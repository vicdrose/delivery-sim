const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

function packageFile(name, file) {
  const direct = path.join(root, 'node_modules', name, file);
  if (fs.existsSync(direct)) return direct;
  const manifest = require.resolve(`${name}/package.json`, { paths: [root] });
  return path.join(path.dirname(manifest), file);
}

function run(executable, args, env = {}) {
  console.log(`> ${path.basename(executable)} ${args.join(' ')}`);
  const result = spawnSync(executable, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...env }
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

function buildRenderer() {
  const vite = packageFile('vite', 'bin/vite.js');
  run(process.execPath, [vite, 'build'], { ELECTRON_BUILD: '1' });
  const indexPath = path.join(root, 'dist', 'index.html');
  const index = fs.readFileSync(indexPath, 'utf8');
  if (index.includes('registerSW') || fs.existsSync(path.join(root, 'dist', 'sw.js'))) {
    throw new Error('Electron build still contains PWA service-worker files.');
  }
  console.log('Electron renderer build ready: dist/index.html');
}

function packageWindows() {
  const builder = packageFile('electron-builder', 'cli.js');
  run(process.execPath, [
    builder,
    '--win',
    'dir',
    '--x64',
    '--config',
    path.join(root, 'electron-builder.yml')
  ]);
  const executable = path.join(root, 'release', 'win-unpacked', 'SNACKRUN.exe');
  if (!fs.existsSync(executable)) {
    throw new Error(`Windows build did not produce ${executable}`);
  }
  console.log(`Windows build ready: ${executable}`);
}

function main() {
  if (process.argv.includes('--renderer')) {
    buildRenderer();
    return;
  }
  buildRenderer();
  packageWindows();
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

module.exports = { buildRenderer, packageWindows };
