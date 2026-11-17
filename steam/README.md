# SNACKRUN on Steam

This folder is the Steam/Electron packaging path for the browser game. The Vite
project remains the source of truth. A Steam build is the same `dist/` output in
an Electron shell.

## What `npm run steam:build` produces

- `release/win-unpacked/` — runnable Windows x64 build (`SNACKRUN.exe`).
- `steam/depot/` — the exact folder uploaded through SteamPipe.
- `steam/generated/app_build_<APPID>.vdf` — SteamPipe app build script.
- `steam/generated/depot_build_<DEPOTID>.vdf` — SteamPipe depot script.
- `release/SNACKRUN-steam-depot-<version>.zip` — presentation/archive copy.

The build runs Vite with `ELECTRON_BUILD=1`, so the PWA service worker is not
generated. Electron loads the bundled game from a local `app://snackrun/`
protocol. The app has no dependency on GitHub Pages at runtime.

## First local test

On a machine with a graphical desktop:

```bash
npm install
npm run build:electron
npm run electron:start
```

`npm run build:electron` rebuilds only the renderer. `npm run electron:start`
opens the Electron app against that build.

The current Linux development machine can build the Windows package but cannot
run `SNACKRUN.exe`. Run the packaged folder on Windows before uploading.

## First Steam setup

1. Create a Steamworks partner account, pay the Steam Direct fee, and create the
   app in Steamworks.
2. Create a Windows depot and note both the AppID and DepotID.
3. Add the Spotify loopback redirect URI to the Spotify developer app:
   `http://127.0.0.1:43879/callback`
4. Build with the real IDs:

   Linux/macOS:

   ```bash
   STEAM_APP_ID=123456 STEAM_DEPOT_ID=123457 npm run steam:build
   ```

   Windows PowerShell:

   ```powershell
   $env:STEAM_APP_ID="123456"
   $env:STEAM_DEPOT_ID="123457"
   npm run steam:build
   ```

5. Install [SteamCMD](https://developer.valvesoftware.com/wiki/SteamCMD).
6. Upload the build:

   Windows:

   ```bat
   steamcmd.exe +login YOUR_STEAM_ACCOUNT +run_app_build "C:\path\to\delivery-sim\steam\generated\app_build_123456.vdf" +quit
   ```

   Linux:

   ```bash
   steamcmd +login YOUR_STEAM_ACCOUNT +run_app_build "$(pwd)/steam/generated/app_build_123456.vdf" +quit
   ```

7. In Steamworks, open **SteamPipe > Builds**, select the uploaded build, and set
   it live on the branch you want (normally `default`). For a first release, the
   build must be live before the store page can launch.

SteamCMD prompts for the password and Steam Guard code. Do not put credentials in
this repository.

## Updating the game later

Normal HTML/gameplay development stays exactly as it is:

```bash
npm run dev
npm run build
git push
```

That updates the web version. To ship the same change to Steam:

```bash
npm run steam:build
steamcmd +login YOUR_STEAM_ACCOUNT +run_app_build "/absolute/path/to/delivery-sim/steam/generated/app_build_<APPID>.vdf" +quit
```

Then set the new build live in Steamworks.

Steam does not pull from GitHub Pages. A Steam update is a deliberate depot
upload. If you want that upload automated, the same `npm run steam:build` command
can run in CI with SteamCMD and Steam build-account credentials stored as
secrets. Until those credentials exist, the one-command rebuild plus SteamCMD
upload is the reliable path.

## Steam overlay and achievements

The Electron shell has an optional `steamworks.js` seam in
`electron/steam.cjs`. It does nothing when the package or AppID is absent.

To test the overlay locally:

```bash
npm install steamworks.js
echo 123456 > steam_appid.txt
npm run electron:start
```

Launch the app through Steam for overlay testing. `steam_appid.txt` is for local
testing only and is excluded from the depot. Never upload it.

Steam achievements, stats and Cloud saves are not implemented yet. The seam is
ready for them once the AppID exists.

## Runtime notes

- **Spotify:** uses PKCE from the renderer and opens the Spotify login page in the
  default browser. The Electron app listens on
  `http://127.0.0.1:43879/callback` and sends the callback back to the game.
  Playback control still requires Spotify Premium and an active Spotify device.
- **SoundCloud:** uses the official embedded widget and needs internet access.
- **Multiplayer:** defaults to
  `wss://snackrun-multiplayer.onrender.com` in Electron. Voice chat needs
  microphone permission, which the Electron shell grants only to the game origin.
- **Saves:** progression and settings use the app's local browser storage. They
  are not Steam Cloud saves.
- **Audio rights:** confirm you have distribution rights for every track bundled
  in `src/audio/tracks/` before selling the build. The radio folder contains
  third-party music and is included in the depot.

## Steamworks pages

- [Submission checklist](SUBMISSION.md)
- [Store page copy and assets](STORE_COPY.md)
- [VDF examples](templates/app_build.vdf)
