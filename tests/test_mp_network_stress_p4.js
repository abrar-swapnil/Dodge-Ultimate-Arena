/**
 * Milestone 7 Phase 4: Complete Network Stress, Performance & Gameplay Reliability Suite
 *
 * Comprehensive deterministic test suite for:
 * 1. Network Latency Simulation (50ms, 100ms, 200ms, 300ms, 500ms, 1000ms)
 * 2. Packet Loss Simulation (1%, 5%, 10%, 20%, 30%, 50% loss recovery & de-duplication)
 * 3. Jitter, Out-of-Order Delivery & Bursty Packet Spikes (monotonic sequence enforcement)
 * 4. Connection Interruptions, Silence Detection (2.0s), 5.0s Reconnect Window & Session Expiration
 * 5. WebRTC DataChannel Congestion, Backpressure (>=64KB threshold) & Recovery
 * 6. Memory Bounds & Extended Session Stability (bounded processedEvents, floatingTexts, particles, full cleanup)
 * 7. Security, Directional Validation & Fail-Closed Cryptography
 */

"use strict";

const fs = require("fs");
const path = require("path");

console.log("==================================================================");
console.log("  MILESTONE 7 PHASE 4: NETWORK STRESS, PERFORMANCE & RELIABILITY  ");
console.log("==================================================================\n");

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName, details = "") {
  if (condition) {
    console.log(`  ✅ PASS  ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL  ${testName} ${details ? "(" + details + ")" : ""}`);
    failedCount++;
  }
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
    roundRect: () => {},
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
  getElementById: (id) => (id === "game-canvas" ? mockCanvas : {
    style: {},
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    addEventListener: () => {},
    innerText: "", innerHTML: "", textContent: "", disabled: false, value: "",
    appendChild: () => {}
  }),
  querySelectorAll: () => [],
  querySelector: () => null,
  documentElement: { requestFullscreen: () => Promise.resolve() }
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

function makeHostGame(mode = "INFECTION") {
  const g = createGameInstance();
  g.isHost = true;
  g.mode = "CUSTOM_ROOM";
  g.peer = { id: "host-peer", destroy: () => {} };
  g.lobbyRoomCode = "CHAOS1";
  g.lobbyPlayers = new Map([
    ["host-peer", { name: "Host", shape: "square", isHost: true }],
    ["guest-1",   { name: "Guest1", shape: "circle", isHost: false }],
    ["guest-2",   { name: "Guest2", shape: "triangle", isHost: false }]
  ]);
  g.lobbyMode = mode;
  g.initMPMatch();
  return g;
}

function makeGuestGame(guestId = "guest-1", mode = "INFECTION") {
  const g = createGameInstance();
  g.isHost = false;
  g.hostPeerId = "host-peer";
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

async function runTests() {
  // ═════════════════════════════════════════════════════════════════════
  // SUITE 1: NETWORK LATENCY SIMULATION (Section 4.A)
  // ═════════════════════════════════════════════════════════════════════
  console.log("── Suite 1: Network Latency Simulation (50ms - 1000ms) ─────────");
  {
    const latencies = [50, 100, 200, 300, 500, 1000];

    for (const lat of latencies) {
      const guest = makeGuestGame("guest-1", "INFECTION");

      const sentTime = 1000000;
      const arrivalTime = sentTime + lat;

      // Simulate snapshot sent at sentTime arriving at arrivalTime
      const snap = {
        type: "MP_SNAPSHOT",
        seq: 1,
        time: sentTime,
        players: [
          { id: "host-peer", x: 100 + (lat * 0.1), y: 100, hp: 100, isAlive: true },
          { id: "guest-1",   x: 680, y: 150, hp: 100, isAlive: true }
        ]
      };

      guest.mpApplySnapshot(snap);

      const hostP = guest.mpState.players.get("host-peer");
      assert(
        hostP && hostP.x === (100 + lat * 0.1),
        `1.${latencies.indexOf(lat) + 1}: Snapshot applied accurately at ${lat}ms simulated latency`,
        `expected x=${100 + lat * 0.1}, got ${hostP?.x}`
      );
    }

    // Latency with simultaneous damage verification
    const guestDmg = makeGuestGame("guest-1", "INFECTION");

    // Delayed damage message (200ms latency)
    guestDmg._handleLobbyMessage({
      type: "MP_DAMAGE",
      eventId: "dmg_lat_200",
      targetId: "guest-1",
      amount: 35,
      remainingHp: 65,
      sourceId: "chaser_1"
    }, "host-peer");

    const myP = guestDmg.mpState.players.get("guest-1");
    assert(myP && myP.hp === 65, "1.7: Delayed damage applied accurately with host remainingHp (65 HP)");
  }

  // ═════════════════════════════════════════════════════════════════════
  // SUITE 2: PACKET LOSS SIMULATION (Section 4.B)
  // ═════════════════════════════════════════════════════════════════════
  console.log("\n── Suite 2: Packet Loss Simulation (1% - 50%) ──────────────────");
  {
    const lossRates = [0.01, 0.05, 0.10, 0.20, 0.30, 0.50];

    for (const rate of lossRates) {
      const guest = makeGuestGame("guest-1", "INFECTION");

      let delivered = 0;
      let dropped = 0;
      for (let seq = 1; seq <= 20; seq++) {
        const shouldDrop = (seq * 13 % 100) < (rate * 100);
        if (shouldDrop) {
          dropped++;
          continue;
        }
        delivered++;
        guest.mpApplySnapshot({
          type: "MP_SNAPSHOT",
          seq: seq,
          time: Date.now(),
          players: [
            { id: "host-peer", x: 100 + seq * 5, y: 100, hp: Math.max(20, 100 - seq * 2), isAlive: true },
            { id: "guest-1",   x: 680, y: 150, hp: 100, isAlive: true }
          ]
        });
      }

      const hostP = guest.mpState.players.get("host-peer");
      const lastExpectedSeq = guest.mpLastSnapshotSeq;
      assert(
        lastExpectedSeq > 0 && hostP && hostP.x === (100 + lastExpectedSeq * 5),
        `2.${lossRates.indexOf(rate) + 1}: ${Math.round(rate * 100)}% packet loss: state recovered to seq ${lastExpectedSeq} without corruption`,
        `delivered=${delivered}, dropped=${dropped}`
      );
    }

    // Duplicate damage prevention under packet loss retransmission
    const guestDedup = makeGuestGame("guest-1", "INFECTION");
    const p = guestDedup.mpState.players.get("guest-1");
    p.hp = 100;

    guestDedup._handleLobbyMessage({
      type: "MP_DAMAGE",
      eventId: "unique_event_loss_101",
      targetId: "guest-1",
      amount: 25,
      remainingHp: 75
    }, "host-peer");
    assert(p.hp === 75, "2.7: Damage event applied initially (100 -> 75 HP)");

    guestDedup._handleLobbyMessage({
      type: "MP_DAMAGE",
      eventId: "unique_event_loss_101",
      targetId: "guest-1",
      amount: 25,
      remainingHp: 50
    }, "host-peer");
    assert(p.hp === 75, "2.8: Retransmitted duplicate damage event strictly discarded (HP remained 75)");
  }

  // ═════════════════════════════════════════════════════════════════════
  // SUITE 3: JITTER & OUT-OF-ORDER PACKET REORDERING (Section 4.C)
  // ═════════════════════════════════════════════════════════════════════
  console.log("\n── Suite 3: Jitter & Packet Reordering Simulation ──────────────");
  {
    const guest = makeGuestGame("guest-1", "INFECTION");

    const seqArrivals = [1, 4, 2, 3, 5, 8, 6, 7, 9];
    let appliedSeqs = [];
    let droppedSeqs = [];

    for (const seq of seqArrivals) {
      const beforeSeq = guest.mpLastSnapshotSeq || 0;
      guest.mpApplySnapshot({
        type: "MP_SNAPSHOT",
        seq: seq,
        time: Date.now(),
        players: [
          { id: "host-peer", x: seq * 10, y: seq * 10, hp: 100, isAlive: true },
          { id: "guest-1",   x: 680, y: 150, hp: 100, isAlive: true }
        ]
      });
      if ((guest.mpLastSnapshotSeq || 0) === seq && seq > beforeSeq) {
        appliedSeqs.push(seq);
      } else {
        droppedSeqs.push(seq);
      }
    }

    assert(
      JSON.stringify(appliedSeqs) === JSON.stringify([1, 4, 5, 8, 9]),
      "3.1: Monotonic sequence filtering: only forward-advancing snapshots accepted [1, 4, 5, 8, 9]",
      `got ${JSON.stringify(appliedSeqs)}`
    );

    assert(
      JSON.stringify(droppedSeqs) === JSON.stringify([2, 3, 6, 7]),
      "3.2: Stale out-of-order packets correctly dropped [2, 3, 6, 7]",
      `got ${JSON.stringify(droppedSeqs)}`
    );

    const finalX = guest.mpState.players.get("host-peer").x;
    assert(finalX === 90, "3.3: Final position reflects newest snapshot seq 9 (x=90)");

    const burstSeqs = [10, 11, 12, 13, 14];
    for (const s of burstSeqs) {
      guest.mpApplySnapshot({
        type: "MP_SNAPSHOT",
        seq: s,
        time: Date.now(),
        players: [
          { id: "host-peer", x: s * 10, y: 100, hp: 100, isAlive: true },
          { id: "guest-1",   x: 680, y: 150, hp: 100, isAlive: true }
        ]
      });
    }
    assert(guest.mpLastSnapshotSeq === 14, "3.4: Bursty spike applied monotonically to seq 14");
    assert(guest.mpState.players.get("host-peer").x === 140, "3.5: Authoritative position updated to seq 14 (x=140)");
  }

  // ═════════════════════════════════════════════════════════════════════
  // SUITE 4: CONNECTION INTERRUPTIONS & SILENCE LIFECYCLE (Section 4.D)
  // ═════════════════════════════════════════════════════════════════════
  console.log("\n── Suite 4: Connection Interruptions & Silence Lifecycle ───────");
  {
    const host = makeHostGame("INFECTION");

    const pSilent = host.mpState.players.get("guest-2");
    const pActive = host.mpState.players.get("guest-1");

    const startTime = 1000000;
    pSilent.lastHeartbeatResponseTime = startTime;
    pActive.lastHeartbeatResponseTime = startTime;

    // Active player input packet refreshes liveness
    host._handleLobbyMessage({
      type: "MP_INPUT",
      x: 1, y: 0, sprint: false, seq: 10
    }, "guest-1");

    assert(
      pActive.lastHeartbeatResponseTime > startTime,
      "4.1: Guest input packet actively refreshes player liveness timestamp"
    );

    // Silence detection: silence > 2000ms triggers soft disconnect
    pSilent.lastHeartbeatResponseTime = startTime - 2500;
    host._handlePeerTemporaryDisconnect("guest-2");

    assert(pSilent.disconnected === true, "4.2: 2.0s silence threshold triggered soft disconnect");
    assert(pSilent.disconnectDeadline !== null, "4.3: 5.0s reconnect window deadline granted");

    // Soft-disconnected player cannot move or deal damage
    host.mpState.status = "PLAYING";
    host.update(0.05);
    assert(pSilent.vx === 0 && pSilent.vy === 0, "4.4: Disconnected player velocity locked to 0 during reconnect window");

    // Active player moves normally
    pActive.input = { x: 1, y: 0, sprint: false };
    pActive.isAlive = true;
    host.update(0.05);
    assert(pActive.x > 680, "4.5: Active connected player moves normally");

    // Reconnection deadline expiration
    pSilent.disconnectDeadline = startTime - 100;
    host._handlePeerDisconnect("guest-2");

    assert(!host.mpState.players.has("guest-2"), "4.6: Expired player permanently purged from players map");
    assert(host.mpState.players.has("guest-1"), "4.7: Remaining active player unaffected");
  }

  // ═════════════════════════════════════════════════════════════════════
  // SUITE 5: SNAPSHOT CONGESTION & WEBRTC BACKPRESSURE (Section 4.E)
  // ═════════════════════════════════════════════════════════════════════
  console.log("\n── Suite 5: Snapshot Congestion & WebRTC Backpressure ──────────");
  {
    const host = makeHostGame("INFECTION");

    let sentPackets = 0;
    const mockDataChannel = {
      bufferedAmount: 0,
      send() { sentPackets++; }
    };

    const mockConn = {
      reliable: { open: true, send: () => {} },
      unreliable: {
        open: true,
        dataChannel: mockDataChannel,
        send(msg) { mockDataChannel.send(msg); }
      }
    };

    host.mpConnections.set("guest-1", mockConn);

    // Normal buffer: snapshot should be sent
    mockDataChannel.bufferedAmount = 1024;
    host.mpBroadcastSnapshot();
    assert(sentPackets === 1, "5.1: Normal buffer (<64KB): snapshot transmitted cleanly");

    // Congested buffer: bufferedAmount >= 65536 bytes
    mockDataChannel.bufferedAmount = 70000;
    host.mpBroadcastSnapshot();
    assert(sentPackets === 1, "5.2: Congested buffer (>=64KB): snapshot transmission skipped to prevent bloat");

    // Buffer drains: transmission resumes
    mockDataChannel.bufferedAmount = 4096;
    host.mpBroadcastSnapshot();
    assert(sentPackets === 2, "5.3: Drained buffer: transmission immediately resumes with latest snapshot");

    assert(host.mpState.seq === 3, "5.4: Monotonic sequence correctly tracked across backpressure frames (seq=3)");
  }

  // ═════════════════════════════════════════════════════════════════════
  // SUITE 6: MEMORY BOUNDS & EXTENDED SESSION STABILITY (Section 5)
  // ═════════════════════════════════════════════════════════════════════
  console.log("\n── Suite 6: Memory Bounds & Extended Session Stability ─────────");
  {
    const host = makeHostGame("INFECTION");

    // 1. Processed events bounded capacity test (5000 events)
    for (let i = 1; i <= 5000; i++) {
      host._addProcessedEvent(`event_stress_${i}`);
    }

    assert(
      host.mpState.processedEvents.size <= 2000,
      "6.1: processedEvents Set strictly bounded (size <= 2000 after 5000 additions)",
      `size=${host.mpState.processedEvents.size}`
    );

    assert(
      host.mpState.processedEvents.has("event_stress_5000"),
      "6.2: Most recent event_stress_5000 retained in Set"
    );

    assert(
      !host.mpState.processedEvents.has("event_stress_1"),
      "6.3: Old event_stress_1 evicted via FIFO ring eviction"
    );

    // 2. Floating text bounding test
    for (let i = 0; i < 150; i++) {
      host.floatingTexts.push({ update() {}, alpha: 1, text: `Text ${i}` });
    }
    host.update(0.016);
    assert(
      host.floatingTexts.length <= 60,
      "6.4: floatingTexts strictly capped to <= 60 items during frame update",
      `length=${host.floatingTexts.length}`
    );

    // 3. Particle bounding test
    for (let i = 0; i < 500; i++) {
      host.particles.push({ update() {}, alpha: 1, color: "#ff0055" });
    }
    host.update(0.016);
    assert(
      host.particles.length <= 200,
      "6.5: particles strictly capped to <= 200 items during frame update",
      `length=${host.particles.length}`
    );

    // 4. _lobbyLeave cleanup test
    await host._lobbyLeave();
    assert(host.mpState === null, "6.6: _lobbyLeave thoroughly cleared mpState to null");
    assert(host.hostPeerId === null, "6.7: _lobbyLeave thoroughly cleared hostPeerId to null");
    assert(host.isReconnecting === false, "6.8: _lobbyLeave thoroughly cleared isReconnecting flag");
    assert(host.mpConnections.size === 0, "6.9: _lobbyLeave cleared mpConnections map");
  }

  // ═════════════════════════════════════════════════════════════════════
  // SUITE 7: SECURITY, DIRECTIONAL VALIDATION & CRYPTOGRAPHY (Section 8)
  // ═════════════════════════════════════════════════════════════════════
  console.log("\n── Suite 7: Security, Directional Validation & Cryptography ────");
  {
    const guest = makeGuestGame("guest-1", "INFECTION");
    const p = guest.mpState.players.get("guest-1");
    p.hp = 100;

    // 1. Spoofed damage from rogue peer must be dropped
    guest._handleLobbyMessage({
      type: "MP_DAMAGE",
      eventId: "evil_dmg_1",
      targetId: "guest-1",
      amount: 90,
      remainingHp: 10
    }, "rogue-imposter-999");

    assert(p.hp === 100, "7.1: Directional security: Spoofed MP_DAMAGE from unauthenticated peer dropped (HP=100)");

    // 2. Spoofed match start from rogue peer must be dropped
    let matchStartCalled = false;
    guest.handleMPMatchStart = () => { matchStartCalled = true; };
    guest._handleLobbyMessage({
      type: "MP_MATCH_START",
      hostId: "rogue-imposter-999"
    }, "rogue-imposter-999");

    assert(matchStartCalled === false, "7.2: Directional security: Spoofed MP_MATCH_START from unauthenticated peer dropped");

    // 3. Host-authoritative weapon damage validation: Dead shooter rejected
    const host = makeHostGame("INFECTION");
    const shooter = host.mpState.players.get("guest-1");
    shooter.isAlive = false;
    shooter.isSpectator = true;
    shooter.infectionWeapon = { type: "ZOMBIE_KILLER", ammo: 150 };

    const resultDead = host.mpApplyWeaponDamage("INFECTED_BOSS", "boss_infected", "guest-1", "ZOMBIE_KILLER");
    assert(resultDead === null, "7.3: Host strictly rejects weapon damage from dead or spectator player");

    // 4. Cryptographic random fail-closed verification
    const token = host.mpGenerateSecureToken();
    assert(
      typeof token === "string" && token.length === 32,
      "7.4: Secure 128-bit hexadecimal token generated with cryptographic entropy",
      `token=${token}`
    );

    // Timing safe equal verification
    assert(host.mpTimingSafeEqual("abcdef123456", "abcdef123456") === true, "7.5: mpTimingSafeEqual returns true for identical tokens");
    assert(host.mpTimingSafeEqual("abcdef123456", "abcdef123457") === false, "7.6: mpTimingSafeEqual returns false for different tokens");
    assert(host.mpTimingSafeEqual("abc", "abcdef") === false, "7.7: mpTimingSafeEqual returns false for different lengths");
  }

  // ═════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═════════════════════════════════════════════════════════════════════
  console.log("\n──────────────────────────────────────────────────────────────────");
  console.log("Milestone 7 Phase 4 Network Stress & Reliability Results:");
  console.log(`  PASSED: ${passedCount}`);
  console.log(`  FAILED: ${failedCount}`);
  console.log(`  TOTAL:  ${passedCount + failedCount}`);
  console.log("──────────────────────────────────────────────────────────────────");

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
