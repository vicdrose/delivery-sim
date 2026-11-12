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
- `src/sleep/SleepSystem.js` — sleepiness meter, sleep spot resolution (home / van),
  the fade-sleep-wake sequence, and the dream roll (`sleep:dream` bus seam).
- `src/audio/AudioSystem.js` + `src/audio/MusicManager.js` — Tone.js engine.
- `src/audio/FoleySystem.js` — ambient sound (currently waves only).
- `src/audio/tracks/{title,pause,radio,infinite-ep}` — folder-driven music, picked
  up automatically on reload/build. Radio = in-game looping playlist (~88 tracks;
  a few have been dropped). `infinite-ep/` is the user's own EP station and is
  empty until files are dropped in.
- `src/radio/RadioSystem.js` — station selection (DEFAULT / INFINITE EP /
  SPOTIFY), persistence (`snackrun_radio_station`), vehicle enter/exit and
  pause/resume transitions, debounced playback requests. `src/radio/providers/`
  holds the provider seam: `LocalStationProvider` wraps `MusicManager`, and
  `SpotifyProvider` uses Spotify Web API + PKCE to control the user's active
  Spotify Connect device.
- `src/world/NPCTraffic.js` — NPC car traffic (re-enabled; uses lane-offset
  collision, grid-bound turns).
- `src/ui/components/TouchControls.vue` — mobile analog stick + contextual
  action / pause buttons and push-to-talk MIC button, bottom-left.
- `src/ui/components/FuelGauge.vue` — gas + vehicle-health + sleepiness meters in the HUD.
- `src/rhythm/index.js` — stub seam where the rhythm mode will plug in.
- `src/net/settings.js` — persisted driver name, relay URL, voice and mic prefs.
- `src/net/client.js` — WebSocket relay client: room create/join, presence,
  reconnect with backoff, and voice-signal forwarding.
- `src/net/Multiplayer.js` — room lifecycle, local state publishing at 15 Hz,
  voice proximity (8 closest within 75 m), HUD state, level guard.
- `src/net/RemotePlayers.js` — remote avatar/vehicle visuals, interpolation,
  name tags, mic dots, minimap blips.
- `src/net/VoiceChat.js` — WebRTC mesh with perfect negotiation, PTT gating and
  distance-based gain.
- `server/index.js` — standalone `ws` relay (rooms, presence ticks, voice
  signaling, `/health`); `render.yaml` deploys it to Render.
- `src/levels/index.js` — the level registry (`LEVELS`, `getLevel`, `levelList`).
  Every level owns its own `grid` (`zoneOf` + `gridN`), `seed`, `gasSpots`,
  optional `storageBlock`, `spawn`, and the `vehicles` it spawns.
- `src/city/gridMath.js` — `gridMetrics(grid)` returns the derived street
  arithmetic (`P`, `T`, `H`, `lineCoord`, `blockCenter`, ...). Anything that needs
  to know how big the city is must go through this, never module-level constants.
- `src/city/StorageFacility.js` — drive-in storage block (gated aisle, roll-door
  units, vehicle slots). Only built when a level sets `storageBlock`.

Current behavior worth remembering (all landed and stable):

- **Shift** = hold B (gamepad) / N (keyboard) for 1.5s to toggle on/off. Game
  **starts with shift ON**. Flash = "SHIFT STARTED"; ending shows "Shift ended."
  toast; when off, banner reads "HOLD B TO BEGIN SHIFT". B also maps to decline.
- **RT = gas** when driving and **sprint on foot**; LT = brake. Left stick /
  W,A,S,D move and steer.
- **Controllers**: `src/input/InputManager.js` accepts any browser-exposed pad,
  not just `mapping: "standard"` Xbox ones. It picks the pad with the most
  activity (so multiple connected pads don't fight), and for non-standard pads
  it also reads triggers off resting axes (single-ended or one combined axis),
  accepts digital trigger buttons that report `value: 0`, and falls back to the
  D-pad when there is no stick. The title screen prints the detected pad name
  (`ui.padName`) — if nothing shows there, the browser is not exposing the pad
  at all, which no game code can fix.
- **Settings** = pause menu is a six-page stack (`ui.pauseMenu` =
  `main` | `levels` | `settings` | `sound` | `songs` | `spotify`): level picker,
  sound, traffic, touch controls, UI size, per-song radio on/off + volume,
  Spotify connection, and **RESET GAME DATA** (wipes every `snackrun*`
  localStorage key and rebuilds the profile; `Game.resetAllData()`). The SOUND
  page holds master mute and the overall radio volume (0-200%); Song Choice gives
  every track its own 0-200% volume. Both persist in `snackrun_radio_volume` /
  `snackrun_song_volumes`.
- **Radio volume on the controller** = R3 toggles a radio-volume slider overlay;
  rotating the right stick clockwise raises it, counterclockwise lowers it (a full
  turn spans 0-200%). The slider stays open until R3 is pressed again. The Web Audio
  gain stage is what allows values above 100% (`MusicManager`), and each song's
  volume multiplies on top of the global radio volume. While SPOTIFY is the active
  station, the same setting is mapped to Spotify's device volume (0-100%) and sent
  through `PUT /me/player/volume`, debounced and coalesced so dragging the slider
  does not spam the Web API. Devices that reject remote volume changes are ignored
  without disturbing playback status.
- **Radio stations** = hold LB / R (~0.22s) to open the selector; D-pad Up/Down
  or arrow keys change station, Left/Right toggle power, release closes. A short
  tap still skips to the next track. `RadioSystem` persists the station in
  `snackrun_radio_station`; entering a vehicle resumes it, exiting pauses it, and
  re-entering resumes mid-song. Station changes are debounced to avoid duplicate
  playback requests. DEFAULT uses `tracks/radio/`; INFINITE EP plays
  `tracks/infinite-ep/` in filename order (empty until the user drops files in,
  showing `NO TRACKS`); SPOTIFY controls the user's active Spotify Connect device
  through `SpotifyProvider`. The HUD widget shows station, track/artist when
  available, and a status such as PLAYING, STANDBY, NO TRACKS, NO ACTIVE DEVICE,
  PREMIUM REQUIRED, or SET CLIENT ID.
- **Spotify** = Web API + PKCE from the browser, no backend and no native wrapper.
  Pause → Settings → Spotify stores the client ID (`snackrun_spotify_client_id`),
  token (`snackrun_spotify_token`), PKCE verifier/state, and shows the exact
  redirect URI. Scopes are `user-read-playback-state
  user-modify-playback-state user-read-currently-playing`. Playback control needs
  Premium and an already-active Spotify app/device; the game cannot launch Spotify.
  This is the only implementation testable without the Android SDK. A future native
  App Remote provider can plug into the same seam.
- **HUD size is resolution-relative**, not fixed pixels. Every HUD length in
  `src/style.css` is `calc(N * var(--u))`, where `--u` is `--ui` × 1px. `--ui`
  is set by `applyUiScale()` in `src/ui/store.js` on load and on
  resize/orientationchange (`App.vue`). Auto value: desktop/landscape
  `clamp(min(vw/1920, vh/1080) * 0.6, 0.45, 1.2)`, portrait
  `clamp(vw/1080 * 0.6, 0.45, 1.2)`, touch/mobile
  `clamp(min(vw, vh)/430, 0.8, 1.1)`. The settings page cycles
  `[auto, 1, 0.85, 0.7, 0.55, 0.45, 0.35]`, persisted in `snackrun_uiscale`;
  `RESET GAME DATA` returns it to auto. The minimap is deliberately smaller than
  the rest (`180u` landscape, `150u` portrait), and the speedo / fuel gauge /
  toast offsets are keyed to that width (`216u` / `370u` / `216u`). Menus and
  overlays stay at fixed px on purpose, as do the touch controls.
- **Touch controls** auto-enable on coarse-pointer/UA detection but are
  forceable from settings; override persisted in `snackrun_mobile`. Key hints
  render as empty strings on mobile (`_keyHint` in `DeliveryMode.js`).
- **Vehicle health** (`CONFIG.vehicle.healthMax` 100) is the second gas-style
  meter, gear icon above the gas. Wears while driving (`driveWearPerSec`), takes
  collision damage scaled by impact speed, and **caps top speed at 12% once
  broken** (limp to a pump). Repairs at a gas station: `G` on foot at the pump
  *or* `E` in the car parked at the pump, priced at `repairCostPerUnit` ($42 per
  point of missing health). Persisted in `snackrun_health`; wear rate was cut
  30x after day-12 breakdowns proved too fast.
- **Sleepiness & sleep** is the third gas-style meter (moon row under fuel and
  health). It rises with time, extra while walking / sprinting / driving, warns at
  80%, caps at 100, and persists in `snackrun_sleepiness`. Each level has one sleep
  spot: 1-1 uses the `home` POI nearest `city.spawn` (a pulsing `Zzz` doorstep
  marker), 1-2 uses the rear of the van and follows it as it moves.
  Sleep is **time-based, not a day skip**: 100% = 8 in-game hours (`hoursAtFull`),
  scaled by the meter (60% = 4 hr 48 min). The lapse animation compresses that into
  roughly `lapseSecondsPerHour` (1.1s) per in-game hour, min `minLapseSeconds`;
  `DayNightCycle.advanceHours()` moves clock + sky while the day cycle stays paused.
  Tiredness drains to 0 and you wake at the resulting clock time, possibly the same
  day. Midnight during sleep still emits `day:ended`, so `progression.endDay()` and
  the today-stats reset happen naturally. The view tilts up to the sky
  (`SleepSystem.updateCamera`) and the HUD fades out for the sequence.
  **Below `minSleep` (20%) you cannot sleep** — the spot offers meditation instead:
  the world runs at normal speed and 1 point of tiredness drops every
  `meditateTickSeconds` (10s); stand with E, Esc, or the STAND UP button. At 0 the
  spot prompt disappears entirely. **While a delivery is active the sleep prompt is
  hidden** (sleeping would stall the countdown) although meditation is still allowed;
  `SleepSystem.begin()` also refuses as a safety net. Each sleep is 40% dream: a
  placeholder overlay for the first `dreamSeconds` of the lapse plus a `sleep:dream`
  bus event carrying `{ location, kind, hours, day, clock }` — the seam for future
  dream mini-games; no rewards or mechanics exist yet.
- **NPC traffic**: pause-menu toggle "TRAFFIC (BETA)", default OFF, persisted in
  localStorage `snackrun_traffic`. Added because collision used lane-offset
  positions, wheels use body-rotation angle, and cars are forced to turn at grid
  edges (no driving onto the beach).
- **Out of gas** = no forward *and* no reverse; braking still decelerates while
  rolling.
- **Cars** (NPC + parked) have four wheels with white rims.
- **Doors** are pushed 0.05 outward from walls to fix z-fighting.
- **Levels**: title screen has a level picker; the pause menu has a LEVELS page
  (`ui.pauseMenu` = `main` | `levels` | `settings` | `sound` | `songs`). Picking a level
  calls `Game.loadLevel(id)`, which tears down the city, clears the `city`
  collision layer, and rebuilds scenery / traffic / minimap / fleet. **1-1 must
  stay byte-identical** — its generator hash is
  `37f6a53545122e02f6eb6123c33a75ad8ec9bd26b4843eecbef815005d89135d`
  (61 POIs, 126 colliders, 36 blocks, 62596 verts, half 180). Re-run that check
  after touching `CityGenerator.js` or the 1-1 level definition.
- **Two levels**: 1-1 "SHIFT START" (gridN 6, 360x360, car only) and 1-2 "THE
  MOVE" (gridN 12, 708x708, four corner gas stations, campus top-middle). Both
  are unlocked in `DEFAULT_PROFILE.unlocks.levels` for debug.
- **The van** (1-2 only) is the mobile-studio/creative asset. It is a real
  `Vehicle` built from `VEHICLE_PROFILES.van` (bigger, slower, 56L tank, 140 HP,
  own `snackrun_van_fuel` / `snackrun_van_health` keys, boxy mesh) and it **cannot
  take deliveries** (`deliveries: false`). The car is the only delivery vehicle.
  No offers spawn while the van is the active vehicle, the objective reads
  "THE VAN IS NOT FOR DELIVERIES", and the beacon/minimap still point at the car.
  In 1-2 its rear is the level's sleep spot (the `Zzz` marker moves with it).
  **The van's creative workflow is deliberately TBD** — do not invent a rhythm
  mode; that is roadmap item #10.
- **Vehicle switching** happens on foot: walk up to the *other* vehicle and press
  the action key ("Drive the Van"). Each non-active vehicle registers a live
  interaction item at its own position (`_registerVehicleItems`). `Game.vehicle`
  is a getter over `Game.vehicles[Game.activeVehicleId]` — always read
  `g.vehicle`, never cache it.
- **Storage facility** is a gated drive-in block: 8 roll-door units facing a
  20m aisle that exits through a single gate on the street side. In 1-2 the van
  is backed into the west-front unit with its nose facing the aisle (so it can
  pull straight out) and the car is parked at the curb outside the gate; the
  player starts on foot at the gate (`spawn.kind: 'storage'`).
- **Multiplayer is presence-only co-presence.** Title → MULTIPLAYER creates or
  joins a five-character room (32 cap) on a separate Node `ws` relay
  (`server/index.js`, `render.yaml`). Everyone loads the host's level, but each
  player keeps their own deliveries, money, fuel, health, sleep, radio and
  progression; remotes are visual only (no collision, no shared car). Clients
  publish position/heading/speed/mode/vehicle/mic at 15 Hz; remote avatars and
  cars interpolate, carry name tags and green minimap blips, and hide when
  inside/sleeping. Push-to-talk is V, gamepad Select/Back (button 8), or the
  mobile MIC button; WebRTC voice meshes only the 8 closest drivers within 75 m
  (full volume inside 20 m). `VITE_MULTIPLAYER_URL` overrides the default relay
  (`ws://<host>:2567` locally, `wss://snackrun-multiplayer.onrender.com` in
  production); the panel SERVER field persists to `snackrun_mp_server`. Joining
  a room switches levels (bypassing the normal in-room level guard), leaving
  while host destroys an empty room, and dropped connections reconnect while the
  room survives. No accounts, friends, chat or shared activities yet.

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
  you cannot make money. **First pass has landed** (meter, collision damage,
  wear, limp mode, paid repairs at the pump) — scam/refusal flavor and the
  remaining money-sink pressure are still open.
- **Fitness / Sleep / Hunger / Thirst** — the same meter family, next systems.
  **Sleep has landed** (meter, home/van sleep spots, time-based sleep, meditation,
  dream roll seam). Fitness and hunger/thirst are still open; gym is roadmap #9.

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

In this order. Start at #2 when the user says go (#1 is done, #3/#4 have had
their first pass land as the level-select + 1-2 / van / storage facility — see
"Current behavior" above — but the *systems* half is still open).

1. ~~**Vehicle maintenance (gear / vehicle health)**~~ — **shipped** (meter,
   damage, wear, limp mode, paid repairs). Scam/refusal flavor still open.
2. **Rent**
3. **Secondary vehicles** — **first pass landed** as the 1-2 van (drivable, own
   fuel/health, switch on foot). Still open: buying/owning more than one, the
   "broken car forces you down to the bike" rule, and the van's creative workflow.
4. **Storage unit** — **first pass landed** as the 1-2 drive-in facility (a place
   to keep vehicles). Still open: monthly storage billing, per-unit assignment.
5. **Parking rentals**
6. **Parking tickets**
7. **Night hazards** (health meter or money-based robbery — decision needed)
8. **Police**
9. **Gym**
10. **Study** (coffee shop / college campus)

Loose / later: hunger + thirst meters (with fitness + sleep), multiplayer
friends/accounts, roommates, volleyball mini-game, malls, multi-floor
deliveries, more cities, national-park travel cutscenes, then the rhythm mode.

Multiplayer co-presence has a first pass landed already (rooms, 32-player
presence, remote avatars/cars, minimap blips, 8-peer proximity PTT voice,
reconnect, Render relay). Friends, accounts, text chat and shared mini-games
remain later work.

Track feature work against this file: when a feature ships or its context changes,
update the roadmap here so the next session inherits accurate context.

## Phases

`milestone-1` (git tag) marks the finished single-city delivery loop — the game
as it played before levels existed: one 360x360 city, one car, deliveries, gas,
vehicle health, NPC traffic, audio, touch controls. That is the baseline. **Treat
it as the shipped game, not a prototype**; do not rework it.

**Phase 2** (current) is everything on top of that baseline: the level registry,
level select, 1-2 "THE MOVE", the van, and the storage facility. When phase 2 is
done, tag it `milestone-2` and start the next phase from there.