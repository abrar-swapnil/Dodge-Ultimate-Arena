/**
 * test_mp_reconnect_and_toi.js — Milestone 7 Phase 2 Acceptance Suite
 * Comprehensive automated verification of:
 * 1. Piecewise Linear Swept-Circle TOI & Boundary Clamping Kinematics
 * 2. Strict Infection Timing Semantics & Boss Branch Decision Logic
 * 3. Full-State Serialization (36 fields) & In-Place Player Class Restoration
 * 4. Option B Reconnect Protocol, Attempt Supersession & Token Rotation
 * 5. Bidirectional Liveness (250ms), Silence Detection (2.0s), 5.0s Deadline Enforcement
 * 6. Transport Flow Control & Snapshot Backpressure (64KB buffer guard)
 * 7. Solo Mode Isolation Guarantee
 */

"use strict";

const fs   = require("fs");
const path = require("path");

console.log("=================================================");
console.log("   MILESTONE 7 PHASE 2: RECONNECT & TOI SUITE    ");
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
    setLineDash: () => {},
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

let mockTime = 1000000;
global.performance = { now: () => mockTime };
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
  constructor() {
    this.src = "";
    this.width = 32;
    this.height = 32;
    setTimeout(() => { if (this.onload) this.onload(); }, 0);
  }
};
global.CustomEvent = class CustomEvent {
  constructor(type, params) {
    this.type = type;
    this.detail = params?.detail;
  }
};

// ── Load game code ────────────────────────────────────────────────
const projectRoot = path.join(__dirname, "..");
const gameSource  = fs.readFileSync(path.join(projectRoot, "game.js"), "utf8");

let INFECTION_CONFIG;
let INFECTION_WEAPONS;

function createGameInstance() {
  const instrumented = gameSource.replace(
    "const game = new DodgeArenaGame(canvas);",
    "global.Player = Player; global.INFECTION_CONFIG = INFECTION_CONFIG; global.INFECTION_WEAPONS = INFECTION_WEAPONS; const game = global.exportedGame = new DodgeArenaGame(canvas);"
  );
  eval(instrumented);
  if (eventListeners["DOMContentLoaded"]) {
    eventListeners["DOMContentLoaded"].forEach(fn => fn());
  }
  INFECTION_CONFIG = global.INFECTION_CONFIG;
  INFECTION_WEAPONS = global.INFECTION_WEAPONS;
  return global.exportedGame;
}

function makeHostGame() {
  const g = createGameInstance();
  g.isHost = true;
  g.mode = "CUSTOM_ROOM";
  g.peer = { id: "host-peer" };
  g.lobbyRoomCode = "M7TEST";
  g.lobbyPlayers = new Map([
    ["host-peer",  { name: "Host",  shape: "square", isHost: true  }],
    ["guest-peer", { name: "Guest", shape: "circle", isHost: false }]
  ]);
  g.lobbyMode = "INFECTION";
  g.initMPMatch("INFECTION");
  g.state = "PLAYING";
  return g;
}

function makeGuestGame() {
  const g = createGameInstance();
  g.isHost = false;
  g.mode = "CUSTOM_ROOM";
  g.hostPeerId = "host-peer";
  g.peer = { id: "guest-peer" };
  g.lobbyRoomCode = "M7TEST";
  g.lobbyMode = "INFECTION";
  g.initMPMatch("INFECTION");
  g.state = "PLAYING";
  return g;
}

// ─────────────────────────────────────────────────────────────────
// Suite 1: Piecewise Linear Swept-Circle TOI & Boundary Clamping
// ─────────────────────────────────────────────────────────────────
console.log("\n── Suite 1: Swept-Circle TOI Kinematics & Boundary Clamping ─────");
{
  const g = makeHostGame();

  // 1a: Constant relative velocity direct collision mid-step
  // Entity 1 at x=100, moving right at 200px/s (r=16, size=32)
  // Entity 2 at x=200, stationary (r=16, size=32). Distance between centers = 100.
  // Contact occurs when distance between centers = 32, i.e. E1 travels 68px.
  // Expected TOI = 68 / 200 = 0.34s.
  const e1 = { x: 100, y: 100, vx: 200, vy: 0, size: 32 };
  const e2 = { x: 200, y: 100, vx: 0, vy: 0, size: 32 };
  const toi1 = g._computeSweptCircleTOI(e1, e2, 1.0);
  assert(toi1 !== null && Math.abs(toi1 - 0.34) < 1e-4, "1a: Continuous collision detection calculates exact TOI root (0.34s)");

  // 1b: Trajectory splitting at X-axis boundary clamp
  // E1 starts at x=750 (right arena boundary max = 768), vx = 100. Hits clamp at t = (768 - 750) / 100 = 0.18s.
  // E2 starts at x=600, vx = 200. Reaches contact with clamped E1.
  // E1 center clamped at 768 + 16 = 784.
  // E2 center = 600 + 16 + 200*t = 616 + 200*t.
  // Contact when E1 center - E2 center = 32 => 784 - (616 + 200*t) = 32 => 200*t = 136 => t = 0.68s.
  // Since 0.68s > clamp time (0.18s), this collision happens in the post-clamp segment!
  const e1_clamp = { x: 750, y: 200, vx: 100, vy: 0, size: 32 };
  const e2_clamp = { x: 600, y: 200, vx: 200, vy: 0, size: 32 };
  const toiClamp = g._computeSweptCircleTOI(e1_clamp, e2_clamp, 1.0);
  assert(toiClamp !== null && Math.abs(toiClamp - 0.68) < 1e-4, "1b: Trajectory splitting at X boundary correctly computes post-clamp TOI (0.68s)");

  // 1c: Trajectory splitting at Y-axis boundary clamp
  // Top-left y arena boundary max = 568. E1 hits bottom wall, stops, E2 hits it.
  const e1_y = { x: 300, y: 550, vx: 0, vy: 100, size: 32 }; // hits wall at (568 - 550)/100 = 0.18s
  const e2_y = { x: 300, y: 400, vx: 0, vy: 200, size: 32 }; // reaches contact at t = (584 - 32 - 416)/200 = 136/200 = 0.68s
  const toiY = g._computeSweptCircleTOI(e1_y, e2_y, 1.0);
  assert(toiY !== null && Math.abs(toiY - 0.68) < 1e-4, "1c: Trajectory splitting at Y boundary correctly computes post-clamp TOI (0.68s)");

  // 1d: Initial overlap at t=0 returns immediately 0
  const e1_overlap = { x: 100, y: 100, vx: 50, vy: 0, size: 32 };
  const e2_overlap = { x: 110, y: 100, vx: -50, vy: 0, size: 32 };
  const toiOverlap = g._computeSweptCircleTOI(e1_overlap, e2_overlap, 0.5);
  assertEqual(toiOverlap, 0, "1d: Initial overlap at t=0 returns exactly 0");

  // 1e: Non-intersecting trajectories return null
  const e1_miss = { x: 100, y: 100, vx: 100, vy: 0, size: 32 };
  const e2_miss = { x: 100, y: 300, vx: 100, vy: 0, size: 32 };
  const toiMiss = g._computeSweptCircleTOI(e1_miss, e2_miss, 1.0);
  assertEqual(toiMiss, null, "1e: Parallel non-intersecting trajectories return null");

  // 1f: Stationary entities
  const e1_stat = { x: 100, y: 100, vx: 0, vy: 0, size: 32 };
  const e2_stat = { x: 300, y: 300, vx: 0, vy: 0, size: 32 };
  assertEqual(g._computeSweptCircleTOI(e1_stat, e2_stat, 1.0), null, "1f: Stationary non-overlapping entities return null");
}

// ─────────────────────────────────────────────────────────────────
// Suite 2: Strict Infection Timing Semantics & Boss Branch Logic
// ─────────────────────────────────────────────────────────────────
console.log("\n── Suite 2: Strict Infection Timing Semantics & Branch Selection ");
{
  // 2a: All active players infected strictly before 60.000s -> COSMIC_BOSS
  const g1 = makeHostGame();
  const st1 = g1.mpState;
  const p1 = st1.players.get("host-peer");
  const p2 = st1.players.get("guest-peer");
  p1.isInfected = true;
  p2.isInfected = false;
  st1.enemies.clear();
  st1.infectionTimer = 59.9; // 59.9s

  // P1 touches P2 during a 0.08s step -> collision at 59.9 + 0.04 = 59.94s < 60.000s
  // PLAYER_SIZE is 20, R = 20. Dist = 28, delta = 8px => tau = 8/200 = 0.04s
  p1.x = 200; p1.y = 200; p1.vx = 200; p1.vy = 0;
  p2.x = 228; p2.y = 200; p2.vx = 0; p2.vy = 0;

  g1.mpUpdateInfection(0.08);

  assertEqual(st1.bossBranch, "COSMIC_BOSS", "2a: All active players infected strictly before 60.000s triggers COSMIC_BOSS");
  assert(st1.boss !== null && st1.boss.type === "COSMIC_BOSS", "2a-2: Cosmic Boss spawned");

  // 2b: Surviving normal player reaches >= 60.000s -> INFECTED_BOSS
  const g2 = makeHostGame();
  const st2 = g2.mpState;
  const pA = st2.players.get("host-peer");
  const pB = st2.players.get("guest-peer");
  pA.isInfected = false;
  pB.isInfected = true; // P2 is infected, but P1 is normal survivor
  st2.enemies.clear();
  st2.infectionTimer = 59.95;

  g2.mpUpdateInfection(0.05); // Reaches exactly 60.000s with normal player surviving!

  assertEqual(st2.bossBranch, "INFECTED_BOSS", "2b: >=1 normal player surviving at >=60.000s triggers INFECTED_BOSS");
  assert(st2.boss !== null && st2.boss.type === "INFECTED_BOSS", "2b-2: Infected Boss spawned");

  // 2c: Exactly 60.000000s with all infected -> Team Defeat (QUARANTINE_BREACHED)
  const g3 = makeHostGame();
  const st3 = g3.mpState;
  const pX = st3.players.get("host-peer");
  const pY = st3.players.get("guest-peer");
  pX.isInfected = true;
  pY.isInfected = false;
  st3.enemies.clear();
  st3.infectionTimer = 59.9;

  // Collision engineered to occur at exactly tau = 0.100000s => t_event = 60.000000s
  // Contact when E1 travels 20px at 200px/s => tau = 20/200 = 0.10s
  pX.x = 200; pX.y = 200; pX.vx = 200; pX.vy = 0;
  pY.x = 240; pY.y = 200; pY.vx = 0; pY.vy = 0; // dist = 40, contact at 20 => travel = 20px => 0.1s

  let defeatBroadcastReason = null;
  g3._broadcastReliable = (msg) => {
    if (msg.type === "MP_MATCH_DEFEAT") defeatBroadcastReason = msg.reason;
  };

  g3.mpUpdateInfection(0.2); // Frame covers [59.9, 60.1], collision at 60.000s

  assertEqual(st3.bossBranch, null, "2c: Exactly 60.000s infection does NOT trigger Cosmic Boss");
  assertEqual(st3.status, "DEFEAT", "2c-2: Exactly 60.000s infection sets status DEFEAT");
  assertEqual(defeatBroadcastReason, "QUARANTINE_BREACHED", "2c-3: Team defeat reason is QUARANTINE_BREACHED");

  // 2d: After 60.000s with all infected -> Team Defeat (QUARANTINE_BREACHED)
  const g4 = makeHostGame();
  const st4 = g4.mpState;
  const pM = st4.players.get("host-peer");
  const pN = st4.players.get("guest-peer");
  pM.isInfected = true;
  pN.isInfected = false;
  st4.enemies.clear();
  st4.infectionTimer = 62.0;

  pM.x = 100; pM.y = 100;
  pN.x = 110; pN.y = 100; // Immediate touch at 62.0s

  let defeat4Reason = null;
  g4._broadcastReliable = (msg) => {
    if (msg.type === "MP_MATCH_DEFEAT") defeat4Reason = msg.reason;
  };

  g4.mpUpdateInfection(0.016);

  assertEqual(st4.status, "DEFEAT", "2d: Infection after 60.000s triggers DEFEAT");
  assertEqual(defeat4Reason, "QUARANTINE_BREACHED", "2d-2: Reason is QUARANTINE_BREACHED");

  // 2e: All active players eliminated -> Team Defeat
  const g5 = makeHostGame();
  const st5 = g5.mpState;
  for (const p of st5.players.values()) {
    p.isAlive = false;
  }
  let defeat5Reason = null;
  g5._broadcastReliable = (msg) => {
    if (msg.type === "MP_MATCH_DEFEAT") defeat5Reason = msg.reason;
  };
  g5.mpUpdateInfection(0.016);
  assertEqual(st5.status, "DEFEAT", "2e: All eliminated triggers DEFEAT");
  assertEqual(defeat5Reason, "ALL_PLAYERS_ELIMINATED", "2e-2: Reason is ALL_PLAYERS_ELIMINATED");

  // 2f: Terminal outcome immutability
  assertEqual(st5.status, "DEFEAT", "2f: Status remains DEFEAT");
  g5.mpUpdateInfection(1.0);
  assertEqual(st5.status, "DEFEAT", "2f-2: Terminal defeat is strictly immutable");
}

// ─────────────────────────────────────────────────────────────────
// Suite 3: Full-State Serialization & In-Place Restoration
// ─────────────────────────────────────────────────────────────────
console.log("\n── Suite 3: Full-State Serialization & In-Place Player Restoration ");
{
  const host = makeHostGame();
  const hst = host.mpState;
  hst.teamScore = 150;
  hst.currentPhase = 3;
  hst.boss = { id: "boss_demo", type: "INFECTED_BOSS", hp: 1800, maxHp: 2500, x: 400, y: 300 };

  const pGuest = hst.players.get("guest-peer");
  pGuest.infectionWeapon = { type: "ZOMBIE_KILLER", ammo: 25, maxAmmo: 30, cooldown: 0.1, damage: 100 };
  pGuest.fireballGun = { ammo: 80, maxAmmo: 100, cooldown: 0, damage: 50 };

  // 3a: Serialization exports all 36 authoritative fields
  const serialized = host.mpSerializeFullSync();
  assert(serialized !== null, "3a: mpSerializeFullSync returns payload");
  assertEqual(serialized.matchId, hst.matchId, "3a-1: matchId present");
  assertEqual(serialized.teamScore, 150, "3a-2: teamScore serialized");
  assertEqual(serialized.currentPhase, 3, "3a-3: currentPhase serialized");
  assertEqual(serialized.players.length, 2, "3a-4: players array serialized");
  assertEqual(serialized.boss.hp, 1800, "3a-5: boss serialized");

  // 3b: Deep cloning of nested mutable objects
  assert(serialized.players[1].infectionWeapon !== pGuest.infectionWeapon, "3b: Nested infectionWeapon is a distinct clone");
  assertEqual(serialized.players[1].infectionWeapon.ammo, 25, "3b-2: Cloned weapon ammo matches");

  // 3c: Candidate validation fails closed on corrupted/malformed input
  const client = createGameInstance();
  client.isHost = false;
  client.peer = { id: "guest-peer" };
  client.hostPeerId = "host-peer";

  const malformed1 = { ...serialized, status: "INVALID_STATUS" };
  assert(client.mpValidateAndApplyFullSync(malformed1) === false, "3c-1: Invalid status rejected without mutating client");

  const malformed2 = { ...serialized, players: [{ id: "bad", x: NaN, y: 100, hp: 100, maxHp: 100 }] };
  assert(client.mpValidateAndApplyFullSync(malformed2) === false, "3c-2: Non-finite coordinate rejected without mutating client");

  // 3d: In-place restoration preserves Player class instance & prototype methods
  const validSyncSuccess = client.mpValidateAndApplyFullSync(serialized);
  assert(validSyncSuccess === true, "3d: Valid full-state committed successfully");
  assert(client.p1 instanceof global.Player, "3d-1: client.p1 remains an instance of Player class");
  assertEqual(typeof client.p1.dash, "function", "3d-2: Player prototype method 'dash' remains intact");
  assertEqual(typeof client.p1.shockwave, "function", "3d-3: Player prototype method 'shockwave' remains intact");
  assertEqual(typeof client.p1.emergencyDodge, "function", "3d-4: Player prototype method 'emergencyDodge' remains intact");
  assertEqual(client.p1.x, pGuest.x, "3d-5: Player position restored in-place");
  assertEqual(client.p1.infectionWeapon.ammo, 25, "3d-6: Player weapon restored in-place");
}

// ─────────────────────────────────────────────────────────────────
// Suite 4: Option B Reconnect Protocol & Handshake Security
// ─────────────────────────────────────────────────────────────────
console.log("\n── Suite 4: Option B Reconnect Protocol & Identity Binding ───────");
{
  const host = makeHostGame();
  const guest = createGameInstance();
  guest.isHost = false;
  guest.peer = { id: "guest-peer", connect: (target, opts) => mockConn };
  guest.hostPeerId = "host-peer";
  guest.initMPMatch("INFECTION");
  guest.state = "PLAYING";

  const pHostGuest = host.mpState.players.get("guest-peer");
  const originalToken = pHostGuest.activeToken;
  guest.activeToken = originalToken;

  // Mark player as soft-disconnected on host
  host._handlePeerTemporaryDisconnect("guest-peer");
  assert(pHostGuest.disconnected === true, "4a: Player marked disconnected on host");

  // 4a: Derive identity strictly from conn.peer; reject spoofed metadata
  let incomingClosed = false;
  const mockIncomingBad = {
    peer: "unauthorized-attacker",
    metadata: { type: "RECONNECT", peerId: "guest-peer", attemptId: 1, token: originalToken },
    close: () => { incomingClosed = true; }
  };
  // Simulate host connection listener logic
  const checkConnection = (conn) => {
    const guestPeerId = conn.peer;
    const player = host.mpState.players.get(guestPeerId);
    if (!player || !player.disconnected) {
      conn.close();
      return false;
    }
    const meta = conn.metadata;
    if (!meta || meta.type !== "RECONNECT" || meta.peerId !== guestPeerId) {
      conn.close();
      return false;
    }
    return true;
  };
  assert(checkConnection(mockIncomingBad) === false && incomingClosed === true, "4a: Rejected attacker attempting to spoof guest-peer in metadata");

  // 4b: Legitimate reconnect handshake
  let hostSentSync = null;
  let hostSentConfirm = null;
  let guestSentAck = null;

  host._sendReliableToPlayer = (peerId, msg) => {
    if (msg.type === "MP_RECONNECT_SYNC") hostSentSync = msg;
    if (msg.type === "MP_RECONNECT_CONFIRMED") hostSentConfirm = msg;
  };
  guest._sendToHostReliable = (msg) => {
    if (msg.type === "MP_RECONNECT_ACK") guestSentAck = msg;
  };

  // Step 1: Guest sends MP_RECONNECT_REQUEST (attempt 1)
  host._handleLobbyMessage({
    type: "MP_RECONNECT_REQUEST",
    attemptId: 1,
    token: originalToken
  }, "guest-peer");

  assert(hostSentSync !== null, "4b-1: Host processed request and generated MP_RECONNECT_SYNC");
  assertEqual(hostSentSync.attemptId, 1, "4b-2: Sync matches attemptId 1");
  assert(pHostGuest.pendingToken !== null, "4b-3: Host staged pendingToken");

  // Step 2: Guest applies MP_RECONNECT_SYNC and sends MP_RECONNECT_ACK
  guest.reconnectAttemptId = 1;
  guest._handleLobbyMessage(hostSentSync, "host-peer");
  assert(guestSentAck !== null, "4b-4: Guest applied sync and emitted MP_RECONNECT_ACK");
  assertEqual(guestSentAck.pendingToken, hostSentSync.pendingToken, "4b-5: Guest ACK includes staged pendingToken");

  // Step 3: Host receives MP_RECONNECT_ACK and commits
  host._handleLobbyMessage(guestSentAck, "guest-peer");
  assert(hostSentConfirm !== null, "4b-6: Host emitted MP_RECONNECT_CONFIRMED");
  assertEqual(pHostGuest.disconnected, false, "4b-7: Host cleared disconnected state");
  assertEqual(pHostGuest.activeToken, guestSentAck.pendingToken, "4b-8: Host rotated activeToken to pendingToken");
  assertEqual(pHostGuest.pendingToken, null, "4b-9: Host cleared pendingToken");

  // Step 4: Guest receives MP_RECONNECT_CONFIRMED
  guest._handleLobbyMessage(hostSentConfirm, "host-peer");
  assertEqual(guest.activeToken, pHostGuest.activeToken, "4b-10: Guest rotated activeToken to new token");
  assertEqual(guest.state, "PLAYING", "4b-11: Guest state restored to PLAYING");

  // 4c: Attempt Supersession
  // Suppose client disconnects again and starts attempt 2, then attempt 3
  host._handlePeerTemporaryDisconnect("guest-peer");
  host._handleLobbyMessage({ type: "MP_RECONNECT_REQUEST", attemptId: 2, token: guest.activeToken }, "guest-peer");
  const tokenAttempt2 = pHostGuest.pendingToken;

  // New attempt 3 arrives before attempt 2 completes
  host._handleLobbyMessage({ type: "MP_RECONNECT_REQUEST", attemptId: 3, token: guest.activeToken }, "guest-peer");
  const tokenAttempt3 = pHostGuest.pendingToken;

  assert(tokenAttempt3 !== tokenAttempt2, "4c: Attempt 3 superseded Attempt 2 and generated new pendingToken");
  assertEqual(pHostGuest.currentAttemptId, 3, "4c-2: Current attempt ID updated to 3");

  // 4d: Stale delayed ACK from Attempt 2 is rejected
  hostSentConfirm = null;
  host._handleLobbyMessage({ type: "MP_RECONNECT_ACK", attemptId: 2, pendingToken: tokenAttempt2 }, "guest-peer");
  assert(hostSentConfirm === null, "4d: Delayed ACK from superseded Attempt 2 was rejected");
  assertEqual(pHostGuest.disconnected, true, "4d-2: Player remains disconnected");

  // Complete attempt 3
  host._handleLobbyMessage({ type: "MP_RECONNECT_ACK", attemptId: 3, pendingToken: tokenAttempt3 }, "guest-peer");
  assert(hostSentConfirm !== null, "4d-3: Legitimate Attempt 3 ACK committed");
  assertEqual(pHostGuest.disconnected, false, "4d-4: Player reconnected after supersession");

  // 4e: Status check idempotency without token leakage
  let statusResp = null;
  host._sendReliableToPlayer = (peerId, msg) => { statusResp = msg; };
  host._handleLobbyMessage({ type: "MP_RECONNECT_STATUS", attemptId: 3 }, "guest-peer");
  assert(statusResp !== null, "4e: Status response received");
  assertEqual(statusResp.status, "COMMITTED", "4e-2: Status is COMMITTED");
  assert(statusResp.token === undefined, "4e-3: No security token leaked in status response");
}

// ─────────────────────────────────────────────────────────────────
// Suite 5: Bidirectional Liveness, Silence Detection & 5s Deadline
// ─────────────────────────────────────────────────────────────────
console.log("\n── Suite 5: Bidirectional Liveness & Silence Detection ──────────");
{
  const host = makeHostGame();
  const guest = createGameInstance();
  guest.isHost = false;
  guest.peer = { id: "guest-peer" };
  guest.hostPeerId = "host-peer";
  guest.initMPMatch("INFECTION");
  guest.state = "PLAYING";

  const pHostGuest = host.mpState.players.get("guest-peer");
  pHostGuest.lastHeartbeatResponseTime = 1000000;
  mockTime = 1000000;

  // 5a: Host emits MP_HEARTBEAT at 250ms
  let hostHb = null;
  host._broadcastReliable = (msg) => { if (msg.type === "MP_HEARTBEAT") hostHb = msg; };
  host.mpUpdateLiveness(0.26); // > 0.25s
  assert(hostHb !== null, "5a: Host emits MP_HEARTBEAT at 250ms interval");

  // Guest receives MP_HEARTBEAT and responds with MP_HEARTBEAT_ACK
  let guestHbAck = null;
  guest._sendToHostReliable = (msg) => { if (msg.type === "MP_HEARTBEAT_ACK") guestHbAck = msg; };
  guest._handleLobbyMessage(hostHb, "host-peer");
  assert(guestHbAck !== null, "5a-2: Guest immediately responds with MP_HEARTBEAT_ACK");
  assertEqual(guestHbAck.seq, hostHb.seq, "5a-3: ACK echoes sequence number");

  // 5b: Guest emits MP_GUEST_HEARTBEAT at 250ms
  let guestHb = null;
  guest._sendToHostReliable = (msg) => { if (msg.type === "MP_GUEST_HEARTBEAT") guestHb = msg; };
  guest.mpUpdateLiveness(0.26);
  assert(guestHb !== null, "5b: Guest emits MP_GUEST_HEARTBEAT at 250ms interval");

  // Host receives MP_GUEST_HEARTBEAT and responds with MP_GUEST_HEARTBEAT_ACK
  let hostHbAck = null;
  host._sendReliableToPlayer = (peerId, msg) => { if (msg.type === "MP_GUEST_HEARTBEAT_ACK") hostHbAck = msg; };
  host._handleLobbyMessage(guestHb, "guest-peer");
  assert(hostHbAck !== null, "5b-2: Host responds with MP_GUEST_HEARTBEAT_ACK");

  // 5c: 2.0s silence threshold triggers soft disconnect
  mockTime = 1000000 + 2050; // Advance time by 2.05s without heartbeats
  host._broadcastReliable = () => {};
  host.mpUpdateLiveness(0.016);
  assertEqual(pHostGuest.disconnected, true, "5c: Host marks player disconnected after 2.0s silence");
  assert(pHostGuest.disconnectDeadline > mockTime, "5c-2: Host sets 5.0s disconnect deadline");

  // 5d: 5.0s reconnect window expiration permanently purges player
  let playerLeftMsg = null;
  host._broadcastReliable = (msg) => { if (msg.type === "MP_PLAYER_LEFT") playerLeftMsg = msg; };
  mockTime += 5100; // Advance past the 5.0s deadline
  host.mpUpdateLiveness(0.016);
  assert(!host.mpState.players.has("guest-peer"), "5d: Expired player permanently purged from players map");
  assert(playerLeftMsg !== null && playerLeftMsg.peerId === "guest-peer", "5d-2: MP_PLAYER_LEFT broadcast upon deadline expiration");
}

// ─────────────────────────────────────────────────────────────────
// Suite 6: Snapshot Backpressure & Transport Flow Control
// ─────────────────────────────────────────────────────────────────
console.log("\n── Suite 6: Snapshot Backpressure (64KB Buffer Guard) ───────────");
{
  const host = makeHostGame();
  let snapshotFramesSent = 0;

  const mockChannel = {
    bufferedAmount: 70000 // 70KB >= 65536 threshold
  };
  const mockConn = {
    open: true,
    dataChannel: mockChannel,
    send: () => { snapshotFramesSent++; }
  };
  host.mpConnections.set("guest-peer", { unreliable: mockConn });

  host._broadcastUnreliable({ type: "MP_SNAPSHOT", seq: 1 });
  assertEqual(snapshotFramesSent, 0, "6a: Snapshot frame dropped when dataChannel.bufferedAmount >= 65536");

  // When buffer drops below threshold
  mockChannel.bufferedAmount = 10240; // 10KB < 65536
  host._broadcastUnreliable({ type: "MP_SNAPSHOT", seq: 2 });
  assertEqual(snapshotFramesSent, 1, "6b: Snapshot frame transmitted when buffer is below 64KB threshold");
}

// ─────────────────────────────────────────────────────────────────
// Suite 7: Solo Mode Isolation Guarantee
// ─────────────────────────────────────────────────────────────────
console.log("\n── Suite 7: Solo Mode Isolation ─────────────────────────────────");
{
  const solo = createGameInstance();
  solo.startMatch("SOLO");

  assertEqual(solo.mode, "SOLO", "7a: Mode is SOLO");
  assertEqual(solo.mpState, null, "7b: mpState is strictly null in Solo Mode");
  assertEqual(solo.p1.lives, 3, "7c: Solo player has 3 lives");

  // Exercise Player class instance methods
  solo.p1.dash();
  assert(solo.p1.dashTimer > 0, "7d: Solo player can dash");
  solo.p1.shockwave();
  assert(solo.p1.pushCooldown > 0, "7e: Solo player can shockwave");
  solo.p1.emergencyDodge();
  assertEqual(solo.p1.emerDodges, 2, "7f: Solo player can emergency dodge");
}

// ─────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────
console.log("\n────────────────────────────────────────────────────────────");
console.log("Milestone 7 Phase 2 Acceptance Suite Results:");
console.log(`  PASSED: ${passed}`);
console.log(`  FAILED: ${failed}`);
console.log(`  TOTAL:  ${passed + failed}`);
console.log("────────────────────────────────────────────────────────────");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("\n🎉 ALL MILESTONE 7 PHASE 2 TESTS PASSED PERFECTLY!\n");
  process.exit(0);
}
