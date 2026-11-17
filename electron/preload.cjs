const { contextBridge, ipcRenderer } = require('electron');

const SPOTIFY_REDIRECT_URI = 'http://127.0.0.1:43879/callback';

contextBridge.exposeInMainWorld(
  'snackrun',
  Object.freeze({
    isElectron: true,
    platform: process.platform,
    spotifyRedirectUri: SPOTIFY_REDIRECT_URI,
    getInfo: () => ipcRenderer.invoke('app:info'),
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', String(url || '')),
    openSpotifyAuth: (url) => ipcRenderer.invoke('spotify:openAuth', String(url || '')),
    onSpotifyCallback: (callback) => {
      if (typeof callback !== 'function') return () => {};
      const listener = (_event, url) => callback(String(url || ''));
      ipcRenderer.on('spotify:callback', listener);
      return () => ipcRenderer.removeListener('spotify:callback', listener);
    }
  })
);
