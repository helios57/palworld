/**
 * Palworld save file parser.
 *
 * Supports:
 * - PlZ format (zlib-compressed GVAS) — decompressed with DecompressionStream in-browser
 * - PlM format (Oodle-Kraken) — detected and reported; user directed to Python CLI
 *
 * After decompression, scans the GVAS binary for CharacterID markers and maps
 * internal IDs to display names.
 */

// Magic bytes for save format detection
const PLZ_MAGIC = 0x506c5a00; // "PlZ\0" — zlib-compressed
const PLM_MAGIC = 0x506c4d00; // "PlM\0" — Oodle-Kraken compressed

// GVAS markers
const CHARACTER_ID_MARKER = "CharacterID";

export type SaveFormat = "PlZ" | "PlM" | "unknown";

export interface ParseResult {
  format: SaveFormat;
  palNames: string[];
  error?: string;
}

/**
 * Read a big-endian uint32 from bytes at offset.
 */
function readU32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
}

/**
 * Decode UTF-8 bytes to string.
 */
function decodeUTF8(bytes: Uint8Array, start: number, length: number): string {
  const decoder = new TextDecoder("utf-8");
  return decoder.decode(bytes.slice(start, start + length));
}

/**
 * Detect the save format by reading the first 4 bytes.
 */
export function detectFormat(bytes: Uint8Array): SaveFormat {
  if (bytes.length < 4) return "unknown";
  const magic = readU32BE(bytes, 0);
  if (magic === PLZ_MAGIC) return "PlZ";
  if (magic === PLM_MAGIC) return "PlM";
  return "unknown";
}

/**
 * Decompress a zlib (deflate) stream. PlZ format has a 4-byte header:
 * uncompressed_size (u32 LE) followed by zlib data from offset 4.
 *
 * Uses the browser's built-in DecompressionStream.
 */
export async function decompressPlZ(bytes: Uint8Array): Promise<Uint8Array> {
  // Skip 4-byte header (uncompressed size)
  const compressed = bytes.slice(4);

  // zlib data: need to strip the 2-byte zlib header if present,
  // DecompressionStream with "deflate-raw" expects raw deflate.
  // zlib format: 2-byte header + raw deflate + 4-byte adler32
  // Try with zlib header first, fall back to deflate-raw

  const decompress = async (
    data: Uint8Array,
    format: CompressionFormat,
  ): Promise<Uint8Array> => {
    const stream = new Blob([data as BlobPart])
      .stream()
      .pipeThrough(new DecompressionStream(format));
    const result = new Uint8Array(await new Response(stream).arrayBuffer());
    return result;
  };

  // Try "deflate-raw" (needs 2-byte zlib header stripped)
  try {
    return await decompress(compressed.slice(2), "deflate-raw");
  } catch {
    // fallback: try full zlib
    try {
      return await decompress(compressed, "deflate-raw");
    } catch {
      throw new Error(
        "Failed to decompress PlZ data. The file may be corrupted.",
      );
    }
  }
}

/**
 * Scan decompressed GVAS bytes for CharacterID markers and extract the following
 * FString value.
 *
 * UE FString format in GVAS:
 *   4 bytes (int32): length — negative = UTF-16, positive = UTF-8/ASCII
 *   data: length bytes (ASCII) or -length * 2 bytes (UTF-16)
 *
 * We search for "CharacterID" text markers and extract the next FString.
 */
export function extractCharacterIds(gvasBytes: Uint8Array): string[] {
  const ids = new Set<string>();

  // Find all occurrences of "CharacterID" in the byte stream
  let searchPos = 0;
  const markerBytes = new TextEncoder().encode(CHARACTER_ID_MARKER);
  const markerLen = markerBytes.length;

  while (searchPos < gvasBytes.length - markerLen - 4) {
    // Search for the marker
    let found = -1;
    for (let i = searchPos; i <= gvasBytes.length - markerLen; i++) {
      let match = true;
      for (let j = 0; j < markerLen; j++) {
        if (gvasBytes[i + j] !== markerBytes[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        found = i;
        break;
      }
    }

    if (found === -1) break;

    // Skip past the marker
    let pos = found + markerLen;

    // The marker "CharacterID" is typically a property name followed by an FString value.
    // UE GVAS property format:
    //   property_name (FString: length + data)
    //   property_type (FString: length + data, e.g. "StrProperty")
    //   padding/terminator (8 bytes)
    //   value_length (int32)
    //   value_data

    // Actually, for our purposes, we just look for a nearby FString that looks like
    // a pal internal ID. The pattern is: CharacterID marker → some metadata → FString value.

    // Scan forward for an FString: 4-byte length followed by printable ASCII
    // Internal pal IDs are like "Kitsunebi", "PinkCat", "Yeti_Grass"
    for (let attempt = 0; attempt < 200; attempt++) {
      if (pos + 4 > gvasBytes.length) break;

      // Read potential FString length (signed int32 LE)
      const len =
        gvasBytes[pos] |
        (gvasBytes[pos + 1] << 8) |
        (gvasBytes[pos + 2] << 16) |
        (gvasBytes[pos + 3] << 24);

      // Valid FString: length between 3 and 100, data is printable ASCII with optional underscores
      if (len > 3 && len < 100 && pos + 4 + len <= gvasBytes.length) {
        // Check if the data looks like an internal pal ID
        let valid = true;
        for (let k = 0; k < len; k++) {
          const c = gvasBytes[pos + 4 + k];
          if (
            !(
              (c >= 0x41 && c <= 0x5a) || // A-Z
              (c >= 0x61 && c <= 0x7a) || // a-z
              (c >= 0x30 && c <= 0x39) || // 0-9
              c === 0x5f
            )
          ) {
            // underscore
            valid = false;
            break;
          }
        }
        if (valid) {
          const value = decodeUTF8(gvasBytes, pos + 4, len);
          // Filter out common false positives from UE metadata
          const falsePositives = new Set([
            "None",
            "Guid",
            "StructProperty",
            "StrProperty",
            "IntProperty",
            "FloatProperty",
            "BoolProperty",
            "ArrayProperty",
            "ByteProperty",
            "ObjectProperty",
            "NameProperty",
            "EnumProperty",
            "TextProperty",
            "SoftObjectProperty",
            "MapProperty",
            "SetProperty",
            "FieldPathProperty",
            "DelegateProperty",
            "MulticastDelegateProperty",
            "InterfaceProperty",
          ]);
          if (!falsePositives.has(value)) {
            ids.add(value);
          }
          break;
        }
      }
      pos++;
    }

    searchPos = found + markerLen;
  }

  return Array.from(ids).sort();
}

/**
 * Map internal IDs (e.g., "Kitsunebi") to display names (e.g., "Foxparks").
 * Falls back to the internal ID with underscores replaced by spaces if no mapping found.
 */
export function mapToDisplayNames(
  internalIds: string[],
  idMap: Record<string, string>,
): string[] {
  return internalIds.map((id) => {
    if (id in idMap) return idMap[id];
    // Try with underscore→space conversion
    const displayName = id.replace(/_/g, " ");
    return displayName;
  });
}

/**
 * Parse a PlZ save file from raw bytes.
 * Returns the list of owned pal display names.
 */
export async function parsePlZSave(
  fileBytes: Uint8Array,
  idMap: Record<string, string>,
): Promise<ParseResult> {
  const format = detectFormat(fileBytes);

  if (format === "PlM") {
    return {
      format: "PlM",
      palNames: [],
      error:
        "PlM (Oodle-Kraken) format is not supported in-browser. " +
        "Please use the Python extract_pals.py tool from the repository " +
        "or upload your pal list via CSV.",
    };
  }

  if (format !== "PlZ") {
    return {
      format: "unknown",
      palNames: [],
      error:
        "Unknown save format. Expected a Palworld .sav file (PlZ or PlM format).",
    };
  }

  try {
    const decompressed = await decompressPlZ(fileBytes);
    const internalIds = extractCharacterIds(decompressed);
    const palNames = mapToDisplayNames(internalIds, idMap);

    return {
      format: "PlZ",
      palNames,
    };
  } catch (err) {
    return {
      format: "PlZ",
      palNames: [],
      error: `Failed to parse save: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
