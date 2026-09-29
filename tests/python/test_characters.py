"""Tests for character records and player level editing.

``CharacterSaveParameterMap`` RawData is a GVAS property list followed by an
opaque tail whose length changed in 1.0. These tests build such blobs
in-process; no savegame is needed or committed.
"""

import os
import struct
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "tools"))

import palsave  # noqa: E402

pytest.importorskip("palworld_save_tools")

# 1.0 characters carry 24 trailing bytes; the library assumes 20 and raises.
REAL_TAIL_LEN = 24


def build_character(level=10, exp=1234, is_player=True, nickname="Tester",
                    tail_len=REAL_TAIL_LEN):
    """A character RawData blob shaped like the real thing."""
    from palworld_save_tools.archive import FArchiveWriter

    param = {
        "NickName": {"id": None, "value": nickname, "type": "StrProperty"},
        # Level is a ByteProperty, so its value is a nested {type, value}
        "Level": {"id": None, "value": {"type": "None", "value": level},
                  "type": "ByteProperty"},
        "Exp": {"id": None, "value": exp, "type": "Int64Property"},
        "IsPlayer": {"id": None, "value": is_player, "type": "BoolProperty"},
    }
    if not is_player:
        del param["IsPlayer"]
        del param["NickName"]
    props = {
        "SaveParameter": {
            "struct_type": "PalIndividualCharacterSaveParameter",
            "struct_id": "00000000-0000-0000-0000-000000000000",
            "id": None,
            "value": param,
            "type": "StructProperty",
        }
    }
    writer = FArchiveWriter()
    writer.properties(props)
    return writer.bytes() + bytes(range(tail_len))


def test_decode_character_splits_properties_and_tail():
    blob = build_character(level=42, exp=999)
    props, tail = palsave.decode_character(blob)
    assert len(tail) == REAL_TAIL_LEN
    assert tail == bytes(range(REAL_TAIL_LEN))
    param = palsave.save_parameter(props)
    assert param["Level"]["value"]["value"] == 42
    assert param["Exp"]["value"] == 999


def test_character_roundtrip_is_byte_identical():
    blob = build_character()
    props, tail = palsave.decode_character(blob)
    assert palsave.encode_character(props, tail) == blob


@pytest.mark.parametrize("tail_len", [0, 4, 20, 24, 40])
def test_character_roundtrip_for_any_tail_length(tail_len):
    """The tail is opaque, so its length must not matter."""
    blob = build_character(tail_len=tail_len)
    props, tail = palsave.decode_character(blob)
    assert len(tail) == tail_len
    assert palsave.encode_character(props, tail) == blob


def test_save_parameter_of_unknown_shape_is_empty():
    assert palsave.save_parameter({}) == {}


# --------------------------------------------------------------- players ---


def _fake_gvas(characters):
    """A stand-in exposing just what iter_players touches."""
    class G:
        properties = {
            "worldSaveData": {
                "value": {
                    "CharacterSaveParameterMap": {
                        "value": [
                            {
                                "key": {"PlayerUId": {"value": uid}},
                                "value": {
                                    "RawData": {"value": {"values": list(blob)}}
                                },
                            }
                            for uid, blob in characters
                        ]
                    }
                }
            }
        }
    return G()


def test_iter_players_skips_pals():
    gvas = _fake_gvas([
        ("uid-player", build_character(level=70, exp=100, nickname="Hero")),
        ("uid-pal", build_character(is_player=False, level=5, exp=10)),
    ])
    players = list(palsave.iter_players(gvas))
    assert [p.nickname for p in players] == ["Hero"]
    assert players[0].level == 70
    assert players[0].exp == 100
    assert players[0].uid == "uid-player"


def test_set_player_level_updates_level_and_exp():
    gvas = _fake_gvas([("uid", build_character(level=64, exp=10_160_214))])
    player = next(palsave.iter_players(gvas))
    palsave.set_player_level(player, 80, palsave.PLAYER_EXP_AT_MAX_LEVEL)
    after = next(palsave.iter_players(gvas))
    assert after.level == 80
    assert after.exp == palsave.PLAYER_EXP_AT_MAX_LEVEL


def test_set_player_level_does_not_change_record_size():
    """Level is a ByteProperty and Exp an Int64Property: both fixed width.

    If this ever fails, enclosing property sizes would need recomputing.
    """
    gvas = _fake_gvas([("uid", build_character(level=1, exp=0))])
    entry = gvas.properties["worldSaveData"]["value"][
        "CharacterSaveParameterMap"]["value"][0]
    before = len(entry["value"]["RawData"]["value"]["values"])
    palsave.set_player_level(next(palsave.iter_players(gvas)), 80,
                             palsave.PLAYER_EXP_AT_MAX_LEVEL)
    assert len(entry["value"]["RawData"]["value"]["values"]) == before


def test_set_player_level_preserves_the_tail_and_other_fields():
    gvas = _fake_gvas([("uid", build_character(level=64, exp=1, nickname="Keep"))])
    palsave.set_player_level(next(palsave.iter_players(gvas)), 80, 42)
    entry = gvas.properties["worldSaveData"]["value"][
        "CharacterSaveParameterMap"]["value"][0]
    blob = bytes(entry["value"]["RawData"]["value"]["values"])
    props, tail = palsave.decode_character(blob)
    assert tail == bytes(range(REAL_TAIL_LEN))
    assert palsave.save_parameter(props)["NickName"]["value"] == "Keep"


def test_set_player_level_refuses_a_pal():
    gvas = _fake_gvas([("uid", build_character(is_player=False))])
    fake = palsave.PlayerRecord(
        uid="uid", nickname="notaplayer", level=5, exp=0,
        entry=gvas.properties["worldSaveData"]["value"][
            "CharacterSaveParameterMap"]["value"][0],
    )
    with pytest.raises(ValueError, match="not a player"):
        palsave.set_player_level(fake, 80, 1)


@pytest.mark.parametrize("level", [0, -1, 256, 1000])
def test_set_player_level_rejects_out_of_byte_range(level):
    gvas = _fake_gvas([("uid", build_character())])
    player = next(palsave.iter_players(gvas))
    with pytest.raises(ValueError, match="byte"):
        palsave.set_player_level(player, level, 1)


def test_set_player_level_rejects_negative_exp():
    gvas = _fake_gvas([("uid", build_character())])
    player = next(palsave.iter_players(gvas))
    with pytest.raises(ValueError, match="negative"):
        palsave.set_player_level(player, 80, -1)


def test_max_level_constants_are_consistent():
    """Cap and its exp threshold, cross-checked against published 1.0 tables."""
    assert palsave.PLAYER_MAX_LEVEL == 80
    assert palsave.PLAYER_EXP_AT_MAX_LEVEL == 45_859_908
    # a real level-77 player had 36,970,459 exp, which must sit below the cap
    assert 36_970_459 < palsave.PLAYER_EXP_AT_MAX_LEVEL
