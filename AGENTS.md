# AGENTS.md — SNACKRUN

Guide for AI agents working on this project. Read before making changes.

## What this is

SNACKRUN is a browser low-poly delivery driving simulator: drive a procedurally
generated city, accept food-delivery jobs, park, run inside on foot, collect and
deliver before the timer runs out. Money persists between sessions.

Bigger picture — the user's vision: the game is a **real-life simulator** built on
their own "Life Engine" resource-management design. Gig-work economy
(DoorDash-style, Uber later). The game loop as it exists today is essentially
**the finished game**; future work is *adding cells to a complete organism*, not
building phases of something bigger. Repeating the proven loop across new
vehicles and re-skinned cities, layering gas-style living systems on top, and
finally the destination: the user's own released songs as **playable rhythm-game
levels (animated music videos)**.

Do not over-scope. Every feature slots into the context below even though we
build them one at a time.

## Stack & commands

- Three.js (rendering), Tone.js (audio), Vue 3 (HUD/menus), Vite (bundle), ESM.
- `npm install`, `npm run dev`, `npm run build`, `npm run preview`.
- No automated test suite. Verify changes with a fresh `npm run build` and manual play.
- GitHub repo `vicdrose/delivery-sim`, branch `master`.
  Pushing to `master` auto-deploys to GitHub Pages
  (`https://vicdrose.github.io/delivery-sim/`) via `.github/workflows/deploy.yml`.

### Dev server (Windows)

Bind to `127.0.0.1:5173` with `--strictPort`. Plain `Start-Process npm` fails
(npm is a `.cmd` shim). Use:

```
Start-Process cmd.exe /c "npx vite --host 127.0.0.1 --port 5173 --strictPort"
```

## Hard rules

1. **No comments in source files.** Never. If an explanation is needed, put it in
   the README.
2. **No special characters in audio filenames.** `#`, `(`, `)`, apostrophes, etc.
   break Vite's `import.meta.glob` and fail the build (`[UNRESOLVED_IMPORT]`).
   Rename files to safe ASCII (`#2.mp3` -> `2.mp3`). If a build fails on imports,
   suspect filenames first.
3. **Keep the current play untouched.** The player loves the game as it is right
   now. Changes must not regress existing feel. No major rewrites without asking.
4. Always end with a green build.

## Codebase map

Full architecture in `README.md` (`src/` tree). Key files:

- `src/config.js` — all tunables (city size, physics, camera, day cycle, economy).
- `src/game/Game.js` — composition root (renderer, modes, environment sync).
- `src/game/modes/DeliveryMode.js` — the playable mode wiring everything.
- `src/ui/store.js` — reactive HUD state singleton; UI state (incl. persisted
  toggles) lives here, imported as module-level `ui` (never `this.ui`).
- `src/delivery/DeliveryStateMachine.js` — explicit FSM for the delivery flow.
- `src/progression/Progression.js` — localStorage profile (bank, day, stats).
- `src/audio/AudioSystem.js` + `src/audio/MusicManager.js` — Tone.js engine.
- `src/audio/FoleySystem.js` — ambient sound (currently waves only).
- `src/audio/tracks/{title,pause,radio}` — folder-driven music, picked up
  automatically on reload/build. Radio = in-game looping playlist (90 tracks).
- `src/world/NPCTraffic.js` — NPC car traffic (re-enabled; uses lane-offset
  collision, grid-bound turns).
- `src/rhythm/index.js` — stub seam where the rhythm mode will plug in.

Current behavior worth remembering (all landed and stable):

- **Shift** = hold B (gamepad) / N (keyboard) for 1.5s to toggle on/off. Game
  **starts with shift ON**. Flash = "SHIFT STARTED"; ending shows "Shift ended."
  toast; when off, banner reads "HOLD B TO BEGIN SHIFT". B also maps to decline.
- **RT = gas** when driving and **sprint on foot**; LT = brake. Left stick /
  W,A,S,D move and steer.
- **NPC traffic**: pause-menu toggle "TRAFFIC (BETA)", default OFF, persisted in
  localStorage `snackrun_traffic`. Added because collision used lane-offset
  positions, wheels use body-rotation angle, and cars are forced to turn at grid
  edges (no driving onto the beach).
- **Out of gas** = no forward *and* no reverse; braking still decelerates while
  rolling.
- **Cars** (NPC + parked) have four wheels with white rims.
- **Doors** are pushed 0.05 outward from walls to fix z-fighting.

## Design language — the systems family

Every living resource is a **"gas-style" HUD meter**: depletes over time and via
specific actions, refilled by spending/finding things. All live in the main-game
HUD (not tied to car vs. on-foot). The state of a well-being e.g. thirst/hunger:
water-bottle emoji + meter, burger emoji + meter, run down like fuel.

- **Gas** — vehicle fuel (already in game).
- **Vehicle health** — the gear icon above the gas. **The core lesson of the
  game**: it is the biggest money sink and the penalty for bad driving.
  Crashes deduct heavily (roughly 20 crashes ≈ $2,000 mechanic bill). Repair
  costs money; the mechanic may scam you or refuse you. Without vehicle health
  you cannot make money.
- **Fitness / Sleep / Hunger / Thirst** — the same meter family, next systems.

Other pillars:

- **Vehicles are assets, not upgrades.** Bike -> car -> van -> SUV -> bus.
  Van = newer + sleepable + travel to next city. A broken car forces you down to
  the bike for gigs. Chapters/story unlock by *having the right asset*, not a
  cash number. Buying a second vehicle means parking spaces + storage units
  (monthly billing every 30 days, like rent).
- **Rent / parking / storage** are billed monthly on a 30-day cycle.
- **Reputation is lightweight.** Driver reputation is barely a system. Social
  reputation is a *natural byproduct* of talking to random NPCs doing their own
  things — don't build a separate reputation system.
- **Cities are copies of the current map, re-skinned** (island, desert, lake,
  middle-of-nowhere). Invented stand-in cities inspired by real places
  (e.g. "Santa Monica-style", "Atlanta-style"); never real city names.
- **National park travel**: between-cities travel (Phoenix <-> Colorado is the
  natural case) is a **car cutscene** — drive to a travel point, confirm
  "ready to travel?", watch a scenic driving cutscene with optional stops that
  host small mini-games (malls, strip malls).
- **Multi-floor deliveries**: some drop-offs require easy parkour — elevator /
  stairs up multiple floors to the door.
- **Night hazards**: sooner or later (health meter vs. money-based robbery —
  decision still open). **Police** to be added (enforcement family with parking
  tickets). **Gym** and **Study** (coffee shop / college campus) locations.

## The music / rhythm destination

- Rhythm levels = the user's **released songs**, chosen from whatever is most
  popular on their social media. Levels are effectively **animated music videos
  with lore**.
- Tone parity: some songs are serious, some are deliberately goofy. Gameplay and
  cutscene lore must match each song's tone.
- Unlock pattern: in-world venues you can trigger to play levels (Pokémon-gym
  style, gating progress), **plus a dedicated menu to replay any unlocked
  level** freely.
- Replays need plot justification so lore stays coherent (e.g. a killed rabid dog
  shouldn't be killable again).

## Build roadmap (feature queue)

In this order. Start at #1 when the user says go.

1. **Vehicle maintenance (gear / vehicle health)** — confirmed starting point.
2. **Rent**
3. **Secondary vehicles**
4. **Storage unit**
5. **Parking rentals**
6. **Parking tickets**
7. **Night hazards** (health meter or money-based robbery — decision needed)
8. **Police**
9. **Gym**
10. **Study** (coffee shop / college campus)

Loose / later: hunger + thirst meters (with fitness + sleep), multiplayer for
friends, roommates, volleyball mini-game, malls, multi-floor deliveries, more
cities, national-park travel cutscenes, then the rhythm mode.

Track feature work against this file: when a feature ships or its context changes,
update the roadmap here so the next session inherits accurate context.