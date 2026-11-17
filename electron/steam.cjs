const fs = require('node:fs');
const path = require('node:path');

let initialized = false;
let cachedClient = null;

function readAppId() {
  const fromEnv = Number.parseInt(process.env.SNACKRUN_STEAM_APP_ID || '', 10);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  const candidates = [
    path.join(__dirname, '..', 'steam_appid.txt'),
    path.join(process.resourcesPath || '', 'steam_appid.txt')
  ];
  for (const file of candidates) {
    try {
      const value = Number.parseInt(fs.readFileSync(file, 'utf8').trim(), 10);
      if (Number.isFinite(value) && value > 0) return value;
    } catch {
      void 0;
    }
  }
  return null;
}

function initSteam() {
  if (initialized) return cachedClient;
  initialized = true;
  let steamworks = null;
  try {
    steamworks = require('steamworks.js');
  } catch {
    return null;
  }
  const appId = readAppId();
  try {
    const client = appId ? steamworks.init(appId) : steamworks.init();
    if (typeof steamworks.electronEnableSteamOverlay === 'function') {
      steamworks.electronEnableSteamOverlay();
    }
    cachedClient = client;
    console.log(`[steam] initialized${appId ? ` for app ${appId}` : ''}`);
    return client;
  } catch (error) {
    console.warn(`[steam] unavailable: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

function getSteamClient() {
  return cachedClient;
}

module.exports = { initSteam, getSteamClient, readAppId };
