"""Tests for the Palworld save tooling.

Everything here runs on synthetic data built in-process. No real savegame is
committed to the repository, and none is needed.
"""

import os
import struct
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "tools"))

import palsave  # noqa: E402


# ---------------------------------------------------------------- header ---


def test_parse_header_reads_plz_fields():
    blob = struct.pack("<II", 1000, 40) + b"PlZ" + bytes([0x31]) + b"x" * 40
    header = palsave.parse_header(blob)
    assert header.uncompressed_len == 1000
    assert header.compressed_len == 40
    assert header.magic == b"PlZ"
    assert header.save_type == 0x31
    assert header.format == "PlZ"


def test_parse_header_reads_plm():
    blob = struct.pack("<II", 42831595, 2604183) + b"PlM" + bytes([0x31])
    header = palsave.parse_header(blob)
    assert header.format == "PlM"
    assert header.uncompressed_len == 42831595


@pytest.mark.parametrize(
    "blob",
    [
        b"",
        b"short",
        struct.pack("<II", 10, 10) + b"XYZ" + bytes([0x31]),          # bad magic
        struct.pack("<II", 10, 10) + b"PlZ" + bytes([0x99]),          # bad save type
    ],
)
def test_parse_header_rejects_junk(blob):
    with pytest.raises(palsave.UnsupportedSaveError):
        palsave.parse_header(blob)


def test_detect_format_returns_none_instead_of_raising():
    assert palsave.detect_format(b"not a save at all") is None
    assert palsave.detect_format(
        struct.pack("<II", 1, 1) + b"PlM" + bytes([0x31])
    ) == "PlM"


# ----------------------------------------------------------- compression ---


def test_plz_single_roundtrip():
    payload = b"GVAS" + os.urandom(64) + b"padding" * 100
    blob = palsave.compress_plz(payload, palsave.SAVE_TYPE_SINGLE)
    assert blob[8:11] == b"PlZ"
    assert blob[11] == 0x31
    raw, header = palsave.decompress_sav(blob)
    assert raw == payload
    assert header.uncompressed_len == len(payload)
    # for single compression the declared length is the on-disk payload length
    assert header.compressed_len == len(blob) - palsave.HEADER_LEN


def test_plz_double_roundtrip():
    payload = b"GVAS" + (b"compress me " * 500)
    blob = palsave.compress_plz(payload, palsave.SAVE_TYPE_DOUBLE)
    assert blob[11] == 0x32
    raw, header = palsave.decompress_sav(blob)
    assert raw == payload
    # for double compression it is the *intermediate* length, not the payload
    assert header.compressed_len != len(blob) - palsave.HEADER_LEN


def test_decompress_rejects_truncated_payload():
    payload = b"GVAS" + b"x" * 500
    blob = bytearray(palsave.compress_plz(payload))
    del blob[-5:]
    with pytest.raises(palsave.UnsupportedSaveError, match="truncated"):
        palsave.decompress_sav(bytes(blob))


def test_decompress_rejects_uncompressed_save_type():
    blob = struct.pack("<II", 4, 4) + b"PlZ" + bytes([0x30]) + b"GVAS"
    with pytest.raises(palsave.UnsupportedSaveError, match="unhandled compression"):
        palsave.decompress_sav(blob)


def test_compress_plz_rejects_bad_save_type():
    with pytest.raises(ValueError):
        palsave.compress_plz(b"data", 0x30)


def test_plm_without_pyooz_gives_actionable_error(monkeypatch):
    """A PlM save must never fail with a bare ImportError."""
    real_import = __builtins__["__import__"] if isinstance(__builtins__, dict) \
        else __builtins__.__import__

    def fake_import(name, *args, **kwargs):
        if name == "ooz":
            raise ImportError("no module named ooz")
        return real_import(name, *args, **kwargs)

    monkeypatch.setitem(sys.modules, "ooz", None)
    monkeypatch.delitem(sys.modules, "ooz")
    monkeypatch.setattr("builtins.__import__", fake_import)
    blob = struct.pack("<II", 100, 4) + b"PlM" + bytes([0x31]) + b"data"
    with pytest.raises(palsave.UnsupportedSaveError, match="pip install pyooz"):
        palsave.decompress_sav(blob)


# ----------------------------------------------------------- item slots ---


def test_decode_slot_matches_real_layout():
    """Byte pattern taken from a real 1.0 container (Money x823 in slot 0)."""
    blob = (
        struct.pack("<III", 0, 823, 6) + b"Money\x00" + b"\x00" * palsave.SLOT_TAIL_LEN
    )
    slot = palsave.decode_slot(blob)
    assert slot.index == 0
    assert slot.count == 823
    assert slot.static_id == "Money"
    assert len(slot.tail) == palsave.SLOT_TAIL_LEN
    assert not slot.empty


@pytest.mark.parametrize(
    "index,count,static_id",
    [
        (0, 1, "Wood"),
        (23, 9999, "AIcore"),
        (7, 12, "Thermal_Core"),
        (10, 9999, "AncientParts2"),
        (3, 2, "WorkSuitability_AddTicket_Seeding"),
    ],
)
def test_slot_encode_decode_roundtrip(index, count, static_id):
    blob = palsave.encode_slot(index, count, static_id)
    slot = palsave.decode_slot(blob)
    assert (slot.index, slot.count, slot.static_id) == (index, count, static_id)
    assert palsave.encode_slot(*slot) == blob


def test_encoded_slot_length_matches_formula():
    blob = palsave.encode_slot(8, 9999, "AIcore")
    # u32 index + u32 count + u32 strlen + "AIcore\0" + tail
    assert len(blob) == 4 + 4 + 4 + 7 + palsave.SLOT_TAIL_LEN


def test_empty_slot_has_zero_length_id():
    blob = palsave.encode_slot(5, 0, "")
    slot = palsave.decode_slot(blob)
    assert slot.empty and slot.static_id == "" and slot.index == 5
    assert palsave.decode_slot(palsave.encode_slot(*slot)) == slot


def test_slot_tail_is_preserved_verbatim():
    """Dynamic-item payloads (durability etc.) must survive a rewrite."""
    tail = bytes(range(palsave.SLOT_TAIL_LEN))
    slot = palsave.decode_slot(palsave.encode_slot(1, 1, "Sword", tail))
    assert slot.tail == tail


@pytest.mark.parametrize("blob", [b"", b"\x00" * 8, struct.pack("<III", 0, 0, 999)])
def test_decode_slot_rejects_malformed(blob):
    with pytest.raises(ValueError):
        palsave.decode_slot(blob)


# ------------------------------------------------------- addition planning --


def _fake_container(capacity, occupied):
    """Minimal container entry shaped like the real GVAS structure."""
    slots = [
        {
            "RawData": {"value": {"values": list(palsave.encode_slot(i, 1, name))}},
            "CustomVersionData": {"value": {"values": [1, 2, 3]}},
        }
        for i, name in occupied
    ]
    return {
        "key": {"ID": {"value": "test-container"}},
        "value": {
            "Slots": {"value": {"values": slots}},
            "SlotNum": {"value": capacity},
        },
    }


def test_plan_uses_lowest_free_slots():
    entry = _fake_container(24, [(0, "Cloth"), (1, "Wool"), (2, "Leather")])
    plan = palsave.plan_additions(entry, [("AIcore", 9999)])
    assert plan == [palsave.Addition(3, "AIcore", 9999)]


def test_plan_fills_gaps_not_just_the_tail():
    entry = _fake_container(10, [(0, "Cloth"), (3, "Wool")])
    plan = palsave.plan_additions(entry, [("AIcore", 1), ("Ore", 1), ("Bone", 1)])
    assert [a.slot for a in plan] == [1, 2, 4]


def test_plan_splits_quantities_over_the_stack_cap():
    entry = _fake_container(10, [])
    plan = palsave.plan_additions(entry, [("AIcore", 25000)], max_stack=9999)
    assert [a.count for a in plan] == [9999, 9999, 5002]
    assert sum(a.count for a in plan) == 25000
    assert [a.slot for a in plan] == [0, 1, 2]


def test_plan_handles_multiple_items():
    entry = _fake_container(24, [(i, "X") for i in range(8)])
    plan = palsave.plan_additions(
        entry, [("AIcore", 9999), ("Thermal_Core", 9999), ("AncientParts2", 9999)]
    )
    assert [(a.slot, a.static_id) for a in plan] == [
        (8, "AIcore"), (9, "Thermal_Core"), (10, "AncientParts2")
    ]


def test_plan_raises_when_container_is_full():
    entry = _fake_container(4, [(i, "X") for i in range(4)])
    with pytest.raises(ValueError, match="container is full"):
        palsave.plan_additions(entry, [("AIcore", 1)])


def test_plan_raises_when_quantity_exceeds_remaining_space():
    entry = _fake_container(3, [(0, "X")])
    with pytest.raises(ValueError, match="container is full"):
        palsave.plan_additions(entry, [("AIcore", 30000)], max_stack=9999)


@pytest.mark.parametrize("quantity", [0, -5])
def test_plan_rejects_non_positive_quantities(quantity):
    entry = _fake_container(10, [])
    with pytest.raises(ValueError, match="must be positive"):
        palsave.plan_additions(entry, [("AIcore", quantity)])


def test_plan_does_not_mutate_the_container():
    entry = _fake_container(10, [(0, "Cloth")])
    before = len(palsave.container_slots(entry))
    palsave.plan_additions(entry, [("AIcore", 9999)])
    assert len(palsave.container_slots(entry)) == before


def test_apply_additions_writes_ordered_slots():
    entry = _fake_container(10, [(0, "Cloth"), (5, "Wool")])
    plan = palsave.plan_additions(entry, [("AIcore", 9999), ("Ore", 3)])
    palsave.apply_additions(entry, plan)
    slots = palsave.read_slots(entry)
    assert [s.index for s in slots] == sorted(s.index for s in slots)
    got = {(s.index, s.static_id, s.count) for s in slots}
    assert (1, "AIcore", 9999) in got
    assert (2, "Ore", 3) in got
    assert (0, "Cloth", 1) in got and (5, "Wool", 1) in got


def test_apply_additions_inherits_custom_version_data():
    entry = _fake_container(10, [(0, "Cloth")])
    palsave.apply_additions(entry, palsave.plan_additions(entry, [("AIcore", 1)]))
    blobs = {
        tuple(s["CustomVersionData"]["value"]["values"])
        for s in palsave.container_slots(entry)
    }
    assert len(blobs) == 1, "new slot must reuse the container's CustomVersionData"


def test_apply_additions_needs_a_slot_to_clone():
    entry = _fake_container(10, [])
    with pytest.raises(ValueError, match="no existing slot"):
        palsave.apply_additions(entry, [palsave.Addition(0, "AIcore", 1)])


def test_read_slots_and_slot_num_read_the_structure():
    entry = _fake_container(24, [(0, "Cloth"), (1, "Wool")])
    assert palsave.slot_num(entry) == 24
    assert [s.static_id for s in palsave.read_slots(entry)] == ["Cloth", "Wool"]
