"""Packet parser invariants: the 324-byte layout and the FIELDS/_STRUCT
lockstep the whole stack depends on (a mismatch silently corrupts every
frame). Mirrors the round-trip self-test in packet.py as real assertions."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.telemetry.packet import (  # noqa: E402
    FIELDS,
    PACKET_SIZE,
    _STRUCT,
    _TOTAL_VALUES,
    empty_fields,
    pack,
    parse,
)


def test_struct_size_is_packet_size():
    assert _STRUCT.size == PACKET_SIZE


def test_fields_and_struct_stay_in_lockstep():
    # every FIELDS entry maps to exactly the struct's value count
    assert _TOTAL_VALUES == len(_STRUCT.unpack(bytes(PACKET_SIZE)))
    assert _TOTAL_VALUES == sum(count for _, count in FIELDS)


def test_empty_fields_packs_to_full_size():
    assert len(pack(empty_fields())) == PACKET_SIZE


def test_round_trip_scalar_and_wheel_fields():
    f = empty_fields()
    f["is_race_on"] = 1
    f["speed"] = 42.5
    f["tire_combined_slip"] = [0.1, 0.2, 0.3, 0.4]
    f["lap_number"] = 3
    f["steer"] = -100
    f["gear"] = 4

    p = parse(pack(f))

    assert p["is_race_on"] == 1
    assert p["speed"] == pytest.approx(42.5)
    assert p["tire_combined_slip"] == pytest.approx([0.1, 0.2, 0.3, 0.4])
    assert p["lap_number"] == 3
    assert p["steer"] == -100
    assert p["gear"] == 4


def test_wheel_field_wrong_length_raises():
    f = empty_fields()
    f["tire_combined_slip"] = [0.1, 0.2, 0.3]  # a wheel field needs 4 values
    with pytest.raises(ValueError):
        pack(f)


def test_parse_rejects_nothing_but_needs_full_size():
    # parse() unpacks a fixed-size struct; a short buffer must not silently pass
    with pytest.raises(Exception):
        parse(bytes(PACKET_SIZE - 1))
