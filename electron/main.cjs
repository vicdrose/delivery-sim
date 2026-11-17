const { app, BrowserWindow, ipcMain, shell, session, protocol, net } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const { pathToFileURL } = require('node:url');
const { initSteam } = require('./steam.cjs');

const APP_ORIGIN = 'app://snackrun';
const DIST_DIR = path.join(__dirname, '..', 'dist');
const SPOTIFY_PORT = 43879;
const SPOTIFY_REDIRECT_URI = `http://127.0.0.1:${SPOTIFY_PORT}/callback`;

let mainWindow = null;
let spotifyServer = null;
let steamClient = null;

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
]);

function resolveContentFile(requestUrl) {
  let pathname = '/index.html';
  try {
    pathname = decodeURIComponent(new URL(requestUrl).pathname || '/index.html');
  } catch {
    return null;
  }
  if (pathname === '/' || pathname === '') pathname = '/index.html';
  const target = path.resolve(DIST_DIR, `.${pathname}`);
  const root = path.resolve(DIST_DIR);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) return null;
  return target;
}

function registerAppProtocol() {
  protocol.handle('app', async (request) => {
    const file = resolveContentFile(request.url);
    if (!file) return new Response('Not found', { status: 404 });
    try {
      await fs.promises.access(file, fs.constants.R_OK);
      return net.fetch(pathToFileURL(file).toString());
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}

function startSpotifyServer() {
  if (spotifyServer) return Promise.resolve(true);
  return new Promise((resolve) => {
    const server = http.createServer((request, response) => {
      let callbackUrl = null;
      try {
        callbackUrl = new URL(request.url || '/', `http://127.0.0.1:${SPOTIFY_PORT}`);
      } catch {
        response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Bad request');
        return;
      }
      if (callbackUrl.pathname !== '/callback') {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Not found');
        return;
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('spotify:callback', callbackUrl.toString());
      }
      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store'
      });
      response.end(
        '<!doctype html><html><head><meta charset="utf-8"><title>SNACKRUN</title>' +
          '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#1a1a2e;color:#f7e7ce;font:16px system-ui,sans-serif;text-align:center}main{padding:32px}strong{color:#ffb43a;font-size:22px}</style>' +
          '</head><body><main><strong>SNACKRUN</strong><p>Spotify is connected. You can close this window and return to the game.</p></main></body></html>'
      );
    });
    server.once('error', (error) => {
      console.warn(`[spotify] local callback server unavailable: ${error.message}`);
      spotifyServer = null;
      resolve(false);
    });
    server.listen(SPOTIFY_PORT, '127.0.0.1', () => {
      spotifyServer = server;
      resolve(true);
    });
  });
}

function stopSpotifyServer() {
  if (!spotifyServer) return;
  try {
    spotifyServer.close();
  } catch {
    void 0;
  }
  spotifyServer = null;
}

function openExternalUrl(raw) {
  let target = null;
  try {
    target = new URL(String(raw || ''));
  } catch {
    return false;
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') return false;
  shell.openExternal(target.toString()).catch(() => void 0);
  return true;
}

function configurePermissions() {
  const allowed = (permission, origin) =>
    (permission === 'media' || permission === 'fullscreen') &&
    typeof origin === 'string' &&
    origin.startsWith(APP_ORIGIN);

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const origin = (details && details.requestingUrl) || webContents.getURL();
    callback(allowed(permission, origin));
  });

  session.defaultSession.setPermissionCheckHandler((_webContents, permission, origin) =>
    allowed(permission, origin)
  );
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: '#1a1a2e',
    title: 'SNACKRUN',
    icon: path.join(DIST_DIR, 'icon-512.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false
    }
  });

  window.setMenuBarVisibility(false);
  window.once('ready-to-show', () => window.show());

  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternalUrl(url);
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith(`${APP_ORIGIN}/`)) return;
    event.preventDefault();
    openExternalUrl(url);
  });

  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') {
      event.preventDefault();
      window.setFullScreen(!window.isFullScreen());
    } else if (input.key === 'F12' && !app.isPackaged) {
      event.preventDefault();
      window.webContents.toggleDevTools();
    }
  });

  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null;
  });

  window.loadURL(`${APP_ORIGIN}/index.html`);
  mainWindow = window;
  return window;
}

function registerIpc() {
  ipcMain.handle('shell:openExternal', (_event, raw) => openExternalUrl(raw));

  ipcMain.handle('spotify:openAuth', (_event, raw) => {
    let target = null;
    try {
      target = new URL(String(raw || ''));
    } catch {
      return false;
    }
    if (
      target.protocol !== 'https:' ||
      target.hostname !== 'accounts.spotify.com' ||
      target.pathname !== '/authorize'
    ) {
      return false;
    }
    shell.openExternal(target.toString()).catch(() => void 0);
    return true;
  });

  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    electron: process.versions.electron,
    platform: process.platform,
    packaged: app.isPackaged,
    steam: !!steamClient,
    spotifyRedirectUri: SPOTIFY_REDIRECT_URI
  }));
}

async function start() {
  app.setName('SNACKRUN');
  app.setAppUserModelId('com.snackrun.game');
  registerAppProtocol();
  configurePermissions();
  registerIpc();
  await startSpotifyServer();
  steamClient = initSteam();
  createWindow();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(start);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', stopSpotifyServer);
}
