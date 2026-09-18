#!/usr/bin/env python3
"""Extract owned pal names from a Palworld save file.

Supports PlZ (zlib) and PlM (Oodle Kraken) saves. PlM is what Palworld 1.0
dedicated servers write and needs the ``pyooz`` package; see
``tools/requirements.txt``. Decompression is handled by :mod:`palsave`, which
needs no GVAS parser, so this script stays dependency-light.
"""

import argparse
import json
import os
import re
import struct
import sys
import zlib

import palsave

# Path to project data directory (script lives in tools/)
_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")


def load_internal_id_map():
    """Load the internal-ID → display-name mapping."""
    path = os.path.join(_DATA_DIR, "internal_id_map.json")
    if not os.path.exists(path):
        print(f"ERROR: internal_id_map.json not found at {path}", file=sys.stderr)
        sys.exit(1)
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)
    # Replace underscores with spaces in display names for readability
    return {k: v.replace("_", " ") for k, v in raw.items()}


def load_known_ids():
    """Return a set of known internal CharacterIDs from the map + pals.json."""
    id_map = load_internal_id_map()
    known = set(id_map.keys())

    # Also pull keys from pals.json as a secondary source
    pals_path = os.path.join(_DATA_DIR, "pals.json")
    if os.path.exists(pals_path):
        with open(pals_path, "r", encoding="utf-8") as f:
            pals = json.load(f)
        known.update(pals.keys())

    return known, id_map


def detect_format(filepath):
    """Detect save format from the file header.

    Returns "PlZ", "PlM", or None if unrecognized.
    """
    with open(filepath, "rb") as f:
        return palsave.detect_format(f.read(palsave.HEADER_LEN))


def extract_character_ids_from_gvas(data):
    """Extract CharacterID values from decompressed GVAS binary data.

    Scans for ``CharacterID`` property markers followed by StrProperty
    FString values using the Unreal Engine GVAS serialisation format.

    Returns a set of unique CharacterID strings (e.g. "Kitsunebi").
    """
    ids = set()
    pattern = b"CharacterID\x00"
    pos = 0

    while True:
        idx = data.find(pattern, pos)
        if idx == -1:
            break

        # We are at the start of the property name FString "CharacterID\0"
        # The FString for the name would be: [4-byte LE len=13]["CharacterID\0"]
        # Move past the null terminator of the name
        seek = idx + len(pattern)

        # Next comes the type FString: "StrProperty\0"
        # FString format: 4-byte LE length, then text + null
        if seek + 4 > len(data):
            pos = idx + 1
            continue

        type_len = struct.unpack_from("<i", data, seek)[0]
        if type_len <= 0 or type_len > 256:
            pos = idx + 1
            continue

        seek += 4
        if seek + type_len > len(data):
            pos = idx + 1
            continue

        type_name = data[seek : seek + type_len - 1].decode("utf-8", errors="ignore")
        seek += type_len

        if type_name != "StrProperty":
            # Some IDs may be stored under different property types; skip
            pos = idx + 1
            continue

        # After StrProperty FString: 8 bytes padding/size (int64), then 4 bytes array index (int32)
        # The 8-byte size field represents the value length; skip both
        seek += 8  # padding (the property size)
        if seek + 4 > len(data):
            pos = idx + 1
            continue
        # skip array index (int32, typically 0)
        seek += 4

        # Now read the value FString: 4-byte LE length, then text + null
        if seek + 4 > len(data):
            pos = idx + 1
            continue

        val_len = struct.unpack_from("<i", data, seek)[0]
        seek += 4

        # val_len includes the null terminator for positive lengths
        if val_len <= 0 or val_len > 256:
            pos = idx + 1
            continue

        if seek + val_len > len(data):
            pos = idx + 1
            continue

        # Extract string (exclude null terminator)
        raw = data[seek : seek + val_len - 1]
        try:
            char_id = raw.decode("utf-8", errors="ignore")
            if char_id and re.match(r"^[A-Za-z][A-Za-z0-9_]*$", char_id):
                ids.add(char_id)
        except UnicodeDecodeError:
            pass

        pos = idx + 1

    return ids


def decompress_save(filepath):
    """Decompress a save file to raw GVAS bytes, or exit with a clear error.

    Handles both PlZ and PlM via :mod:`palsave`, falling back to a scan of
    likely zlib offsets for files with an unusual wrapper.
    """
    with open(filepath, "rb") as f:
        data = f.read()

    try:
        raw, _header = palsave.decompress_sav(data)
        return raw
    except palsave.UnsupportedSaveError as exc:
        reason = str(exc)

    # Fallback: a bare or oddly wrapped zlib stream.
    for offset in (0, 4, 8, 11, 12):
        try:
            return zlib.decompress(data[offset:])
        except Exception:
            continue

    print(f"ERROR: could not decompress {filepath}: {reason}", file=sys.stderr)
    sys.exit(1)


def extract_pals_from_save(filepath, known_ids):
    """Extract CharacterIDs from a save file.

    Returns a sorted list of unique CharacterID strings found.
    """
    decompressed = decompress_save(filepath)

    # Extract CharacterIDs from the GVAS data
    ids = extract_character_ids_from_gvas(decompressed)

    if not ids:
        # Fallback: scan the entire decompressed data for strings that match
        # known CharacterID patterns
        ids = fallback_scan(decompressed, known_ids)

    return sorted(ids)


def fallback_scan(data, known_ids):
    """Fallback: scan binary data for strings matching known CharacterIDs.

    This is used when the structured GVAS parser finds nothing, which can
    happen with unusual save file layouts.
    """
    # Common false positives from GVAS headers / UE metadata
    FALSE_POSITIVES = {
        "GVAS", "None", "Property", "StructProperty", "ArrayProperty",
        "StrProperty", "IntProperty", "BoolProperty", "FloatProperty",
        "MapProperty", "ByteProperty", "NameProperty", "ObjectProperty",
        "EnumProperty", "TextProperty", "SoftObjectProperty",
    }

    ids = set()
    # Scan for all printable ASCII strings that look like identifiers
    for match in re.finditer(rb"[A-Z][a-zA-Z0-9_]{2,40}", data):
        s = match.group(0).decode("ascii")
        if s in FALSE_POSITIVES:
            continue
        # Must contain at least one lowercase letter (real pal IDs are CamelCase)
        if not any(c.islower() for c in s) and s not in known_ids:
            continue
        # Check if this looks like a CharacterID (known or follows naming convention)
        if s in known_ids or (
            s[0].isupper() and not s.startswith("BP_")
        ):
            ids.add(s)

    # If we got too many candidates, restrict to known IDs only
    if len(ids) > 500:
        ids = {s for s in ids if s in known_ids}

    return ids


def map_to_display_names(character_ids, id_map):
    """Map internal CharacterIDs to display names.

    Falls back to the CharacterID itself (with underscores → spaces) if
    no mapping is found.
    """
    results = []
    for cid in character_ids:
        if cid in id_map:
            results.append(id_map[cid])
        else:
            # Fallback: human-readable version of the internal ID
            results.append(cid.replace("_", " "))
    return results


def run(filepath, output_path=None, json_output=False):
    """Main entry point: detect format, extract, and output pal names."""
    if not os.path.exists(filepath):
        print(f"ERROR: File not found: {filepath}", file=sys.stderr)
        sys.exit(1)

    known_ids, id_map = load_known_ids()
    character_ids = extract_pals_from_save(filepath, known_ids)
    display_names = map_to_display_names(character_ids, id_map)

    if json_output:
        out = json.dumps(display_names, indent=2, ensure_ascii=False)
    else:
        out = "\n".join(display_names)

    if output_path:
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(out)
            if not json_output:
                f.write("\n")
        print(f"Wrote {len(display_names)} pal names to {output_path}")
    else:
        print(out)


def main():
    parser = argparse.ArgumentParser(
        description="Extract owned pal names from a Palworld save file.",
    )
    parser.add_argument(
        "-f",
        "--file",
        required=True,
        help="Path to the save file (e.g. Level.sav)",
    )
    parser.add_argument(
        "-o",
        "--output",
        default=None,
        help="Write output to file instead of stdout",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        dest="json_output",
        help="Output as a JSON array",
    )
    args = parser.parse_args()
    run(args.file, output_path=args.output, json_output=args.json_output)


if __name__ == "__main__":
    main()
