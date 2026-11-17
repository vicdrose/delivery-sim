# Steam submission checklist

Use this after `npm run steam:build` is green and the Windows folder has been
tested on a real Windows machine.

## Steamworks account and app

- [ ] Steamworks partner account created.
- [ ] Steam Direct fee paid.
- [ ] App created and AppID recorded.
- [ ] Windows depot created and DepotID recorded.
- [ ] Build account has SteamPipe upload permission.
- [ ] Store page is in a supported language.
- [ ] Coming Soon page has been public for at least two weeks before release.
- [ ] Price and release date set.
- [ ] Age/rating questionnaire completed.

## Build

- [ ] `steam/depot/SNACKRUN.exe` launches on Windows 10/11 x64.
- [ ] `steam_appid.txt` is absent from `steam/depot/`.
- [ ] The full game works from the packaged folder with no GitHub Pages access.
- [ ] Window opens at a sensible size, F11 toggles fullscreen, and Alt+F4 quits.
- [ ] Keyboard, mouse, and controller are usable.
- [ ] Microphone permission works in the packaged build.
- [ ] Spotify login returns to the game through the localhost callback.
- [ ] SoundCloud playback works.
- [ ] Multiplayer connects to the production relay.
- [ ] Save/progression data survives a restart.
- [ ] A clean install has no missing DLL or Visual C++ runtime errors.
- [ ] Antivirus/Windows SmartScreen test completed.

## Steamworks launch configuration

- Executable: `SNACKRUN.exe`
- Arguments: none
- Working directory: the depot root (leave blank/default)
- Operating system: Windows
- Architecture: 64-bit
- Controller support: Partial Controller Support is the honest setting until every
  text-entry and account flow is controller-complete.
- Steam Input: optional; the game reads browsers' standard Gamepad API directly.

## Store page assets

Prepare at least the current Steam sizes:

- Header capsule: 920 x 430
- Small capsule: 462 x 174
- Main capsule: 1232 x 706
- Vertical capsule: 748 x 896
- Page background: 1438 x 810
- Library capsule: 600 x 900
- Library header: 460 x 215
- Library hero: 3840 x 1240
- Library logo: transparent PNG
- Screenshots: at least five, 1920 x 1080 or 2560 x 1440
- Trailer: optional but strongly recommended

Use in-game screenshots, not mockups. Show the title screen, driving, a delivery
handoff, the gas/repair meters, night driving, and the radio or multiplayer.

## Store page fields

- Genre: Simulation, Driving, Indie
- Tags: Driving, Open World, Simulation, Economy, Casual, Singleplayer,
  Multiplayer, Procedural Generation, Music
- Platforms: Windows
- Languages: English
- Steam Cloud: not supported yet
- Achievements: not supported yet
- Leaderboards: not supported yet

## Legal and content disclosures

- [ ] Confirm distribution rights for all music in `src/audio/tracks/`, including
  the radio folder.
- [ ] Confirm the Spotify and SoundCloud integrations follow their developer
  terms for a commercial game.
- [ ] Add third-party service/network disclosures if required by your store page.
- [ ] Include a privacy note if the game sends voice/position data to the
  multiplayer relay.
- [ ] Complete Steam's AI-generated content disclosure if any generated assets
  are included.

## Review build notes

Give Steam review a short note:

> SNACKRUN is a single-player delivery driving game with optional presence-only
> multiplayer. The Windows build is a self-contained Electron app; no browser or
> external launcher is required. Multiplayer and the optional Spotify/SoundCloud
> integrations require internet access. Controller support uses the browser
> Gamepad API. Local save data is stored in the app's user-data folder.

## After approval

- [ ] Upload the final build through SteamCMD.
- [ ] Set the build live on `default`.
- [ ] Install from Steam on a clean Windows account.
- [ ] Check the Steam overlay, launch options, and uninstall behavior.
- [ ] Keep the uploaded depot and the matching source commit tagged in git.
