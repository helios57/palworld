#!/usr/bin/env python3
"""Read and write Palworld 1.0 save files (``Level.sav``).

Palworld 1.0 dedicated servers write ``PlM`` saves, which use Oodle Kraken
compression. Older and single-player saves use ``PlZ`` (zlib). The game still
*reads* ``PlZ``, so this module decompresses either format and writes ``PlZ``;
the server rewrites the file as ``PlM`` on its next autosave.

The module is layered so the cheap parts stay cheap:

* the compression layer needs only ``zlib`` plus ``pyooz`` (for ``PlM``);
* the GVAS layer additionally needs ``palworld-save-tools``, imported lazily.

``palworld-save-tools`` 0.24.0 predates Palworld 1.0 and cannot parse a 1.0
save on its own, so :func:`read_gvas` applies two workarounds:

* ``SetProperty`` (new in 1.0) is taught to the reader/writer, see
  :func:`_install_setproperty_support`;
* every ``RawData`` blob is left as opaque bytes, because several of the
  library's rawdata decoders assume the pre-1.0 layout. Structure is still
  fully walked, so sizes are recomputed correctly on write.

Round-tripping an unmodified save through :func:`read_gvas` /
:func:`write_gvas` reproduces the input byte for byte; ``tests/python``
asserts this on synthetic data and ``verify_roundtrip`` does it on a real file.
"""

from __future__ import annotations

import struct
import zlib
from typing import Any, Iterator, NamedTuple, Optional

PLZ_MAGIC = b"PlZ"
PLM_MAGIC = b"PlM"

#: Save type byte: 0x31 = single compression pass, 0x32 = double.
SAVE_TYPE_SINGLE = 0x31
SAVE_TYPE_DOUBLE = 0x32
VALID_SAVE_TYPES = (0x30, SAVE_TYPE_SINGLE, SAVE_TYPE_DOUBLE)

HEADER_LEN = 12

#: Trailing bytes of a ``PalItemSlotSaveData`` RawData record (dynamic-item
#: payload: durability, passives, ...). All zero for plain stackable items.
SLOT_TAIL_LEN = 52

#: Map object ids for player-built storage. World loot uses ``TreasureBox*``.
PLAYER_CHEST_IDS = frozenset(
    {"ItemChest", "ItemChest_02", "ItemChest_03", "GuildChest", "Box01_Stone"}
)

ITEM_CONTAINER_MODULE = "EPalMapObjectConcreteModelModuleType::ItemContainer"


class SaveHeader(NamedTuple):
    """The 12-byte wrapper in front of the compressed GVAS payload."""

    uncompressed_len: int
    compressed_len: int
    magic: bytes
    save_type: int

    @property
    def format(self) -> str:
        return self.magic.decode("ascii", "replace")


class UnsupportedSaveError(Exception):
    """Raised for files that are not a recognised Palworld save."""


# --------------------------------------------------------------------------
# Compression layer (zlib + Oodle).  No palworld-save-tools needed.
# --------------------------------------------------------------------------


def parse_header(data: bytes) -> SaveHeader:
    """Parse the 12-byte save header. Raises :class:`UnsupportedSaveError`."""
    if len(data) < HEADER_LEN:
        raise UnsupportedSaveError(f"file too short: {len(data)} bytes")
    uncompressed_len, compressed_len = struct.unpack_from("<II", data, 0)
    magic = data[8:11]
    save_type = data[11]
    if magic not in (PLZ_MAGIC, PLM_MAGIC):
        raise UnsupportedSaveError(
            f"not a Palworld save: magic {magic!r}, expected "
            f"{PLZ_MAGIC!r} or {PLM_MAGIC!r}"
        )
    if save_type not in VALID_SAVE_TYPES:
        raise UnsupportedSaveError(f"unknown save type byte: {save_type:#x}")
    return SaveHeader(uncompressed_len, compressed_len, magic, save_type)


def detect_format(data: bytes) -> Optional[str]:
    """Return ``"PlZ"``, ``"PlM"`` or ``None`` without raising."""
    try:
        return parse_header(data).format
    except UnsupportedSaveError:
        return None


def _oodle_decompress(payload: bytes, out_len: int) -> bytes:
    try:
        import ooz  # provided by the `pyooz` package
    except ImportError as exc:  # pragma: no cover - depends on environment
        raise UnsupportedSaveError(
            "this save uses PlM (Oodle Kraken) compression; install the "
            "decompressor with: pip install pyooz"
        ) from exc
    return ooz.decompress(payload, out_len)


def decompress_sav(data: bytes) -> tuple[bytes, SaveHeader]:
    """Decompress a ``.sav`` file to raw GVAS bytes.

    Handles ``PlM`` (Oodle Kraken) and ``PlZ`` (single or double zlib).
    """
    header = parse_header(data)
    payload = data[HEADER_LEN:]
    if header.save_type not in (SAVE_TYPE_SINGLE, SAVE_TYPE_DOUBLE):
        raise UnsupportedSaveError(
            f"unhandled compression type {header.save_type:#x} "
            f"(only 0x31 and 0x32 carry compressed payloads)"
        )
    # For 0x32 the header's second field is the *intermediate* length, not the
    # on-disk payload length, so only 0x31 can be length-checked up front.
    if header.save_type == SAVE_TYPE_SINGLE and header.compressed_len != len(payload):
        raise UnsupportedSaveError(
            f"truncated save: header declares {header.compressed_len} "
            f"compressed bytes, file has {len(payload)}"
        )

    if header.magic == PLM_MAGIC:
        raw = _oodle_decompress(payload, header.uncompressed_len)
    else:
        raw = zlib.decompress(payload)
        if header.save_type == SAVE_TYPE_DOUBLE:
            if header.compressed_len != len(raw):
                raise UnsupportedSaveError(
                    f"double-compressed save: header declares "
                    f"{header.compressed_len} intermediate bytes, got {len(raw)}"
                )
            raw = zlib.decompress(raw)

    if len(raw) != header.uncompressed_len:
        raise UnsupportedSaveError(
            f"decompressed {len(raw)} bytes, header declares "
            f"{header.uncompressed_len}"
        )
    return raw, header


def compress_plz(raw: bytes, save_type: int = SAVE_TYPE_SINGLE, level: int = 6) -> bytes:
    """Wrap raw GVAS bytes as a ``PlZ`` save the game can load."""
    if save_type not in (SAVE_TYPE_SINGLE, SAVE_TYPE_DOUBLE):
        raise ValueError(f"save_type must be 0x31 or 0x32, got {save_type:#x}")
    compressed = zlib.compress(raw, level)
    # The header's second field is the length after the *first* pass, which for
    # 0x31 is also the payload length and for 0x32 is the intermediate length.
    inner_len = len(compressed)
    if save_type == SAVE_TYPE_DOUBLE:
        compressed = zlib.compress(compressed, level)
    return (
        struct.pack("<II", len(raw), inner_len)
        + PLZ_MAGIC
        + bytes([save_type])
        + compressed
    )


# --------------------------------------------------------------------------
# GVAS layer (needs palworld-save-tools)
# --------------------------------------------------------------------------

_setproperty_installed = False


def _install_setproperty_support() -> None:
    """Teach palworld-save-tools the 1.0 ``SetProperty`` type.

    Serialised like ``MapProperty``: element type string, optional guid, a
    ``num_removed`` count, the element count, then the elements. The declared
    property size covers everything from ``num_removed`` onwards.
    """
    global _setproperty_installed
    if _setproperty_installed:
        return
    from palworld_save_tools.archive import FArchiveReader, FArchiveWriter

    orig_read = FArchiveReader.property
    orig_write = FArchiveWriter.property_inner

    def read(self, type_name, size, path, nested_caller_path=""):
        if type_name != "SetProperty" or path in self.custom_properties:
            return orig_read(self, type_name, size, path, nested_caller_path)
        element_type = self.fstring()
        prop_id = self.optional_guid()
        num_removed = self.u32()
        count = self.u32()
        values = []
        for _ in range(count):
            if element_type == "StructProperty":
                values.append(self.properties_until_end(path))
            else:
                values.append(self.prop_value(element_type, "", path))
        return {
            "element_type": element_type,
            "id": prop_id,
            "num_removed": num_removed,
            "value": values,
            "type": type_name,
        }

    def write(self, property_type, prop):
        if property_type != "SetProperty" or "custom_type" in prop:
            return orig_write(self, property_type, prop)
        self.fstring(prop["element_type"])
        self.optional_guid(prop.get("id"))
        body = self.copy()
        body.u32(prop.get("num_removed", 0))
        body.u32(len(prop["value"]))
        for item in prop["value"]:
            if prop["element_type"] == "StructProperty":
                body.properties(item)
            else:
                body.prop_value(prop["element_type"], "", item)
        buf = body.bytes()
        self.write(buf)
        return len(buf)

    FArchiveReader.property = read
    FArchiveWriter.property_inner = write
    _setproperty_installed = True


def read_gvas(raw: bytes, quiet: bool = True):
    """Parse raw GVAS bytes into a ``GvasFile``.

    All ``RawData`` blobs stay as opaque byte lists (see module docstring), so
    the result round-trips byte for byte through :func:`write_gvas`.
    """
    import contextlib
    import io

    _install_setproperty_support()
    from palworld_save_tools.gvas import GvasFile
    from palworld_save_tools.paltypes import PALWORLD_TYPE_HINTS

    ctx = contextlib.redirect_stdout(io.StringIO()) if quiet else contextlib.nullcontext()
    with ctx:
        return GvasFile.read(raw, PALWORLD_TYPE_HINTS, {}, allow_nan=True)


def write_gvas(gvas) -> bytes:
    """Serialise a ``GvasFile`` back to raw GVAS bytes."""
    _install_setproperty_support()
    return gvas.write({})


def load_sav(path: str, quiet: bool = True):
    """Read a ``.sav`` from disk. Returns ``(gvas, raw_bytes, header)``."""
    with open(path, "rb") as fh:
        data = fh.read()
    raw, header = decompress_sav(data)
    return read_gvas(raw, quiet=quiet), raw, header


def save_plz(path: str, gvas, save_type: int = SAVE_TYPE_SINGLE) -> int:
    """Serialise ``gvas`` and write it to ``path`` as a ``PlZ`` save."""
    blob = compress_plz(write_gvas(gvas), save_type)
    with open(path, "wb") as fh:
        fh.write(blob)
    return len(blob)


def verify_roundtrip(path: str) -> bool:
    """True if parsing and re-serialising ``path`` reproduces it exactly.

    Worth running once against your own save before trusting an edit.
    """
    gvas, raw, _ = load_sav(path)
    return write_gvas(gvas) == raw


# --------------------------------------------------------------------------
# Item slots
# --------------------------------------------------------------------------


class ItemSlot(NamedTuple):
    """One decoded ``PalItemSlotSaveData`` RawData record."""

    index: int
    count: int
    static_id: str
    tail: bytes

    @property
    def empty(self) -> bool:
        return not self.static_id


def decode_slot(blob: bytes) -> ItemSlot:
    """Decode a slot RawData blob.

    Layout: ``u32 slot_index | u32 stack_count | fstring static_id | tail``.
    """
    if len(blob) < 12:
        raise ValueError(f"slot blob too short: {len(blob)} bytes")
    index, count, name_len = struct.unpack_from("<III", blob, 0)
    if name_len < 0 or 12 + name_len > len(blob):
        raise ValueError(f"bad static_id length {name_len} in {len(blob)}-byte slot")
    static_id = blob[12 : 12 + name_len].rstrip(b"\x00").decode("utf-8") if name_len else ""
    return ItemSlot(index, count, static_id, blob[12 + name_len :])


def encode_slot(
    index: int, count: int, static_id: str, tail: bytes = b"\x00" * SLOT_TAIL_LEN
) -> bytes:
    """Encode a slot RawData blob. Inverse of :func:`decode_slot`."""
    name = static_id.encode("utf-8") + b"\x00" if static_id else b""
    return struct.pack("<III", index, count, len(name)) + name + tail


# --------------------------------------------------------------------------
# World navigation helpers
# --------------------------------------------------------------------------


def world(gvas) -> dict[str, Any]:
    """The ``worldSaveData`` value dict."""
    return gvas.properties["worldSaveData"]["value"]


def raw_bytes(node: dict[str, Any]) -> bytes:
    """Bytes of a ``RawData``-style ArrayProperty node."""
    return bytes(node["value"]["values"])


def set_raw_bytes(node: dict[str, Any], blob: bytes) -> None:
    """Replace the bytes of a ``RawData``-style ArrayProperty node."""
    node["value"]["values"] = list(blob)


def _guid_at(blob: bytes, offset: int) -> str:
    from palworld_save_tools.archive import FArchiveReader

    return str(FArchiveReader(blob[offset : offset + 16]).guid())


def containers(gvas) -> dict[str, dict[str, Any]]:
    """Map container guid -> ``ItemContainerSaveData`` entry."""
    return {
        str(entry["key"]["ID"]["value"]): entry
        for entry in world(gvas)["ItemContainerSaveData"]["value"]
    }


def container_slots(entry: dict[str, Any]) -> list[dict[str, Any]]:
    """The raw slot dicts of a container entry (only occupied slots exist)."""
    return entry["value"]["Slots"]["value"]["values"]


def slot_num(entry: dict[str, Any]) -> int:
    """Declared capacity of a container."""
    return entry["value"]["SlotNum"]["value"]


def read_slots(entry: dict[str, Any]) -> list[ItemSlot]:
    """Decoded slots of a container, in stored order."""
    return [decode_slot(raw_bytes(s["RawData"])) for s in container_slots(entry)]


class Addition(NamedTuple):
    """One planned new stack: which free slot, which item, how many."""

    slot: int
    static_id: str
    count: int


def plan_additions(
    entry: dict[str, Any],
    requests: list[tuple[str, int]],
    max_stack: int = 9999,
) -> list[Addition]:
    """Work out which free slots to use for ``(item, quantity)`` requests.

    Quantities larger than ``max_stack`` are split across several slots. Does
    not mutate ``entry``; raises :class:`ValueError` if the container runs out
    of slots or a quantity is not positive.
    """
    capacity = slot_num(entry)
    used = {slot.index for slot in read_slots(entry)}
    free = [i for i in range(capacity) if i not in used]
    plan: list[Addition] = []

    for static_id, quantity in requests:
        if quantity <= 0:
            raise ValueError(f"quantity for {static_id} must be positive, got {quantity}")
        remaining = quantity
        while remaining > 0:
            if not free:
                raise ValueError(
                    f"container is full: {capacity} slots, "
                    f"{len(plan)} new stacks placed, {remaining} x {static_id} left over"
                )
            take = min(remaining, max_stack)
            plan.append(Addition(free.pop(0), static_id, take))
            remaining -= take
    return plan


def apply_additions(entry: dict[str, Any], plan: list[Addition]) -> None:
    """Append the planned stacks to a container, keeping slots index-ordered.

    New slot dicts are cloned from an existing slot so they inherit the
    container's ``CustomVersionData``.
    """
    import copy

    slots = container_slots(entry)
    if not slots:
        raise ValueError("cannot add to a container with no existing slot to clone")
    for addition in plan:
        new_slot = copy.deepcopy(slots[0])
        set_raw_bytes(
            new_slot["RawData"],
            encode_slot(addition.slot, addition.count, addition.static_id),
        )
        slots.append(new_slot)
    slots.sort(key=lambda s: decode_slot(raw_bytes(s["RawData"])).index)


def map_objects(gvas) -> list[dict[str, Any]]:
    return world(gvas)["MapObjectSaveData"]["value"]["values"]


def map_object_base_id(map_object: dict[str, Any]) -> str:
    """Guid of the base camp a placed object belongs to (zeros if none).

    ``Model.RawData`` starts with instance_id, concrete_model_instance_id,
    base_camp_id_belong_to, group_id_belong_to - four guids.
    """
    return _guid_at(raw_bytes(map_object["Model"]["value"]["RawData"]), 32)


def map_object_container_id(map_object: dict[str, Any]) -> Optional[str]:
    """Guid of the object's item container, if it has one."""
    for module in map_object["ConcreteModel"]["value"]["ModuleMap"]["value"]:
        if module["key"] == ITEM_CONTAINER_MODULE:
            return _guid_at(raw_bytes(module["value"]["RawData"]), 0)
    return None


class Chest(NamedTuple):
    base_id: str
    map_object_id: str
    container_id: str


def iter_chests(gvas, chest_ids: frozenset = PLAYER_CHEST_IDS) -> Iterator[Chest]:
    """Yield every player-built storage chest in the world."""
    known = containers(gvas)
    for map_object in map_objects(gvas):
        if map_object["MapObjectId"]["value"] not in chest_ids:
            continue
        container_id = map_object_container_id(map_object)
        if container_id is None or container_id not in known:
            continue
        yield Chest(
            map_object_base_id(map_object),
            map_object["MapObjectId"]["value"],
            container_id,
        )


def main_base_id(gvas) -> Optional[str]:
    """Guid of the base camp with the most placed objects.

    That is reliably the base you actually live in; outposts have far fewer.
    """
    counts: dict[str, int] = {}
    for map_object in map_objects(gvas):
        base = map_object_base_id(map_object)
        if base == "00000000-0000-0000-0000-000000000000":
            continue
        counts[base] = counts.get(base, 0) + 1
    if not counts:
        return None
    return max(counts, key=lambda k: counts[k])
