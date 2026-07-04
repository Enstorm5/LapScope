# TODO / backlog

Open items for going public and beyond. **Workflow:** pick one item, cut a
`feat/…` or `fix/…` branch, open a PR, get CI green, merge. Once the repo is on
GitHub these become issues; this file is the pre-GitHub backlog. Prune items when
they land and move any lasting behavioral knowledge into
[AGENTS.md](AGENTS.md) rather than leaving it here.

Rough priority: **Release blockers → Distribution → Settings/Car DB → CI/Docs →
Ideas.**

---

## Release blockers (do before announcing publicly)

- **LICENSE.** The repo has none, so legally nobody can use it yet. Pick one
  (MIT recommended for max adoption) and add `LICENSE` + a header line in README.
  Note the vendored third-party assets already in the tree: Rajdhani font (OFL)
  and uPlot (MIT) — credit both in a NOTICES/THIRD-PARTY section.
- **Public README rewrite.** Lead with what it is + a hero GIF, then a features
  list and a one-line install for the chosen distribution method. Move the deep
  troubleshooting / capture-diagnosis material to the wiki and link it. Keep the
  in-game Data Out setup table front and centre.
- **Screenshots + GIFs** for the README and the Reddit post (live dashboard in
  motion, analysis A/B comparison, track map colored by speed/slip, dirty-lap
  flags). Captured from real gameplay — see the asset shot-list.
- **CI on pull requests** (see Testing & CI) — required before opening the repo
  to outside PRs.
- **Repo hygiene files:** `CONTRIBUTING.md`, issue templates (bug / feature /
  "unrecognized event type" capture report), a PR template, and a short
  `CODE_OF_CONDUCT.md`. Document the branch-protection rules in CONTRIBUTING.

## Distribution & packaging (make it plug & play)

- **Single-file Windows build (PyInstaller).** The app is a near-perfect
  candidate: pure Python (FastAPI + uvicorn), stdlib SQLite, no frontend build
  step. Bundle `app/` + static assets + fonts + `car_ordinals.json` into one
  `ForzaCalibrator.exe` that binds UDP 9999, serves the dashboard on
  `localhost:8000`, and auto-opens the browser. Decide DB location (next to the
  exe = portable, or `%LOCALAPPDATA%`).
- **GitHub Releases pipeline.** GitHub Action that builds the exe on a version
  tag and attaches it to a Release, with checksums and a VirusTotal link in the
  notes (transparency vs. SmartScreen/AV false positives).
- **SmartScreen / antivirus trust.** Unsigned PyInstaller binaries get flagged.
  Evaluate: Azure Trusted Signing or SignPath (free for OSS) for code signing;
  meanwhile prefer a onedir build over onefile (fewer heuristics) and publish
  reproducible-build instructions.
- **Version / update check.** Exe users don't get `git pull`. Add a lightweight
  "newer version available" notice (checks the GitHub Releases API, dismissible,
  no auto-download).
- **Keep the Docker path** for advanced/cross-platform users; document both in
  the README (exe for normal users, Docker for power users). Note: a native exe
  also sidesteps the Docker IPv6-proxy port bug and one layer of UWP-loopback
  pain, so it is arguably *more* reliable for the common case.

## Settings page (user preferences)

Today a couple of preferences are ad-hoc: the live dashboard has an mph/km/h
toggle in `localStorage` (`fc_mph`) but the analysis page is hard-coded to km/h.
Consolidate into one Settings page and apply preferences across both pages.

- **Units:** speed (mph / km/h), tire temp (°F / °C — packet is Fahrenheit),
  distance (mi / km). Make the analysis charts honor the choice too (currently
  km/h only).
- **Free-roam map:** optional toggle to draw the live track map in free roam,
  not only race mode.
- **Analysis map layers:** show/hide overlays — contact spikes, 2D/3D default,
  color-by (speed vs. slip) default.
- **Persistence:** decide `localStorage` (per-browser, zero backend) vs. a
  server-side settings row (shared across devices). Start with `localStorage`.
- **Theme / accent** (optional, low priority).

## Car database (community ordinal list)

`app/car_ordinals.json` (638 entries) maps car name → ordinal and is baked into
the build. Playground Games ships new cars → new ordinals, so it goes stale.

- **Auto-refresh mechanism.** Fetch an updated community list from a canonical
  source (a maintained file in this repo / a pinned gist) on demand or on a
  schedule, with the bundled copy as offline fallback and user overrides winning.
- **Surface unknown cars.** When an ordinal isn't in the list, make it obvious in
  the UI ("Car #1234 — help us name it") and provide a one-click "report unknown
  car" that pre-fills a GitHub issue, so the community list self-heals.
- Interim: the maintainer triggers refreshes manually for the first months.

## Testing & CI

- **Automated test harness (there is none today).** Add `pytest`:
  - packet round-trip / `FIELDS`↔`_STRUCT` invariant (wrap the existing
    `packet.py` self-test).
  - Headless recorder assertions: feed simulator-style frames straight through
    `SessionTracker` into an in-memory `Store` and assert on laps/flags/finishes
    for every scenario in the AGENTS.md test matrix — **no container, no game,
    no wall-clock wait** (the current simulator runs in real time, too slow for
    CI).
- **GitHub Actions:** run the tests + a lint (ruff) on every PR; build the exe on
  tags. This is the "automated system for testing" that branch protection will
  require.
- **Branch protection** on `main`: require PR + passing checks, no direct pushes.

## Docs

- **Wiki** for advanced material (packet internals, event-detection deep dive,
  capture-diagnosis workflow, the FH6 behavioral facts). README links to it.
- Keep README basic: what it is, features, install, in-game setup, a little
  troubleshooting.

## Ideas / nice-to-have (unscheduled)

- Auto-suggest track type from geometry instead of a manual dropdown.
- Export a session/lap (CSV or image of the racing line) for sharing.
- Multiple-session overlay (more than A/B) on the analysis map.

---

## In flight (carried over)

- **Confirm the last unverified event type: cross-country.** Point-to-point
  finishes (dirt/touge/sprint/drag/street) are implemented, simulator-verified,
  and confirmed on real captures. Capture mode is still ON — `.env` has
  `FC_KEEP_DISCARDED=1` — to catch any event type the recorder doesn't yet
  recognize (cross-country is the remaining candidate). After driving one:
  `python tools/inspect_session.py <id>`, confirm it's kept and timed correctly,
  add support if needed, then set the flag back to 0 (or delete `.env`) and
  `docker compose up -d`.

## Known accepted trade-offs (not bugs; revisit only with new signal data)

- A fresh-boot free-roam session starting at `DistanceTraveled` 0 that loops over
  its own start point without teleporting can produce one false geometric lap
  (AGENTS.md, WTA section).
- A mid-run quit at speed is indistinguishable from a stream-cut point-to-point
  finish; such runs carry the `cutoff` 🏁 flag rather than being dropped.
