import http from 'node:http';
import crypto from 'node:crypto';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT) || 2567;
const MAX_PLAYERS = 32;
const MAX_PAYLOAD = 64 * 1024;
const TICK_MS = 100;
const IDLE_MS = 5000;
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;
const ALLOWED_MODES = new Set([0, 1, 2, 3]);

const rooms = new Map();

function iceServers() {
  const list = [{ urls: process.env.STUN_URL || 'stun:stun.l.google.com:19302' }];
  const turn = (process.env.TURN_URL || '').split(',').map((v) => v.trim()).filter(Boolean);
  if (turn.length) {
    list.push({
      urls: turn,
      username: process.env.TURN_USERNAME || '',
      credential: process.env.TURN_CREDENTIAL || ''
    });
  }
  return list;
}

function send(ws, payload) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(payload));
}

function clampNumber(value, min, max, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function round(value, digits = 2) {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

function wrapAngle(value) {
  const full = Math.PI * 2;
  return ((((value + Math.PI) % full) + full) % full) - Math.PI;
}

function cleanName(raw) {
  const text = String(raw || '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 16);
  return text || 'DRIVER';
}

function cleanLevel(raw) {
  const text = String(raw || '').trim();
  return /^[a-z0-9-]{1,12}$/i.test(text) ? text : '1-1';
}

function newCode() {
  for (let attempt = 0; attempt < 40; attempt++) {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += ROOM_ALPHABET[crypto.randomInt(ROOM_ALPHABET.length)];
    }
    if (!rooms.has(code)) return code;
  }
  return String(crypto.randomInt(100000, 999999));
}

function roster(room) {
  return [...room.clients.values()].map((client) => ({
    id: client.meta.id,
    name: client.meta.name,
    host: client.meta.id === room.hostId
  }));
}

function broadcastRoster(room) {
  const payload = { t: 'roster', players: roster(room), hostId: room.hostId, max: MAX_PLAYERS };
  for (const client of room.clients.values()) send(client, payload);
}

function makeState(client) {
  const state = client.meta.state;
  if (!state) return [client.meta.id, 0, 0, 0, 2, 0, 0, 0];
  const idle = !client.meta.lastStateAt || Date.now() - client.meta.lastStateAt > IDLE_MS;
  return idle ? [state[0], state[1], state[2], state[3], state[4], state[5], 0, 0] : state;
}

function leaveRoom(client) {
  const room = client.meta.room;
  if (!room) return;
  room.clients.delete(client.meta.id);
  client.meta.room = null;
  client.meta.state = null;
  client.meta.lastStateAt = 0;
  if (room.clients.size === 0) {
    rooms.delete(room.code);
    return;
  }
  if (room.hostId === client.meta.id) {
    room.hostId = room.clients.keys().next().value;
  }
  broadcastRoster(room);
}

function attachToRoom(client, room, name) {
  leaveRoom(client);
  client.meta.name = name;
  client.meta.room = room;
  client.meta.state = [client.meta.id, 0, 0, 0, 2, 0, 0, 0];
  client.meta.lastStateAt = 0;
  room.clients.set(client.meta.id, client);
  send(client, {
    t: 'joined',
    id: client.meta.id,
    code: room.code,
    level: room.level,
    hostId: room.hostId,
    players: roster(room),
    iceServers: iceServers(),
    max: MAX_PLAYERS
  });
  broadcastRoster(room);
}

function handleCreate(client, msg) {
  const code = newCode();
  const room = {
    code,
    level: cleanLevel(msg.level),
    hostId: client.meta.id,
    clients: new Map()
  };
  rooms.set(code, room);
  attachToRoom(client, room, cleanName(msg.name));
}

function handleJoin(client, msg) {
  const code = String(msg.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);
  const room = rooms.get(code);
  if (!room) {
    send(client, { t: 'error', code: 'ROOM_NOT_FOUND', message: 'Room not found or already closed.' });
    return;
  }
  if (room.clients.size >= MAX_PLAYERS && !room.clients.has(client.meta.id)) {
    send(client, { t: 'error', code: 'ROOM_FULL', message: 'That room is full.' });
    return;
  }
  attachToRoom(client, room, cleanName(msg.name));
}

function handleState(client, msg) {
  if (!client.meta.room) return;
  const mode = ALLOWED_MODES.has(Math.round(Number(msg.mode))) ? Math.round(Number(msg.mode)) : 2;
  const veh = Number(msg.veh) === 1 ? 1 : 0;
  const yaw = Number(msg.yaw);
  client.meta.state = [
    client.meta.id,
    round(clampNumber(msg.x, -5000, 5000)),
    round(clampNumber(msg.z, -5000, 5000)),
    round(wrapAngle(Number.isFinite(yaw) ? yaw : 0)),
    mode,
    mode === 0 ? veh : 0,
    round(clampNumber(msg.sp, 0, 100)),
    msg.mic ? 1 : 0
  ];
  client.meta.lastStateAt = Date.now();
}

function handleVoice(client, msg) {
  const room = client.meta.room;
  if (!room) return;
  const target = room.clients.get(String(msg.to || ''));
  if (!target || target === client) return;
  if (!msg.data || typeof msg.data !== 'object') return;
  send(target, { t: 'v', from: client.meta.id, data: msg.data });
}

function handleMessage(client, raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }
  if (!msg || typeof msg !== 'object') return;
  switch (msg.t) {
    case 'create':
      handleCreate(client, msg);
      break;
    case 'join':
      handleJoin(client, msg);
      break;
    case 's':
      handleState(client, msg);
      break;
    case 'v':
      handleVoice(client, msg);
      break;
    case 'ping':
      send(client, { t: 'pong', now: Date.now() });
      break;
    default:
      break;
  }
}

function rateLimited(client) {
  const now = Date.now();
  if (now - client.meta.rateStart > 1000) {
    client.meta.rateStart = now;
    client.meta.rateCount = 0;
  }
  client.meta.rateCount++;
  return client.meta.rateCount > 160;
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.url === '/health') {
    let players = 0;
    for (const room of rooms.values()) players += room.clients.size;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, players, uptime: Math.round(process.uptime()) }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('SNACKRUN multiplayer relay. Connect over WebSocket. Health: /health\n');
});

const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD });

server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.meta = {
    id: crypto.randomUUID().slice(0, 8),
    room: null,
    name: 'DRIVER',
    state: null,
    lastStateAt: 0,
    rateStart: Date.now(),
    rateCount: 0
  };
  ws.on('pong', () => {
    ws.isAlive = true;
  });
  ws.on('message', (data) => {
    if (rateLimited(ws)) return;
    if (data.length > MAX_PAYLOAD) return;
    handleMessage(ws, data.toString());
  });
  ws.on('close', () => {
    leaveRoom(ws);
  });
  ws.on('error', () => {
    leaveRoom(ws);
  });
});

const tick = setInterval(() => {
  for (const room of rooms.values()) {
    const states = [...room.clients.values()].map(makeState);
    for (const client of room.clients.values()) {
      send(client, {
        t: 'p',
        p: states.filter((state) => state[0] !== client.meta.id)
      });
    }
  }
}, TICK_MS);

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

function shutdown() {
  clearInterval(tick);
  clearInterval(heartbeat);
  for (const ws of wss.clients) ws.close(1001, 'Server restarting');
  wss.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`SNACKRUN multiplayer relay listening on :${PORT}`);
});
