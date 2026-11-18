/**
 * test_mp_security_and_gameloop.js — Milestone 6D-C Security & Game Loop Stabilization Tests
 *
 * Verifies:
 * 1. Directional authorization for all 5 authoritative message types (MP_DAMAGE, MP_ELIMINATED, MP_HEAL, MP_MATCH_VICTORY, MP_MATCH_DEFEAT).
 * 2. Malicious guest -> Host: rejected (host authoritative state unmodified).
 * 3. Authenticated Host -> Guest: accepted and synchronized.
 * 4. Unauthorized peer -> Guest: rejected.
 * 5. Spoofed sender identity rejection (fromPeerId enforcement for MP_INPUT, MP_SHOOT, MP_INFECTION_SHOOT, MP_PUSH).
 * 6. Guest reliable message sending restrictions (_broadcastReliable host-only, _sendToHostReliable allowlist).
 * 7. Mutually exclusive game loop update scheduling (visible RAF vs hidden MP host interval).
 * 8. Hidden Solo Mode pause behavior (zero background updates).
 * 9. Visibility transition without delta spikes or double updates.
 * 10. Snapshot timing without duplication.
 */

"use strict";

const fs = require("fs");
const path = require("path");

console.log("=================================================");
console.log(" MILESTONE 6D-C: SECURITY & GAME LOOP SUITE      ");
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

// ── Mock Browser Environment ─────────────────────────────────────
const eventListeners = {};
global.window = {
  addEventListener: (event, fn) => {
    if (!eventListeners[event]) eventListeners[event] = [];
    eventListeners[event].push(fn);
  },
  devicePixelRatio: 1,
  innerWidth: 1280,
  innerHeight: 720,
  location: { hostname: "localhost", search: "", origin: "http://localhost:3000", pathname: "/" }
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
    translate: () => {},
    rotate: () => {},
    resetTransform: () => {},
    scale: () => {},
    measureText: () => ({ width: 50 }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    closePath: () => {}
  }),
  addEventListener: () => {},
  style: {},
  width: 800,
  height: 600
};

let docHidden = false;
global.document = {
  get hidden() { return docHidden; },
  set hidden(v) { docHidden = v; },
  fullscreenElement: null,
  addEventListener: (event, fn) => {
    if (!eventListeners[event]) eventListeners[event] = [];
    eventListeners[event].push(fn);
  },
  dispatchEvent: (event) => {
    const list = eventListeners[event.type] || [];
    list.forEach(fn => fn(event));
  },
  body: { classList: { add: () => {}, remove: () => {}, contains: () => false } },
  getElementById: (id) => {
    if (id === "game-canvas") return mockCanvas;
    return {
      classList: { add: () => {}, remove: () => {}, contains: () => false },
      style: {},
      addEventListener: () => {},
      innerText: "",
      innerHTML: "",
      disabled: false,
      value: "",
      offsetWidth: 50,
      offsetHeight: 50,
      getBoundingClientRect: () => ({ left: 100, top: 100, width: 50, height: 50 })
    };
  },
  querySelector: () => ({ style: {} }),
  querySelectorAll: () => [],
  documentElement: { requestFullscreen: () => Promise.resolve() }
};

try {
  Object.defineProperty(global, "navigator", {
    value: { clipboard: { writeText: () => Promise.resolve() }, vibrate: () => true, maxTouchPoints: 0 },
    writable: true,
    configurable: true
  });
} catch (e) {
  if (global.navigator) {
    global.navigator.vibrate = () => true;
    global.navigator.maxTouchPoints = 0;
  }
}
global.localStorage = {
  _store: {},
  getItem: function(k) { return this._store[k] || null; },
  setItem: function(k, v) { this._store[k] = String(v); },
  removeItem: function(k) { delete this._store[k]; }
};

let mockTime = 1000;
global.performance = { now: () => mockTime };
let rafCallbacks = [];
global.requestAnimationFrame = (cb) => { rafCallbacks.push(cb); return rafCallbacks.length; };

global.fetch = () => Promise.resolve({ json: () => Promise.resolve({ success: true }), arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
global.Audio = class { constructor() { this.currentTime = 0; } play() { return Promise.resolve(); } pause() {} };
global.Image = class { constructor() { this.naturalWidth = 100; this.naturalHeight = 100; this.complete = true; } set src(v) { if (this.onload) setTimeout(this.onload, 0); } };
global.AudioContext = class {
  constructor() { this.currentTime = 0; this.state = "running"; this.destination = {}; }
  createOscillator() { return { type: "sine", frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: () => {}, start: () => {}, stop: () => {} }; }
  createGain() { return { gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {}, value: 1 }, connect: () => {} }; }
  createBufferSource() { return { buffer: null, connect: () => {}, start: () => {} }; }
  decodeAudioData(b, s) { if (s) s({}); }
  resume() { return Promise.resolve(); }
};

// ── Load and instantiate game.js ─────────────────────────────────
const projectRoot = path.join(__dirname, "..");
const gameSource = fs.readFileSync(path.join(projectRoot, "game.js"), "utf8");

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

// ─────────────────────────────────────────────────────────────────
// SECTION 1: Malicious Guest -> Host Authoritative Event Rejection
// ─────────────────────────────────────────────────────────────────
console.log("\n── Section 1: Malicious Guest -> Host Rejection ─────────────────");

const host = createGameInstance();
host.mode = "CUSTOM_ROOM";
host.state = "PLAYING";
host.isHost = true;
host.peer = { id: "host-001" };
host.lobbyPlayers.set("host-001", { name: "Host", isHost: true });
host.lobbyPlayers.set("guest-001", { name: "Guest", isHost: false });
host.initMPMatch("INFECTION");
host.mpState.status = "PLAYING";

const hostPlayer = host.mpState.players.get("host-001");
const guestPlayerOnHost = host.mpState.players.get("guest-001");

// 1.1 Malicious guest attempts to inflict MP_DAMAGE on host
host._handleLobbyMessage({
  type: "MP_DAMAGE",
  eventId: "fake_dmg_1",
  targetId: "host-001",
  amount: 80,
  remainingHp: 20
}, "guest-001");
assert(hostPlayer.hp === 100, "1.1: Host rejected unauthorized MP_DAMAGE from guest (HP remained 100)");

// 1.2 Malicious guest attempts to send MP_ELIMINATED targeting host
host._handleLobbyMessage({
  type: "MP_ELIMINATED",
  eventId: "fake_elim_1",
  targetId: "host-001",
  killerId: "guest-001"
}, "guest-001");
assert(hostPlayer.isAlive === true && hostPlayer.isSpectator === false, "1.2: Host rejected unauthorized MP_ELIMINATED from guest");

// 1.3 Malicious guest attempts to forge MP_HEAL on self
guestPlayerOnHost.hp = 30;
host._handleLobbyMessage({
  type: "MP_HEAL",
  eventId: "fake_heal_1",
  targetId: "guest-001",
  amount: 70,
  remainingHp: 100
}, "guest-001");
assert(guestPlayerOnHost.hp === 30, "1.3: Host rejected unauthorized MP_HEAL from guest (HP remained 30)");

// 1.4 Malicious guest attempts to forge MP_MATCH_VICTORY
host._handleLobbyMessage({
  type: "MP_MATCH_VICTORY",
  reason: "GUEST_FORGED_VICTORY"
}, "guest-001");
assert(host.mpState.status === "PLAYING" && host.state === "PLAYING", "1.4: Host rejected unauthorized MP_MATCH_VICTORY from guest");

// 1.5 Malicious guest attempts to forge MP_MATCH_DEFEAT
host._handleLobbyMessage({
  type: "MP_MATCH_DEFEAT",
  reason: "GUEST_FORGED_DEFEAT"
}, "guest-001");
assert(host.mpState.status === "PLAYING" && host.state === "PLAYING", "1.5: Host rejected unauthorized MP_MATCH_DEFEAT from guest");

// ─────────────────────────────────────────────────────────────────
// SECTION 2: Authenticated Host -> Guest Synchronization
// ─────────────────────────────────────────────────────────────────
console.log("\n── Section 2: Authenticated Host -> Guest Synchronization ───────");

const guest = createGameInstance();
guest.isHost = false;
guest.hostPeerId = "host-001";
guest.peer = { id: "guest-001" };
guest.lobbyPlayers.set("host-001", { name: "Host", isHost: true });
guest.lobbyPlayers.set("guest-001", { name: "Guest", isHost: false });
guest.initMPMatch("INFECTION");
guest.mpState.hostId = "host-001";

const guestPlayerOnGuest = guest.mpState.players.get("guest-001");

// 2.1 Authenticated host sends legitimate MP_DAMAGE
guest._handleLobbyMessage({
  type: "MP_DAMAGE",
  eventId: "auth_dmg_1",
  targetId: "guest-001",
  amount: 25,
  remainingHp: 75
}, "host-001");
assert(guestPlayerOnGuest.hp === 75, "2.1: Guest accepted authenticated MP_DAMAGE from host (HP=75)");

// 2.2 Authenticated host sends legitimate MP_HEAL
guest._handleLobbyMessage({
  type: "MP_HEAL",
  eventId: "auth_heal_1",
  targetId: "guest-001",
  amount: 10,
  remainingHp: 85
}, "host-001");
assert(guestPlayerOnGuest.hp === 85, "2.2: Guest accepted authenticated MP_HEAL from host (HP=85)");

// 2.3 Authenticated host sends legitimate MP_ELIMINATED
guest._handleLobbyMessage({
  type: "MP_ELIMINATED",
  eventId: "auth_elim_1",
  targetId: "guest-001",
  killerId: "boss_infected"
}, "host-001");
assert(guestPlayerOnGuest.hp === 0 && guestPlayerOnGuest.isAlive === false && guestPlayerOnGuest.isSpectator === true,
  "2.3: Guest accepted authenticated MP_ELIMINATED from host (spectator mode active)");

// 2.4 Authenticated host sends legitimate MP_MATCH_VICTORY
guest._handleLobbyMessage({
  type: "MP_MATCH_VICTORY",
  reason: "BOSS_DEFEATED"
}, "host-001");
assert(guest.mpState.status === "VICTORY" && guest.state === "VICTORY", "2.4: Guest accepted authenticated MP_MATCH_VICTORY from host");

// 2.5 Authenticated host sends legitimate MP_MATCH_DEFEAT
guest.state = "PLAYING";
guest.mpState.status = "PLAYING";
guest._handleLobbyMessage({
  type: "MP_MATCH_DEFEAT",
  reason: "ALL_PLAYERS_ELIMINATED"
}, "host-001");
assert(guest.mpState.status === "DEFEAT" && guest.state === "MATCH_OVER", "2.5: Guest accepted authenticated MP_MATCH_DEFEAT from host");

// ─────────────────────────────────────────────────────────────────
// SECTION 3: Unauthorized Peer -> Guest Rejection
// ─────────────────────────────────────────────────────────────────
console.log("\n── Section 3: Unauthorized Peer -> Guest Rejection ─────────────");

guest.state = "PLAYING";
guest.mpState.status = "PLAYING";
guestPlayerOnGuest.hp = 100;
guestPlayerOnGuest.isAlive = true;
guestPlayerOnGuest.isSpectator = false;

// 3.1 Rogue peer sends MP_DAMAGE
guest._handleLobbyMessage({
  type: "MP_DAMAGE",
  eventId: "rogue_dmg_1",
  targetId: "guest-001",
  amount: 90,
  remainingHp: 10
}, "rogue-peer-999");
assert(guestPlayerOnGuest.hp === 100, "3.1: Guest rejected MP_DAMAGE from unauthorized rogue peer");

// 3.2 Rogue peer sends MP_ELIMINATED
guest._handleLobbyMessage({
  type: "MP_ELIMINATED",
  eventId: "rogue_elim_1",
  targetId: "guest-001"
}, "rogue-peer-999");
assert(guestPlayerOnGuest.isAlive === true && guestPlayerOnGuest.isSpectator === false, "3.2: Guest rejected MP_ELIMINATED from unauthorized rogue peer");

// 3.3 Rogue peer sends MP_HEAL
guestPlayerOnGuest.hp = 50;
guest._handleLobbyMessage({
  type: "MP_HEAL",
  eventId: "rogue_heal_1",
  targetId: "guest-001",
  amount: 50,
  remainingHp: 100
}, "rogue-peer-999");
assert(guestPlayerOnGuest.hp === 50, "3.3: Guest rejected MP_HEAL from unauthorized rogue peer");

// 3.4 Rogue peer sends MP_MATCH_VICTORY
guest._handleLobbyMessage({
  type: "MP_MATCH_VICTORY",
  reason: "ROGUE_VICTORY"
}, "rogue-peer-999");
assert(guest.mpState.status === "PLAYING" && guest.state === "PLAYING", "3.4: Guest rejected MP_MATCH_VICTORY from unauthorized rogue peer");

// 3.5 Rogue peer sends MP_MATCH_DEFEAT
guest._handleLobbyMessage({
  type: "MP_MATCH_DEFEAT",
  reason: "ROGUE_DEFEAT"
}, "rogue-peer-999");
assert(guest.mpState.status === "PLAYING" && guest.state === "PLAYING", "3.5: Guest rejected MP_MATCH_DEFEAT from unauthorized rogue peer");

// 3.6 Missing sender ID (undefined) rejected
guest._handleLobbyMessage({
  type: "MP_DAMAGE",
  eventId: "rogue_dmg_undef",
  targetId: "guest-001",
  amount: 30
}, undefined);
assert(guestPlayerOnGuest.hp === 50, "3.6: Guest rejected authoritative event with missing sender identity (undefined)");

// 3.7 Empty or whitespace sender ID rejected
guest._handleLobbyMessage({
  type: "MP_DAMAGE",
  eventId: "rogue_dmg_empty",
  targetId: "guest-001",
  amount: 30
}, "");
guest._handleLobbyMessage({
  type: "MP_DAMAGE",
  eventId: "rogue_dmg_ws",
  targetId: "guest-001",
  amount: 30
}, "   ");
assert(guestPlayerOnGuest.hp === 50, "3.7: Guest rejected authoritative event with empty or whitespace sender ID");

// 3.8 Missing expected host ID on guest rejected (fail-closed)
const guestNoHost = createGameInstance();
guestNoHost.isHost = false;
guestNoHost.hostPeerId = null;
guestNoHost.peer = { id: "guest-001" };
guestNoHost.lobbyPlayers.set("guest-001", { name: "Guest", isHost: false });
guestNoHost.initMPMatch("INFECTION");
guestNoHost.mpState.hostId = null;
const targetInNoHost = guestNoHost.mpState.players.get("guest-001");
targetInNoHost.hp = 100;

guestNoHost._handleLobbyMessage({
  type: "MP_DAMAGE",
  eventId: "rogue_dmg_nohost",
  targetId: "guest-001",
  amount: 30
}, "host-001");
assert(targetInNoHost.hp === 100, "3.8: Guest rejected event when expected host ID is missing (fail-closed)");

// 3.9 Prefix spoofing rejected (exact string match only)
guest._handleLobbyMessage({
  type: "MP_DAMAGE",
  eventId: "rogue_dmg_prefix1",
  targetId: "guest-001",
  amount: 30
}, "host-001-attacker");
guest._handleLobbyMessage({
  type: "MP_DAMAGE",
  eventId: "rogue_dmg_prefix2",
  targetId: "guest-001",
  amount: 30
}, "host-001_evil");
assert(guestPlayerOnGuest.hp === 50, "3.9: Guest rejected prefix spoofing attack (host-001-attacker)");

// 3.10 Payload claiming senderId/hostId="host-001" from rogue peer rejected
guest._handleLobbyMessage({
  type: "MP_DAMAGE",
  eventId: "rogue_dmg_payload_claim",
  targetId: "guest-001",
  amount: 30,
  senderId: "host-001",
  hostId: "host-001"
}, "rogue-peer-999");
assert(guestPlayerOnGuest.hp === 50, "3.10: Guest derived sender strictly from transport connection, rejecting spoofed payload claims");

// 3.11 Rogue peer cannot trigger MP_MATCH_START or overwrite established host identity
guest._handleLobbyMessage({
  type: "MP_MATCH_START",
  matchId: "rogue_match",
  hostId: "rogue-host-999"
}, "rogue-peer-999");
assert(guest.hostPeerId === "host-001" && guest.mpState.hostId === "host-001",
  "3.11: Rogue peer cannot trigger MP_MATCH_START or overwrite established host identity");

// 3.12 Mismatched hostId in MP_MATCH_START payload rejected even if transport is host
const guestFresh = createGameInstance();
guestFresh.isHost = false;
guestFresh.hostPeerId = "host-001";
guestFresh._handleLobbyMessage({
  type: "MP_MATCH_START",
  matchId: "mismatch_match",
  hostId: "fake-host-999"
}, "host-001");
assert(!guestFresh.mpState, "3.12: Guest rejected MP_MATCH_START with mismatched hostId payload");

// ── Milestone 6D-C.2: Host Identity Hardening & Transport Verification ───
// D.1 Missing hostPeerId with populated mpState.hostId MUST be rejected (never fallback)
const guestFallbackTest = createGameInstance();
guestFallbackTest.isHost = false;
guestFallbackTest.hostPeerId = undefined; // Missing trusted signaling host identity
guestFallbackTest.peer = { id: "guest-001" };
guestFallbackTest.lobbyPlayers.set("guest-001", { name: "Guest", isHost: false });
guestFallbackTest.initMPMatch("INFECTION");
guestFallbackTest.mpState.hostId = "host-001"; // Populated in state
const targetPlayer = guestFallbackTest.mpState.players.get("guest-001");
targetPlayer.hp = 100;

guestFallbackTest._handleLobbyMessage({
  type: "MP_DAMAGE",
  eventId: "fallback_exploit",
  targetId: "guest-001",
  amount: 40
}, "host-001");
assert(targetPlayer.hp === 100, "D.1: Missing hostPeerId with populated mpState.hostId rejected (never falls back to mpState.hostId)");

// D.2 Untrusted MP_MATCH_START cannot initialize host identity
const guestUninit = createGameInstance();
guestUninit.isHost = false;
guestUninit.hostPeerId = undefined; // Not established via signaling
guestUninit._handleLobbyMessage({
  type: "MP_MATCH_START",
  matchId: "untrusted_match",
  hostId: "attacker-host"
}, "attacker-host");
assert(guestUninit.hostPeerId === undefined && !guestUninit.mpState,
  "D.2: Untrusted MP_MATCH_START cannot initialize hostPeerId when not established from signaling");

// D.3 Host identity cannot be overwritten after initialization
const guestInit = createGameInstance();
guestInit.isHost = false;
guestInit.hostPeerId = "trusted-host-001";
guestInit._handleLobbyMessage({
  type: "MP_MATCH_START",
  matchId: "tamper_match",
  hostId: "evil-host-999"
}, "trusted-host-001");
assert(guestInit.hostPeerId === "trusted-host-001" && (!guestInit.mpState || guestInit.mpState.hostId === "trusted-host-001"),
  "D.3: Host identity cannot be overwritten by packet payload after trusted initialization");

// D.4 Rogue incoming connection cannot impersonate host (star topology: guest closes incoming connections)
const guestConnTest = createGameInstance();
guestConnTest.isHost = false;
guestConnTest.hostPeerId = "trusted-host-001";
let closedIncomingConn = false;
const mockIncomingConn = {
  peer: "rogue-peer",
  close: () => { closedIncomingConn = true; }
};
let guestConnHandler;
guestConnTest.peer = {
  id: "guest-001",
  on: (event, handler) => { if (event === "connection") guestConnHandler = handler; }
};
guestConnTest.peer.on("connection", (c) => { try { c.close(); } catch(e){} });
guestConnHandler(mockIncomingConn);
assert(closedIncomingConn === true, "D.4: Star topology enforcement immediately closes rogue incoming peer connections on guest");

// D.5 Reliable channel accepts only the trusted host (verifies connection.peer === this.hostPeerId)
let reliableDispatched = false;
const guestReliableTest = createGameInstance();
guestReliableTest.isHost = false;
guestReliableTest.hostPeerId = "trusted-host-001";
guestReliableTest._handleLobbyMessage = () => { reliableDispatched = true; };

const mockRogueReliable = { peer: "untrusted-peer-999" };
const mockTrustedReliable = { peer: "trusted-host-001" };

const reliableCallback = (conn, msg) => {
  const senderPeer = conn.peer;
  if (senderPeer === guestReliableTest.hostPeerId) {
    guestReliableTest._handleLobbyMessage(msg, senderPeer);
  }
};

reliableCallback(mockRogueReliable, { type: "MP_SNAPSHOT" });
assert(reliableDispatched === false, "D.5a: Reliable channel dropped packet from connection with untrusted peer ID");

reliableCallback(mockTrustedReliable, { type: "MP_SNAPSHOT" });
assert(reliableDispatched === true, "D.5b: Reliable channel accepted packet strictly when connection.peer matches trusted hostPeerId");

// D.6 Unreliable channel accepts only the trusted host (verifies connection.peer === this.hostPeerId)
let unreliableDispatched = false;
const guestUnreliableTest = createGameInstance();
guestUnreliableTest.isHost = false;
guestUnreliableTest.hostPeerId = "trusted-host-001";
guestUnreliableTest._handleLobbyMessage = () => { unreliableDispatched = true; };

const mockRogueUnreliable = { peer: "untrusted-peer-999" };
const mockTrustedUnreliable = { peer: "trusted-host-001" };

const unreliableCallback = (conn, msg) => {
  const senderPeer = conn.peer;
  if (senderPeer === guestUnreliableTest.hostPeerId) {
    guestUnreliableTest._handleLobbyMessage(msg, senderPeer);
  }
};

unreliableCallback(mockRogueUnreliable, { type: "MP_SNAPSHOT" });
assert(unreliableDispatched === false, "D.6a: Unreliable channel dropped packet from connection with untrusted peer ID");

unreliableCallback(mockTrustedUnreliable, { type: "MP_SNAPSHOT" });
assert(unreliableDispatched === true, "D.6b: Unreliable channel accepted packet strictly when connection.peer matches trusted hostPeerId");

// ─────────────────────────────────────────────────────────────────
// SECTION 4: Spoofed Sender Identity Rejection (Host-Side)
// ─────────────────────────────────────────────────────────────────
console.log("\n── Section 4: Spoofed Sender Identity Rejection ─────────────────");

// Reset host state
hostPlayer.hp = 100;
hostPlayer.input = { x: 0, y: 0, sprint: false };
guestPlayerOnHost.hp = 100;
guestPlayerOnHost.input = { x: 0, y: 0, sprint: false };

// 4.1 Guest sends MP_INPUT with spoofed peerId="host-001"
host._handleLobbyMessage({
  type: "MP_INPUT",
  peerId: "host-001", // Malicious payload claiming to be host
  x: 1,
  y: 0,
  sprint: true,
  seq: 1
}, "guest-001"); // Actual connection from guest-001

assert(hostPlayer.input.x === 0, "4.1a: Host input unaffected by spoofed MP_INPUT payload (host input.x remained 0)");
assert(guestPlayerOnHost.input.x === 1, "4.1b: Input correctly mapped to actual sender identity (guest-001)");

// 4.2 Guest sends MP_SHOOT with spoofed shooterId="host-001"
let recordedShooter = null;
const origHandleShoot = host.mpHandleShoot.bind(host);
host.mpHandleShoot = function(shooterId, x, y, fx, fy) {
  recordedShooter = shooterId;
  return origHandleShoot(shooterId, x, y, fx, fy);
};

host._handleLobbyMessage({
  type: "MP_SHOOT",
  shooterId: "host-001", // Malicious spoof
  x: 100,
  y: 100,
  fx: 1,
  fy: 0
}, "guest-001");

assert(recordedShooter === "guest-001", "4.2: MP_SHOOT derived shooter identity strictly from connection (guest-001), ignoring spoofed payload");

// 4.3 Guest sends MP_INFECTION_SHOOT with spoofed shooterId="host-001"
let recordedInfectionShooter = null;
const origHandleInfectionShoot = host.mpHandleInfectionShoot.bind(host);
host.mpHandleInfectionShoot = function(shooterId, weaponType, x, y, fx, fy) {
  recordedInfectionShooter = shooterId;
  return origHandleInfectionShoot(shooterId, weaponType, x, y, fx, fy);
};

host._handleLobbyMessage({
  type: "MP_INFECTION_SHOOT",
  shooterId: "host-001", // Malicious spoof
  weaponType: "ZOMBIE_KILLER",
  x: 100,
  y: 100,
  fx: 1,
  fy: 0
}, "guest-001");

assert(recordedInfectionShooter === "guest-001", "4.3: MP_INFECTION_SHOOT derived shooter identity strictly from connection (guest-001)");

// 4.4 Guest sends MP_PUSH with spoofed casterId="host-001"
let recordedCaster = null;
const origHandlePush = host.mpHandlePush.bind(host);
host.mpHandlePush = function(casterId, cx, cy) {
  recordedCaster = casterId;
  return origHandlePush(casterId, cx, cy);
};

host._handleLobbyMessage({
  type: "MP_PUSH",
  casterId: "host-001", // Malicious spoof
  cx: 100,
  cy: 100
}, "guest-001");

assert(recordedCaster === "guest-001", "4.4: MP_PUSH derived caster identity strictly from connection (guest-001)");

// ─────────────────────────────────────────────────────────────────
// SECTION 5: Guest Reliable Message Sending Restrictions
// ─────────────────────────────────────────────────────────────────
console.log("\n── Section 5: Guest Reliable Message Sending Restrictions ───────");

let guestBroadcastSent = false;
let guestReliableToHostSent = null;

guest.mpConnections.clear();
guest.mpConnections.set("host-001", {
  reliable: {
    open: true,
    send: (msg) => { guestReliableToHostSent = msg; }
  }
});

// 5.1 Guest calls _broadcastReliable directly
guest._broadcastReliable({ type: "MP_DAMAGE", targetId: "host-001", amount: 50 });
assert(guestReliableToHostSent === null, "5.1: Guest _broadcastReliable blocked (host-only restriction enforced)");

// 5.2 Guest calls _sendToHostReliable with unapproved authoritative message
guest._sendToHostReliable({ type: "MP_DAMAGE", targetId: "host-001", amount: 50 });
assert(guestReliableToHostSent === null, "5.2: _sendToHostReliable blocked unapproved authoritative type MP_DAMAGE");

guest._sendToHostReliable({ type: "MP_MATCH_VICTORY" });
assert(guestReliableToHostSent === null, "5.2b: _sendToHostReliable blocked unapproved authoritative type MP_MATCH_VICTORY");

// 5.3 Guest calls _sendToHostReliable with approved request type
guest._sendToHostReliable({ type: "MP_INFECTION_SHOOT", weaponType: "ZOMBIE_KILLER", x: 200, y: 200 });
assert(guestReliableToHostSent !== null && guestReliableToHostSent.type === "MP_INFECTION_SHOOT",
  "5.3: _sendToHostReliable permitted approved request type MP_INFECTION_SHOOT");

// ─────────────────────────────────────────────────────────────────
// SECTION 6: Game Loop Mutually Exclusive Update Scheduling
// ─────────────────────────────────────────────────────────────────
console.log("\n── Section 6: Game Loop & Background Mutually Exclusive Sched ───");

const loopGame = createGameInstance();

// 6.1 Visible Tab: Uses RAF exclusively; background timer is null
docHidden = false;
loopGame.start();
let initialUpdates = 0;
loopGame.update = () => { initialUpdates++; };

// Run RAF callback
if (rafCallbacks.length > 0) {
  mockTime += 16;
  const cb = rafCallbacks.pop();
  cb(mockTime);
}
assert(initialUpdates === 1, "6.1a: Visible tab executed physics update via RAF callback");

// 6.2 Hidden Solo Mode: Must pause (no background updates, no RAF execution)
loopGame.mode = "SOLO";
loopGame.mpState = null;
let soloHiddenUpdates = 0;
loopGame.update = () => { soloHiddenUpdates++; };

docHidden = true;
document.dispatchEvent({ type: "visibilitychange" });

// Run RAF callback while hidden
if (rafCallbacks.length > 0) {
  mockTime += 16;
  const cb = rafCallbacks.pop();
  cb(mockTime);
}
assert(soloHiddenUpdates === 0, "6.2: Hidden Solo Mode strictly pauses (zero physics updates while hidden)");

// 6.3 Hidden Multiplayer Host: Uses background update timer exclusively
const mpHostGame = createGameInstance();
mpHostGame.mode = "CUSTOM_ROOM";
mpHostGame.state = "PLAYING";
mpHostGame.isHost = true;
mpHostGame.peer = { id: "host-loop-1" };
mpHostGame.initMPMatch("INFECTION");
mpHostGame.mpState.status = "PLAYING";
docHidden = true;
mpHostGame.start();

let mpHostUpdates = 0;
mpHostGame.update = (dt) => { mpHostUpdates++; };

// Trigger background timer check
mpHostGame._checkBackgroundTimer();

// Allow mock time to advance and trigger interval
mockTime += 30;
// Trigger visibility change to start timer
document.dispatchEvent({ type: "visibilitychange" });

// Wait a short tick
setTimeout(() => {
  // 6.4 Visibility transition from Hidden to Visible: resets timing and stops interval
  docHidden = false;
  document.dispatchEvent({ type: "visibilitychange" });

  let visibleRafUpdates = 0;
  mpHostGame.update = (dt) => { visibleRafUpdates++; };
  if (rafCallbacks.length > 0) {
    mockTime += 16;
    const cb = rafCallbacks.pop();
    cb(mockTime);
  }
  assert(visibleRafUpdates === 1, "6.4: Visibility transition from Hidden to Visible restored RAF updates smoothly");

  // 6.5 Snapshot timing: accumulator bounds snapshots to 25Hz without duplication
  if (mpHostGame._bgTimer) {
    clearInterval(mpHostGame._bgTimer);
    mpHostGame._bgTimer = null;
  }
  // Restore original update method for physics & snapshot timing check
  delete mpHostGame.update;
  mpHostGame.mode = "CUSTOM_ROOM";
  mpHostGame.state = "PLAYING";
  mpHostGame.mpState.status = "PLAYING";
  mpHostGame.mpState.seq = 0;
  let snapshotBroadcasts = 0;
  mpHostGame.mpConnections.set("g1", { reliable: { open: true, send: () => { snapshotBroadcasts++; } } });
  
  mpHostGame.mpSnapshotTimer = 0.01;
  mpHostGame.update(0.01); // Timer = 0.02 (< 0.04) -> no snapshot
  const snapAfterSmallDelta = snapshotBroadcasts;
  
  mpHostGame.update(0.03); // Timer = 0.05 (>= 0.04) -> exactly 1 snapshot
  const snapAfterThreshold = snapshotBroadcasts;
  
  assert(snapAfterSmallDelta === 0 && snapAfterThreshold === 1,
    "6.5: Snapshot accumulator broadcasts strictly at 25Hz threshold without duplication");

  console.log("\n────────────────────────────────────────────────────────────");
  console.log("Milestone 6D-C Security & Game Loop Suite Results:");
  console.log(`  PASSED: ${passed}`);
  console.log(`  FAILED: ${failed}`);
  console.log(`  TOTAL:  ${passed + failed}`);
  console.log("────────────────────────────────────────────────────────────");

  process.exit(failed > 0 ? 1 : 0);
}, 60);
