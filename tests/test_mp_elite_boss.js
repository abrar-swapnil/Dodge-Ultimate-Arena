/**
 * test_mp_elite_boss.js — Milestone 5C
 * Comprehensive automated test suite for Demon Boss & Fireball Gun:
 * - Demon Boss spawn at 200 pts with exact 2500 HP.
 * - Fireball Gun grant to all surviving players (100 ammo, 50 damage/shot, FF OFF).
 * - Threat targeting: highest individual score contribution.
 * - 3 Boss abilities: Fireball (5s/10dmg), Pink Vapor (15s/7s/5dmg/0.5s), Green Gas (20s/30s/2dmg/s).
 * - Player fireball damage (50 HP per hit), Demon Boss defeat, Team Victory.
 * - 25Hz snapshot synchronization & Solo Mode isolation.
 */

"use strict";

const fs   = require("fs");
const path = require("path");

console.log("=================================================");
console.log("   MILESTONE 5C: DEMON BOSS & FIREBALL GUN TESTS ");
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
  g.lobbyRoomCode = "BOSS_TEST";
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
  g.peer   = { id: "guest-peer" };
  g.mpConnections        = new Map();
  g.floatingTexts        = g.floatingTexts || [];
  return g;
}

// ── SUITE 1: Demon Boss Spawn & Attributes ────────────────────────────────────
console.log("\n── Suite 1: Demon Boss Spawn & Attributes ──────────────────────");

{
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  g.mpState.teamScore = 200; // Reach 200 points
  g.mpUpdateElite(0.016);

  assert(g.mpState.boss !== null, "1a: Demon Boss spawned at 200 points");
  assertEqual(g.mpState.boss.hp, 2500, "1b: Demon Boss HP is exactly 2500");
  assertEqual(g.mpState.boss.maxHp, 2500, "1c: Demon Boss maxHp is exactly 2500");
  assertEqual(g.mpState.boss.isAlive, true, "1d: Demon Boss is alive");
}

{
  // Test boss HP does NOT scale with 8 players (fixed 2500 HP)
  const g = makeHostGame();
  g.lobbyPlayers = new Map();
  for (let i = 0; i < 8; i++) {
    g.lobbyPlayers.set(`peer-${i}`, { name: `P${i+1}`, shape: "square", isHost: i === 0 });
  }
  g.initMPMatch("ELITE");
  g.mpState.teamScore = 200;
  g.mpUpdateElite(0.016);
  assertEqual(g.mpState.boss.hp, 2500, "1e: Boss HP is exactly 2500 with 8 players (does not scale)");
}

// ── SUITE 2: Fireball Gun Grant & Mechanics ───────────────────────────────────
console.log("\n── Suite 2: Fireball Gun Grant & Shooting ──────────────────────");

{
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  g.mpState.teamScore = 200;
  g.mpUpdateElite(0.016);

  const hostP = g.mpState.players.get("host-peer");
  const guestP = g.mpState.players.get("guest-peer");

  assert(hostP.fireballGun !== undefined, "2a: host player received Fireball Gun at 200 pts");
  assert(guestP.fireballGun !== undefined, "2b: guest player received Fireball Gun at 200 pts");
  assertEqual(hostP.fireballGun.ammo, 100, "2c: Fireball Gun starts with exactly 100 ammo");
  assertEqual(hostP.fireballGun.damage, 50, "2d: Fireball Gun damage is 50 HP per shot");
}

{
  // Test eliminated players do NOT receive Fireball Gun
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  const guestP = g.mpState.players.get("guest-peer");
  guestP.isAlive = false;
  guestP.isSpectator = true;

  g.mpState.teamScore = 200;
  g.mpUpdateElite(0.016);

  assert(guestP.fireballGun === undefined, "2e: eliminated spectator does NOT receive Fireball Gun");
}

{
  // Test firing Fireball Gun consumes 1 ammo and spawns projectile
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  g.mpState.teamScore = 200;
  g.mpUpdateElite(0.016);

  const initialAmmo = g.mpState.players.get("host-peer").fireballGun.ammo;
  g.mpHandleShoot("host-peer", 100, 100, 1, 0);

  const remainingAmmo = g.mpState.players.get("host-peer").fireballGun.ammo;
  assertEqual(remainingAmmo, initialAmmo - 1, "2f: firing decrements Fireball Gun ammo by 1");
  assert(g.mpState.playerFireballs.length === 1, "2g: playerFireball projectile created");
  assertEqual(g.mpState.playerFireballs[0].damage, 50, "2h: projectile damage is 50 HP");
}

// ── SUITE 3: Threat Priority Targeting ────────────────────────────────────────
console.log("\n── Suite 3: Threat Priority Targeting ──────────────────────────");

{
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  const p1 = g.mpState.players.get("host-peer");
  const p2 = g.mpState.players.get("guest-peer");

  // Give guest a higher individual score contribution
  p1.scoreContribution = 30;
  p2.scoreContribution = 65;

  g.mpState.teamScore = 200;
  g.mpUpdateElite(0.016);

  assertEqual(g.mpState.boss.targetId, "guest-peer", "3a: Demon Boss targets player with highest score contribution");
}

// ── SUITE 4: Boss Abilities & Exact Damages ───────────────────────────────────
console.log("\n── Suite 4: Boss Abilities (Fireball, Pink Vapor, Green Gas) ───");

{
  // Ability 1: Fireball (every 5.0s, 10 damage)
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  g.mpState.teamScore = 200;
  g.mpUpdateElite(0.016);

  g.mpState.boss.fireballTimer = 0.01; // trigger fireball
  g.mpUpdateElite(0.02);

  assert(g.mpState.bossProjectiles.length >= 1, "4a: boss launches Fireball");
  const fb = g.mpState.bossProjectiles[0];
  assertEqual(fb.type, "FIREBALL", "4b: projectile type is FIREBALL");
  assertEqual(fb.damage, 10, "4c: Fireball damage is exactly 10 HP");

  // Test damage application to player
  const p = g.mpState.players.get("host-peer");
  p.hp = 100;
  fb.x = p.x + 10;
  fb.y = p.y + 10;
  g.mpUpdateElite(0.016); // collision check
  assertEqual(p.hp, 90, "4d: Fireball collision deals exact 10 HP damage");
}

{
  // Ability 2: Pink Burst Vapor (every 15.0s, lasts 7.0s, 5 damage every 0.5s)
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  g.mpState.teamScore = 200;
  g.mpUpdateElite(0.016);

  g.mpState.boss.vaporTimer = 0.01; // trigger vapor
  g.mpUpdateElite(0.02);

  const pv = g.mpState.bossVapors.find(v => v.type === "PINK_BURST");
  assert(pv !== undefined, "4e: Pink Burst Vapor spawned");
  assert(Math.abs(pv.duration - (7.0 - 0.02)) < 0.001, "4f: Pink Burst Vapor has exact 7.0s initial duration");
  assertEqual(pv.tickDamage, 5, "4g: Pink Burst Vapor deals exact 5 damage per tick");
  assert(Math.abs(pv.tickTimer - (0.5 - 0.02)) < 0.001, "4h: Pink Burst Vapor ticks every 0.5s");

  // Test tick damage
  const p = g.mpState.players.get(g.mpState.boss.targetId);
  p.hp = 100;
  pv.x = p.x + 5;
  pv.y = p.y + 5;
  pv.tickTimer = 0.01;
  g.mpUpdateElite(0.02);
  assertEqual(p.hp, 95, "4i: Pink Burst Vapor deals exactly 5 HP damage per tick");
}

{
  // Ability 3: Targeted Green Gas (every 20.0s, lasts 30.0s, 2 damage/s)
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  g.mpState.teamScore = 200;
  g.mpUpdateElite(0.016);

  g.mpState.boss.gasTimer = 0.01; // trigger green gas
  g.mpUpdateElite(0.02);

  const gg = g.mpState.bossVapors.find(v => v.type === "TARGETED_GREEN");
  assert(gg !== undefined, "4j: Targeted Green Gas spawned");
  assert(Math.abs(gg.duration - (30.0 - 0.02)) < 0.001, "4k: Targeted Green Gas has exact 30.0s initial duration");
  assertEqual(gg.tickDamage, 2, "4l: Targeted Green Gas deals exact 2 damage per second");

  // Test sustained tick damage
  const p = g.mpState.players.get(g.mpState.boss.targetId);
  p.hp = 100;
  gg.x = p.x + 5;
  gg.y = p.y + 5;
  gg.tickTimer = 0.01;
  g.mpUpdateElite(0.02);
  assertEqual(p.hp, 98, "4m: Targeted Green Gas deals exactly 2 HP damage");
}

// ── SUITE 5: Boss Combat & Team Victory ───────────────────────────────────────
console.log("\n── Suite 5: Boss Combat, Defeat & Team Victory ─────────────────");

{
  // Direct hit deals 50 damage to Demon Boss
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  g.mpState.teamScore = 200;
  g.mpUpdateElite(0.016);

  const b = g.mpState.boss;
  b.hp = 2500;
  g.mpState.playerFireballs = [{
    id: "pf_1",
    shooterId: "host-peer",
    x: b.x,
    y: b.y,
    vx: 0, vy: 0,
    radius: 8,
    damage: 50,
    life: 2.0
  }];

  g.mpUpdateElite(0.016);
  assertEqual(b.hp, 2450, "5a: player fireball deals exact 50 HP damage to Demon Boss");
  assertEqual(g.mpState.playerFireballs.length, 0, "5b: fireball consumed upon impact");
}

{
  // Friendly Fire is OFF: fireballs do not damage teammates
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  g.mpState.teamScore = 200;
  g.mpUpdateElite(0.016);

  const teammate = g.mpState.players.get("guest-peer");
  teammate.hp = 100;

  g.mpState.playerFireballs = [{
    id: "pf_ff",
    shooterId: "host-peer",
    x: teammate.x + 5,
    y: teammate.y + 5,
    vx: 0, vy: 0,
    radius: 8,
    damage: 50,
    life: 2.0
  }];

  g.mpUpdateElite(0.016);
  assertEqual(teammate.hp, 100, "5c: Friendly fire is OFF (teammate takes 0 damage from fireball)");
}

{
  // Boss Defeat triggers Team Victory
  const g = makeHostGame();
  g.initMPMatch("ELITE");
  g.mpState.teamScore = 200;
  g.mpUpdateElite(0.016);

  let victoryEventSent = false;
  g._broadcastReliable = (msg) => {
    if (msg.type === "MP_MATCH_VICTORY") victoryEventSent = true;
  };

  const b = g.mpState.boss;
  b.hp = 50; // 1 shot away from defeat
  g.mpState.playerFireballs = [{
    id: "pf_kill",
    shooterId: "host-peer",
    x: b.x,
    y: b.y,
    vx: 0, vy: 0,
    radius: 8,
    damage: 50,
    life: 2.0
  }];

  g.mpUpdateElite(0.016);
  assertEqual(b.hp, 0, "5d: Demon Boss HP reaches 0");
  assertEqual(b.isAlive, false, "5e: Demon Boss marked as not alive");
  assertEqual(g.mpState.status, "VICTORY", "5f: match status updated to VICTORY");
  assertEqual(g.state, "VICTORY", "5g: game state set to VICTORY");
  assert(victoryEventSent, "5h: MP_MATCH_VICTORY reliable broadcast sent to team");
}

// ── SUITE 6: Snapshot Synchronization (Demon Boss & Combat) ───────────────────
console.log("\n── Suite 6: Snapshot Sync of Demon Boss & Fireballs ────────────");

{
  const host = makeHostGame();
  host.initMPMatch("ELITE");
  host.mpState.teamScore = 200;
  host.mpUpdateElite(0.016);

  let captured = null;
  host._broadcastUnreliable = (msg) => { captured = msg; };
  host.mpBroadcastSnapshot();

  assert(captured !== null, "6a: snapshot broadcast");
  assert(captured.boss !== null, "6b: snapshot contains boss payload");
  assertEqual(captured.boss.hp, 2500, "6c: snapshot contains boss.hp=2500");
  assertEqual(captured.boss.maxHp, 2500, "6d: snapshot contains boss.maxHp=2500");
  assert(Array.isArray(captured.bossProjectiles), "6e: snapshot contains bossProjectiles");
  assert(Array.isArray(captured.bossVapors), "6f: snapshot contains bossVapors");
  assert(Array.isArray(captured.playerFireballs), "6g: snapshot contains playerFireballs");
}

{
  const guest = makeGuestGame();
  guest.mpState = {
    players: new Map(), enemies: new Map(), projectiles: [], mines: [],
    pickups: [], teamScore: 200, processedEvents: new Set(), seq: 0,
    boss: null, bossProjectiles: [], bossVapors: [], playerFireballs: []
  };

  guest.mpApplySnapshot({
    seq: 15,
    players: [], enemies: [], projectiles: [], mines: [],
    boss: { id: "demon_boss_1", x: 400, y: 300, hp: 1750, maxHp: 2500, isAlive: true },
    bossProjectiles: [{ id: "bfb_1", type: "FIREBALL", x: 300, y: 250 }],
    bossVapors: [{ id: "bv_1", type: "PINK_BURST", x: 200, y: 200, radius: 75 }],
    playerFireballs: [{ id: "pfb_1", x: 380, y: 290 }]
  });

  assert(guest.mpState.boss !== null, "6h: guest mirrors Demon Boss from snapshot");
  assertEqual(guest.mpState.boss.hp, 1750, "6i: guest mirrors accurate boss HP (1750)");
  assertEqual(guest.mpState.bossProjectiles.length, 1, "6j: guest mirrors boss projectiles");
  assertEqual(guest.mpState.bossVapors.length, 1, "6k: guest mirrors boss vapors");
  assertEqual(guest.mpState.playerFireballs.length, 1, "6l: guest mirrors player fireballs");
}

// ── SUITE 7: Solo Mode Isolation ──────────────────────────────────────────────
console.log("\n── Suite 7: Solo Mode Isolation ─────────────────────────────────");

{
  const solo = createGameInstance();
  solo.startMatch("SOLO");
  assertEqual(solo.mode, "SOLO", "7a: Solo mode remains active");
  assertEqual(solo.mpState, null, "7b: mpState is strictly null in Solo mode");
  assertEqual(solo.p1.lives, 3, "7c: Solo player has 3 lives");

  // Verify Demon Boss rendering does not run in Solo
  let drewCleanly = true;
  try {
    solo.gameTime = 1.0;
    solo.draw();
  } catch(e) {
    drewCleanly = false;
  }
  assert(drewCleanly, "7d: Solo mode draw() renders cleanly without errors");
}

// ── Results ───────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(60)}`);
console.log("Milestone 5C — Demon Boss & Fireball Gun");
console.log(`  PASSED: ${passed}`);
console.log(`  FAILED: ${failed}`);
console.log(`  TOTAL:  ${passed + failed}`);
console.log(`${"─".repeat(60)}`);

if (failed > 0) {
  console.error("\n⚠️  Some tests failed.");
  process.exit(1);
} else {
  console.log("\n✅  All Phase 5C tests passed.");
  process.exit(0);
}
