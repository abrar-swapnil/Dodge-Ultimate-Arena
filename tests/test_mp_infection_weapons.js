/**
 * test_mp_infection_weapons.js — Milestone 6B
 * Automated test suite for Infection Mode Weapon System:
 * 1. Weapon roster specs (Zombie Killer, Cosmic Bomb, Raybluster).
 * 2. Pickup rules: 1 weapon per player, no switching, unarmed if no pickup.
 * 3. Concurrent & duplicate pickup prevention (atomic host authority).
 * 4. Firing, ammo consumption & unlimited ammo handling.
 * 5. Host-authoritative damage validation against both bosses.
 * 6. Multiplayer network synchronization (events & snapshots).
 * 7. Solo & Elite Mode isolation.
 */

"use strict";

const fs   = require("fs");
const path = require("path");

console.log("=================================================");
console.log("   MILESTONE 6B: INFECTION WEAPONS TESTS        ");
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

let INFECTION_CONFIG;
let INFECTION_WEAPONS;

function createGameInstance() {
  const instrumented = gameSource.replace(
    "const game = new DodgeArenaGame(canvas);",
    "global.INFECTION_CONFIG = INFECTION_CONFIG; global.INFECTION_WEAPONS = INFECTION_WEAPONS; const game = global.exportedGame = new DodgeArenaGame(canvas);"
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
  g._sendReliableToHost = (msg) => { g.lastSentReliableMsg = msg; };
  g.mpConnections = new Map();
  g.floatingTexts = g.floatingTexts || [];
  return g;
}

// ── Suite 1: Weapon Roster & Stats Validation ────────────────────
console.log("\n── Suite 1: Weapon Roster & Stats Validation ────────────────────");
{
  createGameInstance();
  assert(!!INFECTION_WEAPONS, "1a: INFECTION_WEAPONS constant exported");
  
  // Zombie Killer
  const zk = INFECTION_WEAPONS.ZOMBIE_KILLER;
  assertEqual(zk.ammo, 150, "1b: Zombie Killer has exactly 150 ammo");
  assertEqual(zk.maxAmmo, 150, "1c: Zombie Killer maxAmmo is 150");
  assertEqual(zk.infectedBossDamage, 100, "1d: Zombie Killer deals 100 dmg to Infected Boss");
  assertEqual(zk.cosmicBossDamage, 50, "1e: Zombie Killer deals 50 dmg to Cosmic Boss");

  // Cosmic Bomb
  const cb = INFECTION_WEAPONS.COSMIC_BOMB;
  assertEqual(cb.ammo, 150, "1f: Cosmic Bomb has exactly 150 ammo");
  assertEqual(cb.maxAmmo, 150, "1g: Cosmic Bomb maxAmmo is 150");
  assertEqual(cb.infectedBossDamage, 50, "1h: Cosmic Bomb deals 50 dmg to Infected Boss");
  assertEqual(cb.cosmicBossDamage, 100, "1i: Cosmic Bomb deals 100 dmg to Cosmic Boss");

  // Raybluster
  const rb = INFECTION_WEAPONS.RAYBLUSTER;
  assertEqual(rb.ammo, Infinity, "1j: Raybluster has unlimited ammo (Infinity)");
  assertEqual(rb.infectedBossDamage, 500, "1k: Raybluster deals 500 dmg to Infected Boss");
  assertEqual(rb.cosmicBossDamage, 500, "1l: Raybluster deals 500 dmg to Cosmic Boss");

  // Provisional configuration labels
  assert(INFECTION_CONFIG.rayblusterRarity !== undefined, "1m: Raybluster rarity is explicitly configurable");
  assert(Array.isArray(INFECTION_CONFIG.weaponSpawnPositions), "1n: Weapon spawn positions are configurable");
}

// ── Suite 2: Weapon Pickup Mechanics & Single Weapon Restriction ─
console.log("\n── Suite 2: Weapon Pickup Mechanics & Single Weapon Restriction ─");
{
  const host = makeHostGame();
  host.initMPMatch("INFECTION");

  assert(Array.isArray(host.mpState.weaponPickups), "2a: Host initialized weaponPickups array");
  assert(host.mpState.weaponPickups.length > 0, "2b: Initial weapon pickups spawned at match start");

  // Manually place a Zombie Killer pickup
  host.mpState.weaponPickups = [
    { id: "wpk_test_zk", type: "ZOMBIE_KILLER", x: 200, y: 200, radius: 18 },
    { id: "wpk_test_cb", type: "COSMIC_BOMB", x: 400, y: 200, radius: 18 }
  ];

  const p1 = host.mpState.players.get("host-peer");
  assertEqual(p1.infectionWeapon, null, "2c: Player starts unarmed (infectionWeapon is null)");

  // Collect Zombie Killer
  const pickupRes = host.mpCollectWeaponPickup("host-peer", "wpk_test_zk");
  assertEqual(pickupRes, true, "2d: Host approved first weapon pickup");
  assert(!!p1.infectionWeapon, "2e: Player now has an equipped weapon");
  assertEqual(p1.infectionWeapon.type, "ZOMBIE_KILLER", "2f: Player equipped Zombie Killer");
  assertEqual(p1.infectionWeapon.ammo, 150, "2g: Equipped weapon has 150 ammo");

  // Pickup should be removed from arena
  assertEqual(host.mpState.weaponPickups.some(p => p.id === "wpk_test_zk"), false, "2h: Collected pickup removed from arena");

  // Rule: 1 weapon per player; no switching after pickup!
  const switchRes = host.mpCollectWeaponPickup("host-peer", "wpk_test_cb");
  assertEqual(switchRes, false, "2i: Player already carrying a weapon CANNOT pick up another weapon (no switching)");
  assertEqual(p1.infectionWeapon.type, "ZOMBIE_KILLER", "2j: Player weapon remains Zombie Killer");
  assertEqual(host.mpState.weaponPickups.some(p => p.id === "wpk_test_cb"), true, "2k: Second pickup remained in arena");
}

// ── Suite 3: Concurrent & Duplicate Pickup Prevention ────────────
console.log("\n── Suite 3: Concurrent & Duplicate Pickup Prevention ────────────");
{
  const host = makeHostGame();
  host.initMPMatch("INFECTION");

  host.mpState.weaponPickups = [
    { id: "wpk_shared", type: "RAYBLUSTER", x: 300, y: 300, radius: 18 }
  ];

  // Two players attempt to collect the exact same pickup
  const resP1 = host.mpCollectWeaponPickup("host-peer", "wpk_shared", "evt_fixed_col_1");
  const resP2 = host.mpCollectWeaponPickup("guest-peer", "wpk_shared", "evt_fixed_col_2");

  assertEqual(resP1, true, "3a: First player successfully claims the weapon pickup");
  assertEqual(resP2, false, "3b: Second player rejected; cannot double-claim same pickup");

  // Duplicate event ID check
  const dupEventRes = host.mpCollectWeaponPickup("guest-peer", "wpk_nonexistent", "evt_fixed_col_1");
  assertEqual(dupEventRes, false, "3c: Duplicate pickup event ID rejected by host");

  // Guest handling of pickup event
  const guest = makeGuestGame();
  guest.initMPMatch("INFECTION");
  guest.mpState.weaponPickups = [
    { id: "wpk_guest_test", type: "COSMIC_BOMB", x: 100, y: 100 }
  ];

  guest.handleMPWeaponPickup({
    type: "MP_WEAPON_PICKUP",
    eventId: "guest_wpk_evt_1",
    playerId: "guest-peer",
    weaponType: "COSMIC_BOMB",
    pickupId: "wpk_guest_test"
  });

  const guestP = guest.mpState.players.get("guest-peer");
  assertEqual(guestP.infectionWeapon?.type, "COSMIC_BOMB", "3d: Guest equipped Cosmic Bomb from host message");
  assertEqual(guest.mpState.weaponPickups.length, 0, "3e: Guest removed pickup from arena");
  assert(guest.mpState.processedEvents.has("guest_wpk_evt_1"), "3f: Guest recorded pickup event in processedEvents");

  // Re-sending duplicate event on guest
  const floatingCount = guest.floatingTexts.length;
  guest.handleMPWeaponPickup({
    type: "MP_WEAPON_PICKUP",
    eventId: "guest_wpk_evt_1",
    playerId: "guest-peer",
    weaponType: "COSMIC_BOMB",
    pickupId: "wpk_guest_test"
  });
  assertEqual(guest.floatingTexts.length, floatingCount, "3g: Guest ignored duplicate weapon pickup event");
}

// ── Suite 4: Firing & Ammo Consumption ───────────────────────────
console.log("\n── Suite 4: Firing & Ammo Consumption ───────────────────────────");
{
  const host = makeHostGame();
  host.initMPMatch("INFECTION");

  const pHost = host.mpState.players.get("host-peer");
  const pGuest = host.mpState.players.get("guest-peer");

  // Test 4.1: Zombie Killer firing and ammo decrement
  pHost.infectionWeapon = {
    type: "ZOMBIE_KILLER",
    name: "Zombie Killer",
    ammo: 150,
    maxAmmo: 150,
    infectedBossDamage: 100,
    cosmicBossDamage: 50,
    cooldown: 0
  };

  const shootRes1 = host.mpHandleInfectionShoot("host-peer", "ZOMBIE_KILLER", 100, 100, 1, 0);
  assertEqual(shootRes1, true, "4a: Zombie Killer shot successfully");
  assertEqual(pHost.infectionWeapon.ammo, 149, "4b: Ammo decremented by 1 (150 -> 149)");
  assertEqual(host.mpState.infectionProjectiles.length, 1, "4c: Infection projectile spawned in arena");

  // Deplete ammo to 0
  pHost.infectionWeapon.ammo = 0;
  const shootEmpty = host.mpHandleInfectionShoot("host-peer", "ZOMBIE_KILLER", 100, 100, 1, 0);
  assertEqual(shootEmpty, false, "4d: Cannot shoot when ammo is 0");

  // Test 4.2: Cosmic Bomb firing
  pGuest.infectionWeapon = {
    type: "COSMIC_BOMB",
    name: "Cosmic Bomb",
    ammo: 150,
    maxAmmo: 150,
    infectedBossDamage: 50,
    cosmicBossDamage: 100,
    cooldown: 0
  };

  const shootCB = host.mpHandleInfectionShoot("guest-peer", "COSMIC_BOMB", 200, 200, 0, 1);
  assertEqual(shootCB, true, "4e: Cosmic Bomb shot successfully");
  assertEqual(pGuest.infectionWeapon.ammo, 149, "4f: Cosmic Bomb ammo decremented to 149");

  // Test 4.3: Raybluster unlimited ammo
  pHost.infectionWeapon = {
    type: "RAYBLUSTER",
    name: "Raybluster",
    ammo: Infinity,
    maxAmmo: Infinity,
    infectedBossDamage: 500,
    cosmicBossDamage: 500,
    cooldown: 0
  };

  host.mpHandleInfectionShoot("host-peer", "RAYBLUSTER", 100, 100, 1, 0);
  assertEqual(pHost.infectionWeapon.ammo, Infinity, "4g: Raybluster retains unlimited ammo (Infinity) after firing");

  // Test 4.4: Unarmed player cannot shoot
  pGuest.infectionWeapon = null;
  const shootUnarmed = host.mpHandleInfectionShoot("guest-peer", "ZOMBIE_KILLER", 200, 200, 1, 0);
  assertEqual(shootUnarmed, false, "4h: Unarmed player cannot shoot");

  // Test 4.5: Spectator / eliminated player cannot shoot
  pHost.isAlive = false;
  pHost.isSpectator = true;
  const shootDead = host.mpHandleInfectionShoot("host-peer", "RAYBLUSTER", 100, 100, 1, 0);
  assertEqual(shootDead, false, "4i: Eliminated player cannot shoot");
}

// ── Suite 5: Host-Authoritative Damage Validation ────────────────
console.log("\n── Suite 5: Host-Authoritative Damage Validation ────────────────");
{
  const host = makeHostGame();
  host.initMPMatch("INFECTION");

  const p = host.mpState.players.get("host-peer");

  // Equip Zombie Killer
  p.infectionWeapon = {
    type: "ZOMBIE_KILLER",
    ammo: 100,
    infectedBossDamage: 100,
    cosmicBossDamage: 50
  };

  // Zombie Killer -> Infected Boss: 100 dmg
  const dmgZK_IB = host.mpApplyWeaponDamage("INFECTED_BOSS", "boss_1", "host-peer", "ZOMBIE_KILLER");
  assertEqual(dmgZK_IB?.damage, 100, "5a: Zombie Killer deals exactly 100 damage to Infected Boss");

  // Zombie Killer -> Cosmic Boss: 50 dmg
  const dmgZK_CB = host.mpApplyWeaponDamage("COSMIC_BOSS", "boss_2", "host-peer", "ZOMBIE_KILLER");
  assertEqual(dmgZK_CB?.damage, 50, "5b: Zombie Killer deals exactly 50 damage to Cosmic Boss");

  // Equip Cosmic Bomb
  p.infectionWeapon = {
    type: "COSMIC_BOMB",
    ammo: 100,
    infectedBossDamage: 50,
    cosmicBossDamage: 100
  };

  // Cosmic Bomb -> Infected Boss: 50 dmg
  const dmgCB_IB = host.mpApplyWeaponDamage("INFECTED_BOSS", "boss_1", "host-peer", "COSMIC_BOMB");
  assertEqual(dmgCB_IB?.damage, 50, "5c: Cosmic Bomb deals exactly 50 damage to Infected Boss");

  // Cosmic Bomb -> Cosmic Boss: 100 dmg
  const dmgCB_CB = host.mpApplyWeaponDamage("COSMIC_BOSS", "boss_2", "host-peer", "COSMIC_BOMB");
  assertEqual(dmgCB_CB?.damage, 100, "5d: Cosmic Bomb deals exactly 100 damage to Cosmic Boss");

  // Equip Raybluster
  p.infectionWeapon = {
    type: "RAYBLUSTER",
    ammo: Infinity,
    infectedBossDamage: 500,
    cosmicBossDamage: 500
  };

  // Raybluster -> Infected Boss: 500 dmg
  const dmgRB_IB = host.mpApplyWeaponDamage("INFECTED_BOSS", "boss_1", "host-peer", "RAYBLUSTER");
  assertEqual(dmgRB_IB?.damage, 500, "5e: Raybluster deals exactly 500 damage to Infected Boss");

  // Raybluster -> Cosmic Boss: 500 dmg
  const dmgRB_CB = host.mpApplyWeaponDamage("COSMIC_BOSS", "boss_2", "host-peer", "RAYBLUSTER");
  assertEqual(dmgRB_CB?.damage, 500, "5f: Raybluster deals exactly 500 damage to Cosmic Boss");

  // Invalid actions validation
  // 1. Shooter unarmed
  p.infectionWeapon = null;
  const dmgNoWeapon = host.mpApplyWeaponDamage("INFECTED_BOSS", "boss_1", "host-peer", "ZOMBIE_KILLER");
  assertEqual(dmgNoWeapon, null, "5g: Damage rejected if shooter is unarmed");

  // 2. Shooter weapon mismatch
  p.infectionWeapon = { type: "COSMIC_BOMB", ammo: 50 };
  const dmgMismatch = host.mpApplyWeaponDamage("INFECTED_BOSS", "boss_1", "host-peer", "ZOMBIE_KILLER");
  assertEqual(dmgMismatch, null, "5h: Damage rejected if weapon type does not match equipped weapon");

  // 3. Invalid target type (e.g. teammate or normal enemy)
  const dmgInvalidTarget = host.mpApplyWeaponDamage("PLAYER", "guest-peer", "host-peer", "COSMIC_BOMB");
  assertEqual(dmgInvalidTarget, null, "5i: Friendly fire damage rejected (only boss targets valid per GDD)");

  // 4. Duplicate event ID
  p.infectionWeapon = { type: "RAYBLUSTER", ammo: Infinity };
  const dmg1 = host.mpApplyWeaponDamage("INFECTED_BOSS", "boss_1", "host-peer", "RAYBLUSTER", "fixed_dmg_evt_1");
  const dmg2 = host.mpApplyWeaponDamage("INFECTED_BOSS", "boss_1", "host-peer", "RAYBLUSTER", "fixed_dmg_evt_1");
  assert(dmg1 !== null, "5j: First damage event succeeded");
  assertEqual(dmg2, null, "5k: Duplicate damage event ID rejected by host dedup");
}

// ── Suite 6: Multiplayer Network Synchronization ─────────────────
console.log("\n── Suite 6: Multiplayer Network Synchronization ─────────────────");
{
  const host = makeHostGame();
  host.initMPMatch("INFECTION");

  // Setup host player with Zombie Killer and guest player with Cosmic Bomb
  const p1 = host.mpState.players.get("host-peer");
  const p2 = host.mpState.players.get("guest-peer");
  p1.infectionWeapon = { type: "ZOMBIE_KILLER", ammo: 145 };
  p2.infectionWeapon = { type: "COSMIC_BOMB", ammo: 120 };

  host.mpState.weaponPickups = [
    { id: "wpk_synced", type: "RAYBLUSTER", x: 350, y: 350 }
  ];
  host.mpState.infectionProjectiles = [
    { id: "pip_1", weaponType: "ZOMBIE_KILLER", x: 150, y: 150, color: "#ff0055" }
  ];

  // Broadcast snapshot
  host.mpBroadcastSnapshot();
  const snap = host.lastSentUnreliableMsg;

  assert(!!snap, "6a: Host generated snapshot");
  const snapP1 = snap.players.find(p => p.id === "host-peer");
  const snapP2 = snap.players.find(p => p.id === "guest-peer");
  assertEqual(snapP1?.infectionWeapon?.type, "ZOMBIE_KILLER", "6b: Snapshot contains P1 Zombie Killer");
  assertEqual(snapP1?.infectionWeapon?.ammo, 145, "6c: Snapshot contains P1 ammo: 145");
  assertEqual(snapP2?.infectionWeapon?.type, "COSMIC_BOMB", "6d: Snapshot contains P2 Cosmic Bomb");
  assertEqual(snapP2?.infectionWeapon?.ammo, 120, "6e: Snapshot contains P2 ammo: 120");
  assertEqual(snap.weaponPickups?.length, 1, "6f: Snapshot contains weaponPickups array");
  assertEqual(snap.infectionProjectiles?.length, 1, "6g: Snapshot contains infectionProjectiles array");

  // Guest applies snapshot
  const guest = makeGuestGame();
  guest.initMPMatch("INFECTION");
  guest.mpApplySnapshot(snap);

  const guestSyncedP1 = guest.mpState.players.get("host-peer");
  const guestSyncedP2 = guest.mpState.players.get("guest-peer");
  assertEqual(guestSyncedP1?.infectionWeapon?.type, "ZOMBIE_KILLER", "6h: Guest synced P1 weapon type");
  assertEqual(guestSyncedP1?.infectionWeapon?.ammo, 145, "6i: Guest synced P1 ammo");
  assertEqual(guestSyncedP2?.infectionWeapon?.type, "COSMIC_BOMB", "6j: Guest synced P2 weapon type");
  assertEqual(guestSyncedP2?.infectionWeapon?.ammo, 120, "6k: Guest synced P2 ammo");
  assertEqual(guest.mpState.weaponPickups.length, 1, "6l: Guest synced weapon pickups");

  // Guest shoot message routed to host via _handleLobbyMessage
  const hostShootCalled = [];
  host.mpHandleInfectionShoot = (shooterId, weaponType, x, y, fx, fy) => {
    hostShootCalled.push({ shooterId, weaponType, x, y, fx, fy });
  };

  host._handleLobbyMessage({
    type: "MP_INFECTION_SHOOT",
    shooterId: "guest-peer",
    weaponType: "COSMIC_BOMB",
    x: 200,
    y: 200,
    fx: 1,
    fy: 0
  }, "guest-peer");

  assertEqual(hostShootCalled.length, 1, "6m: Host received and handled MP_INFECTION_SHOOT from guest");
  assertEqual(hostShootCalled[0].shooterId, "guest-peer", "6n: Shooter authenticated as guest-peer");
}

// ── Suite 7: Solo & Elite Mode Complete Isolation ────────────────
console.log("\n── Suite 7: Solo & Elite Mode Complete Isolation ────────────────");
{
  // 7.1 Solo Mode Isolation
  const solo = createGameInstance();
  assertEqual(solo.mode, "SOLO", "7a: Solo mode default mode is SOLO");
  assertEqual(solo.mpState, null, "7b: mpState is strictly null in Solo Mode");
  assertEqual(solo.p1.lives, 3, "7c: Solo player has 3 lives (unaffected by MP weapons)");

  let soloDrawClean = false;
  try {
    solo.draw();
    soloDrawClean = true;
  } catch (e) {
    console.error(e);
  }
  assert(soloDrawClean, "7d: Solo mode draw() runs cleanly without errors");

  // 7.2 Elite Mode Isolation
  const eliteHost = makeHostGame();
  eliteHost.initMPMatch("ELITE");
  assertEqual(eliteHost.mpState.mode, "ELITE", "7e: Elite mode active");
  assertEqual(eliteHost.mpState.weaponPickups.length, 0, "7f: Infection weapon pickups are NOT spawned in Elite Mode");

  const eliteP = eliteHost.mpState.players.get("host-peer");
  assertEqual(eliteP.infectionWeapon, null, "7g: Elite player has no infectionWeapon");

  // 7.3 Infection Mode Draw
  const infHost = makeHostGame();
  infHost.initMPMatch("INFECTION");
  let infDrawClean = false;
  try {
    infHost.draw();
    infDrawClean = true;
  } catch (e) {
    console.error(e);
  }
  assert(infDrawClean, "7h: Infection Mode Quarantine Lab with weapons draw() runs cleanly");
}

// ── Summary ──────────────────────────────────────────────────────
console.log("\n────────────────────────────────────────────────────────────");
console.log(`Milestone 6B — Infection Weapon System`);
console.log(`  PASSED: ${passed}`);
console.log(`  FAILED: ${failed}`);
console.log(`  TOTAL:  ${passed + failed}`);
console.log("────────────────────────────────────────────────────────────\n");

if (failed > 0) {
  console.error("❌ Some tests failed.");
  process.exit(1);
} else {
  console.log("✅  All Phase 6B tests passed.");
  process.exit(0);
}
