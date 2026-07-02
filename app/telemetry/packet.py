"""Parser for the Forza Horizon 6 "Data Out" UDP packet.

FH6 sends a fixed 324-byte little-endian packet once per rendered frame.
The layout is FH5's 324-byte "Dash" format; the FH-specific block at
offsets 232-243 is officially named CarGroup / SmashableVelDiff /
SmashableMass in the FH6 Data Out documentation. The final byte
(offset 323) is undocumented padding, present since FH4.

Wheel arrays are ordered FL, FR, RL, RR.
"""

from __future__ import annotations

import struct

PACKET_SIZE = 324

_STRUCT = struct.Struct(
    "<"
    "i"    # IsRaceOn (0 in menus / photo mode)
    "I"    # TimestampMS
    "3f"   # EngineMaxRpm, EngineIdleRpm, CurrentEngineRpm
    "3f"   # AccelerationX/Y/Z (car-local, m/s^2; X=right, Y=up, Z=forward)
    "3f"   # VelocityX/Y/Z
    "3f"   # AngularVelocityX/Y/Z
    "3f"   # Yaw, Pitch, Roll
    "4f"   # NormalizedSuspensionTravel (0=full stretch, 1=full compression)
    "4f"   # TireSlipRatio (>1 = wheelspin/lockup)
    "4f"   # WheelRotationSpeed (rad/s)
    "4i"   # WheelOnRumbleStrip
    "4f"   # WheelInPuddleDepth
    "4f"   # SurfaceRumble
    "4f"   # TireSlipAngle (>1 = sliding sideways)
    "4f"   # TireCombinedSlip (>1 = past the grip limit)
    "4f"   # SuspensionTravelMeters
    "5i"   # CarOrdinal, CarClass, CarPerformanceIndex, DrivetrainType, NumCylinders
    "i2f"  # CarGroup, SmashableVelDiff, SmashableMass (FH-only block)
    "3f"   # PositionX/Y/Z (world meters)
    "3f"   # Speed (m/s), Power (W), Torque (Nm)
    "4f"   # TireTemp (Fahrenheit)
    "3f"   # Boost (psi), Fuel, DistanceTraveled (m)
    "4f"   # BestLap, LastLap, CurrentLap, CurrentRaceTime (s)
    "H"    # LapNumber (0-based)
    "5B"   # RacePosition, Accel, Brake, Clutch, HandBrake (inputs 0-255)
    "B"    # Gear (0 = reverse)
    "3b"   # Steer (-127..127), NormalizedDrivingLine, NormalizedAIBrakeDifference
    "x"    # undocumented trailing byte
)

assert _STRUCT.size == PACKET_SIZE, f"struct is {_STRUCT.size} bytes, expected {PACKET_SIZE}"

# (field name, element count). count > 1 -> list in the parsed dict.
FIELDS: list[tuple[str, int]] = [
    ("is_race_on", 1),
    ("timestamp_ms", 1),
    ("engine_max_rpm", 1), ("engine_idle_rpm", 1), ("current_engine_rpm", 1),
    ("accel_x", 1), ("accel_y", 1), ("accel_z", 1),
    ("vel_x", 1), ("vel_y", 1), ("vel_z", 1),
    ("ang_vel_x", 1), ("ang_vel_y", 1), ("ang_vel_z", 1),
    ("yaw", 1), ("pitch", 1), ("roll", 1),
    ("norm_susp_travel", 4),
    ("tire_slip_ratio", 4),
    ("wheel_rotation_speed", 4),
    ("wheel_on_rumble_strip", 4),
    ("wheel_in_puddle", 4),
    ("surface_rumble", 4),
    ("tire_slip_angle", 4),
    ("tire_combined_slip", 4),
    ("susp_travel_meters", 4),
    ("car_ordinal", 1), ("car_class", 1), ("car_pi", 1),
    ("drivetrain_type", 1), ("num_cylinders", 1),
    ("car_group", 1), ("smashable_vel_diff", 1), ("smashable_mass", 1),
    ("pos_x", 1), ("pos_y", 1), ("pos_z", 1),
    ("speed", 1), ("power", 1), ("torque", 1),
    ("tire_temp", 4),
    ("boost", 1), ("fuel", 1), ("distance_traveled", 1),
    ("best_lap", 1), ("last_lap", 1), ("current_lap", 1), ("current_race_time", 1),
    ("lap_number", 1), ("race_position", 1),
    ("accel", 1), ("brake", 1), ("clutch", 1), ("handbrake", 1),
    ("gear", 1), ("steer", 1),
    ("normalized_driving_line", 1), ("normalized_ai_brake_difference", 1),
]

_TOTAL_VALUES = sum(count for _, count in FIELDS)


def parse(data: bytes) -> dict:
    """Parse a 324-byte Data Out packet into a dict (wheel groups as lists)."""
    values = _STRUCT.unpack(data)
    out: dict = {}
    i = 0
    for name, count in FIELDS:
        if count == 1:
            out[name] = values[i]
        else:
            out[name] = list(values[i:i + count])
        i += count
    return out


def pack(fields: dict) -> bytes:
    """Inverse of parse(); used by the simulator and tests."""
    flat: list = []
    for name, count in FIELDS:
        if count == 1:
            flat.append(fields[name])
        else:
            v = fields[name]
            if len(v) != count:
                raise ValueError(f"{name} needs {count} values, got {len(v)}")
            flat.extend(v)
    return _STRUCT.pack(*flat)


def empty_fields() -> dict:
    """A zeroed field dict (useful as a pack() starting point)."""
    return {name: (0 if count == 1 else [0] * count) for name, count in FIELDS}


if __name__ == "__main__":
    # round-trip self-test
    f = empty_fields()
    f["is_race_on"] = 1
    f["speed"] = 42.5
    f["tire_combined_slip"] = [0.1, 0.2, 0.3, 0.4]
    f["lap_number"] = 3
    f["steer"] = -100
    f["gear"] = 4
    raw = pack(f)
    assert len(raw) == PACKET_SIZE
    p = parse(raw)
    assert p["is_race_on"] == 1
    assert abs(p["speed"] - 42.5) < 1e-6
    assert abs(p["tire_combined_slip"][3] - 0.4) < 1e-6
    assert p["lap_number"] == 3 and p["steer"] == -100 and p["gear"] == 4
    assert _TOTAL_VALUES == len(_STRUCT.unpack(raw))
    print(f"OK: {PACKET_SIZE}-byte packet, {_TOTAL_VALUES} values, round-trip verified")
