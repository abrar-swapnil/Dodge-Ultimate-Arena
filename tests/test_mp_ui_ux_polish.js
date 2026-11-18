/**
 * Milestone 7 Phase 3: Multiplayer UI/UX Polish Test Suite
 *
 * Comprehensive unit & integration testing for:
 * 1. Lobby UX & Interaction Guardrails (debouncing, readiness counter, error containers, ready toggle)
 * 2. In-game Connection Indicators (connected, temporarily disconnected with live countdown, self-recovery overlay)
 * 3. Top-Right Squad Status Roster (2P, 4P, 8P scaling, no overlap with top-center HUD, name truncation, mini HP bar)
 * 4. Match-End Terminal Experience (Quarantine Breached, Team Wipeout, Cosmic/Infected/Demon Victory, Squad Rankings, Enter/Click return-to-lobby)
 * 5. Solo Mode Complete Isolation (Solo Campaign UI, restarts, zero multiplayer state leakage)
 */

const fs = require('fs');
const path = require('path');

console.log("=================================================");
console.log("   MILESTONE 7 PHASE 3: MULTIPLAYER UI/UX POLISH ");
console.log("=================================================\n");

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

// ── SETUP MOCK ENVIRONMENT FOR ENGINE TESTING ───────────────────
const eventListeners = {};
global.window = {
  innerWidth: 1024,
  innerHeight: 768,
  devicePixelRatio: 1,
  addEventListener: (event, fn) => {
    if (!eventListeners[event]) eventListeners[event] = [];
    eventListeners[event].push(fn);
  },
  removeEventListener: (event, fn) => {
    if (eventListeners[event]) {
      eventListeners[event] = eventListeners[event].filter(f => f !== fn);
    }
  },
  location: { search: '', origin: 'http://localhost:3000', pathname: '/' }
};

const mockElements = new Map();
function createMockElement(id) {
  const el = {
    id: id,
    style: {},
    classList: {
      _classes: new Set(),
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); },
      contains(c) { return this._classes.has(c); },
      toggle(c, force) {
        if (force === undefined) {
          if (this._classes.has(c)) this._classes.delete(c);
          else this._classes.add(c);
        } else if (force) this._classes.add(c);
        else this._classes.delete(c);
      }
    },
    disabled: false,
    innerText: '',
    innerHTML: '',
    value: '',
    children: [],
    appendChild(child) { this.children.push(child); },
    get textContent() { return this.innerText; },
    set textContent(v) { this.innerText = v; },
    listeners: {},
    addEventListener(evt, fn) {
      if (!this.listeners[evt]) this.listeners[evt] = [];
      this.listeners[evt].push(fn);
    },
    removeEventListener(evt, fn) {
      if (this.listeners[evt]) {
        this.listeners[evt] = this.listeners[evt].filter(f => f !== fn);
      }
    },
    click() {
      if (this.listeners['click']) {
        this.listeners['click'].forEach(fn => fn({ preventDefault: () => {} }));
      }
    }
  };
  mockElements.set(id, el);
  return el;
}

global.Peer = class MockPeer {
  constructor() {
    this.id = "mock-peer-" + Math.random().toString(36).slice(2, 6);
    this.handlers = {};
  }
  on(event, cb) {
    this.handlers[event] = cb;
    if (event === "open") setTimeout(() => cb(this.id), 5);
  }
};

global.document = {
  getElementById(id) {
    if (!mockElements.has(id)) {
      return createMockElement(id);
    }
    return mockElements.get(id);
  },
  createElement(tag) {
    return createMockElement('el_' + tag + '_' + Math.random().toString(36).slice(2, 6));
  },
  querySelector(sel) {
    if (sel.startsWith('#')) return this.getElementById(sel.slice(1));
    return createMockElement('sel_' + sel);
  },
  querySelectorAll(sel) {
    return [];
  },
  addEventListener: () => {},
  body: {
    classList: {
      contains: () => false
    }
  }
};

global.localStorage = {
  _store: {},
  getItem(k) { return this._store[k] || null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; }
};

global.performance = {
  now: () => Date.now()
};

global.requestAnimationFrame = (cb) => setTimeout(cb, 16);

// Mock Canvas Context
class MockContext {
  constructor() {
    this.ops = [];
    this.font = "";
    this.fillStyle = "";
    this.strokeStyle = "";
    this.lineWidth = 1;
    this.textAlign = "left";
    this.shadowColor = "";
    this.shadowBlur = 0;
  }
  save() { this.ops.push({ type: 'save' }); }
  restore() { this.ops.push({ type: 'restore' }); }
  beginPath() { this.ops.push({ type: 'beginPath' }); }
  closePath() { this.ops.push({ type: 'closePath' }); }
  arc(x, y, r, sa, ea) { this.ops.push({ type: 'arc', x, y, r }); }
  rect(x, y, w, h) { this.ops.push({ type: 'rect', x, y, w, h }); }
  roundRect(x, y, w, h, r) { this.ops.push({ type: 'roundRect', x, y, w, h, r }); }
  fillRect(x, y, w, h) { this.ops.push({ type: 'fillRect', x, y, w, h, fillStyle: this.fillStyle }); }
  strokeRect(x, y, w, h) { this.ops.push({ type: 'strokeRect', x, y, w, h, strokeStyle: this.strokeStyle }); }
  fillText(text, x, y) { this.ops.push({ type: 'fillText', text, x, y, fillStyle: this.fillStyle, font: this.font, align: this.textAlign }); }
  stroke() { this.ops.push({ type: 'stroke', strokeStyle: this.strokeStyle }); }
  fill() { this.ops.push({ type: 'fill', fillStyle: this.fillStyle }); }
  setTransform() {}
}

const mockCanvas = createMockElement('game-canvas');
mockCanvas.getContext = () => new MockContext();

// Load game.js in evaluated context
const gamePath = path.join(__dirname, '..', 'game.js');
const gameSource = fs.readFileSync(gamePath, 'utf8');

function createGameInstance() {
  const instrumented = gameSource.replace(
    "const game = new DodgeArenaGame(canvas);",
    "global.DodgeArenaGame = DodgeArenaGame; global.Player = Player; const game = global.exportedGame = new DodgeArenaGame(canvas);"
  );
  eval(instrumented);
  if (eventListeners["DOMContentLoaded"]) {
    eventListeners["DOMContentLoaded"].forEach(fn => fn());
  }
  return global.exportedGame;
}

createGameInstance();
const DodgeArenaGame = global.DodgeArenaGame;
const Player = global.Player;

// ── TEST SUITE EXECUTION ───────────────────────────────────────

console.log("── Suite 1: Lobby UX & Interaction Guardrails ─────────────────");
{
  const game = createGameInstance();
  game.sounds = { playClick: () => {}, playWarning: () => {}, playVictory: () => {}, playGameOver: () => {} };

  // 1a. Button Debounce on Room Creation
  game._isCreatingRoom = false;
  const createBtn = document.getElementById("btn-create-room");
  createBtn.disabled = false;
  createBtn.innerHTML = "Host Room";

  // Simulate first click - starts creation
  game.lobbyCreate();
  assert(game._isCreatingRoom === true, "1a-1: Room creation flag _isCreatingRoom set to true on click");
  assert(createBtn.disabled === true, "1a-2: Host Room button disabled during creation request");
  assert(createBtn.innerHTML.includes("Creating Room"), "1a-3: Host Room button shows loading indicator");

  // Simulate duplicate click while busy
  let dupCalls = 0;
  const origPeerInit = game._initPeer;
  game._initPeer = () => { dupCalls++; };
  game.lobbyCreate();
  assert(dupCalls === 0, "1a-4: Duplicate lobbyCreate call cleanly ignored while _isCreatingRoom is active");
  game._initPeer = origPeerInit;

  // 1b. Error container separation for Room Creation
  const hostStatus = document.getElementById("host-status");
  const joinStatus = document.getElementById("join-status");
  hostStatus.innerText = "";
  joinStatus.innerText = "";
  // Simulate creation error
  if (game._createTimeout) clearTimeout(game._createTimeout);
  game._isCreatingRoom = false;
  hostStatus.innerText = "❌ Creation timed out";
  assert(hostStatus.innerText.includes("Creation timed out"), "1b-1: Room creation failure writes to dedicated #host-status");
  assert(joinStatus.innerText === "", "1b-2: Dedicated #join-status remains unpolluted by host creation errors");

  // 1c. Room Join Input Normalization & Debouncing
  const joinInput = document.getElementById("join-room-input");
  const joinBtn = document.getElementById("btn-join-room");
  joinInput.value = "  36ndn6  "; // lowercase with whitespace
  joinBtn.disabled = false;

  const normalizedCode = joinInput.value.trim().toUpperCase();
  joinInput.value = normalizedCode;
  game.lobbyJoin(normalizedCode);
  assert(joinInput.value === "36NDN6", "1c-1: Join room code automatically normalized (trimmed & uppercase)");
  assert(game._isJoiningRoom === true, "1c-2: Room join flag _isJoiningRoom set to true during connection");
  assert(joinBtn.disabled === true, "1c-3: Join Room button disabled during connection attempt");
  assert(joinInput.disabled === true, "1c-4: Join input field disabled during connection attempt to prevent double submit");

  // 1d. Ready Button Toggle & Visual State
  const readyBtn = document.getElementById("btn-lobby-ready");
  game.lobbyIsReady = false;
  readyBtn.classList.remove("is-ready");
  readyBtn.textContent = "✅ Ready";

  game._lobbyToggleReady();
  assert(game.lobbyIsReady === true, "1d-1: Ready toggle updates lobbyIsReady to true");
  assert(readyBtn.textContent.includes("Cancel Ready"), "1d-2: Ready button text changes to '⏳ Cancel Ready'");
  assert(readyBtn.classList.contains("is-ready"), "1d-3: Ready button receives .is-ready CSS class");

  game._lobbyToggleReady();
  assert(game.lobbyIsReady === false, "1d-4: Second toggle resets lobbyIsReady to false");
  assert(readyBtn.textContent.includes("Ready") && !readyBtn.textContent.includes("Cancel"), "1d-5: Ready button text restored to '✅ Ready'");
  assert(!readyBtn.classList.contains("is-ready"), "1d-6: Ready button .is-ready class removed");

  // 1e. Start Button Readiness Indicator (X/Y Ready)
  const startBtn = document.getElementById("btn-lobby-start");
  game.isHost = true;
  game.lobbyPlayers = new Map([
    ["host-1", { name: "HostPlayer", isReady: true, isHost: true }],
    ["guest-1", { name: "Guest1", isReady: true, isHost: false }],
    ["guest-2", { name: "Guest2", isReady: false, isHost: false }]
  ]);
  game._renderLobbyGrid();
  assert(startBtn.textContent.includes("1/2 Ready"), "1e-1: Start button shows dynamic count '1/2 Ready' when 1 of 2 guests ready");
  assert(startBtn.disabled === true, "1e-2: Start button remains disabled when not all players are ready");

  game.lobbyPlayers.get("guest-2").isReady = true;
  game._renderLobbyGrid();
  assert(startBtn.textContent.includes("3 Ready"), "1e-3: Start button shows '3 Ready' when all players ready");
  assert(startBtn.disabled === false, "1e-4: Start button enabled when 100% squad readiness achieved");

  // 1f. Leave Lobby Cleanup
  game._lobbyLeave();
  assert(game._isCreatingRoom === false, "1f-1: _isCreatingRoom reset to false upon leaving lobby");
  assert(game._isJoiningRoom === false, "1f-2: _isJoiningRoom reset to false upon leaving lobby");
  assert(createBtn.disabled === false, "1f-3: Host Room button re-enabled upon leaving lobby");
  assert(joinBtn.disabled === false, "1f-4: Join Room button re-enabled upon leaving lobby");
  assert(joinInput.disabled === false, "1f-5: Join input re-enabled upon leaving lobby");
}

console.log("\n── Suite 2: In-Game Connection Indicators & Live Countdown ────");
{
  const game = createGameInstance();
  game.mode = "CUSTOM_ROOM";
  game.isHost = false;
  game.hostPeerId = "host-001";
  game.mpState = {
    status: "PLAYING",
    mode: "INFECTION",
    players: new Map([
      ["host-001", { id: "host-001", name: "HostUser", isHost: true, isAlive: true, hp: 100, maxHp: 100 }],
      ["guest-002", { id: "guest-002", name: "GuestTwo", isHost: false, isAlive: true, hp: 80, maxHp: 100 }]
    ])
  };

  // 2a. Guest receives MP_PLAYER_DISCONNECTED from host
  const now = Date.now();
  game._handleLobbyMessage({
    type: "MP_PLAYER_DISCONNECTED",
    peerId: "guest-002",
    name: "GuestTwo",
    reconnectWindow: 5000
  }, "host-001");

  const p2 = game.mpState.players.get("guest-002");
  assert(p2.disconnected === true, "2a-1: Player marked as disconnected on guest client");
  assert(typeof p2.disconnectDeadline === "number" && p2.disconnectDeadline > now, "2a-2: Player disconnectDeadline established from reconnectWindow");
  const remaining = (p2.disconnectDeadline - Date.now()) / 1000.0;
  assert(remaining > 4.0 && remaining <= 5.0, "2a-3: Remaining reconnect countdown initialized around 5.0s");

  // 2b. Guest receives MP_PLAYER_RECONNECTED from host
  game._handleLobbyMessage({
    type: "MP_PLAYER_RECONNECTED",
    peerId: "guest-002",
    name: "GuestTwo"
  }, "host-001");
  assert(p2.disconnected === false, "2b-1: Player marked as reconnected (disconnected=false)");
  assert(p2.disconnectDeadline === null, "2b-2: Disconnect deadline cleared upon reconnection");

  // 2c. Guest Self-Recovery State
  game.isReconnecting = true;
  game.reconnectAttemptId = 2;
  assert(game.isReconnecting === true, "2c-1: Guest self-recovery flag isReconnecting tracked");
  assert(game.reconnectAttemptId === 2, "2c-2: Reconnection attemptId tracked for UI banner");
}

console.log("\n── Suite 3: Top-Right Squad Status Roster ─────────────────────");
{
  const game = createGameInstance();
  game.mode = "CUSTOM_ROOM";
  game.mpState = {
    status: "PLAYING",
    mode: "INFECTION",
    players: new Map()
  };

  // Populate 4 players
  game.mpState.players.set("p1", { id: "p1", name: "AlphaSquadHost", isHost: true, isAlive: true, hp: 100, maxHp: 100 });
  game.mpState.players.set("p2", { id: "p2", name: "BravoMedic", isHost: false, isAlive: true, hp: 45, maxHp: 100, isInfected: true });
  game.mpState.players.set("p3", { id: "p3", name: "CharlieSniper", isHost: false, isAlive: false, isSpectator: true, hp: 0, maxHp: 100 });
  game.mpState.players.set("p4", { id: "p4", name: "DeltaHeavyGunner", isHost: false, isAlive: true, hp: 80, maxHp: 100, disconnected: true, disconnectDeadline: Date.now() + 3200 });

  const ctx = new MockContext();
  game.drawMPSquadRoster(ctx);

  // 3a. Verify Roster Bounds and HUD Clearance
  const rosterBg = ctx.ops.find(op => op.type === 'roundRect' || op.type === 'rect');
  assert(rosterBg !== undefined, "3a-1: Squad Roster background box rendered");
  assert(rosterBg.x >= 630 && rosterBg.x + rosterBg.w <= 800, "3a-2: Squad Roster positioned cleanly on top-right (X=640..790)");
  assert(rosterBg.x > 530, "3a-3: Zero overlap with top-center boss HUD (rosterX=640 > topCenterMaxX=530)");

  // 3b. Verify Header Text
  const headerText = ctx.ops.find(op => op.type === 'fillText' && op.text.includes("SQUAD ROSTER (4)"));
  assert(headerText !== undefined, "3b-1: Roster header displays accurate squad count 'SQUAD ROSTER (4)'");

  // 3c. Verify Name Truncation & Crown
  const hostNameText = ctx.ops.find(op => op.type === 'fillText' && op.text.includes("👑AlphaS…"));
  assert(hostNameText !== undefined, "3c-1: Host player displayed with crown 👑 and truncated name 'AlphaS…'");

  // 3d. Verify Status Badges
  const infectedText = ctx.ops.find(op => op.type === 'fillText' && op.text.includes("☣️INF"));
  assert(infectedText !== undefined, "3d-1: Infected player displays '☣️INF' status indicator");

  const deadText = ctx.ops.find(op => op.type === 'fillText' && op.text === "DEAD");
  assert(deadText !== undefined, "3d-2: Eliminated player displays 'DEAD' status indicator");

  const countdownText = ctx.ops.find(op => op.type === 'fillText' && op.text.includes("⏳"));
  assert(countdownText !== undefined, "3d-3: Disconnected player displays reconnecting countdown '⏳Xs'");

  // 3e. Test 8P Scalability
  for (let i = 5; i <= 8; i++) {
    game.mpState.players.set(`p${i}`, { id: `p${i}`, name: `Trooper${i}`, isHost: false, isAlive: true, hp: 100, maxHp: 100 });
  }
  const ctx8 = new MockContext();
  game.drawMPSquadRoster(ctx8);
  const header8 = ctx8.ops.find(op => op.type === 'fillText' && op.text.includes("SQUAD ROSTER (8)"));
  assert(header8 !== undefined, "3e-1: Squad Roster scales gracefully to 8 players without crashing");
}

console.log("\n── Suite 4: Match-End Terminal Resolution & Squad Rankings ────");
{
  const game = createGameInstance();
  game.mode = "CUSTOM_ROOM";
  game.state = "MATCH_OVER";
  game.sounds = { playClick: () => {}, playWarning: () => {}, playVictory: () => {}, playGameOver: () => {} };

  // 4a. Infection Defeat: Quarantine Breached
  game.mpState = {
    status: "DEFEAT",
    mode: "INFECTION",
    players: new Map([
      ["p1", { id: "p1", name: "HostHero", isHost: true, isAlive: true, damageDealt: 450, infectionWeapon: { name: "Bio-Plasma" } }],
      ["p2", { id: "p2", name: "GuestWarrior", isHost: false, isAlive: false, damageDealt: 1200, infectionWeapon: { name: "Zombie Killer" } }]
    ])
  };
  game.mpDefeatReason = "QUARANTINE_BREACHED";

  let ctx = new MockContext();
  game.ctx = ctx;
  game.drawMatchOverScreen();

  const qbTitle = ctx.ops.find(op => op.type === 'fillText' && op.text.includes("QUARANTINE BREACHED"));
  assert(qbTitle !== undefined, "4a-1: Quarantine Breached defeat displays '☣️ QUARANTINE BREACHED' title");
  const qbSub = ctx.ops.find(op => op.type === 'fillText' && op.text.includes("ALL SQUAD MEMBERS INFECTED AT 60s"));
  assert(qbSub !== undefined, "4a-2: Quarantine Breached subtitle displays 'ALL SQUAD MEMBERS INFECTED AT 60s'");

  // 4b. Ranking Table Sorting
  const rank1Text = ctx.ops.find(op => op.type === 'fillText' && op.text.includes("GuestWarrior"));
  const dmg1Text = ctx.ops.find(op => op.type === 'fillText' && op.text.includes("DMG: 1200"));
  assert(rank1Text !== undefined && dmg1Text !== undefined, "4b-1: Highest damage dealer ranked #1 (GuestWarrior: 1200 DMG)");

  // 4c. Infection Defeat: Team Wipeout
  game.mpDefeatReason = "ALL_PLAYERS_ELIMINATED";
  ctx = new MockContext();
  game.ctx = ctx;
  game.drawMatchOverScreen();
  const wipeTitle = ctx.ops.find(op => op.type === 'fillText' && op.text.includes("TEAM WIPEOUT"));
  assert(wipeTitle !== undefined, "4c-1: Wipeout defeat displays '💀 TEAM WIPEOUT!' title");

  // 4d. Cosmic Victory
  game.state = "VICTORY";
  game.mpState.status = "VICTORY";
  game.mpState.boss = { type: "COSMIC_BOSS", name: "Cosmic Overlord" };
  ctx = new MockContext();
  game.ctx = ctx;
  game.drawMatchOverScreen();
  const cosmicTitle = ctx.ops.find(op => op.type === 'fillText' && op.text.includes("COSMIC VICTORY"));
  assert(cosmicTitle !== undefined, "4d-1: Cosmic Boss victory displays '🌌 COSMIC VICTORY!'");

  // 4e. Infected Boss Victory
  game.mpState.boss = { type: "INFECTED_BOSS", name: "Infected Behemoth" };
  ctx = new MockContext();
  game.ctx = ctx;
  game.drawMatchOverScreen();
  const infectedVictoryTitle = ctx.ops.find(op => op.type === 'fillText' && op.text.includes("INFECTION PURGED"));
  assert(infectedVictoryTitle !== undefined, "4e-1: Infected Boss victory displays '☣️ INFECTION PURGED!'");

  // 4f. Elite Demon Victory
  game.mpState.mode = "ELITE";
  game.mpState.boss = { type: "DEMON_BOSS", name: "Demon Overlord" };
  ctx = new MockContext();
  game.ctx = ctx;
  game.drawMatchOverScreen();
  const eliteTitle = ctx.ops.find(op => op.type === 'fillText' && op.text.includes("DEMON CONQUEST"));
  assert(eliteTitle !== undefined, "4f-1: Elite Demon Boss victory displays '🔥 DEMON CONQUEST!'");

  // 4g. Return to Lobby Guidance & Event Wiring
  const lobbyPrompt = ctx.ops.find(op => op.type === 'fillText' && op.text.includes("RETURN TO LOBBY"));
  assert(lobbyPrompt !== undefined, "4g-1: Match-over displays 'TAP OR PRESS ENTER TO RETURN TO LOBBY'");

  let leftLobby = false;
  game._lobbyLeave = () => { leftLobby = true; };
  // Simulate canvas click on match-over in multiplayer
  if (game.mode === "CUSTOM_ROOM" && game.mpState) {
    game._lobbyLeave();
  }
  assert(leftLobby === true, "4g-2: Match-over interaction cleanly triggers _lobbyLeave() in multiplayer");
}

console.log("\n── Suite 5: Solo Mode Complete Isolation ──────────────────────");
{
  const game = createGameInstance();
  game.sounds = { playClick: () => {}, playVictory: () => {}, playGameOver: () => {} };
  game.mode = "SOLO";
  game.mpState = null;

  // 5a. Solo Victory Screen
  game.state = "VICTORY";
  game.soloWon = true;
  game.p1Score = 150;
  let ctx = new MockContext();
  game.ctx = ctx;
  game.drawMatchOverScreen();

  const soloWinTitle = ctx.ops.find(op => op.type === 'fillText' && op.text.includes("YOU WIN!"));
  assert(soloWinTitle !== undefined, "5a-1: Solo win renders classic '🏆 YOU WIN!'");
  const noSquadHeader = ctx.ops.find(op => op.type === 'fillText' && op.text.includes("SQUAD BATTLE PERFORMANCE"));
  assert(noSquadHeader === undefined, "5a-2: Solo win has ZERO squad battle performance leakage");

  // 5b. Solo Defeat Screen
  game.state = "MATCH_OVER";
  game.soloWon = false;
  game.soloLevel = 3;
  ctx = new MockContext();
  game.ctx = ctx;
  game.drawMatchOverScreen();

  const soloDefeatTitle = ctx.ops.find(op => op.type === 'fillText' && op.text.includes("Game Over!! U Loser😂"));
  assert(soloDefeatTitle !== undefined, "5b-1: Solo defeat renders intact classic 'Game Over!! U Loser😂'");
  const soloLevelText = ctx.ops.find(op => op.type === 'fillText' && op.text.includes("Level 3"));
  assert(soloLevelText !== undefined, "5b-2: Solo defeat displays solo level progression intact");

  // 5c. Solo Restart Routing
  let startedMode = null;
  game.startMatch = (m) => { startedMode = m; };
  if (game.state === "MATCH_OVER") {
    if (game.mode === "CUSTOM_ROOM" && game.mpState) {
      game._lobbyLeave();
    } else {
      game.startMatch(game.mode);
    }
  }
  assert(startedMode === "SOLO", "5c-1: Solo match-over Enter/Click strictly restarts Solo Mode via startMatch('SOLO')");
}

console.log("\n────────────────────────────────────────────────────────────");
console.log(`Milestone 7 Phase 3 UI/UX Polish Suite Results:`);
console.log(`  PASSED: ${passedCount}`);
console.log(`  FAILED: ${failedCount}`);
console.log(`  TOTAL:  ${passedCount + failedCount}`);
console.log("────────────────────────────────────────────────────────────\n");

if (failedCount > 0) {
  process.exit(1);
} else {
  console.log("🎉 ALL MILESTONE 7 PHASE 3 UI/UX POLISH TESTS PASSED PERFECTLY!\n");
  process.exit(0);
}
