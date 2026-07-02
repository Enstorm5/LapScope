# ForzaCalibrator

A self-hosted telemetry dashboard for **Forza Horizon 6**. Runs in Docker on your PC,
receives the game's official "Data Out" UDP stream, and serves a web UI with:

- **Live dashboard** — speed/RPM/gear gauges, friction circle (G-forces), per-tire grip
  panel (combined slip: green = grip, red = sliding), understeer/oversteer indicator,
  throttle/brake/steering traces, lap timer with **live delta vs. your session-best lap**.
- **Recording & analysis** — timed drives are stored in SQLite. Browse sessions, see lap
  times, draw your **racing line on a track map** colored by speed or tire slip, and
  compare two laps (A vs. B) with distance-aligned charts: time delta, speed, inputs,
  steering, and tire slip. The map has a **2D/3D toggle** — 3D uses the packet's
  elevation (PositionY) and is drag-to-rotate.
- **Dirty-lap flags** — the packet has no official "lap invalidated" field, so the
  recorder infers it: ⏪ **rewind** (the lap clock ran backwards — reversing on track
  never does that) and 💥 **contact** (a ground-plane G-spike beyond anything tires can
  generate). Rewound stretches are also cut from charts and the map, so only the
  finally-driven line is shown.
- **Session metadata** — Forza-colored class/PI ribbons, drivetrain badges
  (FWD/RWD/AWD, straight from the packet), car names (bundled community FH6 ordinal
  list + your own overrides), track conditions (wet is auto-detected from puddle
  telemetry; snow/dirt are one-click manual tags), and a track-type tag
  (road/street/dirt/cross-country/drag — not in the packet, so it's a dropdown).
- **Races and point-to-point events** — the game ends an event *without* counting
  the last lap, so the recorder watches for two finish signals: `LastLap` changing
  while `LapNumber` stands still (final lap of a circuit race), and the race clock
  freezing during the finish cinematic. Sprints, drags, street races, and other
  point-to-point events (no laps at all) are captured as a single timed run.
- **Routes** — the game never broadcasts route names, so circuits are fingerprinted
  from the lap start position + lap length. Name a route once ("Name route" button)
  and every past and future session on it picks the name up automatically. Free-roam
  **time-attack circuits** are captured too: the server starts a new session whenever
  the race clock resets or the lap timer starts counting mid-drive.
- **No junk entries** — sessions that end without a single completed lap (free-roam
  cruising, menu blips) are discarded automatically.

The game only broadcasts *your* car (no rival data), so driving quality is measured
against your own best lap and the tires' grip limit — which is what actually makes
you faster in Rivals.

## Quick start

```bash
docker compose up --build -d
```

Open **http://localhost:8000** — you'll see "Waiting for telemetry…" until the game sends data.

### In Forza Horizon 6

`Settings → HUD and Gameplay`:

| Setting             | Value       |
|---------------------|-------------|
| Data Out            | `ON`        |
| Data Out IP Address | `127.0.0.1` |
| Data Out IP Port    | `9999`      |

Then just drive. Telemetry is only sent while driving (not in menus). Timed events
(Rivals, races, time trials) get automatic lap detection; free roam is recorded as a
plain session.

> Do **not** use ports 5200–5300 — the game binds its own socket in that range.

## Test without the game

```bash
python tools/simulator.py                                   # ~3.5 laps, 1 event
python tools/simulator.py --freeroam 20 --events 2 --wet    # full feature test
python tools/simulator.py --duration 180 --dirty            # wall contact + rewind flags
python tools/simulator.py --race 3 --duration 200           # race with a real finish
python tools/simulator.py --sprint 75 --jumps               # point-to-point + jumps
```

The live dashboard should move immediately, and a session with laps appears on the
Analysis page ~15 s after the simulator finishes.

## Troubleshooting: no packets arriving (Xbox app / Microsoft Store version)

Store (UWP) builds of games can be blocked from sending to `127.0.0.1`. In order:

1. Try `127.0.0.1:9999` first — it is officially supported by FH6.
2. Use your PC's **LAN IP** instead (find it with `ipconfig`, e.g. `192.168.1.20`),
   keeping port `9999`. Docker publishes the port on all interfaces, and this
   bypasses UWP loopback isolation.
3. Last resort — add a one-time loopback exemption (admin PowerShell):

   ```powershell
   Get-AppxPackage *Forza* | Select-Object PackageFamilyName
   CheckNetIsolation.exe LoopbackExempt -a -n=<PackageFamilyName>
   ```

Check what the server sees at any time: **http://localhost:8000/api/status**
(packet counters, last-packet age, wrong-size packet warnings) or
`docker compose logs -f`.

## Configuration

| Env var              | Default     | Meaning                          |
|----------------------|-------------|----------------------------------|
| `TELEMETRY_UDP_PORT` | `9999`      | UDP port the listener binds      |
| `DATA_DIR`           | `/app/data` | Where `telemetry.db` is written  |

Recordings are raw 324-byte packets (~70 MB per hour of driving) in `./data/telemetry.db`;
delete sessions from the Analysis page to reclaim space.

## How it works

```
FH6 ──UDP 9999──▶ asyncio listener ──▶ parser (324-byte Data Out packet)
                                      ├──▶ WebSocket /ws/live ──▶ live dashboard
                                      └──▶ session/lap tracker ──▶ SQLite ──▶ REST /api ──▶ analysis page
```

Packet layout reference: [FH6 Data Out documentation](https://support.forza.net/hc/en-us/articles/51744149102611-Forza-Horizon-6-Data-Out-Documentation).
If a title update ever changes the packet size, the server logs a warning with a hex
dump instead of crashing — check the logs if data stops parsing.

**Quirk found in real FH6 data:** on real circuits, `DistanceTraveled` is *not*
driven meters — it advances by the same fixed amount every lap of a given route
(a track-position parameter, ~2.4–2.5× the true driven length). That makes it
ideal for aligning two laps by track position (how the comparison charts use it),
but not a length. The "Driven" figure on the analysis page is integrated from
speed instead.
