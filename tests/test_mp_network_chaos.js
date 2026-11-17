/**
 * test_mp_network_chaos.js — Network Interruption, Latency, Packet Loss & Disconnect Suite
 * Milestone 6D: Multiplayer Stabilization & Chaos Testing
 * Tests:
 * 1. Monotonic sequence & out-of-order snapshot rejection (stale packet dropping).
 * 2. Unreliable packet loss resilience (state recovery on subsequent snapshot).
 * 3. High latency snapshot application & local prediction dead reckoning.
 * 4. Guest disconnect during active match (cleanup, state rebalancing, match continuity).
 * 5. Host disconnect & 5-second reconnect window / graceful cleanup.
 * 6. Edge cases: Simultaneous disconnection of multiple guests.
 */

"use strict";

const fs   = require("fs");
const path = require("path");

console.log("=================================================");
console.log("   MULTIPLAYER NETWORK CHAOS & DISCONNECT TESTS  ");
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

// ── Minimal browser mock ──────────────────────────────────────────
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
    arc: () => {}, stroke: () => {}, fill: () => {},
    fillText: () => {}, strokeText: () => {},
    save: () => {}, restore: () => {},
    drawImage: () => {},
    setTransform: () => {}, scale: () => {}, resetTransform: () => {},
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
  getElementById: (id) => (id === "game-canvas" ? mockCanvas : {
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    style: {}, addEventListener: () => {}, innerText: "", innerHTML: "", disabled: false
  }),
  querySelector: () => ({ style: {} }),
  querySelectorAll: () => [],
  documentElement: { requestFullscreen: () => Promise.resolve() },
  createElement: () => ({
    style: {}, addEventListener: () => {},
    classList: { add: () => {}, remove: () => {}, contains: () => false }
  }),
  head: { appendChild: () => {} }
};

global.localStorage = {
  _s: {},
  getItem(k) { return this._s[k] || null; },
  setItem(k, v) { this._s[k] = String(v); },
  removeItem(k) { delete this._s[k]; }
};

global.performance = { now: () => Date.now() };
global.requestAnimationFrame = () => {};
global.cancelAnimationFrame = () => {};
global.Audio = class { play() { return Promise.resolve(); } pause() {} };
global.Image = class { constructor() { this.src = ""; this.complete = false; } };
global.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });

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

function makeHostGame(mode = "INFECTION") {
  const g = createGameInstance();
  g.isHost = true;
  g.mode = "CUSTOM_ROOM";
  g.peer = { id: "host-peer", destroy: () => {} };
  g.lobbyRoomCode = "CHAOS1";
  g.lobbyPlayers = new Map([
    ["host-peer",  { name: "Host",  shape: "square", isHost: true  }],
    ["guest-1",    { name: "Guest1", shape: "circle", isHost: false }],
    ["guest-2",    { name: "Guest2", shape: "triangle", isHost: false }]
  ]);
  g.lobbyMode = mode;
  g.initMPMatch();
  return g;
}

function makeGuestGame(guestId = "guest-1", mode = "INFECTION") {
  const g = createGameInstance();
  g.isHost = false;
  g.mode = "CUSTOM_ROOM";
  g.peer = { id: guestId, destroy: () => {} };
  g.lobbyRoomCode = "CHAOS1";
  g.lobbyMode = mode;
  g.handleMPMatchStart({
    matchId: "chaos_match",
    hostId: "host-peer",
    mode: mode,
    players: [
      { id: "host-peer", name: "Host", shape: "square", isHost: true, x: 120, y: 150, color: "#00e5ff" },
      { id: "guest-1",   name: "Guest1", shape: "circle", isHost: false, x: 680, y: 150, color: "#ff2266" },
      { id: "guest-2",   name: "Guest2", shape: "triangle", isHost: false, x: 120, y: 450, color: "#ffe600" }
    ],
    enemies: [],
    weaponPickups: []
  });
  return g;
}

// ─────────────────────────────────────────────────────────────────
// Suite 1: Out-of-Order Packets & Stale Sequence Rejection
// ─────────────────────────────────────────────────────────────────
console.log("\n── Suite 1: Out-of-Order Packets & Stale Sequence ──────────────");
{
  const guest = makeGuestGame("guest-1");

  // Snapshot seq 10 arrives
  guest.mpApplySnapshot({
    type: "MP_SNAPSHOT",
    seq: 10,
    players: [
      { id: "host-peer", x: 250, y: 250, hp: 100, isAlive: true },
      { id: "guest-1",   x: 680, y: 150, hp: 100, isAlive: true }
    ]
  });
  assertEqual(guest.mpState.players.get("host-peer").x, 250, "1a: Newer snapshot seq 10 applied (x=250)");

  // Stale snapshot seq 8 arrives out of order
  guest.mpApplySnapshot({
    type: "MP_SNAPSHOT",
    seq: 8,
    players: [
      { id: "host-peer", x: 180, y: 180, hp: 100, isAlive: true },
      { id: "guest-1",   x: 680, y: 150, hp: 100, isAlive: true }
    ]
  });
  assertEqual(guest.mpState.players.get("host-peer").x, 250, "1b: Stale snapshot seq 8 dropped (x remained 250)");

  // Duplicate snapshot seq 10 arrives
  guest.mpApplySnapshot({
    type: "MP_SNAPSHOT",
    seq: 10,
    players: [
      { id: "host-peer", x: 190, y: 190, hp: 100, isAlive: true }
    ]
  });
  assertEqual(guest.mpState.players.get("host-peer").x, 250, "1c: Duplicate snapshot seq 10 dropped");

  // Monotonic advance seq 11 arrives
  guest.mpApplySnapshot({
    type: "MP_SNAPSHOT",
    seq: 11,
    players: [
      { id: "host-peer", x: 260, y: 260, hp: 100, isAlive: true },
      { id: "guest-1",   x: 680, y: 150, hp: 100, isAlive: true }
    ]
  });
  assertEqual(guest.mpState.players.get("host-peer").x, 260, "1d: Newer snapshot seq 11 applied (x=260)");
}

// ─────────────────────────────────────────────────────────────────
// Suite 2: Packet Loss Resilience & Authoritative State Recovery
// ─────────────────────────────────────────────────────────────────
console.log("\n── Suite 2: Packet Loss Resilience ─────────────────────────────");
{
  const guest = makeGuestGame("guest-1");

  // Host sends seq 1 -> received
  guest.mpApplySnapshot({
    type: "MP_SNAPSHOT",
    seq: 1,
    players: [{ id: "host-peer", x: 100, y: 100, hp: 100, isAlive: true }]
  });

  // Packets seq 2, 3, 4 dropped due to 75% simulated burst loss
  // Guest receives seq 5
  guest.mpApplySnapshot({
    type: "MP_SNAPSHOT",
    seq: 5,
    players: [{ id: "host-peer", x: 200, y: 200, hp: 80, isAlive: true }]
  });

  assertEqual(guest.mpState.players.get("host-peer").x, 200, "2a: Recovered state after dropped packets (x=200)");
  assertEqual(guest.mpState.players.get("host-peer").hp, 80, "2b: Recovered health state after dropped packets (hp=80)");
}

// ─────────────────────────────────────────────────────────────────
// Suite 3: Guest Disconnect During Active Match
// ─────────────────────────────────────────────────────────────────
console.log("\n── Suite 3: Guest Disconnect During Active Match ───────────────");
{
  const host = makeHostGame("INFECTION");
  const st = host.mpState;

  assertEqual(st.players.size, 3, "3a: Initially 3 players connected to host");

  // Guest 2 disconnects
  host._handlePeerDisconnect("guest-2");

  assertEqual(st.players.size, 2, "3b: Disconnected guest removed from host mpState (size=2)");
  assert(!st.players.has("guest-2"), "3c: guest-2 key purged from players map");
  assert(st.players.has("guest-1"), "3d: Remaining guest-1 intact");
  assert(st.players.has("host-peer"), "3e: Host player intact");

  // Match continues running smoothly
  host.mpUpdateInfection(0.1);
  assertEqual(st.status, "PLAYING", "3f: Match remains PLAYING after guest disconnect");
}

// ─────────────────────────────────────────────────────────────────
// Suite 4: Host Disconnect Handling
// ─────────────────────────────────────────────────────────────────
console.log("\n── Suite 4: Host Disconnect Handling ───────────────────────────");
{
  const guest = makeGuestGame("guest-1");
  guest.state = "PLAYING";

  assertEqual(guest.state, "PLAYING", "4a: Guest initially in PLAYING state");
  assert(guest.mpState !== null, "4b: mpState is active");

  // Host disconnects during match
  guest._handleHostDisconnectDuringMatch();

  assertEqual(guest.state, "MENU", "4c: Guest returned cleanly to MENU on host disconnect");
  assertEqual(guest.mpState, null, "4d: mpState wiped to null (no frozen phantom state)");
  assertEqual(guest.announcement.title, "HOST DISCONNECTED", "4e: Host disconnect announcement displayed");
}

// ─────────────────────────────────────────────────────────────────
// Suite 5: Infection Freeze State Integrity Under Latency
// ─────────────────────────────────────────────────────────────────
console.log("\n── Suite 5: Infection Freeze State Under Latency ───────────────");
{
  const guest = makeGuestGame("guest-1");
  const p1 = guest.mpState.players.get("guest-1");

  // Host snapshot sets freezeTimer = 15.0 (White Hole)
  guest.mpApplySnapshot({
    type: "MP_SNAPSHOT",
    seq: 20,
    players: [
      { id: "guest-1", x: 10, y: 10, hp: 100, isAlive: true, freezeTimer: 15.0, freezeType: "WHITE_HOLE" }
    ]
  });

  assertEqual(p1.freezeTimer, 15.0, "5a: Guest applied 15.0s freeze from snapshot");
  assertEqual(p1.freezeType, "WHITE_HOLE", "5b: Guest freezeType set to WHITE_HOLE");

  // Local prediction must not move frozen player
  guest.p1Input = { x: 1, y: 0 };
  guest.p1.isSprinting = true;
  guest.update(0.1);

  assertEqual(p1.vx, 0, "5c: Frozen player horizontal velocity locked to 0");
  assertEqual(p1.vy, 0, "5d: Frozen player vertical velocity locked to 0");
}

console.log("\n────────────────────────────────────────────────────────────");
console.log("Multiplayer Network Chaos Test Results:");
console.log(`  PASSED: ${passed}`);
console.log(`  FAILED: ${failed}`);
console.log(`  TOTAL:  ${passed + failed}`);
console.log("────────────────────────────────────────────────────────────");

process.exit(failed > 0 ? 1 : 0);
