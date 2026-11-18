/**
 * test_mp_elite_hazards.js — Milestone 5B
 * Comprehensive automated test suite for Elite Mode Environmental Hazards & Score Thresholds:
 * - 30 pts: Smoke Bombs (2s fuse, 3s duration, 20 HP damage on entry)
 * - 70 pts: Toxic Gas (spawns every 5s, lasts 10s, 10 HP every 0.5s)
 * - 120 pts: Stop mini enemies. Laser Wall (every 15s, 60 HP direct hit)
 * - 200 pts: Stop toxic gas & lasers. Smoke bombs continue. Scoring halted.
 * - Snapshot sync & Solo Mode protection.
 */

"use strict";

const fs   = require("fs");
const path = require("path");

console.log("=================================================");
console.log("   MILESTONE 5B: ELITE HAZARDS & THRESHOLDS      ");
console.log("=================================================");

let passed = 0;
let failed = 0;

function assert(cond, name, detail) {
  if (cond) {
    console.log(`  ✅ PASS  ${name}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL  ${name}${detail ? ": " + detail : ""}`);
    failed++;
  }
}
function assertEqual(a, b, name) {
  assert(a === b, name, `got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
}

// ── Minimal browser mock environment ─────────────────────────────────────────
const eventListeners = {};

global.window = {
  addEventListener: (event, fn) => {
    if (!eventListeners[event]) eventListeners[event] = [];
    eventListeners[event].push(fn);
  },
  devicePixelRatio: 1,
  innerWidth: 800,
  innerHeight: 600,
  location: { hostname: "localhost", search: "", origin: "http://localhost:3000", pathname: "/" }
};

const mockCanvas = {
  getContext: () => ({
    fillRect: () => {}, strokeRect: () => {}, clearRect: () => {},
    beginPath: () => {}, moveTo: () => {}, lineTo: () => {},
    arc: () => {}, ellipse: () => {}, rect: () => {},
    stroke: () => {}, fill: () => {},
    fillText: () => {}, strokeText: () => {},
    save: () => {}, restore: () => {},
    drawImage: () => {},
    roundRect: () => {}, quadraticCurveTo: () => {},
    setTransform: () => {}, scale: () => {}, translate: () => {}, rotate: () => {},
    measureText: () => ({ width: 50 }),
    closePath: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    get canvas() { return mockCanvas; },
    fillStyle: "", strokeStyle: "", lineWidth: 1, globalAlpha: 1,
    textAlign: "", textBaseline: "", font: "", shadowColor: "", shadowBlur: 0,
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
  body: { classList: { add: () => {}, remove: () => {}, contains: () => false }, style: {} },
  getElementById: (id) => {
    if (id === "game-canvas") return mockCanvas;
    return {
      classList: { add: () => {}, remove: () => {}, contains: () => false },
      style: {},
      addEventListener: () => {},
      innerText: "", innerHTML: "",
      disabled: false, value: "",
      offsetWidth: 50, offsetHeight: 50,
      getBoundingClientRect: () => ({ left: 100, top: 100, width: 50, height: 50 })
    };
  },
  querySelector: () => ({ style: {} }),
  querySelectorAll: () => [],
  documentElement: { requestFullscreen: () => Promise.resolve() },
  createElement: (tag) => ({
    style: {}, src: "", onload: null, onerror: null, complete: false, naturalWidth: 0,
    play: () => Promise.resolve(), pause: () => {},
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    innerText: "", innerHTML: "",
    addEventListener: () => {}, setAttribute: () => {}, getAttribute: () => null,
  }),
  head: { appendChild: () => {} }
};

try {
  global.navigator = {
    clipboard: { writeText: () => Promise.resolve() },
    vibrate: () => true,
    maxTouchPoints: 0
  };
} catch(_) {
  Object.defineProperty(global, "navigator", {
    value: { clipboard: { writeText: () => Promise.resolve() }, vibrate: () => true, maxTouchPoints: 0 },
    writable: true, configurable: true
  });
}

global.localStorage = {
  _store: {},
  getItem: function(k) { return this._store[k] || null; },
  setItem: function(k, v) { this._store[k] = String(v); },
  removeItem: function(k) { delete this._store[k]; }
};

global.performance = { now: () => Date.now() };
global.requestAnimationFrame = () => {};
global.cancelAnimationFrame = (id) => clearTimeout(id);
global.fetch = () => Promise.resolve({
  ok: true,
  json: () => Promise.resolve({ success: true }),
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
});

global.Audio = class {
  constructor() { this.currentTime = 0; this.preload = ""; }
  play() { return Promise.resolve(); }
  pause() {}
};

global.Image = class {
  constructor() { this.src = ""; this.onload = null; this.complete = false; this.naturalWidth = 0; }
};

// ── Load game code ────────────────────────────────────────────────────────────
const projectRoot = path.join(__dirname, "..");
const gameSource  = fs.readFileSync(path.join(projectRoot, "game.js"), "utf8");

function createGameInstance() {
  const instrumented = gameSource.replace(
    "const game = new DodgeArenaGame(canvas);",
    "const game = global.exportedGame = new DodgeArenaGame(canvas);"
  );
  eval(instrumented);
  if (eventListeners["DOMContentLoaded"]) {
    eventListeners["DOMContentLoaded"].forEach(fn => fn());
  }
  return global.exportedGame;
}

function makeHostGame() {
  const g = createGameInstance();
  g.isHost = true;
  g.peer = { id: "host-peer" };
  g.lobbyRoomCode = "ELITE_TEST";
  g.lobbyPlayers = new Map([
    ["host-peer",  { name: "Host",  shape: "square", isHost: true  }],
    ["guest-peer", { name: "Guest", shape: "circle", isHost: false }],
  ]);
  g._broadcastReliable   = () => {};
  g._broadcastUnreliable = () => {};
  g.mpConnections        = new Map();
  g.floatingTexts        = g.floatingTexts || [];
  return g;
}

function makeGuestGame() {
  const g = createGameInstance();
  g.isHost = false;
  g.hostPeerId = "host-peer";
  g.peer   = { id: "guest-peer" };
  g.mpConnections        = new Map();
  g.floatingTexts        = g.floatingTexts || [];
  return g;
}

// ── SUITE 1: Phase Transitions & Threshold Evaluations ────────────────────────
console.log("\n── Suite 1: Score Threshold Transitions (30 / 70 / 120 / 200) ──");

{
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  assertEqual(g.mpState.currentPhase, 0, "1a: initial phase is 0 when score < 30");

  g.mpState.teamScore = 30;
  let sentMsg = null;
  g._broadcastReliable = (msg) => { sentMsg = msg; };
  g.mpUpdateElite(0.016);
  assertEqual(g.mpState.currentPhase, 1, "1b: transitions to Phase 1 at 30 points");
  assertEqual(sentMsg && sentMsg.type, "MP_PHASE_TRANSITION", "1c: broadcasts MP_PHASE_TRANSITION");
  assertEqual(sentMsg && sentMsg.phase, 1, "1d: broadcast payload indicates phase 1");
}

{
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  g.mpState.teamScore = 70;
  g.mpUpdateElite(0.016);
  assertEqual(g.mpState.currentPhase, 2, "1e: transitions to Phase 2 at 70 points");
}

{
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  g.mpState.teamScore = 120;
  g.mpUpdateElite(0.016);
  assertEqual(g.mpState.currentPhase, 3, "1f: transitions to Phase 3 at 120 points");
}

{
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  g.mpState.teamScore = 200;
  g.mpUpdateElite(0.016);
  assertEqual(g.mpState.currentPhase, 4, "1g: transitions to Phase 4 at 200 points");
  assertEqual(g.mpState.scoreActive, false, "1h: scoreActive permanently set to false at 200 points");
}

// ── SUITE 2: Smoke Bombs (30 pts) ─────────────────────────────────────────────
console.log("\n── Suite 2: Smoke Bombs (30 pts Threshold) ─────────────────────");

{
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  g.mpState.teamScore = 30; // Phase 1
  g.mpState.hazardTimers.smoke = 4.0; // Trigger spawn interval
  g.mpUpdateElite(0.016);
  assert(g.mpState.hazards.smokeBombs.length >= 1, "2a: smoke bomb spawned in Phase 1");
  const sb = g.mpState.hazards.smokeBombs[0];
  assert(Math.abs(sb.fuse - (2.0 - 0.016)) < 0.001, "2b: smoke bomb has exact 2.0s initial fuse");
  assertEqual(sb.duration, 3.0, "2c: smoke bomb has exact 3.0s duration");
  assertEqual(sb.state, "FUSE", "2d: initial state is FUSE");
}

{
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  g.mpState.teamScore = 30;
  // Create an active smoke bomb centered at player position
  const p = g.mpState.players.get("host-peer");
  p.hp = 100;
  g.mpState.hazards.smokeBombs = [{
    id: "sb_test",
    x: p.x + 10, y: p.y + 10,
    radius: 50,
    fuse: 0.1,
    duration: 3.0,
    state: "FUSE",
    enteredPlayers: new Set()
  }];

  // Step 0.2s: fuse finishes -> state becomes ACTIVE and deals 20 HP on entry
  g.mpUpdateElite(0.2);
  const sb = g.mpState.hazards.smokeBombs[0];
  assertEqual(sb.state, "ACTIVE", "2e: fuse expires and enters ACTIVE state");
  assertEqual(p.hp, 80, "2f: player takes exactly 20 HP damage on smoke bomb entry");
  assert(sb.enteredPlayers.has("host-peer"), "2g: player recorded in enteredPlayers");

  // Step another 0.2s while player stays inside: damage should NOT repeat
  g.mpUpdateElite(0.2);
  assertEqual(p.hp, 80, "2h: no continuous tick damage while staying inside smoke");
}

{
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  g.mpState.teamScore = 30;
  // Test expiration after 3s duration
  g.mpState.hazards.smokeBombs = [{
    id: "sb_exp",
    x: 200, y: 200,
    radius: 50,
    fuse: 0,
    duration: 0.1,
    state: "ACTIVE",
    enteredPlayers: new Set()
  }];
  g.mpUpdateElite(0.2);
  assertEqual(g.mpState.hazards.smokeBombs.length, 0, "2i: smoke bomb removed when duration expires");
}

// ── SUITE 3: Toxic Gas (70 pts) ───────────────────────────────────────────────
console.log("\n── Suite 3: Toxic Gas (70 pts Threshold) ───────────────────────");

{
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  g.mpState.teamScore = 70; // Phase 2
  g.mpState.hazardTimers.gas = 5.0; // Trigger 5s spawn interval
  g.mpUpdateElite(0.016);
  assert(g.mpState.hazards.toxicGas.length >= 1, "3a: toxic gas spawned in Phase 2");
  const tg = g.mpState.hazards.toxicGas[0];
  assert(Math.abs(tg.duration - (10.0 - 0.016)) < 0.001, "3b: toxic gas has exact 10.0s initial duration");
  assert(Math.abs(tg.tickTimer - (0.5 - 0.016)) < 0.001, "3c: toxic gas deals damage every 0.5s");
}

{
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  g.mpState.teamScore = 70;
  const p = g.mpState.players.get("host-peer");
  p.hp = 100;
  g.mpState.hazards.toxicGas = [{
    id: "tg_dmg",
    x: p.x + 10, y: p.y + 10,
    radius: 65,
    duration: 10.0,
    tickTimer: 0.1 // about to tick
  }];

  g.mpUpdateElite(0.15); // triggers tick
  assertEqual(p.hp, 90, "3d: toxic gas deals exactly 10 HP damage per tick");

  // Step 0.5s more inside the cloud -> second tick
  g.mpUpdateElite(0.5);
  assertEqual(p.hp, 80, "3e: toxic gas deals second 10 HP damage tick after 0.5s");
}

{
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  g.mpState.teamScore = 70;
  // Test expiration after 10s duration
  g.mpState.hazards.toxicGas = [{
    id: "tg_exp",
    x: 400, y: 400,
    radius: 65,
    duration: 0.1,
    tickTimer: 0.5
  }];
  g.mpUpdateElite(0.2);
  assertEqual(g.mpState.hazards.toxicGas.length, 0, "3f: toxic gas cloud removed after 10s duration");
}

// ── SUITE 4: Laser Wall & Mini Enemy Halting (120 pts) ─────────────────────────
console.log("\n── Suite 4: Laser Wall & Mini Enemy Halting (120 pts) ──────────");

{
  // Test mini enemy spawning is halted at 120 points
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  g.mpState.teamScore = 120; // 120 points
  g.mpState.directorTimer = 10.0; // exceed spawn interval
  const countBefore = g.mpState.enemies.size;
  g.mpUpdateEnemyAI(0.016);
  assertEqual(g.mpState.enemies.size, countBefore, "4a: mini enemy spawning halted at 120 pts in Elite Mode");
}

{
  // Test laser wall activation at 120 pts
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  g.mpState.teamScore = 120;
  g.mpState.hazardTimers.laser = 15.0; // exact 15s cycle
  g.mpUpdateElite(0.1);
  assert(g.mpState.hazards.laserWall !== null, "4b: laser wall activates at 120 pts after 15s cycle");
  assertEqual(g.mpState.hazards.laserWall.active, true, "4c: laser wall is active");
}

{
  // Test laser wall 60 HP direct hit damage
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  g.mpState.teamScore = 120;
  const p = g.mpState.players.get("host-peer");
  p.hp = 100;
  p.x = 200; p.y = 300;

  g.mpState.hazards.laserWall = {
    id: "lw_hit",
    x: 195, // Sweeping right towards player at x=200
    width: 16,
    speed: 240,
    active: true,
    hitPlayers: new Set()
  };

  g.mpUpdateElite(0.05); // laser sweeps over player
  assertEqual(p.hp, 40, "4d: laser wall deals exact 60 HP damage on direct hit (100 -> 40)");
  assert(g.mpState.hazards.laserWall.hitPlayers.has("host-peer"), "4e: player recorded in hitPlayers");

  // Step further while player is still at x=200 and laser passes: no double-damage
  g.mpUpdateElite(0.05);
  assertEqual(p.hp, 40, "4f: laser wall hits player at most once per sweep pass");
}

// ── SUITE 5: Boss Transition Threshold (200 pts) ──────────────────────────────
console.log("\n── Suite 5: Boss Spawn Transition Threshold (200 pts) ──────────");

{
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  g.mpState.teamScore = 195;
  g.mpUpdateElite(0.016);
  // Add some active toxic gas and a laser wall
  g.mpState.hazards.toxicGas = [{ id: "tg1", x: 100, y: 100, radius: 65, duration: 8, tickTimer: 0.5 }];
  g.mpState.hazards.laserWall = { id: "lw1", x: 300, width: 16, speed: 240, active: true, hitPlayers: new Set() };
  g.mpState.hazards.smokeBombs = [{ id: "sb1", x: 400, y: 400, radius: 50, fuse: 1.0, duration: 3.0, state: "FUSE", enteredPlayers: new Set() }];

  // Reach 200 points
  g.mpState.teamScore = 200;
  g.mpUpdateElite(0.016);

  assertEqual(g.mpState.currentPhase, 4, "5a: Phase 4 triggered at 200 points");
  assertEqual(g.mpState.hazards.toxicGas.length, 0, "5b: toxic gas stopped and cleared immediately at 200 pts");
  assertEqual(g.mpState.hazards.laserWall, null, "5c: laser wall stopped and cleared immediately at 200 pts");
  assert(g.mpState.hazards.smokeBombs.length >= 1, "5d: smoke bombs persist and continue at 200 pts");
  assertEqual(g.mpState.scoreActive, false, "5e: score collection halted permanently at 200 pts");
}

{
  // Test score pickups are rejected when scoreActive is false
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  g.mpState.teamScore = 200;
  g.mpState.scoreActive = false;
  const p = g.mpState.players.get("host-peer");
  g.mpState.pickups = [{ id: 99, type: "SCORE", x: p.x + 5, y: p.y + 5 }];
  g.mpUpdateElite(0.1);
  assertEqual(g.mpState.teamScore, 200, "5f: score does not increment past 200 pts");
}

// ── SUITE 6: Snapshot Synchronization (Host -> Guest) ─────────────────────────
console.log("\n── Suite 6: Snapshot Sync of Hazards & Phase ───────────────────");

{
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  g.mpState.currentPhase = 3;
  g.mpState.hazards = {
    smokeBombs: [{ id: "sb_sync", x: 100, y: 100, radius: 50, state: "ACTIVE", fuse: 0, duration: 2.5, enteredPlayers: new Set() }],
    toxicGas: [{ id: "tg_sync", x: 300, y: 300, radius: 65, duration: 7.2, tickTimer: 0.5 }],
    laserWall: { x: 450, width: 16, active: true }
  };

  let captured = null;
  g._broadcastUnreliable = (msg) => { captured = msg; };
  g.mpBroadcastSnapshot();

  assert(captured !== null, "6a: snapshot broadcast");
  assertEqual(captured.currentPhase, 3, "6b: snapshot contains currentPhase=3");
  assert(captured.hazards !== undefined, "6c: snapshot contains hazards payload");
  assertEqual(captured.hazards.smokeBombs.length, 1, "6d: snapshot contains smoke bomb");
  assertEqual(captured.hazards.toxicGas.length, 1, "6e: snapshot contains toxic gas cloud");
  assert(captured.hazards.laserWall !== null && captured.hazards.laserWall.active, "6f: snapshot contains laser wall");
}

{
  const guest = makeGuestGame();
  guest.mpState = {
    players: new Map(), enemies: new Map(), projectiles: [], mines: [],
    pickups: [], teamScore: 0, processedEvents: new Set(), seq: 0,
    currentPhase: 0,
    hazards: { smokeBombs: [], toxicGas: [], laserWall: null }
  };

  guest.mpApplySnapshot({
    seq: 5,
    players: [], enemies: [], projectiles: [], mines: [],
    currentPhase: 2,
    teamScore: 85,
    hazards: {
      smokeBombs: [{ id: "sb_g", x: 120, y: 140, radius: 50, state: "FUSE", fuse: 1.5, duration: 3.0 }],
      toxicGas: [{ id: "tg_g", x: 350, y: 250, radius: 65, duration: 9.0 }],
      laserWall: null
    }
  });

  assertEqual(guest.mpState.currentPhase, 2, "6g: guest receives and updates currentPhase");
  assertEqual(guest.mpState.teamScore, 85, "6h: guest receives updated teamScore");
  assertEqual(guest.mpState.hazards.smokeBombs.length, 1, "6i: guest mirrors smoke bombs");
  assertEqual(guest.mpState.hazards.toxicGas.length, 1, "6j: guest mirrors toxic gas");
  assertEqual(guest.mpState.hazards.laserWall, null, "6k: guest mirrors null laser wall");
}

// ── SUITE 7: Solo Mode Isolation ──────────────────────────────────────────────
console.log("\n── Suite 7: Solo Mode Isolation ─────────────────────────────────");

{
  const solo = createGameInstance();
  solo.startMatch("SOLO");
  assertEqual(solo.mode, "SOLO", "7a: Solo mode active");
  assertEqual(solo.mpState, null, "7b: mpState strictly null in Solo mode");
  assertEqual(solo.p1.lives, 3, "7c: Solo player has 3 lives");

  // Hazards drawing does not run in Solo
  let drewWithoutCrash = true;
  try {
    solo.gameTime = 1.0;
    solo.draw();
  } catch(e) {
    drewWithoutCrash = false;
  }
  assert(drewWithoutCrash, "7d: Solo mode draw() runs cleanly without hazard errors");
}

// ── Results ───────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(60)}`);
console.log("Milestone 5B — Elite Hazards & Thresholds");
console.log(`  PASSED: ${passed}`);
console.log(`  FAILED: ${failed}`);
console.log(`  TOTAL:  ${passed + failed}`);
console.log(`${"─".repeat(60)}`);

if (failed > 0) {
  console.error("\n⚠️  Some tests failed.");
  process.exit(1);
} else {
  console.log("\n✅  All Phase 5B tests passed.");
  process.exit(0);
}
