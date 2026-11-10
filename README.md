# SNACKRUN — delivery driving prototype

A browser-based low-poly delivery driving simulator built as a foundation for a future
rhythm-game mode. Drive through a procedurally generated city, accept food delivery
jobs, park, run inside on foot, collect the order and deliver it before the timer runs
out. Money persists between sessions.

Built with Three.js (rendering), Tone.js (procedural audio) and Vue 3 (HUD/menus),
bundled by Vite.

## Quick start

```bash
cd delivery-sim
npm install
npm run dev      # dev server with HMR
npm run build    # production build to dist/
npm run preview  # serve the production build
```

## Controls

| Input | Action |
| --- | --- |
| W / S or Up / Down | Accelerate / brake-reverse |
| A / D or Left / Right | Steer / strafe on foot |
| Space | Handbrake |
| E | Interact (enter building / pick up / deliver / sleep / meditate) |
| F | Enter or exit the car |
| Shift | Sprint on foot |
| H | Horn |
| M | Mute audio |
| R | Radio: tap = next track, hold = station selector |
| Esc | Pause |
| Enter / N | Accept / decline offer |
| Gamepad | Full support (RT/LT drive, stick steer, A interact/accept, Y vehicle, RB handbrake, X horn, LB radio / hold stations, R3 radio volume) |

## Gameplay loop

1. Title screen - press Start. The game spawns you in your hatchback.
2. An offer card appears (restaurant, drop-off, distance, pay estimate).
3. Accept, follow the beacon, stop near the curb marker at the pickup.
4. Press F to leave the car, walk to the door, press E to step inside.
5. Hold E to collect the food, walk out, get back in the car.
6. Deliver to the customer's door the same way. On-time deliveries earn a fat tip;
   late ones barely cover gas.

The day clock advances continuously; light, sky and fog shift through morning, noon,
sunset, dusk and night. Each day your earnings bank into a persistent profile
(localStorage).

## Sleep & dreams

A sleepiness meter (the moon row in the HUD, under fuel and vehicle health) climbs
while you play: slowly while idle, faster while walking, sprinting or driving. At 80%
the row turns red and a warning toast points you toward bed. Sleepiness is capped at
100% and persists in `snackrun_sleepiness`.

Each level has one sleep spot:

- **1-1** — the home nearest the spawn point (currently "Blue Condos Court"). A pulsing
  `Zzz` marker sits on the doorstep; stand on it and press E.
- **1-2** — the rear of the van. The spot and marker follow the van wherever it is
  parked, so the van works as a bed on the move.

Sleep is time-based, not a day skip. **100% tiredness is 8 in-game hours of sleep**,
and the length scales with the meter (60% = 4 hr 48 min). During sleep the clock and
sky run forward in a time-lapse, the camera tilts up to the sky, and tiredness drains
linearly to 0. You wake at whatever time that is, so a short nap can end on the same
day. Crossing midnight still advances the day and the profile day counter.

At **20% or more** the spot offers sleep. Below that you are not tired enough to fall
asleep, so it offers **meditation** instead. Meditation keeps the world running at
normal speed and removes 1% tiredness every 10 seconds; press E or **STAND UP** to
stop. `CONFIG.sleep` holds the tuning (`hoursAtFull`, `minSleep`,
`lapseSecondsPerHour`, `meditateTickSeconds`).

You cannot sleep while a delivery is active — the timer would stall while in-game
hours pass — so the sleep prompt is hidden until the run is delivered or failed.
Meditation stays available because it does not pause the world.

Every sleep has a 40% chance of being a dream; dreams currently show a placeholder
sequence and emit `sleep:dream` on the shared bus. That event is the seam where dream
mini-games will plug in. A plain sleep simply wakes you up.

## Architecture

```
src/
  config.js               All tunables: city size, physics, camera, day cycle, economy
  core/
    bus.js                Shared EventBus singleton
    Loop.js               Fixed-rAF main loop with delta clamping
    RNG.js                Seeded mulberry32 PRNG (city is deterministic per seed)
  input/InputManager.js   Keyboard + Gamepad API, edge detection
  city/
    CityGenerator.js      Block orchestration, roads, sidewalks, props, spawn point
    Buildings.js          Building archetypes with door metadata per zone type
    Locations.js          POI registry (food + home categories) for delivery targets
    StorageFacility.js    Drive-in storage block: gated aisle, roll-door units, slots
    gridMath.js           gridMetrics(grid) — derived street arithmetic per level
    names.js              Procedural street / venue naming
    materials.js          Shared vertex-color materials
    GeoUtil.js            Geometry helpers (box, prism, cylinder batching)
  levels/
    index.js              Level registry: grid, seed, gas spots, storage, spawn, fleet
  world/
    DayNightCycle.js      Time-of-day state machine driving sun/fog/sky colors
    Sky.js                Gradient dome + sun/moon sprites
    Scenery.js            Beach, ocean, mountains, wing walls (level-sized)
    NPCTraffic.js         Grid-bound NPC car traffic (level-sized)
  vehicle/Vehicle.js      Arcade vehicle: car + van profiles, mesh, fuel, damage
  player/Player.js        On-foot character controller + capsule mesh
  physics/CollisionWorld.js Circle-vs-AABB solver, separate static sets
  interiors/
    InteriorManager.js    One shared interior room placed far outside the city
  interaction/InteractionSystem.js   Nearest-interactable prompts + key routing
  delivery/
    DeliveryGenerator.js  Order generation, pricing, time limits, payout finalize
    DeliveryStateMachine.js Explicit FSM for the whole delivery flow
  progression/Progression.js  localStorage profile (bank, day, stats)
  sleep/SleepSystem.js    Sleepiness meter, sleep spots, sleep sequence, dream roll
  rhythm/index.js         Stub seam where the rhythm mode will plug in
  radio/RadioSystem.js    Station selection, vehicle/pause transitions, persistence
  radio/providers/        LocalStationProvider (DEFAULT/EP) + SpotifyProvider (PKCE)
  audio/AudioSystem.js    Tone.js engine: engine drone, skid, horn, UI stingers
  audio/MusicManager.js   Folder-driven title/radio/EP/ambient playback
  game/
    Game.js               Composition root: renderer, levels, fleet, environment sync
    modes/DeliveryMode.js The playable mode wiring everything together
  ui/
    store.js              Reactive HUD state singleton
    App.vue + components/ Hud, minimap canvas, offers, payment flash, screens
```

## The World

The map is a Santa Monica-style coastal bowl:

- **West** — the city opens onto a beach. Dry sand, wet sand at the surf line,
  palm trees, and an animated ocean with drifting foam. You can drive on the sand;
  an invisible barrier at the waterline keeps you out of the sea.
- **North, East, South** — a continuous ring of low-poly mountains with green
  foothills, rocky faces, and snow caps, plus smaller foothill cones closer in.
- The minimap mirrors this: blue strip on the west edge, muted green-grey border
  on the other three.

All of it is generated procedurally in `src/world/Scenery.js` from the same city
seed, so it is stable across reloads. The ocean and foam animate every frame;
mountains and palms are static merged geometry (one draw call each).

## Music

All music is folder-driven. Drop audio files (mp3, ogg, wav, m4a, flac) into the
matching folder and they are picked up automatically on the next dev reload or build:

```
src/audio/tracks/
  title/         Loops on the main menu
  radio/         DEFAULT station: the in-game looping playlist
  infinite-ep/   INFINITE EP station: your own EP, played in filename order
```

Behavior:

- The title track starts immediately at page load, muted; browsers forbid audible
  autoplay, so it un-mutes itself on your first click or keypress without
  restarting.
- The radio picks a random starting song each shift, then advances sequentially,
  looping the playlist.
- The DEFAULT and INFINITE EP stations only play while you are driving. Leave the
  car and the selected station pauses exactly where it was; get back in and it picks
  up mid-song. Changing stations while parked does not start playback.
- Pausing the game freezes the station where it is and keeps everything silent until
  you resume (the station resumes only if you were driving).
- Pause → Settings → Song Choice lets you mute individual songs and give each song
  its own volume (0-200%); choices are saved per browser and survive reloads.
- Pause → Settings → Sound sets master sound and the overall radio volume (0-200%,
  so it can go past 100%). Settings are saved per browser. When SPOTIFY is the
  selected station, the same volume setting controls Spotify's device volume
  (mapped to Spotify's 0-100%).
- Click R3 (right-stick press) during play to open the radio volume slider. Rotate
  the right stick clockwise to raise it and counterclockwise to lower it; click R3
  again to close.

### Stations

Hold LB (or R) for about a quarter second to open the station selector. D-pad
Up/Down or the arrow keys move between stations, Left/Right toggle power, and
releasing LB/R closes the selector. A tap of LB/R still skips to the next track.
The chosen station is saved in `snackrun_radio_station` and survives vehicle
transitions and reloads.

- **DEFAULT** — the existing in-game radio playlist in `tracks/radio/`.
- **INFINITE EP** — plays `tracks/infinite-ep/` in filename order. The folder is
  empty until you drop your EP files in.
- **SPOTIFY** — controls the Spotify app already running on your phone. SNACKRUN
  never downloads, hosts or redistributes Spotify audio; Spotify remains
  responsible for its own playback.

The HUD widget top-right shows the station, current track (and artist when
available), and playback status. If a station has no tracks or Spotify is not
configured, the widget shows a setup message instead of failing.

### Spotify setup

Spotify control uses the Web API with PKCE from the browser. There is no backend
and no native wrapper. Pause → Settings → Spotify holds the setup:

1. Create an app at https://developer.spotify.com/dashboard.
2. Add the redirect URI shown on that page to the app exactly as written.
   For GitHub Pages it is the page URL; for local dev it is
   `http://127.0.0.1:5173/`.
3. Paste the app's client ID into the field and press CONNECT SPOTIFY. The browser
   redirects to Spotify, then back to the game with a token saved locally in
   `snackrun_spotify_token`.
4. Open Spotify on the phone and start something once so the phone is an active
   Spotify Connect device. SNACKRUN can control that device but cannot launch the
   Spotify app for you.

Requirements and limits:

- Spotify playback control requires **Spotify Premium**.
- The Spotify Android app must already be open/active on a device; otherwise the
  station reports **NO ACTIVE DEVICE**.
- The app needs the `user-read-playback-state`, `user-modify-playback-state`, and
  `user-read-currently-playing` scopes.
- The radio volume slider also sets Spotify's volume (0-100%). Some Spotify
  Connect devices do not accept remote volume changes; in that case the game
  keeps playing and leaves the device volume alone.
- Missing client ID, cancelled login, expired sessions, rate limiting, offline
  state, and Premium/device errors are shown in the widget instead of throwing.
- The Web API path is the only Spotify integration in this milestone. A future
  native App Remote provider can slot into the same `RadioSystem` provider seam
  without changing the UI or station model.


## Key decisions

- **One merged mesh for the static city.** Every building, curb and sidewalk is
  vertex-colored once and merged into a handful of draw calls; trees, lamps and parked
  cars are InstancedMesh. Whole-city frame cost stays around 50-60 draw calls and
  holds 60 FPS headless.
- **Custom collision, not a physics engine.** Circles (cars, players) against static
  AABBs with wall sliding. Cheap, stable, and enough for arcade feel.
- **Explicit FSM for deliveries** (`DeliveryStateMachine`). States like
  `PARKED_PICKUP`, `COLLECTING`, `RETURNING` encode exactly what the player may do
  next; UI prompts derive from it rather than duplicating logic.
- **Shared interior room.** Instead of modeling interiors per building, one room
  instance sits at a far origin coordinate and gets re-tinted per venue; entering a
  building teleports you there and swaps the collision set.
- **Seeded generation.** The whole city derives from one seed in `config.js`, so runs
  are reproducible and tuning changes are diffable.
- **Rhythm-ready seams.** `rhythm/index.js` exposes an interface stub; audio lives
  behind `AudioSystem` so a future beat-driven mode can schedule against Tone's
  transport without touching gameplay code.
- **Radio is provider-based.** `RadioSystem` owns station choice, persistence and
  vehicle/pause state; each station plugs in behind a small provider interface.
  Local stations use `MusicManager`; Spotify uses PKCE and the Web API. Adding a
  future provider (for example SoundCloud) does not change input or HUD code.
- **Spotify stays Spotify.** The browser only sends playback commands to the
  user's active Spotify Connect device. No audio is downloaded, proxied or
  rebroadcast, and no server or client secret is needed.
