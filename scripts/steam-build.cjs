const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { buildRenderer, packageWindows } = require('./electron-build.cjs');

const root = path.join(__dirname, '..');
const releaseDir = path.join(root, 'release');
const sourceDir = path.join(releaseDir, 'win-unpacked');
const steamDir = path.join(root, 'steam');
const depotDir = path.join(steamDir, 'depot');
const generatedDir = path.join(steamDir, 'generated');
const outputDir = path.join(steamDir, 'output');

function vdfPath(target) {
  return path.resolve(target).split(path.sep).join('/');
}

function readVersion() {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  return manifest.version || '0.0.0';
}

function stageDepot() {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Missing Windows package: ${sourceDir}`);
  }
  fs.rmSync(depotDir, { recursive: true, force: true });
  fs.mkdirSync(depotDir, { recursive: true });
  fs.cpSync(sourceDir, depotDir, { recursive: true, dereference: true });
  for (const file of ['steam_appid.txt', 'steam_appid.txt.example']) {
    fs.rmSync(path.join(depotDir, file), { force: true });
  }
  const executable = path.join(depotDir, 'SNACKRUN.exe');
  if (!fs.existsSync(executable)) {
    throw new Error(`Steam depot is missing SNACKRUN.exe: ${depotDir}`);
  }
  console.log(`Steam depot ready: ${depotDir}`);
}

function writeSteamPipeFiles() {
  const version = readVersion();
  const appId = String(process.env.STEAM_APP_ID || 'YOUR_APP_ID').trim();
  const depotId = String(process.env.STEAM_DEPOT_ID || 'YOUR_DEPOT_ID').trim();
  fs.mkdirSync(generatedDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });

  const depotFile = `depot_build_${depotId}.vdf`;
  const appBuild = `"appbuild"
{
  "appid" "${appId}"
  "desc" "SNACKRUN ${version}"
  "buildoutput" "${vdfPath(outputDir)}"
  "contentroot" "${vdfPath(depotDir)}"
  "setlive" ""
  "preview" "0"
  "local" ""
  "depots"
  {
    "${depotId}" "${depotFile}"
  }
}
`;
  const depotBuild = `"DepotBuildConfig"
{
  "DepotID" "${depotId}"
  "ContentRoot" "${vdfPath(depotDir)}"
  "FileMapping"
  {
    "LocalPath" "*"
    "DepotPath" "."
    "recursive" "1"
  }
  "FileExclusion" "steam_appid.txt"
  "FileExclusion" "steam_appid.txt.example"
  "FileExclusion" "*.pdb"
  "FileExclusion" "**/*.log"
}
`;

  fs.writeFileSync(path.join(generatedDir, `app_build_${appId}.vdf`), appBuild);
  fs.writeFileSync(path.join(generatedDir, depotFile), depotBuild);
  return { appId, depotId, appVdf: path.join(generatedDir, `app_build_${appId}.vdf`) };
}

function zipDepot() {
  const version = readVersion();
  const destination = path.join(releaseDir, `SNACKRUN-steam-depot-${version}.zip`);
  fs.rmSync(destination, { force: true });
  let result = null;
  if (process.platform === 'win32') {
    const escapedSource = depotDir.replace(/"/g, '`"');
    const escapedDestination = destination.replace(/"/g, '`"');
    result = spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Compress-Archive -Path "${escapedSource}\\*" -DestinationPath "${escapedDestination}" -Force`
      ],
      { stdio: 'inherit' }
    );
  } else {
    result = spawnSync('zip', ['-r', '-q', destination, '.'], {
      cwd: depotDir,
      stdio: 'inherit'
    });
  }
  if (!result || result.error || result.status !== 0) {
    console.warn(`Could not create presentation zip: ${destination}`);
    return null;
  }
  const size = fs.statSync(destination).size;
  console.log(`Presentation zip ready: ${destination} (${(size / 1024 / 1024 / 1024).toFixed(2)} GB)`);
  return destination;
}

function main() {
  buildRenderer();
  packageWindows();
  stageDepot();
  const steamPipe = writeSteamPipeFiles();
  const archive = zipDepot();
  console.log('');
  console.log(`Steam AppID: ${steamPipe.appId}`);
  console.log(`Steam DepotID: ${steamPipe.depotId}`);
  console.log(`SteamPipe app build: ${steamPipe.appVdf}`);
  if (archive) console.log(`Presentation archive: ${archive}`);
  if (steamPipe.appId === 'YOUR_APP_ID' || steamPipe.depotId === 'YOUR_DEPOT_ID') {
    console.log('Set STEAM_APP_ID and STEAM_DEPOT_ID, then rerun npm run steam:build before uploading.');
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
