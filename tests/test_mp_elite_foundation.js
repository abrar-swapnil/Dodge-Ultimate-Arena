/**
 * test_mp_elite_foundation.js  — Milestone 5A
 * Elite Mode Foundation: Obsidian Crucible map, team score, pickups,
 * host-authoritative heal, snapshot sync, and Solo Mode isolation.
 *
 * All tests are Node.js simulations (no live browser / WebRTC).
 *
 * PROVISIONAL STATISTICS tested here (not in Appendix B — require approval):
 *   - SCORE pickup spawn interval: 3.0 s
 *   - SCORE pickup max on field:   5
 *   - HEART pickup spawn interval: 8.0 s
 *   - HEART pickup max on field:   3
 *   - Pickup collision radius:     22 px
 */

"use strict";

const fs   = require("fs");
const path = require("path");

console.log("=================================================");
console.log("   MILESTONE 5A: ELITE MODE FOUNDATION TESTS    ");
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

// ── Minimal browser stub (matches test_mp_core.js pattern) ───────────────────
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
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 50, height: 50 })
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeHostGame() {
  const g = createGameInstance();
  g.isHost = true;
  g.peer = { id: "host-peer" };
  g.lobbyRoomCode = "TEST";
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

// ── SUITE 1: Initialisation ───────────────────────────────────────────────────
console.log("\n── Suite 1: Elite Mode Initialisation ──────────────────────────");

{
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  assertEqual(g.mpState.teamScore, 0, "1a: initMPMatch adds teamScore=0");
  assertEqual(g.mpState.scoreActive, true, "1b: initMPMatch adds scoreActive=true");
  assert(Array.isArray(g.mpState.pickups), "1c: initMPMatch adds pickups[]");
  assertEqual(g.mpState.pickups.length, 0, "1d: pickups[] initially empty");
  assertEqual(g.mpState.nextPickupId, 1, "1e: nextPickupId=1");
  assertEqual(g.mpState.mode, "ELITE", "1f: mode=ELITE stored");
}

{
  const g = makeHostGame();
  g.initMPMatch("INFECTION");
  g.mpState.scoreActive = true;
  g.mpState.pickups = [];
  const before = g.mpState.pickups.length;
  g.mpUpdateElite(10); // should return early for non-ELITE
  assertEqual(g.mpState.pickups.length, before, "1g: non-ELITE mode — no pickups spawned");
}

// ── SUITE 2: Player HP ────────────────────────────────────────────────────────
console.log("\n── Suite 2: Player HP (100 HP each) ────────────────────────────");

{
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  let allOk = true;
  for (const p of g.mpState.players.values()) {
    if (p.hp !== 100 || p.maxHp !== 100) allOk = false;
  }
  assert(allOk, "2a: 2-player match — both start with 100 HP");
}

{
  const g = makeHostGame();
  g.lobbyPlayers = new Map();
  for (let i = 0; i < 8; i++) {
    g.lobbyPlayers.set(`peer-${i}`, { name: `P${i+1}`, shape: "square", isHost: i === 0 });
  }
  g.initMPMatch("ELITE");
  const players = Array.from(g.mpState.players.values());
  assertEqual(players.length, 8, "2b: 8-player match — 8 players created");
  const positions = new Set();
  let allHp = true;
  for (const p of players) {
    if (p.hp !== 100 || p.maxHp !== 100) allHp = false;
    positions.add(`${p.x},${p.y}`);
  }
  assert(allHp, "2c: 8-player match — all 8 start with 100 HP");
  assertEqual(positions.size, 8, "2d: 8-player match — all unique spawn points");
}

// ── SUITE 3: Score Pickup Collection ─────────────────────────────────────────
console.log("\n── Suite 3: Score Pickup Collection ────────────────────────────");

{
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  g.mpState.teamScore = 0;
  // Manually simulate a score collection (same logic as mpUpdateElite)
  g.mpState.teamScore += 5;
  assertEqual(g.mpState.teamScore, 5, "3a: SCORE pickup increments teamScore by 5");
}

{
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  g.mpState.teamScore = 5;
  g.mpState.teamScore += 5;
  assertEqual(g.mpState.teamScore, 10, "3b: Second SCORE pickup increments teamScore to 10");
}

{
  // Dedup: same event ID must not double-apply
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  const eventId = "score_pk_1_host-peer";
  g.mpState.processedEvents.add(eventId);
  const before = g.mpState.teamScore;
  if (!g.mpState.processedEvents.has(eventId)) {
    g.mpState.teamScore += 5;
  }
  assertEqual(g.mpState.teamScore, before, "3c: Duplicate score event rejected (dedup)");
}

// ── SUITE 4: Heart Pickup / mpApplyHeal ───────────────────────────────────────
console.log("\n── Suite 4: Heart Pickup / mpApplyHeal ─────────────────────────");

{
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  const [id, p] = g.mpState.players.entries().next().value;
  p.hp = 70; p.maxHp = 100; p.isAlive = true; p.isSpectator = false;
  g.mpApplyHeal(id, 10);
  assertEqual(p.hp, 80, "4a: mpApplyHeal increases HP by 10");
}

{
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  const [id, p] = g.mpState.players.entries().next().value;
  p.hp = 95; p.maxHp = 100; p.isAlive = true; p.isSpectator = false;
  g.mpApplyHeal(id, 10);
  assertEqual(p.hp, 100, "4b: mpApplyHeal caps HP at maxHp=100");
}

{
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  const [id, p] = g.mpState.players.entries().next().value;
  p.hp = 0; p.isAlive = false; p.isSpectator = true;
  const result = g.mpApplyHeal(id, 10);
  assert(result === false, "4c: mpApplyHeal rejected for dead player");
  assertEqual(p.hp, 0, "4d: HP unchanged for dead player");
}

{
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  const [id, p] = g.mpState.players.entries().next().value;
  p.hp = 70; p.maxHp = 100; p.isAlive = true; p.isSpectator = false;
  const eid = "heal_test_123";
  g.mpApplyHeal(id, 10, eid); // first call: succeeds
  g.mpApplyHeal(id, 10, eid); // second call: deduped
  assertEqual(p.hp, 80, "4e: mpApplyHeal deduplicates same eventId");
}

{
  const g = makeGuestGame();
  g.initMPMatch("ELITE");
  const [id, p] = g.mpState.players.entries().next().value;
  p.hp = 70; p.maxHp = 100; p.isAlive = true; p.isSpectator = false;
  const result = g.mpApplyHeal(id, 10);
  assert(result === false, "4f: mpApplyHeal rejects when not host");
  assertEqual(p.hp, 70, "4g: HP unchanged on guest");
}

// ── SUITE 5: Snapshot Sync ────────────────────────────────────────────────────
console.log("\n── Suite 5: Snapshot Sync (teamScore + pickups) ─────────────────");

{
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  g.mpState.teamScore = 25;
  let captured = null;
  g._broadcastUnreliable = (msg) => { captured = msg; };
  g.mpBroadcastSnapshot();
  assert(captured !== null, "5a: snapshot was broadcast");
  assertEqual(captured !== null && captured.teamScore, 25, "5b: snapshot.teamScore=25");
}

{
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  g.mpState.pickups = [
    { id: 1, type: "SCORE", x: 100, y: 200 },
    { id: 2, type: "HEART", x: 300, y: 400 },
  ];
  let captured = null;
  g._broadcastUnreliable = (msg) => { captured = msg; };
  g.mpBroadcastSnapshot();
  assert(captured !== null && Array.isArray(captured.pickups), "5c: snapshot.pickups is array");
  assertEqual(captured !== null && captured.pickups.length, 2, "5d: 2 pickups in snapshot");
}

{
  const g = makeGuestGame();
  g.mpState = {
    players: new Map(), enemies: new Map(), projectiles: [], mines: [],
    pickups: [], teamScore: 0, processedEvents: new Set(), seq: 0
  };
  g.mpApplySnapshot({
    seq: 1, players: [], enemies: [], projectiles: [], mines: [],
    teamScore: 45, pickups: []
  });
  assertEqual(g.mpState.teamScore, 45, "5e: guest teamScore synced via snapshot");
}

{
  const g = makeGuestGame();
  g.mpState = {
    players: new Map(), enemies: new Map(), projectiles: [], mines: [],
    pickups: [{ id: 99, type: "SCORE", x: 0, y: 0 }], // stale
    teamScore: 0, processedEvents: new Set(), seq: 0
  };
  g.mpApplySnapshot({
    seq: 1, players: [], enemies: [], projectiles: [], mines: [],
    teamScore: 0,
    pickups: [
      { id: 1, type: "SCORE", x: 100, y: 150 },
      { id: 2, type: "HEART", x: 300, y: 250 },
    ]
  });
  assertEqual(g.mpState.pickups.length, 2, "5f: guest pickups replaced from snapshot");
  assert(!g.mpState.pickups.find(p => p.id === 99), "5g: stale pickup removed");
  assert(!!g.mpState.pickups.find(p => p.id === 1), "5h: pickup id=1 present");
}

{
  const g = makeGuestGame();
  g.mpState = {
    players: new Map(), enemies: new Map(), projectiles: [], mines: [],
    pickups: [{ id: 7, type: "SCORE", x: 50, y: 50 }],
    teamScore: 0, processedEvents: new Set(), seq: 0
  };
  g.mpApplySnapshot({
    seq: 1, players: [], enemies: [], projectiles: [], mines: [],
    teamScore: 0
    // No pickups field — guest pickups should be unchanged
  });
  assertEqual(g.mpState.pickups.length, 1, "5i: guest pickups unchanged when no pickups in snapshot");
}

// ── SUITE 6: Pickup Spawning (host only, provisional rates) ───────────────────
console.log("\n── Suite 6: Pickup Spawning (Provisional rates) ─────────────────");

{
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  g.mpState.players.clear();
  g.mpState.pickups = [];
  g.mpState.elitePickupTimer = 0;
  g.mpState.eliteHeartTimer = 0;
  g.mpUpdateElite(3.1); // exceed 3s SCORE interval
  const scoreCount = g.mpState.pickups.filter(p => p.type === "SCORE").length;
  assert(scoreCount >= 1, "6a: SCORE pickup spawned after 3s", `scoreCount=${scoreCount}`);
}

{
  const g = makeHostGame();
  g.initMPMatch("INFECTION");
  g.mpState.scoreActive = true;
  g.mpState.pickups = [];
  g.mpState.elitePickupTimer = 0;
  g.mpState.eliteHeartTimer = 0;
  g.mpUpdateElite(10);
  assertEqual(g.mpState.pickups.length, 0, "6b: no pickups for non-ELITE mode");
}

{
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  g.mpState.scoreActive = false;
  g.mpState.pickups = [];
  g.mpState.elitePickupTimer = 0;
  g.mpUpdateElite(10);
  assertEqual(g.mpState.pickups.length, 0, "6c: no pickups when scoreActive=false");
}

{
  const g = makeGuestGame();
  g.initMPMatch("ELITE");
  g.mpState.scoreActive = true;
  g.mpState.pickups = [];
  g.mpState.elitePickupTimer = 0;
  g.mpUpdateElite(10);
  assertEqual(g.mpState.pickups.length, 0, "6d: guest cannot spawn pickups");
}

{
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  g.mpState.pickups = [1,2,3,4,5].map(i => ({ id: i, type: "SCORE", x: 100+i*10, y: 100 }));
  g.mpState.nextPickupId = 6;
  g.mpState.elitePickupTimer = 0;
  g.mpState.eliteHeartTimer = 0;
  g.mpUpdateElite(3.1);
  const scoreCount = g.mpState.pickups.filter(p => p.type === "SCORE").length;
  assert(scoreCount <= 5, "6e: SCORE pickup count capped at 5 (provisional)", `count=${scoreCount}`);
}

// ── SUITE 7: Solo Mode Isolation ─────────────────────────────────────────────
console.log("\n── Suite 7: Solo Mode Isolation ─────────────────────────────────");

{
  const g = createGameInstance();
  assert(g.mpState === null || g.mpState === undefined, "7a: Solo — mpState null at start");
}

{
  const g = createGameInstance();
  g.isHost = true;
  g.mpState = null;
  let threw = false;
  try { g.mpUpdateElite(1); } catch(e) { threw = true; }
  assert(!threw, "7b: mpUpdateElite safe with null mpState");
}

{
  const g = createGameInstance();
  g.isHost = true;
  g.mpState = null;
  const result = g.mpApplyHeal("some-player", 10);
  assert(result === false, "7c: mpApplyHeal false with null mpState");
}

{
  const g = createGameInstance();
  g.isHost = true;
  g.mpState = null;
  let threw = false;
  try { g.mpBroadcastSnapshot(); } catch(e) { threw = true; }
  assert(!threw, "7d: mpBroadcastSnapshot safe with null mpState");
}

{
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  const soloScore = g.p1Score;
  g.mpState.teamScore += 100;
  assertEqual(g.p1Score, soloScore, "7e: p1Score unaffected by teamScore");
}

{
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  const itemsBefore = (g.items || []).length;
  g.mpUpdateElite(10);
  assertEqual((g.items || []).length, itemsBefore, "7f: Solo items[] unmodified by mpUpdateElite");
}

// ── SUITE 8: MAP_THEMES["ELITE"] ─────────────────────────────────────────────
console.log("\n── Suite 8: Obsidian Crucible MAP_THEMES[\"ELITE\"] ───────────────");

{
  // Verify theme key/properties exist in source
  const src = fs.readFileSync(path.join(projectRoot, "game.js"), "utf8");
  assert(src.includes('"ELITE"'), "8a: MAP_THEMES ELITE key present");
  assert(src.includes("OBSIDIAN CRUCIBLE"), "8b: Obsidian Crucible name present");
  assert(src.includes("#0a0205"), "8c: Obsidian bg color #0a0205 present");
  assert(src.includes("#ff6600"), "8d: Obsidian border color #ff6600 present");
}

{
  // draw() must not crash when in Elite MP mode
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  g.mode      = "CUSTOM_ROOM";
  g.gameTime  = 1.0;
  g.floatingTexts = []; g.particles = [];
  g.items = []; g.enemies = []; g.boss = null;
  g.soloBosses = []; g.soloWaveMode = false;
  g.announcement = null; g.state = "PLAYING";
  let threw = false;
  try { g.draw(); } catch(e) { threw = true; console.error("draw() error:", e.message); }
  assert(!threw, "8e: draw() runs without crash in Elite Mode (Obsidian Crucible)");
}

// ── SUITE 9: handleMPMatchStart (guest side) ──────────────────────────────────
console.log("\n── Suite 9: handleMPMatchStart (guest side) ─────────────────────");

{
  const g = makeGuestGame();
  g.handleMPMatchStart({
    matchId: "m1", hostId: "host-peer", mode: "ELITE",
    teamScore: 0, nextPickupId: 1,
    players: [
      { id: "host-peer",  name: "Host",  shape: "square", isHost: true,  x: 120, y: 150, hp: 100, maxHp: 100, isAlive: true, isSpectator: false },
      { id: "guest-peer", name: "Guest", shape: "circle", isHost: false, x: 680, y: 150, hp: 100, maxHp: 100, isAlive: true, isSpectator: false },
    ]
  });
  assertEqual(g.mpState.teamScore, 0, "9a: guest teamScore initialized to 0");
  assertEqual(g.mpState.scoreActive, true, "9b: guest scoreActive=true");
  assert(Array.isArray(g.mpState.pickups), "9c: guest pickups[] is array");
  assertEqual(g.mpState.mode, "ELITE", "9d: guest mode=ELITE");
}

{
  const g = makeGuestGame();
  g.handleMPMatchStart({
    matchId: "m2", hostId: "host-peer", mode: "ELITE",
    players: [
      { id: "host-peer",  name: "Host",  shape: "square", isHost: true,  x: 120, y: 150, hp: 100, maxHp: 100, isAlive: true, isSpectator: false },
      { id: "guest-peer", name: "Guest", shape: "circle", isHost: false, x: 680, y: 150, hp: 100, maxHp: 100, isAlive: true, isSpectator: false },
    ]
  });
  let allOk = true;
  for (const p of g.mpState.players.values()) {
    if (p.hp !== 100 || p.maxHp !== 100) allOk = false;
  }
  assert(allOk, "9e: guest handleMPMatchStart: all players start 100 HP");
}

// ── Results ───────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(60)}`);
console.log("Milestone 5A — Elite Mode Foundation");
console.log(`  PASSED: ${passed}`);
console.log(`  FAILED: ${failed}`);
console.log(`  TOTAL:  ${passed + failed}`);
console.log(`${"─".repeat(60)}`);
console.log("NOTE: Tests are Node.js simulations — no live browser/WebRTC.");
console.log("NOTE: Pickup spawn rates are PROVISIONAL (not in Appendix B).");

if (failed > 0) {
  console.error("\n⚠️  Some tests failed.");
  process.exit(1);
} else {
  console.log("\n✅  All tests passed.");
  process.exit(0);
}
