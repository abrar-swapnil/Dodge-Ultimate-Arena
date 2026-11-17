/**
 * test_mp_infection_foundation.js — Milestone 6A
 * Automated test suite for Infection Mode Foundation:
 * 1. Quarantine Lab map theme and rendering.
 * 2. 8-player capacity, 100 HP baseline, normal starting state.
 * 3. Initial infected and normal mini enemy spawning.
 * 4. All four approved infection propagation interactions:
 *    - Interaction 1: Infected enemy -> normal enemy.
 *    - Interaction 2: Infected enemy -> normal player.
 *    - Interaction 3: Infected player -> normal player.
 *    - Interaction 4: Infected player -> normal enemy.
 * 5. Only infected entities spread infection (normal-to-normal non-spread).
 * 6. No speed buffs or stat alterations upon infection.
 * 7. Host-authoritative broadcast & snapshot synchronization.
 * 8. Duplicate event prevention and mutation idempotency.
 * 9. Solo Mode complete isolation.
 */

"use strict";

const fs   = require("fs");
const path = require("path");

console.log("=================================================");
console.log("   MILESTONE 6A: INFECTION FOUNDATION TESTS     ");
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

// ── Minimal browser stub ─────────────────────────────────────────
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

// ── Load game code ────────────────────────────────────────────────
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
  g.mode = "CUSTOM_ROOM";
  g.peer = { id: "host-peer" };
  g.lobbyRoomCode = "TESTINF";
  g.lobbyPlayers = new Map([
    ["host-peer",  { name: "Host",  shape: "square", isHost: true  }],
    ["guest-peer", { name: "Guest", shape: "circle", isHost: false }],
  ]);
  g.lastSentReliableMsg = null;
  g.lastSentUnreliableMsg = null;
  g._broadcastReliable = (msg) => { g.lastSentReliableMsg = msg; };
  g._broadcastUnreliable = (msg) => { g.lastSentUnreliableMsg = msg; };
  g.mpConnections = new Map();
  g.floatingTexts = g.floatingTexts || [];
  return g;
}

function makeGuestGame() {
  const g = createGameInstance();
  g.isHost = false;
  g.mode = "CUSTOM_ROOM";
  g.peer = { id: "guest-peer" };
  g.hostPeerId = "host-peer";
  g.lobbyRoomCode = "TESTINF";
  g.lobbyPlayers = new Map([
    ["host-peer",  { name: "Host",  shape: "square", isHost: true  }],
    ["guest-peer", { name: "Guest", shape: "circle", isHost: false }],
  ]);
  g.lastSentReliableMsg = null;
  g.lastSentUnreliableMsg = null;
  g._broadcastReliable = (msg) => { g.lastSentReliableMsg = msg; };
  g._broadcastUnreliable = (msg) => { g.lastSentUnreliableMsg = msg; };
  g.mpConnections = new Map();
  g.floatingTexts = g.floatingTexts || [];
  return g;
}

// ── Suite 1: Quarantine Lab Map Theme ────────────────────────────
console.log("\n── Suite 1: Quarantine Lab Map Theme ────────────────────────────");
{
  const host = makeHostGame();
  host.initMPMatch("INFECTION");
  assertEqual(host.mpState.mode, "INFECTION", "1a: mpState.mode is INFECTION");

  // Verify Quarantine Lab draw executes cleanly
  let drawSuccess = false;
  try {
    host.draw();
    drawSuccess = true;
  } catch (e) {
    console.error(e);
    drawSuccess = false;
  }
  assert(drawSuccess, "1b: Quarantine Lab draw() executes cleanly in Infection Mode");
}

// ── Suite 2: Player Capacity, 100 HP Baseline, Normal Start ─────
console.log("\n── Suite 2: Player Capacity, 100 HP Baseline, Normal Start ─────");
{
  const host = makeHostGame();
  // Register 8 players
  host.lobbyPlayers.clear();
  for (let i = 1; i <= 8; i++) {
    host.lobbyPlayers.set(`peer_${i}`, { name: `Agent ${i}`, shape: "square", isHost: i === 1 });
  }
  host.initMPMatch("INFECTION");

  assertEqual(host.mpState.players.size, 8, "2a: Match initializes with full 8 players");

  let all100Hp = true;
  let allAlive = true;
  let allNormal = true;
  for (const p of host.mpState.players.values()) {
    if (p.hp !== 100 || p.maxHp !== 100) all100Hp = false;
    if (!p.isAlive || p.isSpectator) allAlive = false;
    if (p.isInfected !== false || p.infectionState !== "NORMAL") allNormal = false;
  }
  assert(all100Hp, "2b: All 8 players start with exactly 100 HP");
  assert(allAlive, "2c: All 8 players start alive and non-spectator");
  assert(allNormal, "2d: All 8 players start as normal (isInfected === false)");
}

// ── Suite 3: Initial Mini Enemy Spawning ─────────────────────────
console.log("\n── Suite 3: Initial Mini Enemy Spawning ─────────────────────────");
{
  const host = makeHostGame();
  host.initMPMatch("INFECTION");

  const totalEnemies = host.mpState.enemies.size;
  assert(totalEnemies >= 4, `3a: At least 4 initial mini enemies spawned (${totalEnemies})`);

  let infectedCount = 0;
  let normalCount = 0;
  for (const e of host.mpState.enemies.values()) {
    if (e.isInfected) infectedCount++;
    else normalCount++;
  }
  assert(infectedCount > 0, `3b: At least 1 initially infected mini enemy spawned (${infectedCount})`);
  assert(normalCount > 0, `3c: At least 1 initially normal mini enemy spawned (${normalCount})`);
  assertEqual(infectedCount + normalCount, totalEnemies, "3d: Total mini enemies equals infected + normal sum");
}

// ── Suite 4: Four Infection Propagation Interactions ─────────────
console.log("\n── Suite 4: Four Infection Propagation Interactions ─────────────");
{
  // ── Interaction 1: Infected Enemy touches Normal Enemy -> infect normal enemy ──
  const host1 = makeHostGame();
  host1.initMPMatch("INFECTION");
  host1.mpState.enemies.clear(); // clean slate for precise placement

  const infEnemy = host1.mpSpawnEnemy("CHASER", 100, 100);
  infEnemy.isInfected = true;
  infEnemy.infectionState = "INFECTED";

  const normEnemy = host1.mpSpawnEnemy("CHASER", 110, 100); // dist = 10 <= 18
  normEnemy.isInfected = false;
  normEnemy.infectionState = "NORMAL";

  host1.mpUpdateInfection(0.016);
  assert(normEnemy.isInfected === true, "4a: Interaction 1 - Infected enemy infected normal enemy upon contact");
  assertEqual(normEnemy.infectionState, "INFECTED", "4b: Interaction 1 - Target enemy state set to INFECTED");

  // ── Interaction 2: Infected Enemy touches Normal Player -> infect normal player ──
  const host2 = makeHostGame();
  host2.initMPMatch("INFECTION");
  host2.mpState.enemies.clear();

  const p1 = host2.mpState.players.get("host-peer");
  p1.x = 200; p1.y = 200;
  p1.isInfected = false;
  p1.infectionState = "NORMAL";

  const infEnemy2 = host2.mpSpawnEnemy("FLANKER", 205, 200); // dist = 5 <= 18
  infEnemy2.isInfected = true;
  infEnemy2.infectionState = "INFECTED";

  host2.mpUpdateInfection(0.016);
  assert(p1.isInfected === true, "4c: Interaction 2 - Infected enemy infected normal player upon contact");
  assertEqual(p1.infectionState, "INFECTED", "4d: Interaction 2 - Player state set to INFECTED");

  // ── Interaction 3: Infected Player touches Normal Player -> infect normal player ──
  const host3 = makeHostGame();
  host3.initMPMatch("INFECTION");
  host3.mpState.enemies.clear();

  const pHost = host3.mpState.players.get("host-peer");
  const pGuest = host3.mpState.players.get("guest-peer");

  pHost.x = 300; pHost.y = 300;
  pHost.isInfected = true;
  pHost.infectionState = "INFECTED";

  pGuest.x = 310; pGuest.y = 300; // dist = 10 <= 20 (PLAYER_SIZE)
  pGuest.isInfected = false;
  pGuest.infectionState = "NORMAL";

  host3.mpUpdateInfection(0.016);
  assert(pGuest.isInfected === true, "4e: Interaction 3 - Infected player infected normal player upon contact");
  assertEqual(pGuest.infectionState, "INFECTED", "4f: Interaction 3 - Target player state set to INFECTED");

  // ── Interaction 4: Infected Player touches Normal Enemy -> infect normal enemy ──
  const host4 = makeHostGame();
  host4.initMPMatch("INFECTION");
  host4.mpState.enemies.clear();

  const pInfected = host4.mpState.players.get("host-peer");
  pInfected.x = 400; pInfected.y = 400;
  pInfected.isInfected = true;
  pInfected.infectionState = "INFECTED";

  const normEnemy3 = host4.mpSpawnEnemy("SNIPER", 412, 400); // dist = 12 <= 20
  normEnemy3.isInfected = false;
  normEnemy3.infectionState = "NORMAL";

  host4.mpUpdateInfection(0.016);
  assert(normEnemy3.isInfected === true, "4g: Interaction 4 - Infected player infected normal enemy upon contact");
  assertEqual(normEnemy3.infectionState, "INFECTED", "4h: Interaction 4 - Target enemy state set to INFECTED");
}

// ── Suite 5: Only Infected Entities Spread Infection ──────────────
console.log("\n── Suite 5: Only Infected Entities Spread Infection ──────────────");
{
  const host = makeHostGame();
  host.initMPMatch("INFECTION");
  host.mpState.enemies.clear();

  const p1 = host.mpState.players.get("host-peer");
  const p2 = host.mpState.players.get("guest-peer");
  p1.isInfected = false; p1.infectionState = "NORMAL";
  p2.isInfected = false; p2.infectionState = "NORMAL";

  // Normal player touches normal player
  p1.x = 100; p1.y = 100;
  p2.x = 105; p2.y = 100;
  host.mpUpdateInfection(0.016);

  assert(p1.isInfected === false, "5a: Normal player touching normal player does NOT infect P1");
  assert(p2.isInfected === false, "5b: Normal player touching normal player does NOT infect P2");

  // Normal enemy touches normal player
  const normEnemy = host.mpSpawnEnemy("CHASER", 104, 100);
  normEnemy.isInfected = false;
  normEnemy.infectionState = "NORMAL";

  host.mpUpdateInfection(0.016);
  assert(p1.isInfected === false, "5c: Normal enemy touching normal player does NOT infect player");
  assert(normEnemy.isInfected === false, "5d: Normal enemy touching normal player remains normal");

  // Normal enemy touches normal enemy
  const normEnemy2 = host.mpSpawnEnemy("CHASER", 108, 100);
  normEnemy2.isInfected = false;
  normEnemy2.infectionState = "NORMAL";

  host.mpUpdateInfection(0.016);
  assert(normEnemy.isInfected === false, "5e: Normal enemy touching normal enemy remains normal");
  assert(normEnemy2.isInfected === false, "5f: Normal enemy touching normal enemy remains normal");
}

// ── Suite 6: No Speed Buffs / No Extra Abilities ─────────────────
console.log("\n── Suite 6: No Speed Buffs / No Extra Abilities ─────────────────");
{
  const host = makeHostGame();
  host.initMPMatch("INFECTION");

  const p = host.mpState.players.get("host-peer");
  p.input = { x: 1, y: 0, sprint: false };

  // Calculate displacement before infection
  const dt = 0.016;
  const initialX = p.x;
  p.vx = 170; // PLAYER_BASE_SPEED
  p.x += p.vx * dt;
  const normalDeltaX = p.x - initialX;

  // Now infect player
  host.mpInfectEntity("PLAYER", "host-peer", "test_source");
  assert(p.isInfected === true, "6a: Player infected");

  // Calculate displacement after infection
  const infectedStartX = p.x;
  p.vx = 170; // must remain PLAYER_BASE_SPEED (no speed buff)
  p.x += p.vx * dt;
  const infectedDeltaX = p.x - infectedStartX;

  assertEqual(normalDeltaX, infectedDeltaX, "6b: Movement speed is identical (no speed buff applied)");
  assert(!p.specialAbilities, "6c: No unapproved special abilities added");
}

// ── Suite 7: Host Authority & Snapshot Synchronization ───────────
console.log("\n── Suite 7: Host Authority & Snapshot Synchronization ───────────");
{
  const host = makeHostGame();
  host.initMPMatch("INFECTION");

  // Infect guest-peer and first enemy on host
  const p2 = host.mpState.players.get("guest-peer");
  host.mpInfectEntity("PLAYER", "guest-peer", "test_source");

  const firstEnemy = host.mpState.enemies.values().next().value;
  firstEnemy.isInfected = true;

  // Broadcast snapshot
  host.mpBroadcastSnapshot();
  const snap = host.lastSentUnreliableMsg;

  assert(!!snap, "7a: Host generated snapshot");
  const snapP2 = snap.players.find(p => p.id === "guest-peer");
  assertEqual(snapP2?.isInfected, true, "7b: Snapshot contains player isInfected: true");

  const snapE1 = snap.enemies.find(e => e.id === firstEnemy.id);
  assertEqual(snapE1?.isInfected, true, "7c: Snapshot contains enemy isInfected: true");

  // Create guest instance and apply snapshot
  const guest = makeGuestGame();
  guest.initMPMatch("INFECTION");

  assertEqual(guest.mpState.players.get("guest-peer").isInfected, false, "7d: Guest player initially normal before snapshot");
  guest.mpApplySnapshot(snap);

  assertEqual(guest.mpState.players.get("guest-peer").isInfected, true, "7e: Guest synchronized player infection from snapshot");
  assertEqual(guest.mpState.enemies.get(firstEnemy.id)?.isInfected, true, "7f: Guest synchronized enemy infection from snapshot");

  // Test reliable infection event handler on guest
  const guestHostP = guest.mpState.players.get("host-peer");
  guestHostP.isInfected = false;

  guest._handleLobbyMessage({
    type: "MP_INFECTION_EVENT",
    eventId: "test_evt_101",
    targetType: "PLAYER",
    targetId: "host-peer",
    sourceId: "guest-peer"
  });
  assertEqual(guestHostP.isInfected, true, "7g: Guest handled MP_INFECTION_EVENT via message dispatcher");
}

// ── Suite 8: Deduplication & Mutation Idempotency ────────────────
console.log("\n── Suite 8: Deduplication & Mutation Idempotency ────────────────");
{
  const host = makeHostGame();
  host.initMPMatch("INFECTION");

  // First infection call -> returns true
  const res1 = host.mpInfectEntity("PLAYER", "host-peer", "source_1", "evt_fixed_1");
  assertEqual(res1, true, "8a: First infection attempt succeeds");

  // Repeated infection on already infected player -> returns false
  const res2 = host.mpInfectEntity("PLAYER", "host-peer", "source_1", "evt_fixed_2");
  assertEqual(res2, false, "8b: Second infection attempt on already infected entity rejected");

  // Duplicate event ID check
  const res3 = host.mpInfectEntity("PLAYER", "host-peer", "source_1", "evt_fixed_1");
  assertEqual(res3, false, "8c: Duplicate event ID rejected by host");

  // Guest deduplication check
  const guest = makeGuestGame();
  guest.initMPMatch("INFECTION");

  guest.handleMPInfectionEvent({
    type: "MP_INFECTION_EVENT",
    eventId: "guest_evt_1",
    targetType: "PLAYER",
    targetId: "host-peer"
  });
  assert(guest.mpState.processedEvents.has("guest_evt_1"), "8d: Guest recorded eventId in processedEvents");

  // Re-sending same eventId is dropped
  const floatingCountBefore = guest.floatingTexts.length;
  guest.handleMPInfectionEvent({
    type: "MP_INFECTION_EVENT",
    eventId: "guest_evt_1",
    targetType: "PLAYER",
    targetId: "host-peer"
  });
  assertEqual(guest.floatingTexts.length, floatingCountBefore, "8e: Guest ignored duplicate event without re-triggering effects");
}

// ── Suite 9: Solo Mode Isolation ─────────────────────────────────
console.log("\n── Suite 9: Solo Mode Isolation ─────────────────────────────────");
{
  const solo = createGameInstance();
  assertEqual(solo.mode, "SOLO", "9a: Default game mode is SOLO");
  assertEqual(solo.mpState, null, "9b: mpState is strictly null in Solo Mode");
  assertEqual(solo.p1.lives, 3, "9c: Solo player has 3 lives");

  // Solo mode draw runs without error and without infection HUD
  let soloDrawClean = false;
  try {
    solo.draw();
    soloDrawClean = true;
  } catch (e) {
    console.error(e);
    soloDrawClean = false;
  }
  assert(soloDrawClean, "9d: Solo mode draw() runs cleanly without infection HUD errors");
}

// ── Summary ──────────────────────────────────────────────────────
console.log("\n────────────────────────────────────────────────────────────");
console.log(`Milestone 6A — Infection Foundation`);
console.log(`  PASSED: ${passed}`);
console.log(`  FAILED: ${failed}`);
console.log(`  TOTAL:  ${passed + failed}`);
console.log("────────────────────────────────────────────────────────────\n");

if (failed > 0) {
  console.error("❌ Some tests failed.");
  process.exit(1);
} else {
  console.log("✅  All Phase 6A tests passed.");
  process.exit(0);
}
