# TODO / backlog

Open items only — everything previously listed here has shipped (see git log).
Prune items when they land; add the behavioral knowledge they produce to
AGENTS.md instead of keeping it here.

## In flight

- **Verify the real sprint-race finish signature.** Stream-cut sprint recovery
  (`cutoff` flag) is implemented and simulator-verified (`--sprint 60 --cut`),
  but not yet confirmed against a real FH6 sprint. Capture mode is ON for this:
  `.env` has `FC_KEEP_DISCARDED=1` (since 2026-07-03). After driving a real
  sprint: inspect with `python tools/inspect_session.py <id>`, confirm the run
  is kept and timed correctly, then set the flag back to 0 (or delete `.env`)
  and `docker compose up -d`.

## Known accepted trade-offs (not bugs; revisit only with new signal data)

- A fresh-boot free-roam session starting at `DistanceTraveled` 0 that loops
  over its own start point without teleporting can produce one false geometric
  lap (AGENTS.md, WTA section).
- A mid-run quit at speed is indistinguishable from a stream-cut sprint finish;
  such runs carry the `cutoff` 🏁 flag rather than being dropped.
