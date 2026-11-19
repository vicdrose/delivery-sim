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

## Desktop / Steam build

The game can be wrapped in Electron for Steam. The Vite game remains the source
of truth; the desktop build is the same compiled `dist/` output with a local app
protocol, a Windows shell, and an optional Steamworks seam.

```bash
npm run build:electron  # renderer build without the PWA service worker
npm run electron:start  # run the Electron app locally
npm run electron:build  # Windows x64 package in release/win-unpacked/
npm run steam:build     # Windows package + steam/depot/ + SteamPipe VDFs + zip
```

See [`steam/README.md`](steam/README.md) for the Steamworks/SteamCMD upload flow,
[`steam/SUBMISSION.md`](steam/SUBMISSION.md) for the review checklist, and
[`steam/STORE_COPY.md`](steam/STORE_COPY.md) for store-page copy. Steam updates
are rebuilt and uploaded deliberately; GitHub Pages pushes do not update Steam.

## Controls

| Input | Action |
| --- | --- |
| W / S or Up / Down | Accelerate / brake-reverse |
| A / D or Left / Right | Steer / strafe on foot |
| Space | Handbrake |
| E | Interact (enter building / pick up / deliver / sleep / meditate) |
| F | Enter or exit the car |
| Shift | Sprint on foot |
| H | Horn; SoundCloud shuffle while the station selector is open |
| M | Mute audio |
| R | Radio: tap = next track, hold = station selector |
| Hold R, then B | Toggle Freestyle King / Auto Beats on or off (works on foot or in a car; pauses when you exit the car) |
| Hold R in Freestyle King, then ↑ / ↓ / ← / → | Random word: adjective / verb / emotion / compound word |
| Hold R, then E | Open Astro Beats, then flip / shuffle the four cards |
| Hold R in Astro Beats, then P | Close Astro Beats; the current music keeps playing |
| P | Radio power on/off (while the station selector is open) |
| Right stick | Look around with the camera (inverted X, 3x sensitivity); R3 opens the radio volume slider |
| V | Push-to-talk (multiplayer voice) |
| Esc | Pause |
| Enter / N | Accept / decline offer |
| Gamepad | Full support (RT accelerate, LT brake / reverse, stick steer, A interact/accept, Y vehicle, RB handbrake, X horn / SoundCloud shuffle while the selector is open, LB radio / hold stations, LB + B Freestyle King / Auto Beats, LB + A Astro Beats flip / shuffle, D-pad ←/→ aux source, D-pad ↑/↓/←/→ random word in Freestyle King, Y radio power or Astro Beats close while the selector is open, right stick camera look, R3 radio volume, Select / Back push-to-talk) |

Menus are controller-friendly too: on the title screen and every pause page,
D-pad or arrow keys move the highlight, A (or Enter) activates the highlighted
button, B (or N) goes back, and D-pad left/right adjusts a focused volume slider.

Astro Beats uses the same radio popup as Freestyle King but sits on top of the
current music instead of replacing it. Hold LB / R and press A / E once to open a
shuffled four-card spread face-down; the music that was already playing keeps
going. The next press flips all cards to reveal the body, sign, house and crystal.
Press it again to flip them back and draw a fresh spread, then again to reveal the
new cards. LB + B switches to Freestyle King; Y / P or the popup's CLOSE button
just closes the cards. Exiting the car still pauses the underlying station, and
getting back in resumes it.

On a gamepad, LT only reverses once the car is stopped and the trigger is held
past halfway. Small trigger drift and analog noise are ignored, so a resting or
partly pressed trigger cannot make the car creep backward.

### The bike (level 1-2)

The storage unit in "THE MOVE" keeps a bike in the van's open bay, parked against
the back wall. Walk up and press E to ride it. The bike tops out around 40 mph,
turns more sharply than the car, and has its own small tank and health meter
(`snackrun_bike_fuel` / `snackrun_bike_health`), so a fill-up is cheap. It can take
and complete deliveries: collected food rides in a front basket instead of your
hands. The view is a single near-first-person camera just above the rider, looking
over the bike's real handlebars and front basket in the lower part of the screen —
no separate overlay. The character's arms, legs and lean animate with the steering
for other players. Riding the bike tires you out much faster than driving
the car (`CONFIG.sleep.bikeDriveExtra`), so keep an eye on the moon meter. If the
car breaks down and repairs are out of reach, the bike keeps the gigs going.

## Levels

Pick a level on the title screen or from Pause → LEVELS. All three are unlocked for
debug. Each level owns its own grid, seed, gas stations and vehicle set.

- **1-1 SHIFT START** — the original 6×6 island city (360×360 m), one car and the
  ocean/beach scenery. This level's generator output is the shipped baseline and
  must stay unchanged.
- **1-2 THE MOVE** — a 12×12 city (708×708 m) with car, van and bike, four corner
  gas stations, a campus district and a drive-in storage facility. The van is the
  mobile studio/sleep spot; the bike lives in the van's open bay.
- **1-3 EXPANSION** — a 1.5× wider desert city (18×18 grid, 1056×1056 m, about
  2.25× the area of 1-2). The layout is seeded but randomized: commercial and
  business blocks are scattered across the rings, gas stations sit in shuffled
  corners, and the college campus is a 3–4×3–4 block district in a seeded random
  spot. The car, van and bike use a drive-in storage facility on the south edge;
  the van and bike are kept in its open bay and you start on foot at the gate.
  The desert sits outside the perimeter with beige/red mesas, cactuses,
  scattered desert trees and boulders — no ocean and no green island mountains.
  The sky and fog take a sandy tint, and the city ground, lots and minimap use
  warm desert palettes.

The **gym** is a first-party store archetype, not a delivery pickup. Its parking
lot has a marked, van-sized stall by the door; the `Zzz` sleep marker sits there.
Vehicles are never stored there: the van and bike live in the storage facility,
so when sleepiness gets critical you have to get in the van and drive it to the
gym to sleep. The sleep prompt only works once the van is parked in that stall.
Walk up to the gym door and press E to step inside. The college campus uses the
same hall buildings as the earlier levels, clustered into a walkable district;
it is scenery and lives to give the expansion a different silhouette, not a new
delivery system.

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

## Fuel & repairs

Fuel burns while driving. At any gas station, step up to the pump on foot and press E
(or the action button) to refuel. You do not need a full tank's worth of cash: the
pump spends what you have (up to the full price) and adds the matching share of a
tank. The prompt quotes the exact charge and the percentage of the tank it buys,
e.g. `Refuel $20.00 (59%)`. A partial fill toast reports what was added and what is
left to pay for a full tank. Refueling costs `$0.85` per unit (`$34` for an empty
40-unit tank).

Vehicle repairs happen at the same pump with the car parked at it. Press G on foot
(or E when the tank is already full) to pay `$42` per missing health point; the
prompt shows the exact repair bill, e.g. `[G] Repair $420.00`. Fuel, health and
sleep persist across reloads.

## Gas station store & caffeine

Every `Gas & Go` in 1-1, 1-2 and 1-3 now has an enterable convenience store. The
pump stays outside: walk up to the pump to refuel or repair, then step up to the
store door and press E (or the action button) to go inside. The interior has a row
of refrigerators along the left wall and a cash register by the front door on your
way out.

Walk to the refrigerators and press E to buy a **Yerba Mate Can** for `$3`. Each can
drops sleepiness by 40 points, so it can take you from 100% to 60% in one drink. You
can only drink two cans before you have to sleep; the fridge prompt changes to
`Yerba Mate — sleep first` once the limit is reached. The counter resets only when
you actually sleep (not when you meditate), and it persists across reloads in
`snackrun_caffeine_count`.

The store also has two double-sided snack dividers running across the store: each
has chips on one side and candy on the other, reversed on the second divider. The
divider nearest the door is pulled back to leave room to walk in. A glass hot-food
case by the register holds hot dogs and pizza. These are currently just set dressing
for the planned hunger meter — there are no prompts, purchases, prices or hunger
effects yet. The plan is for hot dogs and pizza to be more filling and more expensive
than chips or candy; exact values will be tuned when hunger lands.

## Sleep & dreams

A sleepiness meter (the moon row in the HUD, under fuel and vehicle health) climbs
while you play: slowly while idle, faster while walking, sprinting or driving. At 80%
the row turns red and a warning toast points you toward bed. Sleepiness is capped at
100% and persists in `snackrun_sleepiness`.

From 85% upward the **game view** starts to blur and smear with tiredness (the HUD and
menus stay sharp) — barely there at 85%, obvious by 90%, strong by 95%, and very
visible at 100%. It is a post-process over the 3D scene only: a two-pass Gaussian
blur plus a radial smear, slight desaturation and a vignette, faded in smoothly by
`blurIntensityFor()`. The effect ramps from `CONFIG.sleep.blurOnset` (85) to
`blurFull` (100) and eases with `blurFadeRate`; it only runs while playing, so the
title screen stays crisp. Sleep it off at a sleep spot to clear it.

At 100% sleepiness a pulsing **YOU REALLY NEED SLEEP** banner appears in the HUD with
the distance to your sleep spot. At 5% fuel or less a **YOU REALLY NEED GAS** banner
does the same for the nearest gas station. Both can show at once; they show distance
only — no arrow or directional wording. Each banner clears as soon as the need is
handled (sleep or refuel). The thresholds are
`CONFIG.sleep.criticalAt` (100) and `CONFIG.gas.criticalFrac` (0.05); the one-time low
fuel / running-on-empty toasts still fire earlier at 25% and 80% respectively.

Each level has one sleep spot:

- **1-1** — the home nearest the spawn point (currently "Blue Condos Court"). A pulsing
  `Zzz` marker sits on the doorstep; stand on it and press E.
- **1-2** — the rear of the van. The spot and marker follow the van wherever it is
  parked, so the van works as a bed on the move.
- **1-3** — the van-sized stall in the gym parking lot. The `Zzz` marker and the
  critical-need distance point to the gym, but the van starts in storage; you
  have to drive it to the gym before the sleep or meditation prompt works.

Sleep is time-based, not a day skip. **100% tiredness is 8 in-game hours of sleep**,
and the length scales with the meter (60% = 4 hr 48 min). During sleep the clock and
sky run forward in a time-lapse, the camera tilts up to the sky, and tiredness drains
linearly to 0. You wake at whatever time that is, so a short nap can end on the same
day. Crossing midnight still advances the day and the profile day counter.

At **85% or more** the spot offers sleep. Anywhere below that (but above 0%) you are
not tired enough to fall asleep, so it offers **meditation** instead — you can use it
to meditate back down from, say, 65% to 30% rather than sleeping. Meditation keeps the
world running at normal speed and removes 1% tiredness every 10 seconds; press E or
**STAND UP** to stop. `CONFIG.sleep` holds the tuning (`hoursAtFull`, `minSleep`,
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
  vehicle/Vehicle.js      Arcade vehicle: car / van / bike profiles, mesh, fuel, damage
  player/Player.js        On-foot controller + capsule mesh, riding pose for the bike
  physics/CollisionWorld.js Circle-vs-AABB solver, separate static sets
  interiors/
    InteriorManager.js    One shared interior room placed far outside the city
  interaction/InteractionSystem.js   Nearest-interactable prompts + key routing
  net/
    settings.js           Persisted driver name, server URL, voice + mic prefs
    client.js             WebSocket relay client: rooms, presence, reconnect, signaling
    Multiplayer.js        Room lifecycle, local state publishing, voice proximity, HUD state
    RemotePlayers.js      Remote avatars/vehicles, interpolation, name tags, map blips
    VoiceChat.js          WebRTC mesh, perfect negotiation, PTT gating, distance gain
  delivery/
    DeliveryGenerator.js  Order generation, pricing, time limits, payout finalize
    DeliveryStateMachine.js Explicit FSM for the whole delivery flow
  progression/Progression.js  localStorage profile (bank, day, stats)
  sleep/SleepSystem.js    Sleepiness meter, sleep spots, sleep sequence, dream roll
  sleep/SleepBlur.js      Sleepiness post-process: Gaussian blur, radial smear, vignette
                          over the 3D view only (HUD stays sharp)
  rhythm/index.js         Stub seam where the rhythm mode will plug in
  radio/RadioSystem.js    Station selection, vehicle/pause transitions, persistence
  radio/providers/        LocalStationProvider (DEFAULT/EP) + SpotifyProvider (PKCE)
                          + SoundCloudProvider (embedded widget)
  audio/AudioSystem.js    Tone.js engine: engine drone, skid, horn, UI stingers
  audio/MusicManager.js   Folder-driven title/radio/EP/ambient playback
  game/
    Game.js               Composition root: renderer, levels, fleet, environment sync
    modes/DeliveryMode.js The playable mode wiring everything together
  ui/
    store.js              Reactive HUD state singleton
    App.vue + components/ Hud, minimap canvas, offers, payment flash, screens
server/
  index.js                Standalone WebSocket relay: rooms, presence ticks, voice signaling
render.yaml               Render web service definition for the relay
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
  infinite-ep/   INFINITE EP station: 01 COBB, 02 I Dont Waste My Time, 03 Tension
```

Audio filenames must stay special-character free (no apostrophes, `#`, brackets,
etc.), so track 02 is spelled "Dont" in the filename and in the HUD.

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
  so it can go past 100%). Settings are saved per browser. When AUX is set to
  SPOTIFY, the same volume setting controls Spotify's device volume (mapped to
  Spotify's 0-100%). When AUX is set to SOUNDCLOUD it sets the embedded
  SoundCloud player's volume. The Sound page also opens Freestyle King, Spotify
  and SoundCloud.
- Pause → Settings → Sound → Freestyle King sets AUTO WRAP, the interval between
  random words in the current bank (0.25s to 5s in 0.25s steps, default 1s). The
  choice is saved per browser.
- Pause → Settings → UI holds TOUCH CONTROLS and UI SIZE. Touch controls can be
  forced on or off or left on AUTO; UI SIZE cycles through auto and fixed scales
  for the HUD. Both choices are saved per browser.
- Pause → Settings → RIGHT STICK CAMERA chooses between SNAP BACK (default) and
  FREE. Moving the right stick temporarily orbits and tilts the view at 3x the
  original sensitivity, with horizontal movement inverted. Like the Rocket
  League replay camera, the look stops at about 80 degrees left/right and 40
  degrees up/down instead of spinning forever; returning the stick to neutral
  smoothly snaps back to the game's normal camera angle. In FREE mode
  the view stays where you left it. Changing vehicles or entering/exiting still
  snaps the camera behind the player as usual. The setting is saved per browser
  and resets to SNAP BACK with RESET GAME DATA.
- Click R3 (right-stick press) during play to open the radio volume slider. Rotate
  the right stick clockwise to raise it and counterclockwise to lower it; click R3
  again to close. While the slider is open, the right stick controls volume instead
  of the camera.

### Stations

Hold LB (or R) for about a quarter second to open the station selector. D-pad
Up/Down or the arrow keys move between the three stations. On AUX, D-pad
Left/Right or the arrow keys switch the aux source between Spotify and
SoundCloud. Y on the gamepad, P on the keyboard, or the POWER button in the
selector toggles playback. X on the gamepad, H on the keyboard, or the SHUFFLE
button in the selector toggles SoundCloud shuffle. Releasing LB/R closes the
selector. A tap of LB/R still skips to the next track.

The chosen station is saved in `snackrun_radio_station`; the aux source is saved
in `snackrun_aux_source`. Both survive vehicle transitions and reloads. The
station cycle wraps in the order below.

- **DEFAULT** — the existing in-game radio playlist in `tracks/radio/`.
- **INFINITE EP** — plays the three tracks in `tracks/infinite-ep/` in filename
  order: 01 COBB, 02 I Dont Waste My Time, 03 Tension.
- **AUX** — the aux input. Left/Right or the two source buttons in the selector
  choose which source is plugged in:
  - **SPOTIFY** — controls the Spotify app already running on your phone.
    SNACKRUN never downloads, hosts or redistributes Spotify audio; Spotify
    remains responsible for its own playback.
  - **SOUNDCLOUD** — plays a public SoundCloud profile, playlist or track inside
    the game through SoundCloud's official embedded player. It cannot control a
    soundcloud.com tab you already have open: browsers do not allow one site to
    reach into another tab's audio. Paste a link once in Pause → Settings → Sound →
    SoundCloud and the aux source reuses it. Shuffle is ON by default: the
    player visits every track once in a random order, then starts a fresh pass.
    The selector shows the playlist position (`4 / 23`) and a SHUFFLE button;
    X/H or the settings toggle changes it, and the HUD marks a shuffled track
    with `↻`. With shuffle off, next/previous follow playlist order and the end
    of the playlist wraps back to the first track.

The HUD widget top-right shows the station, the AUX source when AUX is selected,
current track (and artist when available), and playback status. If a station has
no tracks or the aux source is not configured, the widget shows a setup message
instead of failing.

### Freestyle King / Auto Beats

Hold LB (or R) and press B (or keyboard B) to switch the radio into **FREESTYLE
KING**. The same combo turns it off. It works on foot as well as in the car, and
pauses normal radio/aux playback while active. Exiting the car pauses the beat;
getting back in resumes it. The top-right widget keeps the
`RADIO` label, shows `FK` in the station slot, then the current beat name, a
shuffle mark and the current word. The radio selector title stays FREESTYLE KING;
while LB is held, its center shows the current word.

While Freestyle King is active, hold LB (or R) and press a D-pad direction (or an
arrow key on the keyboard) to roll a new word: **Up = adjective, Down = verb,
Left = emotion, Right = compound word**. The same word appears in the top-right
radio under the beat title. Freestyle King starts with a random compound word.
A short LB/R tap still skips to another random beat.

Auto wrap is always on: while Freestyle King is active, the current word bank
rolls a new random word every AUTO WRAP interval, which defaults to one second.
Every word command selects its bank and restarts the timer, so pressing Right
then doing nothing keeps pulling fresh compound words once a second. Pausing the
game freezes the timer; resuming starts a fresh interval. Change the interval in
Pause → Settings → Sound → Freestyle King.

This mirrors the Freestyle King site's Auto Beats button. The site does not expose
a JSON API: it writes a generated `beatShuffler` array into the page and
`rollBeatShuffler()` assigns a random entry to an `<audio>` element, advancing on
`ended`. SNACKRUN ships a snapshot of that 257-beat list in
`src/radio/freestyleBeats.js` and plays from the same
`https://freestylekingapp.com/wp-content/themes/thrive-nouveau/audios//`
endpoint. Each beat plays through before another random beat begins; a tap of
LB/R skips straight to another random beat.

The word controller mirrors the same site's Rap-tab word buttons. SNACKRUN ships
snapshots of its adjective (1,115), verb (330), emotion (444) and compound-word
(846) banks in `src/radio/freestyleWords.js`, and each D-pad press picks a random
entry with the site's `array[Math.floor(Math.random() * array.length)]` logic.

### Spotify setup

Spotify control uses the Web API with PKCE from the browser. There is no backend
and no native wrapper. Pause → Settings → Sound → Spotify holds the setup:

1. Create an app at https://developer.spotify.com/dashboard.
2. Add the redirect URI shown on that page to the app exactly as written.
   For GitHub Pages it is the page URL; for local dev it is
   `http://127.0.0.1:5173/`.
3. Paste the app's client ID into the field and press CONNECT SPOTIFY. The browser
   redirects to Spotify, then back to the game with a token saved locally in
   `snackrun_spotify_token`.
4. Open Spotify on the phone and start something once so the phone is an active
   Spotify Connect device. SNACKRUN can control that device but cannot launch the
   Spotify app for you. In the car, pick AUX and switch the source to SPOTIFY.

Requirements and limits:

- Spotify playback control requires **Spotify Premium**.
- The Spotify Android app must already be open/active on a device; otherwise the
  station reports **NO ACTIVE DEVICE**.
- The app needs the `user-read-playback-state`, `user-modify-playback-state`, and
  `user-read-currently-playing` scopes.
- RESET GAME DATA keeps the Spotify client ID, token and PKCE keys, so Spotify
  keeps working after a reset without connecting again. Use DISCONNECT SPOTIFY
  when you actually want to clear them.
- The radio volume slider also sets Spotify's volume (0-100%). Some Spotify
  Connect devices do not accept remote volume changes; in that case the game
  keeps playing and leaves the device volume alone.
- Missing client ID, cancelled login, expired sessions, rate limiting, offline
  state, and Premium/device errors are shown in the widget instead of throwing.
- The Web API path is the only Spotify integration in this milestone. A future
  native App Remote provider can slot into the same `RadioSystem` provider seam
  without changing the UI or station model.

### SoundCloud setup

SoundCloud has no public API for taking over playback in another app or browser
tab, so SNACKRUN embeds SoundCloud's own player in a hidden iframe and drives it
through the official Widget API (`w.soundcloud.com/player/api.js`). Every player
starts with **Soulection Radio Sessions** built in
(`https://soundcloud.com/soulection/sets/soulection-radio-sessions`), so the
station is available without any setup. Pause → Settings → Sound → SoundCloud can replace
it:

1. Open soundcloud.com and copy a **public** profile, playlist/set or track link.
   For example `https://soundcloud.com/you/sets/your-playlist`.
2. Paste it into the field and press LOAD SOUNDCLOUD. The replacement link is saved
   in `snackrun_soundcloud_url`.
3. Press RESTORE BUILT-IN STATION to drop the replacement and return to Soulection
   Radio Sessions.
4. In the car, hold the station selector, pick AUX, then press ←/→ until
   SOUNDCLOUD is the aux source.

Behaviour and limits:

- The widget loads offscreen the first time the station needs to play and is
  removed again when you restore the built-in station. It reports the current track
  and artist back to the HUD. The built-in station does not load the SoundCloud
  script until AUX/SOUNDCLOUD actually starts playing.
- Play/pause, next/previous and the radio volume slider all drive the widget.
  Leaving the vehicle pauses it, re-entering resumes it, and pausing the game
  pauses it.
- Shuffle is saved in `snackrun_soundcloud_shuffle` and defaults to ON. A
  playlist link gives the widget a full track list; shuffle builds a new random
  order from that list, plays each track once, and reshuffles after the last
  one. It never repeats a track inside a pass. The setting works from the radio
  selector (X/H or the button) and from Pause → Settings → Sound → SoundCloud.
- A playlist that is left on shuffle keeps playing forever; with shuffle off it
  also wraps at the end of the list. The HUD shows a small `↻` in front of the
  track whenever shuffle is on.
- Only public audio works. Private tracks, likes-only profiles with no public
  uploads, and `on.soundcloud.com` short links may fail; the widget then shows
  `LINK FAILED`.
- The station cannot see or control the SoundCloud Android app or an existing
  soundcloud.com tab. It is its own player, not a remote control.
- SoundCloud's script and iframe need network access; an ad blocker that blocks
  `w.soundcloud.com` makes the station fail.


## Multiplayer co-presence

The title screen has a **MULTIPLAYER** entry next to START SHIFT. It is not a
different map or mode: everyone in a room loads the room's level and plays their
own shift in the same city.

- **Rooms** — enter a driver name, press CREATE ROOM, or join with a
  five-character code (for example `QERTY`). Names are anonymous and local; no
  account is required. The room cap is 32 drivers.
- **Your game stays yours.** Deliveries, offers, timers, money, fuel, vehicle
  health, sleepiness, progression, radio and Spotify are all local. Nothing is
  shared or authoritative on the server. Players cannot collide with each other,
  share a car, or take the same delivery.
- **What is shared** — position, heading, speed, on-foot/driving/idle/hidden
  state, car vs. van, and mic activity, sent 15 times per second. Remote players
  appear as low-poly people or cars with floating name tags and a microphone dot;
  they interpolate smoothly, disappear when inside/sleeping, and show as green
  blips on the minimap.
- **Voice** — push-to-talk with **V**, gamepad **Select / Back** (button 8), or
  the on-screen **MIC** button on mobile. Voice is a WebRTC mesh limited to the
  **8 closest drivers within 75 m**; volume is full within 20 m and fades to
  silence at 75 m. The HUD shows talking, muted, mic-blocked and no-device
  states, plus the nearest driver distance when nobody is close enough. A mic
  needs HTTPS or localhost in the browser.
  The HUD also reports connection state: `VOICE CONNECTING…` means signaling
  finished and ICE is still probing; `VOICE UNREACHABLE` means ICE failed, which
  usually needs a TURN server (set `TURN_URL`, `TURN_USERNAME` and
  `TURN_CREDENTIAL` on the relay). The pause-menu room summary shows
  `TURN READY` or `STUN ONLY` plus the distance to the nearest driver, which
  tells you at a glance whether the relay handed out a TURN server. Mic
  permission is requested when a room is created or joined; if it is blocked,
  allow the mic in site settings and rejoin.
  Remote audio plays through one hidden `<audio>` element per peer (instead of a
  Web Audio graph), which is more reliable across browsers and mobile Safari.
  Browsers still require one click or keypress before a page may play audio, so
  playback is retried on the first pointer/key event and on every presence tick.
- **Leaving** — the pause menu exposes a ROOM page with the roster, voice/mic
  toggles, and LEAVE ROOM. Closing the tab leaves the room. A dropped connection
  reconnects automatically while the room still exists. Changing levels is
  blocked while in a room.

### Relay server

The relay is a standalone Node `ws` service in `server/` (port `2567` locally).
It only forwards room membership, presence ticks and voice signaling; it never
runs game logic. `render.yaml` deploys it to Render:

1. Push the repo and create a Render Blueprint (or Web Service) from `render.yaml`.
2. The service builds with `npm install --omit=dev` in `server/` and starts with
   `npm start`; health check is `/health`.
3. Set `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` if you have a TURN service
   (optional; STUN defaults to `stun:stun.l.google.com:19302`).
4. Point the frontend at it with `VITE_MULTIPLAYER_URL=wss://<service>.onrender.com`
   at build time, or paste the address into the SERVER field in the multiplayer
   panel (persisted in `snackrun_mp_server`).

Local development defaults to `ws://<host>:2567` for localhost, so run
`node server/index.js` next to `npm run dev`. Production defaults to
`wss://snackrun-multiplayer.onrender.com`. A page served over HTTPS must use
`wss://`. Render's free plan suspends an idle service, so the first join after a
quiet spell can take up to a minute; the panel shows "Waking the multiplayer
server…" and waits instead of failing after a few seconds.

Wire format: clients send `create` / `join` / `s` (state) / `v` (voice signal to
one peer); the server sends `joined`, `roster`, `p` (presence tick), `v`, and
`error`. State tuples are `[id, x, z, yaw, mode, vehicle, speed, mic]`, where
mode is `0` driving, `1` walking, `2` idle and `3` hidden.

This milestone does not include friends, accounts, text chat, shared activities,
or persistent rooms. Those build on the same relay later.

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
  Local stations use `MusicManager`; AUX switches between Spotify (PKCE + Web
  API) and SoundCloud (embedded Widget API). Adding another aux source does not
  change input or HUD code.
- **Spotify stays Spotify.** The browser only sends playback commands to the
  user's active Spotify Connect device. No audio is downloaded, proxied or
  rebroadcast, and no server or client secret is needed.
- **Multiplayer is presence, not simulation.** A small WebSocket relay forwards
  15 Hz state tuples and WebRTC signaling; every client simulates only its own
  player and game. This keeps single-player play untouched, avoids server
  authority and rollback, and leaves room for shared activities later.
