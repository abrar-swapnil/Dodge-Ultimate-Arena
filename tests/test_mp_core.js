/**
 * Milestone 3: Multiplayer Core Automated Test Suite
 * Tests 2, 4, and 8 player match states, movement sync, 100 HP baseline,
 * damage sync, elimination, spectator restrictions, stale packet dropping,
 * event deduplication, and disconnect handling.
 */

const fs = require('fs');
const path = require('path');

console.log("=================================================");
console.log("   MILESTONE 3: MULTIPLAYER CORE TEST SUITE     ");
console.log("=================================================");

let passed = 0;
let failed = 0;

function assert(cond, name) {
  if (cond) {
    console.log(`✅ PASS: ${name}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${name}`);
    failed++;
  }
}

// 1. Mock Environment
const eventListeners = {};
global.window = {
  addEventListener: (event, fn) => {
    if (!eventListeners[event]) eventListeners[event] = [];
    eventListeners[event].push(fn);
  },
  devicePixelRatio: 1,
  innerWidth: 1280,
  innerHeight: 720,
  location: { hostname: 'localhost', search: '', origin: 'http://localhost:3000', pathname: '/' }
};

const mockCanvas = {
  getContext: () => ({
    fillRect: () => {},
    strokeRect: () => {},
    clearRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    fill: () => {},
    fillText: () => {},
    strokeText: () => {},
    save: () => {},
    restore: () => {},
    drawImage: () => {},
    roundRect: () => {},
    rect: () => {},
    arc: () => {},
    setTransform: () => {},
    scale: () => {},
    measureText: () => ({ width: 50 }),
    closePath: () => {}
  }),
  addEventListener: () => {},
  style: {},
  width: 800,
  height: 600
};

global.document = {
  fullscreenElement: null,
  addEventListener: (event, fn) => {
    if (!eventListeners[event]) eventListeners[event] = [];
    eventListeners[event].push(fn);
  },
  body: { classList: { add: () => {}, remove: () => {}, contains: () => false } },
  getElementById: (id) => {
    if (id === "game-canvas") return mockCanvas;
    return {
      classList: { add: () => {}, remove: () => {}, contains: () => false },
      style: {},
      addEventListener: () => {},
      innerText: '',
      innerHTML: '',
      disabled: false,
      value: '',
      offsetWidth: 50,
      offsetHeight: 50,
      getBoundingClientRect: () => ({ left: 100, top: 100, width: 50, height: 50 })
    };
  },
  querySelector: () => ({ style: {} }),
  querySelectorAll: () => [],
  documentElement: { requestFullscreen: () => Promise.resolve() }
};

global.navigator = {
  clipboard: { writeText: () => Promise.resolve() },
  vibrate: () => true,
  maxTouchPoints: 0
};

global.localStorage = {
  _store: {},
  getItem: function(k) { return this._store[k] || null; },
  setItem: function(k, v) { this._store[k] = String(v); },
  removeItem: function(k) { delete this._store[k]; }
};

global.performance = { now: () => Date.now() };
global.requestAnimationFrame = () => {};
global.fetch = () => Promise.resolve({
  json: () => Promise.resolve({ success: true }),
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
});

global.Audio = class {
  constructor() { this.currentTime = 0; }
  play() { return Promise.resolve(); }
  pause() {}
};

global.Image = class {
  constructor() {
    this.naturalWidth = 100;
    this.naturalHeight = 100;
    this.complete = true;
  }
  set src(val) { if (this.onload) setTimeout(this.onload, 0); }
};

global.AudioContext = class {
  constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; }
  createOscillator() {
    return {
      type: 'sine',
      frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
      connect: () => {},
      start: () => {},
      stop: () => {}
    };
  }
  createGain() {
    return {
      gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {}, value: 1 },
      connect: () => {}
    };
  }
  createBufferSource() { return { buffer: null, connect: () => {}, start: () => {} }; }
  decodeAudioData(buf, success) { if (success) success({}); }
  resume() { return Promise.resolve(); }
};

// 2. Load game.js
const projectRoot = path.join(__dirname, '..');
const gameSource = fs.readFileSync(path.join(projectRoot, 'game.js'), 'utf8');

function createGameInstance() {
  const instrumented = gameSource.replace(
    'const game = new DodgeArenaGame(canvas);',
    'const game = global.exportedGame = new DodgeArenaGame(canvas);'
  );
  eval(instrumented);
  if (eventListeners["DOMContentLoaded"]) {
    eventListeners["DOMContentLoaded"].forEach(fn => fn());
  }
  return global.exportedGame;
}

const hostGame = createGameInstance();

// --- TEST SECTION 1: 2-Player Match Initialization & Unique IDs ---
console.log("\n--- Section 1: 2-Player Match Initialization ---");
hostGame.isHost = true;
hostGame.peer = { id: "host-peer-001" };
hostGame.lobbyRoomCode = "ROOM2P";
hostGame.lobbyPlayers.clear();
hostGame.lobbyPlayers.set("host-peer-001", { name: "HostPlayer", shape: "square", isHost: true });
hostGame.lobbyPlayers.set("guest-peer-002", { name: "Guest1", shape: "circle", isHost: false });

hostGame.initMPMatch("ELITE");

assert(hostGame.mpState !== null, "Host initialized mpState");
assert(hostGame.mpState.players.size === 2, "mpState has exactly 2 players");
assert(hostGame.mpState.players.has("host-peer-001"), "Host player registered with unique ID");
assert(hostGame.mpState.players.has("guest-peer-002"), "Guest player registered with unique ID");

const pHost = hostGame.mpState.players.get("host-peer-001");
const pGuest = hostGame.mpState.players.get("guest-peer-002");

assert(pHost.hp === 100, "Host starts with 100 HP");
assert(pGuest.hp === 100, "Guest starts with 100 HP");
assert(pHost.isAlive === true && pGuest.isAlive === true, "Both players start alive");
assert(pHost.isSpectator === false && pGuest.isSpectator === false, "Neither player starts as spectator");
assert(pHost.x !== pGuest.x || pHost.y !== pGuest.y, "Players have distinct spawn positions");

// --- TEST SECTION 2: 4-Player Match Initialization ---
console.log("\n--- Section 2: 4-Player Match Initialization ---");
hostGame.lobbyPlayers.clear();
hostGame.lobbyPlayers.set("p1", { name: "Alpha", shape: "square", isHost: true });
hostGame.lobbyPlayers.set("p2", { name: "Bravo", shape: "circle", isHost: false });
hostGame.lobbyPlayers.set("p3", { name: "Charlie", shape: "triangle", isHost: false });
hostGame.lobbyPlayers.set("p4", { name: "Delta", shape: "diamond", isHost: false });

hostGame.initMPMatch("ELITE");

assert(hostGame.mpState.players.size === 4, "mpState supports 4 players");
const spawnPositions = new Set();
for (const p of hostGame.mpState.players.values()) {
  assert(p.hp === 100, `${p.name} starts with 100 HP`);
  assert(p.isAlive === true, `${p.name} is alive`);
  spawnPositions.add(`${p.x},${p.y}`);
}
assert(spawnPositions.size === 4, "All 4 players have unique spawn points");

// --- TEST SECTION 3: 8-Player Full Capacity Initialization ---
console.log("\n--- Section 3: 8-Player Full Capacity Match ---");
hostGame.lobbyPlayers.clear();
for (let i = 1; i <= 8; i++) {
  hostGame.lobbyPlayers.set(`peer-00${i}`, {
    name: `Player_${i}`,
    shape: i % 2 === 0 ? "circle" : "square",
    isHost: i === 1
  });
}

hostGame.initMPMatch("INFECTION");

assert(hostGame.mpState.players.size === 8, "mpState holds full 8 players");
const eightSpawns = new Set();
let all100HP = true;
for (const p of hostGame.mpState.players.values()) {
  if (p.hp !== 100) all100HP = false;
  eightSpawns.add(`${p.x},${p.y}`);
}
assert(all100HP, "All 8 players start with exactly 100 HP");
assert(eightSpawns.size === 8, "All 8 players have unique, collision-free spawn coordinates");

// --- TEST SECTION 4: Movement & Input Synchronization (Authoritative Host) ---
console.log("\n--- Section 4: Movement & Input Synchronization ---");
// Simulate guest input sent to host
const targetGuest = hostGame.mpState.players.get("peer-002");
const startX = targetGuest.x;

// Host receives input from guest: moving right
hostGame._handleLobbyMessage({
  type: "MP_INPUT",
  peerId: "peer-002",
  x: 1,
  y: 0,
  sprint: false,
  seq: 1
}, "peer-002");

assert(targetGuest.input.x === 1, "Host received and stored guest horizontal input");

// Run authoritative update step
hostGame.state = "PLAYING";
hostGame.mode = "CUSTOM_ROOM";
hostGame.update(0.1);

assert(targetGuest.x > startX, "Host simulated movement based on guest input (position increased)");
assert(targetGuest.vx > 0, "Guest has positive horizontal velocity");

// --- TEST SECTION 5: Snapshot Generation & Client Reconciliation ---
console.log("\n--- Section 5: Snapshot Sync & Stale Packet Dropping ---");
let capturedSnapshot = null;
hostGame.mpConnections.set("peer-002", {
  reliable: { open: true, send: () => {} },
  unreliable: { open: true, send: (data) => { capturedSnapshot = data; } }
});

hostGame.mpBroadcastSnapshot();

assert(capturedSnapshot !== null, "Host generated snapshot");
assert(capturedSnapshot.type === "MP_SNAPSHOT", "Snapshot has MP_SNAPSHOT type");
assert(capturedSnapshot.players.length === 8, "Snapshot contains state of all 8 players");
assert(capturedSnapshot.seq > 0, "Snapshot contains monotonic sequence number");

// Simulate Guest applying the snapshot
const guestGame = createGameInstance();
guestGame.isHost = false;
guestGame.peer = { id: "peer-002" };
guestGame.hostPeerId = "host-peer";
guestGame.initMPMatch("INFECTION");

guestGame._handleLobbyMessage(capturedSnapshot, "host-peer");
const guestLocalPlayer = guestGame.mpState.players.get("peer-002");
assert(Math.abs(guestLocalPlayer.x - targetGuest.x) < 1, "Guest client synchronized position with host snapshot");

// Stale packet test: sending an old snapshot with lower sequence number
const staleSnapshot = {
  type: "MP_SNAPSHOT",
  seq: capturedSnapshot.seq - 1,
  players: [{ id: "peer-002", x: 0, y: 0, hp: 50, isAlive: true }]
};
guestGame._handleLobbyMessage(staleSnapshot, "host-peer");
assert(guestLocalPlayer.x !== 0, "Guest dropped stale packet (position not corrupted by older seq)");

// --- TEST SECTION 6: Authoritative Health & Damage Synchronization ---
console.log("\n--- Section 6: Health & Damage Synchronization ---");
const damagedPlayerId = "peer-003";
const p3 = hostGame.mpState.players.get(damagedPlayerId);
assert(p3.hp === 100, "Target player starts at 100 HP");

// Host applies 30 damage
const dmgApplied = hostGame.mpApplyDamage(damagedPlayerId, 30, "host-peer-001", "dmg_evt_1");
assert(dmgApplied === true, "Damage was successfully applied by host authority");
assert(p3.hp === 70, "Target HP reduced from 100 to 70");

// Guest receives damage broadcast
guestGame._handleLobbyMessage({
  type: "MP_DAMAGE",
  eventId: "dmg_evt_1",
  targetId: damagedPlayerId,
  amount: 30,
  remainingHp: 70,
  sourceId: "host-peer-001"
}, "host-peer");

assert(guestGame.mpState.players.get(damagedPlayerId).hp === 70, "Damage synchronized to guest client (70 HP)");

// --- TEST SECTION 7: Duplicate Event Protection (Dedup) ---
console.log("\n--- Section 7: Duplicate Damage & Event Dedup ---");
// Re-applying same event ID on host
const duplicateDmg = hostGame.mpApplyDamage(damagedPlayerId, 30, "host-peer-001", "dmg_evt_1");
assert(duplicateDmg === false, "Host rejected duplicate damage event ID");
assert(p3.hp === 70, "HP was NOT decremented a second time (remained 70)");

// Guest receives duplicate packet
guestGame._handleLobbyMessage({
  type: "MP_DAMAGE",
  eventId: "dmg_evt_1",
  targetId: damagedPlayerId,
  amount: 30,
  remainingHp: 40,
  sourceId: "host-peer-001"
}, "host-peer");
assert(guestGame.mpState.players.get(damagedPlayerId).hp === 70, "Guest dedup ignored duplicate damage event");

// --- TEST SECTION 8: Elimination & Spectator Mode Behavior ---
console.log("\n--- Section 8: Elimination & Spectator Restrictions ---");
// Host deals fatal 70 damage to p3 (70 -> 0)
hostGame.mpApplyDamage(damagedPlayerId, 70, "host-peer-001", "dmg_evt_fatal");

assert(p3.hp === 0, "Eliminated player HP dropped to 0");
assert(p3.isAlive === false, "Eliminated player isAlive set to false");
assert(p3.isSpectator === true, "Eliminated player marked as isSpectator");

// Elimination event dedup
const duplicateElim = hostGame.mpEliminatePlayer(damagedPlayerId, "host-peer-001");
assert(duplicateElim === false, "Duplicate elimination attempt safely rejected");

// Spectator movement restriction check on host
p3.input.x = 1;
p3.input.y = 1;
const frozenX = p3.x;
const frozenY = p3.y;
hostGame.update(0.1);

assert(p3.vx === 0 && p3.vy === 0, "Spectator velocity forced to 0");
assert(p3.x === frozenX && p3.y === frozenY, "Spectator position did not move during game update");

// Spectator cannot take further damage
const damagePostMortem = hostGame.mpApplyDamage(damagedPlayerId, 25, "host-peer-001");
assert(damagePostMortem === false, "Eliminated spectator cannot receive further damage");

// Guest elimination synchronization
guestGame._handleLobbyMessage({
  type: "MP_ELIMINATED",
  eventId: "elim_evt_p3",
  targetId: damagedPlayerId,
  killerId: "host-peer-001"
}, "host-peer");

const guestP3 = guestGame.mpState.players.get(damagedPlayerId);
assert(guestP3.isAlive === false && guestP3.isSpectator === true, "Guest synchronized elimination and spectator status");

// --- TEST SECTION 9: Player Disconnect Synchronization ---
console.log("\n--- Section 9: Player Disconnect Synchronization ---");
assert(hostGame.mpState.players.has("peer-008") === true, "peer-008 is initially present");
hostGame._handlePeerDisconnect("peer-008");
assert(hostGame.mpState.players.has("peer-008") === false, "Disconnected player cleanly removed from host match");
assert(hostGame.mpConnections.has("peer-008") === false, "Disconnected player connection removed");

// Guest syncs player leave
guestGame._handleLobbyMessage({
  type: "MP_PLAYER_LEFT",
  peerId: "peer-008",
  name: "Player_8"
}, "host-peer");
assert(guestGame.mpState.players.has("peer-008") === false, "Guest removed disconnected player from state");

// --- TEST SECTION 10: Host Disconnect & Graceful Termination ---
console.log("\n--- Section 10: Host Disconnect & Graceful Termination ---");
guestGame.state = "PLAYING";
assert(guestGame.mpState !== null, "Guest in active match");

guestGame._handleHostDisconnectDuringMatch();

assert(guestGame.state === "MENU", "Guest gracefully transitioned to MENU on host disconnect");
assert(guestGame.mpState === null, "Guest match state cleared (no frozen or broken match)");

// --- TEST SECTION 11: Solo Mode Isolation Verification ---
console.log("\n--- Section 11: Solo Mode Isolation Verification ---");
const soloGame = createGameInstance();
soloGame.startMatch("SOLO");
assert(soloGame.mode === "SOLO", "Solo mode active");
assert(soloGame.mpState === null, "mpState is strictly null in Solo mode");
assert(soloGame.p1Score === 0, "Solo score initialized");
assert(soloGame.p1.lives === 3, "Solo player has 3 lives (unaffected by 100 HP MP system)");

console.log("\n=================================================");
console.log(`  MULTIPLAYER CORE TESTS: ${passed} PASSED, ${failed} FAILED`);
console.log("=================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
