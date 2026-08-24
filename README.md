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
| E | Interact (enter building / pick up / deliver) |
| F | Enter or exit the car |
| Shift | Sprint on foot |
| H | Horn |
| M | Mute audio |
| R | Radio: tap = next track, hold = power |
| Esc | Pause |
| Enter / N | Accept / decline offer |
| Gamepad | Full support (RT/LT drive, stick steer, A interact/accept, Y vehicle, RB handbrake, X horn, LB radio) |

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
    names.js              Procedural street / venue naming
    materials.js          Shared vertex-color materials
    GeoUtil.js            Geometry helpers (box, prism, cylinder batching)
  world/
    DayNightCycle.js      Time-of-day state machine driving sun/fog/sky colors
    Sky.js                Gradient dome + sun/moon sprites
  vehicle/Vehicle.js      Arcade car model + mesh
  player/Player.js        On-foot character controller + capsule mesh
  physics/CollisionWorld.js Circle-vs-AABB solver, separate static sets
  interiors/
    InteriorManager.js    One shared interior room placed far outside the city
  interaction/InteractionSystem.js   Nearest-interactable prompts + key routing
  delivery/
    DeliveryGenerator.js  Order generation, pricing, time limits, payout finalize
    DeliveryStateMachine.js Explicit FSM for the whole delivery flow
  progression/Progression.js  localStorage profile (bank, day, stats)
  rhythm/index.js         Stub seam where the rhythm mode will plug in
  audio/AudioSystem.js    Tone.js engine: engine drone, skid, horn, UI stingers
  game/
    Game.js               Composition root: renderer, modes, environment sync
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
  title/    Loops on the main menu
  pause/    Plays while the game is paused (radio freezes where it is)
  radio/    In-game station; plays as a looping playlist during deliveries
```

Behavior:

- The title track starts immediately at page load, muted; browsers forbid audible
  autoplay, so it un-mutes itself on your first click or keypress without
  restarting.
- Radio picks a random starting song each shift, then advances sequentially,
  looping the playlist.
- The radio only plays while you are driving. Leave the car and it pauses exactly
  where it was; get back in and it picks up mid-song.
- Pausing the game freezes the radio in place and starts the pause music;
  resuming swaps back (radio resumes only if you were driving).

Radio controls: tap LB (or R) to skip to the next song, hold LB / R for about half a
second to switch the radio on or off. A HUD widget top-right shows the current track
and radio state.

No files in a folder simply means that part stays silent — everything degrades
gracefully.

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
