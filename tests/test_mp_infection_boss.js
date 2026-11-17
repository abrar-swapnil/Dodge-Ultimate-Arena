/**
 * test_mp_infection_boss.js — Milestone 6C
 * Comprehensive automated test suite for Infection Mode Boss & Match Resolution:
 * 1. Branch logic & timer triggers (60s survival of normal player -> Infected Boss; all-infected <60s -> Cosmic Boss).
 * 2. Mutual exclusion & host-authoritative branch decisions.
 * 3. Infected Boss: 2500 HP, World Cutting Slash (50 dmg + 3s warning + severance),
 *    Possessed Minions (spawns 3 every 10s, replaces previous set),
 *    Targeted Jump (3s warning telegraph + AoE landing damage).
 * 4. Cosmic Boss: 2500 HP, Falling Sun (projectile + instant-kill crater),
 *    Black Hole (pull + 15s freeze + safe return),
 *    White Hole (repel outside + 15s freeze + safe return).
 * 5. Boss-fight Heart pickups (spawn only during boss fight, restore exactly +10 HP, capped at 100).
 * 6. Weapon damage scaling & boss hitbox collision (ZK 100/50, CB 50/100, RB 500/500, damageDealt leaderboard tracking).
 * 7. Match resolution: Victory on boss defeat, Defeat on team wipeout, Squad ranking leaderboard UI.
 * 8. Network snapshot synchronization.
 * 9. Solo & Elite Mode complete isolation.
 */

"use strict";

const fs   = require("fs");
const path = require("path");

console.log("=================================================");
console.log("   MILESTONE 6C: INFECTION BOSS & RESOLUTION     ");
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
    ["guest-peer", { name: "Guest", shape: "circle", isHost: false }]
  ]);
  g.lobbyMode = "INFECTION";
  g.initMPMatch();
  return g;
}

function makeGuestGame() {
  const g = createGameInstance();
  g.isHost = false;
  g.mode = "CUSTOM_ROOM";
  g.peer = { id: "guest-peer" };
  return g;
}

// ─────────────────────────────────────────────────────────────────
// Suite 1: Branch Logic, 60s Survival & Early All-Infected Triggers
// ─────────────────────────────────────────────────────────────────
console.log("\n── Suite 1: Branch Logic & Mutual Exclusion ─────────────────────");
{
  const g1 = makeHostGame();
  const st1 = g1.mpState;

  assertEqual(st1.bossBranch, null, "1a: Initially bossBranch is null");
  assertEqual(st1.infectionTimer, 0, "1b: Initial infectionTimer is 0");

  // Keep P1 normal, simulate time up to 60.1s
  const p1 = st1.players.get("host-peer");
  const p2 = st1.players.get("guest-peer");
  p1.isInfected = false;
  p2.isInfected = true; // P2 is infected, but P1 is normal survivor
  st1.enemies.clear();  // Clear enemies so they don't accidentally touch P1 during test step

  g1.mpUpdateInfection(60.1);

  assertEqual(st1.bossBranch, "INFECTED_BOSS", "1c: 60s survival of normal player triggers INFECTED_BOSS");
  assert(st1.boss !== null && st1.boss.type === "INFECTED_BOSS", "1d: Infected Boss entity spawned");
  assertEqual(st1.boss.hp, 2500, "1e: Infected Boss has exactly 2500 HP");
  assertEqual(st1.boss.maxHp, 2500, "1f: Infected Boss maxHp is 2500");

  // Test Mutual Exclusion: once branch is set, simulating more time cannot switch branch
  g1.mpUpdateInfection(10.0);
  assertEqual(st1.bossBranch, "INFECTED_BOSS", "1g: Mutual exclusion: branch cannot change once set");

  // Test Branch 2: Early all-infected (< 60s)
  const g2 = makeHostGame();
  const st2 = g2.mpState;
  const pA = st2.players.get("host-peer");
  const pB = st2.players.get("guest-peer");
  pA.isInfected = true;
  pB.isInfected = true; // All active players infected before 60s

  g2.mpUpdateInfection(15.0); // 15s < 60s

  assertEqual(st2.bossBranch, "COSMIC_BOSS", "1h: All active players infected before 60s triggers COSMIC_BOSS");
  assert(st2.boss !== null && st2.boss.type === "COSMIC_BOSS", "1i: Cosmic Boss entity spawned");
  assertEqual(st2.boss.hp, 2500, "1j: Cosmic Boss has exactly 2500 HP");
}

// ─────────────────────────────────────────────────────────────────
// Suite 2: Infected Boss Normalization & Weapon Pickup Cease
// ─────────────────────────────────────────────────────────────────
console.log("\n── Suite 2: Normalization & Pickup Removal on Boss Spawn ────────");
{
  const g = makeHostGame();
  const st = g.mpState;
  const p1 = st.players.get("host-peer");
  const p2 = st.players.get("guest-peer");
  p1.isInfected = false;
  p2.isInfected = true; // P2 starts infected
  assertEqual(p2.isInfected, true, "2a: P2 infected prior to boss branch");

  st.weaponPickups = [{ id: 1, type: "ZOMBIE_KILLER", x: 200, y: 200 }];
  assert(st.weaponPickups.length > 0, "2b: Pickups exist prior to boss spawn");

  g.mpTriggerBossBranch("INFECTED_BOSS");

  assertEqual(p1.isInfected, false, "2c: Normal player remains normal");
  assertEqual(p2.isInfected, false, "2d: GDD exact: Infected player normalized to false");
  assertEqual(p2.infectionState, "NORMAL", "2e: P2 infectionState reset to NORMAL");
  assertEqual(st.weaponPickups.length, 0, "2f: Weapon pickups removed from arena when boss arrives");
}

// ─────────────────────────────────────────────────────────────────
// Suite 3: Infected Boss Abilities (Slash, Minions, Jump)
// ─────────────────────────────────────────────────────────────────
console.log("\n── Suite 3: Infected Boss Abilities ─────────────────────────────");
{
  const g = makeHostGame();
  g.mpTriggerBossBranch("INFECTED_BOSS");
  const st = g.mpState;
  const boss = st.boss;

  // 1. World Cutting Slash
  st.infectionHazards.slashes = [];
  boss.slashTimer = 0.05;
  g.mpUpdateInfection(0.1); // Triggers slash warning

  assert(st.infectionHazards.slashes.length > 0, "3a: World Cutting Slash hazard created");
  const sl = st.infectionHazards.slashes[0];
  assertEqual(sl.state, "WARNING", "3b: Slash begins in 3s WARNING state");
  assertEqual(sl.damage, 50, "3c: Direct hit slash damage is 50 HP per GDD");

  // Advance 3s warning telegraph
  const targetP = st.players.get("host-peer");
  targetP.x = (sl.x1 + sl.x2) / 2;
  targetP.y = (sl.y1 + sl.y2) / 2;
  targetP.hp = 100;

  g.mpUpdateInfection(3.1);

  assertEqual(sl.state, "SEVERED", "3d: Slash transitioned to SEVERED state after warning");
  assertEqual(targetP.hp, 50, "3e: Player took 50 direct damage from World Cutting Slash (100 -> 50)");

  // 2. Possessed Minions Wave Replacement
  st.enemies.clear();
  // Spawn dummy previous wave
  st.enemies.set("old_1", { id: "old_1", isPossessedMinion: true, hp: 50 });
  st.enemies.set("old_2", { id: "old_2", isPossessedMinion: true, hp: 50 });
  assertEqual(st.enemies.size, 2, "3f: Previous possessed minions exist");

  boss.minionTimer = 0.05;
  g.mpUpdateInfection(0.1);

  assert(!st.enemies.has("old_1"), "3g: GDD exact: Previous summoned minion set removed");
  assert(!st.enemies.has("old_2"), "3h: Previous summoned minion set removed");
  assertEqual(st.enemies.size, 3, "3i: Exactly 3 new possessed minions spawned");
  for (const e of st.enemies.values()) {
    assert(e.isPossessedMinion, "3j: Enemy is marked as possessed minion");
    assert(e.isInfected, "3k: Possessed minion is infected");
  }

  // 3. Targeted Jump (3s Warning + AoE landing)
  boss.jumpTimer = 0.05;
  boss.isJumping = false;
  g.mpUpdateInfection(0.1);

  assert(st.infectionHazards.jumpTelegraph !== null, "3l: Targeted Jump 3s warning circle telegraph created");
  assertEqual(boss.isJumping, true, "3m: Boss is in jumping state");

  // Place player in jump radius
  const pJump = st.players.get("host-peer");
  pJump.x = st.infectionHazards.jumpTelegraph.x;
  pJump.y = st.infectionHazards.jumpTelegraph.y;
  pJump.hp = 50;

  g.mpUpdateInfection(3.1);

  assertEqual(boss.isJumping, false, "3n: Boss landed after 3s warning");
  assertEqual(st.infectionHazards.jumpTelegraph, null, "3o: Jump telegraph cleared");
  assert(pJump.hp < 50, "3p: Player took jump impact AoE damage");
}

// ─────────────────────────────────────────────────────────────────
// Suite 4: Cosmic Boss Abilities (Falling Sun, Black Hole, White Hole)
// ─────────────────────────────────────────────────────────────────
console.log("\n── Suite 4: Cosmic Boss Abilities ───────────────────────────────");
{
  const g = makeHostGame();
  g.mpTriggerBossBranch("COSMIC_BOSS");
  const st = g.mpState;
  const boss = st.boss;

  // 1. Falling Sun & Crater Instant Elimination
  st.bossProjectiles = [];
  boss.sunTimer = 0.05;
  g.mpUpdateInfection(0.1);

  assert(st.bossProjectiles.length > 0, "4a: Falling Sun projectile launched");
  const sun = st.bossProjectiles[0];
  assertEqual(sun.type, "FALLING_SUN", "4b: Projectile is FALLING_SUN");

  // Advance projectile impact
  sun.life = 0;
  g.mpUpdateInfection(0.05);

  assert(st.infectionHazards.craters.length > 0, "4c: Falling Sun creates crater on impact");
  const crater = st.infectionHazards.craters[0];

  // Player enters crater -> instant elimination
  const pVictim = st.players.get("host-peer");
  pVictim.x = crater.x - 10;
  pVictim.y = crater.y - 10;
  pVictim.hp = 100;
  pVictim.isAlive = true;

  g.mpUpdateInfection(0.05);

  assertEqual(pVictim.isAlive, false, "4d: GDD exact: Falling into crater instantly eliminates player");
  assertEqual(pVictim.hp, 0, "4e: Eliminated player HP is 0");

  // 2. Black Hole (Pull + 15s freeze + safe return)
  const pFreezeTarget = st.players.get("guest-peer");
  pFreezeTarget.hp = 100;
  pFreezeTarget.isAlive = true;
  pFreezeTarget.isSpectator = false;
  pFreezeTarget.freezeTimer = 0;

  st.infectionHazards.blackHoles = [{
    id: "bh_test",
    x: 400,
    y: 300,
    radius: 70,
    pullForce: 130,
    duration: 8.0
  }];

  // Move player into black hole core
  pFreezeTarget.x = 402;
  pFreezeTarget.y = 302;
  g.mpUpdateInfection(0.05);

  assertEqual(pFreezeTarget.freezeType, "BLACK_HOLE", "4f: Player frozen by Black Hole");
  assertEqual(pFreezeTarget.freezeTimer, 15.0, "4g: GDD exact: Frozen for exactly 15 seconds");

  // Frozen player cannot move
  g.p1Input = { x: 1, y: 0 };
  pFreezeTarget.input = { x: 1, y: 0, sprint: false };
  g.update(0.1);
  assertEqual(pFreezeTarget.vx, 0, "4h: Frozen player movement locked (vx is 0)");

  // 3. Safe Return when 15s expires
  pFreezeTarget.freezeTimer = 0.05;
  g.mpUpdateEnemyAI(0.1); // Updates status effects

  assertEqual(pFreezeTarget.freezeType, null, "4i: Freeze cleared when 15s timer expires");
  assert(pFreezeTarget.x >= 50 && pFreezeTarget.x <= 750, "4j: Player returned safely within arena bounds");

  // 4. White Hole (Repel + 15s freeze)
  st.infectionHazards.blackHoles = []; // Clear black holes so they don't overlap
  st.infectionHazards.whiteHoles = [{
    id: "wh_test",
    x: 400,
    y: 300,
    radius: 75,
    repelForce: 300,
    duration: 6.0
  }];

  pFreezeTarget.x = 405;
  pFreezeTarget.y = 305;
  pFreezeTarget.freezeTimer = 0;
  pFreezeTarget.freezeType = null;
  g.mpUpdateInfection(0.05);

  assertEqual(pFreezeTarget.freezeType, "WHITE_HOLE", "4k: Player frozen by White Hole");
  assertEqual(pFreezeTarget.freezeTimer, 15.0, "4l: GDD exact: White Hole freezes for 15 seconds");
}

// ─────────────────────────────────────────────────────────────────
// Suite 5: Boss-Fight Heart Pickups (+10 HP, Capped at 100)
// ─────────────────────────────────────────────────────────────────
console.log("\n── Suite 5: Boss-Fight Heart Pickups ────────────────────────────");
{
  const g = makeHostGame();
  const st = g.mpState;

  // Before boss fight, hearts do not spawn
  st.heartTimer = 10.0;
  st.pickups = [];
  g.mpUpdateInfection(0.1);
  assertEqual(st.pickups.length, 0, "5a: Hearts do NOT spawn before boss appears");

  // Boss appears
  g.mpTriggerBossBranch("INFECTED_BOSS");
  st.heartTimer = 10.0; // Trigger heart spawn
  g.mpUpdateInfection(0.1);

  assert(st.pickups.length > 0, "5b: Hearts spawn during boss fight");
  const heart = st.pickups[0];
  assertEqual(heart.type, "HEART", "5c: Pickup type is HEART");

  // Player collects heart
  const pHeal = st.players.get("host-peer");
  pHeal.hp = 85;
  pHeal.maxHp = 100;
  pHeal.x = heart.x;
  pHeal.y = heart.y;

  g.mpUpdateInfection(0.05);

  assertEqual(pHeal.hp, 95, "5d: GDD exact: Heart restores exactly +10 HP (85 -> 95)");
  assertEqual(st.pickups.length, 0, "5e: Collected heart removed from arena");

  // Test capping at 100 HP
  st.pickups.push({ id: "h_test", type: "HEART", x: pHeal.x, y: pHeal.y, radius: 14 });
  pHeal.hp = 98;
  g.mpUpdateInfection(0.05);

  assertEqual(pHeal.hp, 100, "5f: GDD exact: Health restored capped at 100 HP (98 + 10 -> 100)");
}

// ─────────────────────────────────────────────────────────────────
// Suite 6: Weapon Damage Integration & Projectile Collision
// ─────────────────────────────────────────────────────────────────
console.log("\n── Suite 6: Weapon Damage Integration & Boss Collision ───────────");
{
  const g = makeHostGame();
  g.mpTriggerBossBranch("INFECTED_BOSS");
  const st = g.mpState;
  const boss = st.boss;
  const shooter = st.players.get("host-peer");

  // Zombie Killer vs Infected Boss: 100 damage
  shooter.infectionWeapon = {
    type: "ZOMBIE_KILLER",
    name: "Zombie Killer",
    ammo: 150,
    maxAmmo: 150,
    infectedBossDamage: 100,
    cosmicBossDamage: 50,
    cooldown: 0
  };
  shooter.damageDealt = 0;
  boss.hp = 2500;

  // Spawn projectile right at boss hitbox
  st.infectionProjectiles = [{
    id: "test_proj_zk",
    shooterId: shooter.id,
    weaponType: "ZOMBIE_KILLER",
    x: boss.x,
    y: boss.y,
    vx: 0,
    vy: 0,
    radius: 8,
    life: 2.0
  }];

  g.mpUpdateInfection(0.05);

  assertEqual(boss.hp, 2400, "6a: Zombie Killer deals exactly 100 damage to Infected Boss (2500 -> 2400)");
  assertEqual(shooter.damageDealt, 100, "6b: Shooter damageDealt tracked as 100");
  assertEqual(st.infectionProjectiles.length, 0, "6c: Projectile consumed upon hitting boss");

  // Cosmic Bomb vs Infected Boss: 50 damage
  shooter.infectionWeapon = {
    type: "COSMIC_BOMB",
    name: "Cosmic Bomb",
    ammo: 150,
    maxAmmo: 150,
    infectedBossDamage: 50,
    cosmicBossDamage: 100,
    cooldown: 0
  };
  st.infectionProjectiles = [{
    id: "test_proj_cb",
    shooterId: shooter.id,
    weaponType: "COSMIC_BOMB",
    x: boss.x,
    y: boss.y,
    vx: 0,
    vy: 0,
    radius: 8,
    life: 2.0
  }];

  g.mpUpdateInfection(0.05);
  assertEqual(boss.hp, 2350, "6d: Cosmic Bomb deals exactly 50 damage to Infected Boss (2400 -> 2350)");

  // Raybluster vs Infected Boss: 500 damage
  shooter.infectionWeapon = {
    type: "RAYBLUSTER",
    name: "Raybluster",
    ammo: Infinity,
    maxAmmo: Infinity,
    infectedBossDamage: 500,
    cosmicBossDamage: 500,
    cooldown: 0
  };
  st.infectionProjectiles = [{
    id: "test_proj_rb",
    shooterId: shooter.id,
    weaponType: "RAYBLUSTER",
    x: boss.x,
    y: boss.y,
    vx: 0,
    vy: 0,
    radius: 8,
    life: 2.0
  }];

  g.mpUpdateInfection(0.05);
  assertEqual(boss.hp, 1850, "6e: Raybluster deals exactly 500 damage to Infected Boss (2350 -> 1850)");

  // Verify Cosmic Boss Damage Scaling: ZK = 50, CB = 100
  const gCosmic = makeHostGame();
  gCosmic.mpTriggerBossBranch("COSMIC_BOSS");
  const stCosmic = gCosmic.mpState;
  const cBoss = stCosmic.boss;
  const cShooter = stCosmic.players.get("host-peer");

  cShooter.infectionWeapon = {
    type: "ZOMBIE_KILLER",
    ammo: 150,
    infectedBossDamage: 100,
    cosmicBossDamage: 50
  };
  cBoss.hp = 2500;
  gCosmic.mpApplyWeaponDamage(cBoss.type, cBoss.id, cShooter.id, "ZOMBIE_KILLER");
  assertEqual(cBoss.hp, 2450, "6f: Zombie Killer deals exactly 50 damage to Cosmic Boss");

  cShooter.infectionWeapon = {
    type: "COSMIC_BOMB",
    ammo: 150,
    infectedBossDamage: 50,
    cosmicBossDamage: 100
  };
  gCosmic.mpApplyWeaponDamage(cBoss.type, cBoss.id, cShooter.id, "COSMIC_BOMB");
  assertEqual(cBoss.hp, 2350, "6g: Cosmic Bomb deals exactly 100 damage to Cosmic Boss");
}

// ─────────────────────────────────────────────────────────────────
// Suite 7: Match Resolution (Victory & Defeat) & Ranking UI
// ─────────────────────────────────────────────────────────────────
console.log("\n── Suite 7: Match Resolution & Squad Ranking UI ─────────────────");
{
  const g = makeHostGame();
  g.mpTriggerBossBranch("INFECTED_BOSS");
  const st = g.mpState;
  const boss = st.boss;
  const shooter = st.players.get("host-peer");
  shooter.infectionWeapon = {
    type: "RAYBLUSTER",
    ammo: Infinity,
    infectedBossDamage: 500,
    cosmicBossDamage: 500
  };

  // Boss defeated -> VICTORY
  boss.hp = 100;
  g.mpApplyWeaponDamage(boss.type, boss.id, shooter.id, "RAYBLUSTER");

  assertEqual(boss.hp, 0, "7a: Boss HP reduced to 0");
  assertEqual(boss.isAlive, false, "7b: Boss isAlive is false");
  assertEqual(st.status, "VICTORY", "7c: Team Victory status set on mpState");
  assertEqual(g.state, "VICTORY", "7d: Game state set to VICTORY");

  // Defeat check: all players eliminated -> DEFEAT
  const gDefeat = makeHostGame();
  gDefeat.mpTriggerBossBranch("INFECTED_BOSS");
  const stD = gDefeat.mpState;
  const p1 = stD.players.get("host-peer");
  const p2 = stD.players.get("guest-peer");

  gDefeat.mpEliminatePlayer(p1.id, "boss");
  assertEqual(stD.status, "PLAYING", "7e: Match continues while P2 is still alive");

  gDefeat.mpEliminatePlayer(p2.id, "boss");
  assertEqual(stD.status, "DEFEAT", "7f: GDD exact: All players eliminated triggers team DEFEAT");
  assertEqual(gDefeat.state, "MATCH_OVER", "7g: Game state transitions to MATCH_OVER");

  // Leaderboard draw executes cleanly
  let drawOverThrew = false;
  try {
    g.drawMatchOverScreen();
    gDefeat.drawMatchOverScreen();
  } catch(e) {
    drawOverThrew = true;
    console.error(e);
  }
  assert(!drawOverThrew, "7h: Squad ranking leaderboard screen draws without errors");
}

// ─────────────────────────────────────────────────────────────────
// Suite 8: Network Synchronization (Host -> Guest)
// ─────────────────────────────────────────────────────────────────
console.log("\n── Suite 8: Network Synchronization ─────────────────────────────");
{
  const host = makeHostGame();
  host.mpTriggerBossBranch("INFECTED_BOSS");
  const stH = host.mpState;
  stH.boss.hp = 1800;
  stH.infectionTimer = 62.5;

  const p1 = stH.players.get("host-peer");
  p1.freezeTimer = 12.0;
  p1.freezeType = "BLACK_HOLE";
  p1.damageDealt = 700;

  // Broadcast snapshot
  let capturedSnapshot = null;
  host._broadcastUnreliable = (snap) => { capturedSnapshot = snap; };
  host.mpBroadcastSnapshot();

  assert(capturedSnapshot !== null, "8a: Snapshot generated by host");
  assertEqual(capturedSnapshot.bossBranch, "INFECTED_BOSS", "8b: Snapshot contains bossBranch");
  assertEqual(capturedSnapshot.infectionTimer, 62.5, "8c: Snapshot contains infectionTimer");
  assert(capturedSnapshot.boss !== null, "8d: Snapshot contains boss metadata");
  assertEqual(capturedSnapshot.boss.hp, 1800, "8e: Snapshot contains boss hp 1800");

  const snapP1 = capturedSnapshot.players.find(p => p.id === "host-peer");
  assertEqual(snapP1.freezeTimer, 12.0, "8f: Snapshot contains freezeTimer 12.0");
  assertEqual(snapP1.freezeType, "BLACK_HOLE", "8g: Snapshot contains freezeType BLACK_HOLE");
  assertEqual(snapP1.damageDealt, 700, "8h: Snapshot contains damageDealt 700");

  // Guest applies snapshot
  const guest = makeGuestGame();
  guest.handleMPMatchStart({
    matchId: "test_m",
    hostId: "host-peer",
    mode: "INFECTION",
    players: capturedSnapshot.players
  });

  guest.mpApplySnapshot(capturedSnapshot);

  assertEqual(guest.mpState.bossBranch, "INFECTED_BOSS", "8i: Guest synced bossBranch");
  assertEqual(guest.mpState.boss.hp, 1800, "8j: Guest synced boss HP");
  const guestP1 = guest.mpState.players.get("host-peer");
  assertEqual(guestP1.freezeTimer, 12.0, "8k: Guest synced player freezeTimer");
  assertEqual(guestP1.damageDealt, 700, "8l: Guest synced player damageDealt");
}

// ─────────────────────────────────────────────────────────────────
// Suite 9: Solo Mode & Elite Mode Isolation
// ─────────────────────────────────────────────────────────────────
console.log("\n── Suite 9: Solo & Elite Mode Complete Isolation ────────────────");
{
  const solo = createGameInstance();
  assertEqual(solo.mode, "SOLO", "9a: Solo default mode is SOLO");
  assertEqual(solo.mpState, null, "9b: mpState is strictly null in Solo Mode");

  let soloDrawThrew = false;
  try {
    solo.draw();
  } catch(e) {
    soloDrawThrew = true;
    console.error(e);
  }
  assert(!soloDrawThrew, "9c: Solo draw() executes cleanly without Infection Boss errors");

  // Elite Mode check
  const elite = createGameInstance();
  elite.isHost = true;
  elite.mode = "CUSTOM_ROOM";
  elite.lobbyMode = "ELITE";
  elite.initMPMatch();
  assertEqual(elite.mpState.mode, "ELITE", "9d: Elite Mode initialized");
  assertEqual(elite.mpState.bossBranch, null, "9e: Infection bossBranch is null in Elite Mode");

  let eliteDrawThrew = false;
  try {
    elite.draw();
  } catch(e) {
    eliteDrawThrew = true;
    console.error(e);
  }
  assert(!eliteDrawThrew, "9f: Elite mode draw() executes cleanly");
}

// ── Summary ───────────────────────────────────────────────────────
console.log("\n────────────────────────────────────────────────────────────");
console.log("Milestone 6C — Infection Boss & Match Resolution");
console.log(`  PASSED: ${passed}`);
console.log(`  FAILED: ${failed}`);
console.log(`  TOTAL:  ${passed + failed}`);
console.log("────────────────────────────────────────────────────────────\n");

if (failed > 0) {
  console.error("❌ Some Milestone 6C tests failed.");
  process.exit(1);
} else {
  console.log("✅  All Phase 6C tests passed.");
  process.exit(0);
}
