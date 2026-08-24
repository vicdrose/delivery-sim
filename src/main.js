import { createApp } from 'vue';
import App from './ui/App.vue';
import './style.css';

const container = document.getElementById('scene');

async function boot() {
  const { Game } = await import('./game/Game.js');
  const game = new Game(container);
  window.__game = game;
  game.start();

  const app = createApp(App);
  app.config.errorHandler = (err, _instance, info) => {
    console.error(`[vue] ${info}:`, err instanceof Error ? err.message : err);
  };
  app.mount('#app');
}

boot();
