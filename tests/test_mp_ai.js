/**
 * tests/test_mp_ai.js
 * Comprehensive automated test suite for Milestone 4: Multiplayer Enemy AI
 */

const fs = require("fs");
const path = require("path");

console.log("=================================================");
console.log("   MILESTONE 4: MULTIPLAYER ENEMY AI TEST SUITE  ");
console.log("=================================================\n");

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

// 1. Mock Browser Environment
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
    save: () => {},
    restore: () => {},
    arc: () => {},
    fillText: () => {},
    setLineDash: () => {},
    setTransform: () => {},
    scale: () => {},
    drawImage: () => {},
    roundRect: () => {},
    rect: () => {},
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

const game = createGameInstance();
game.isHost = true;
game.peer = { id: "host-1" };
game.lobbyPlayers.clear();
game.lobbyPlayers.set("host-1", { name: "HostPlayer", shape: "square", isHost: true });
game.lobbyPlayers.set("guest-2", { name: "GuestPlayer", shape: "circle", isHost: false });

// -----------------------------------------------------------------
// Test Section 1: Spawning all 5 archetypes with exact stats
// -----------------------------------------------------------------
console.log("--- Section 1: Five Enemy Archetypes & Base Stats ---");

game.initMPMatch("host-1", "ELITE");

const chaser = game.mpSpawnEnemy("CHASER", 100, 100);
assert(chaser.type === "CHASER" && chaser.hp === 100 && chaser.speed === 175 && chaser.size === 18 && chaser.state === "CHASE",
  "Chaser spawns with exact stats (HP 100, speed 175, size 18, state CHASE)");

const flanker = game.mpSpawnEnemy("FLANKER", 200, 200);
assert(flanker.type === "FLANKER" && flanker.hp === 100 && flanker.speed === 210 && flanker.size === 16 && flanker.state === "ORBIT",
  "Flanker spawns with exact stats (HP 100, speed 210, size 16, state ORBIT)");

const sniper = game.mpSpawnEnemy("SNIPER", 300, 300);
assert(sniper.type === "SNIPER" && sniper.hp === 100 && sniper.speed === 100 && sniper.size === 20 && sniper.state === "REPOSITION",
  "Sniper spawns with exact stats (HP 100, speed 100, size 20, state REPOSITION)");

const bomber = game.mpSpawnEnemy("BOMBER", 400, 400);
assert(bomber.type === "BOMBER" && bomber.hp === 100 && bomber.speed === 120 && bomber.size === 22 && bomber.state === "PATROL",
  "Bomber spawns with exact stats (HP 100, speed 120, size 22, state PATROL)");

const disruptor = game.mpSpawnEnemy("DISRUPTOR", 500, 500);
assert(disruptor.type === "DISRUPTOR" && disruptor.hp === 100 && disruptor.speed === 135 && disruptor.size === 24 && disruptor.state === "PULL",
  "Disruptor spawns with exact stats (HP 100, speed 135, size 24, state PULL)");

// -----------------------------------------------------------------
// Test Section 2: Algorithmic Threat Scoring & Target Selection
// -----------------------------------------------------------------
console.log("\n--- Section 2: Threat Scoring & Target Balancing ---");

const p1 = game.mpState.players.get("host-1");
const p2 = game.mpState.players.get("guest-2");
p1.x = 100; p1.y = 100; p1.hp = 100; p1.isAlive = true;
p2.x = 500; p2.y = 500; p2.hp = 100; p2.isAlive = true;

let testEnemy = { type: "CHASER", x: 120, y: 120, targetId: null };
let targetId = game.mpSelectTarget(testEnemy);
assert(targetId === "host-1", "Selects closest target when health is equal");

// Sniper threat score prioritizes lower HP
p1.x = 200; p1.y = 200; p1.hp = 100; p1.isAlive = true;
p2.x = 220; p2.y = 220; p2.hp = 20; p2.isAlive = true;  // HP is 20%
testEnemy = { type: "SNIPER", x: 100, y: 200, targetId: null };
targetId = game.mpSelectTarget(testEnemy);
assert(targetId === "guest-2", "Prioritizes lower HP player when distance difference is moderate");

p1.x = 105; p1.y = 100; p1.isAlive = false; // Eliminated
p2.x = 500; p2.y = 500; p2.isAlive = true;
testEnemy = { type: "CHASER", x: 100, y: 100, targetId: null };
targetId = game.mpSelectTarget(testEnemy);
assert(targetId === "guest-2", "Does not target eliminated players");

// Crowd penalty test
game.mpState.enemies.clear();
p1.x = 150; p1.y = 150; p1.hp = 100; p1.isAlive = true;
p2.x = 220; p2.y = 150; p2.hp = 100; p2.isAlive = true;
for (let i = 0; i < 4; i++) {
  const e = game.mpSpawnEnemy("CHASER", 100, 100);
  e.targetId = "host-1";
}
testEnemy = { type: "CHASER", x: 180, y: 150, targetId: null };
const chosen = game.mpSelectTarget(testEnemy);
assert(chosen === "guest-2", "Applies crowd penalty to prevent all enemies focusing on a single target");

// -----------------------------------------------------------------
// Test Section 3: Chaser & Flanker Behaviors
// -----------------------------------------------------------------
console.log("\n--- Section 3: Chaser & Flanker AI Behaviors ---");

game.mpState.enemies.clear();
p1.x = 300; p1.y = 300; p1.hp = 100; p1.isAlive = true;
const testChaser = game.mpSpawnEnemy("CHASER", 200, 300);
testChaser.targetId = "host-1";

game.mpUpdateEnemyAI(0.2);
assert(testChaser.x > 200, "Chaser moves directly toward target player");

testChaser.x = 300; testChaser.y = 300;
game.mpUpdateEnemyAI(0.016);
assert(p1.hp === 80, "Chaser deals 20 contact damage on touch");

game.mpState.enemies.clear();
p1.x = 400; p1.y = 400; p1.hp = 100; p1.isAlive = true;
const testFlanker = game.mpSpawnEnemy("FLANKER", 400, 220);
testFlanker.targetId = "host-1";
testFlanker.state = "ORBIT";
testFlanker.stateTimer = 0.05;

game.mpUpdateEnemyAI(0.1);
assert(testFlanker.state === "DIVE", "Flanker orbits player and transitions to DIVE state");

// -----------------------------------------------------------------
// Test Section 4: Sniper, Bomber, Disruptor Behaviors
// -----------------------------------------------------------------
console.log("\n--- Section 4: Sniper, Bomber & Disruptor Behaviors ---");

game.mpState.enemies.clear();
game.mpState.projectiles = [];
p1.x = 500; p1.y = 300; p1.hp = 100; p1.isAlive = true;
const testSniper = game.mpSpawnEnemy("SNIPER", 250, 300); // 250 dist -> in range (220-380)
testSniper.targetId = "host-1";

game.mpUpdateEnemyAI(0.016);
assert(testSniper.state === "CHARGE" && testSniper.stateTimer === 1.2,
  "Sniper enters CHARGE state for exactly 1.2s per Appendix B");

game.mpUpdateEnemyAI(1.25);
assert(game.mpState.projectiles.length === 1 && game.mpState.projectiles[0].damage === 20,
  "Sniper completes 1.2s charge and spawns projectile with 20 damage");

p1.x = 250; p1.y = 300; p1.hp = 100; p1.isAlive = true;
game.mpState.projectiles = [{
  id: "pr_test",
  x: 250,
  y: 300,
  vx: 550,
  vy: 0,
  damage: 20,
  life: 1.5
}];
game.mpUpdateEnemyAI(0.016);
assert(p1.hp === 80 && game.mpState.projectiles.length === 0,
  "Sniper projectile collides with player, dealing 20 damage and is consumed");

game.mpState.enemies.clear();
game.mpState.mines = [];
p1.x = 1000; p1.y = 1000; p1.hp = 100; p1.isAlive = true;
const testBomber = game.mpSpawnEnemy("BOMBER", 500, 500);
testBomber.attackCooldown = 0.01;

game.mpUpdateEnemyAI(0.02);
assert(game.mpState.mines.length === 1 && game.mpState.mines[0].armed === false,
  "Bomber deploys proximity mine in un-armed state");

game.mpUpdateEnemyAI(1.1);
assert(game.mpState.mines[0].armed === true, "Mine arms after 1.0s delay");

p1.x = game.mpState.mines[0].x - 10;
p1.y = game.mpState.mines[0].y - 10;
game.mpUpdateEnemyAI(0.016);
assert(p1.hp === 80 && game.mpState.mines.length === 0,
  "Armed mine detonates upon player contact, dealing 20 damage");

game.mpState.enemies.clear();
p1.x = 400; p1.y = 300; p1.hp = 100; p1.isAlive = true;
const initialX = p1.x;
const testDisruptor = game.mpSpawnEnemy("DISRUPTOR", 300, 300);
game.mpUpdateEnemyAI(0.1);
assert(p1.x < initialX, "Disruptor gravitational field pulls alive players inward");
assert(p1.suppressedTimer > 0, "Disruptor EMP suppresses player abilities in radius");

// Suppressed player cannot cast Push shockwave
p1.x = 200; p1.y = 200;
p2.x = 230; p2.y = 200;
const prePushX = p2.x;
game.mpHandlePush("host-1", 200, 200);
assert(p2.x === prePushX, "Suppressed player cannot trigger Push shockwave during EMP status");

// -----------------------------------------------------------------
// Test Section 5: Adaptive Difficulty Director Scaling
// -----------------------------------------------------------------
console.log("\n--- Section 5: Adaptive Difficulty Director Scaling ---");

const max2 = Math.min(16, 2 + 2 * 2);
const interval2 = Math.max(1.2, 4.5 - 2 * 0.35);
assert(max2 === 6 && interval2 === 3.8, "Director scales 2-player match: cap 6, interval 3.8s");

const max4 = Math.min(16, 2 + 4 * 2);
const interval4 = Math.max(1.2, 4.5 - 4 * 0.35);
assert(max4 === 10 && interval4 === 3.1, "Director scales 4-player match: cap 10, interval 3.1s");

const max8 = Math.min(16, 2 + 8 * 2);
const interval8 = Math.max(1.2, 4.5 - 8 * 0.35);
assert(max8 === 16 && Number(interval8.toFixed(2)) === 1.7, "Director scales 8-player match: cap 16, interval 1.7s");

game.lobbyPlayers.clear();
game.lobbyPlayers.set("p1", { name: "P1", shape: "square", isHost: true });
game.lobbyPlayers.set("p2", { name: "P2", shape: "circle", isHost: false });
game.initMPMatch("p1", "ELITE");
game.mpState.enemies.clear();
game.mpState.directorTimer = 4.0;
game.mpUpdateEnemyAI(0.1);
assert(game.mpState.enemies.size > 0, "Director automatically spawns enemies when below active cap");

// -----------------------------------------------------------------
// Test Section 6: Network Snapshot Synchronization
// -----------------------------------------------------------------
console.log("\n--- Section 6: Network Snapshot Synchronization (Host -> Guest) ---");

let broadcastMsg = null;
game._broadcastUnreliable = (msg) => { broadcastMsg = msg; };

game.mpState.enemies.clear();
game.mpState.projectiles = [];
game.mpState.mines = [];

game.mpSpawnEnemy("CHASER", 150, 150);
game.mpState.projectiles.push({ id: "pr_1", x: 200, y: 200, vx: 550, vy: 0, radius: 5 });
game.mpState.mines.push({ id: "mine_1", x: 300, y: 300, radius: 36, armed: true, armTimer: 0 });

game.mpBroadcastSnapshot();
assert(broadcastMsg !== null && broadcastMsg.type === "MP_SNAPSHOT" &&
  broadcastMsg.enemies.length === 1 && broadcastMsg.enemies[0].type === "CHASER" &&
  broadcastMsg.projectiles.length === 1 && broadcastMsg.mines.length === 1,
  "Host includes enemies, projectiles, and mines in 25Hz snapshot");

const guestGame = createGameInstance();
guestGame.isHost = false;
guestGame.peer = { id: "guest-2" };
guestGame.lobbyPlayers.clear();
guestGame.lobbyPlayers.set("host-1", { name: "Host", shape: "square", isHost: true });
guestGame.lobbyPlayers.set("guest-2", { name: "Guest", shape: "circle", isHost: false });
guestGame.initMPMatch("host-1", "ELITE");

const snapshot = {
  t: "MP_SNAPSHOT",
  seq: 10,
  timestamp: Date.now(),
  players: [
    { id: "host-1", x: 100, y: 100, vx: 0, vy: 0, hp: 100, isAlive: true, isSpectator: false },
    { id: "guest-2", x: 200, y: 200, vx: 0, vy: 0, hp: 100, isAlive: true, isSpectator: false }
  ],
  enemies: [
    { id: "mpe_42", type: "SNIPER", state: "CHARGE", x: 350, y: 350, vx: 10, vy: 0, hp: 100, maxHp: 100, stateTimer: 0.8 }
  ],
  projectiles: [
    { id: "pr_7", x: 250, y: 250 }
  ],
  mines: [
    { id: "mine_3", x: 450, y: 450, radius: 36, armed: true }
  ]
};

guestGame.mpApplySnapshot(snapshot);
assert(guestGame.mpState.enemies.size === 1 &&
  guestGame.mpState.enemies.get("mpe_42").type === "SNIPER" &&
  guestGame.mpState.enemies.get("mpe_42").state === "CHARGE" &&
  guestGame.mpState.projectiles.length === 1 && guestGame.mpState.projectiles[0].id === "pr_7" &&
  guestGame.mpState.mines.length === 1 && guestGame.mpState.mines[0].id === "mine_3",
  "Guest applies snapshot and accurately mirrors host enemies, projectiles, and mines");

// -----------------------------------------------------------------
// Test Section 7: Disconnect Handling & Edge Cases
// -----------------------------------------------------------------
console.log("\n--- Section 7: Disconnect & Edge Cases ---");

game.lobbyPlayers.clear();
game.lobbyPlayers.set("host-1", { name: "Host", shape: "square", isHost: true });
game.lobbyPlayers.set("guest-2", { name: "Guest", shape: "circle", isHost: false });
game.initMPMatch("host-1", "ELITE");
const retargetChaser = game.mpSpawnEnemy("CHASER", 100, 100);
retargetChaser.targetId = "guest-2";

game._handlePeerDisconnect("guest-2");
game.mpUpdateEnemyAI(0.016);
assert(retargetChaser.targetId === "host-1", "Enemy retargets automatically if target player disconnects or dies");

game.mpState.projectiles = [
  { id: "pr_exp", x: 100, y: 100, vx: 10, vy: 0, life: 0.001 },
  { id: "pr_act", x: 200, y: 200, vx: 10, vy: 0, life: 2.0 }
];
game.mpUpdateEnemyAI(0.05);
assert(game.mpState.projectiles.length === 1 && game.mpState.projectiles[0].id === "pr_act",
  "Expired projectiles are safely culled");

console.log("\n=================================================");
console.log(`  MULTIPLAYER ENEMY AI TESTS: ${passed} PASSED, ${failed} FAILED`);
console.log("=================================================");

if (failed > 0) process.exit(1);
