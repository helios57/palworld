"""Tests for the GVAS layer: SetProperty support and byte-exact round trips.

Palworld 1.0 added a ``SetProperty`` type that palworld-save-tools 0.24.0 does
not know. palsave patches it in; these tests pin the wire format against byte
patterns taken from a real 1.0 ``Level.sav`` and prove a parse/serialise cycle
is lossless, which is what makes editing a save safe.
"""

import os
import struct
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "tools"))

import palsave  # noqa: E402

pytest.importorskip("palworld_save_tools")


def fstr(text: str) -> bytes:
    """GVAS FString: length including the null terminator, then the bytes."""
    raw = text.encode("utf-8")
    return struct.pack("<I", len(raw) + 1) + raw + b"\x00"


GUID_ZERO = b"\x00" * 16
GUID_SAMPLE = bytes(range(16))  # asymmetric, so byte-order bugs show up


def build_setproperty_bytes(count: int = 1) -> bytes:
    """A SetProperty of struct elements, laid out as Palworld 1.0 writes it.

    Mirrors ``worldSaveData.InLockerCharacterInstanceIDArray``.
    """
    element = (
        fstr("PlayerUId")
        + fstr("StructProperty")
        + struct.pack("<Q", 16)      # property size
        + fstr("Guid")               # struct type
        + GUID_ZERO                  # struct id
        + b"\x00"                    # optional guid: absent
        + GUID_SAMPLE                # the guid value
        + fstr("None")               # end of this struct's property list
    )
    body = struct.pack("<II", 0, count) + element * count
    return (
        fstr("InLockerCharacterInstanceIDArray")
        + fstr("SetProperty")
        + struct.pack("<Q", len(body))
        + fstr("StructProperty")     # element type
        + b"\x00"                    # optional guid: absent
        + body
    )


def read_props(data: bytes):
    palsave._install_setproperty_support()
    from palworld_save_tools.archive import FArchiveReader
    from palworld_save_tools.paltypes import PALWORLD_TYPE_HINTS

    return FArchiveReader(data, PALWORLD_TYPE_HINTS, {}).properties_until_end()


def write_props(props) -> bytes:
    palsave._install_setproperty_support()
    from palworld_save_tools.archive import FArchiveWriter

    writer = FArchiveWriter()
    writer.properties(props)
    return writer.bytes()


def test_setproperty_parses_into_expected_shape():
    props = read_props(build_setproperty_bytes() + fstr("None"))
    node = props["InLockerCharacterInstanceIDArray"]
    assert node["type"] == "SetProperty"
    assert node["element_type"] == "StructProperty"
    assert node["num_removed"] == 0
    assert len(node["value"]) == 1
    assert "PlayerUId" in node["value"][0]


def test_setproperty_roundtrips_byte_for_byte():
    original = build_setproperty_bytes() + fstr("None")
    assert write_props(read_props(original)) == original


def test_setproperty_roundtrips_with_multiple_elements():
    original = build_setproperty_bytes(count=3) + fstr("None")
    props = read_props(original)
    assert len(props["InLockerCharacterInstanceIDArray"]["value"]) == 3
    assert write_props(props) == original


def test_empty_setproperty_roundtrips():
    original = build_setproperty_bytes(count=0) + fstr("None")
    props = read_props(original)
    assert props["InLockerCharacterInstanceIDArray"]["value"] == []
    assert write_props(props) == original


def test_setproperty_patch_is_idempotent():
    """Installing twice must not double-wrap the reader/writer."""
    palsave._install_setproperty_support()
    palsave._install_setproperty_support()
    palsave._install_setproperty_support()
    original = build_setproperty_bytes() + fstr("None")
    assert write_props(read_props(original)) == original


def test_ordinary_properties_still_work_after_patching():
    """The patch must delegate every non-SetProperty type untouched."""
    data = (
        fstr("SomeInt") + fstr("IntProperty") + struct.pack("<Q", 4)
        + b"\x00" + struct.pack("<i", 1234)
        + fstr("SomeBool") + fstr("BoolProperty") + struct.pack("<Q", 0)
        + b"\x01" + b"\x00"
        + fstr("None")
    )
    props = read_props(data)
    assert props["SomeInt"]["value"] == 1234
    assert props["SomeBool"]["value"] is True
    assert write_props(props) == data


# ------------------------------------------------------- whole-file layer ---


def build_gvas_file(properties_bytes: bytes) -> bytes:
    """A minimal but structurally valid GVAS file wrapping some properties."""
    return (
        b"GVAS"
        + struct.pack("<iii", 3, 522, 1008)   # save game + package versions
        + struct.pack("<HHHI", 5, 1, 0, 0)    # engine version 5.1.0
        + fstr("++UE5+Release-5.1")
        + struct.pack("<i", 3)                # custom version format
        + struct.pack("<I", 1)                # one custom version
        + GUID_SAMPLE + struct.pack("<i", 7)
        + fstr("PalSaveGameTest")
        + properties_bytes
    )


def test_read_gvas_write_gvas_is_byte_identical():
    raw = build_gvas_file(build_setproperty_bytes() + fstr("None"))
    gvas = palsave.read_gvas(raw)
    assert palsave.write_gvas(gvas) == raw


def test_full_sav_roundtrip_through_plz():
    """sav -> gvas -> edit-free -> sav reproduces the original GVAS bytes."""
    raw = build_gvas_file(build_setproperty_bytes() + fstr("None"))
    blob = palsave.compress_plz(raw)
    recovered, header = palsave.decompress_sav(blob)
    assert recovered == raw
    assert header.format == "PlZ"
    assert palsave.write_gvas(palsave.read_gvas(recovered)) == raw


def test_load_sav_and_save_plz_roundtrip(tmp_path):
    raw = build_gvas_file(build_setproperty_bytes() + fstr("None"))
    src = tmp_path / "Level.sav"
    src.write_bytes(palsave.compress_plz(raw))

    gvas, loaded_raw, header = palsave.load_sav(str(src))
    assert loaded_raw == raw
    assert header.format == "PlZ"

    dst = tmp_path / "Level.out.sav"
    palsave.save_plz(str(dst), gvas)
    again, _ = palsave.decompress_sav(dst.read_bytes())
    assert again == raw


def test_verify_roundtrip_accepts_a_clean_file(tmp_path):
    raw = build_gvas_file(build_setproperty_bytes() + fstr("None"))
    path = tmp_path / "Level.sav"
    path.write_bytes(palsave.compress_plz(raw))
    assert palsave.verify_roundtrip(str(path)) is True
