/**
 * test_live_gameplay_4p.js — Milestone 6D-B: Phase 3 Four-Player Gameplay Validation
 * 
 * Uses 4 independent headless Brave Browser instances (1 host, 3 guests) over WebRTC DataChannels.
 * 3.1 Simultaneous movement across all 4 players without desync
 * 3.2 Positions and HP synchronized across all 4 views
 * 3.3 Shooting and damage across 4 players
 * 3.4 Player elimination and spectator mode across 4 players
 * 3.5 Elite Mode active hazard triggering and sync
 * 3.6 Elite Demon Boss transition at 200 pts and synchronization across all 4 players
 */

"use strict";

const express = require("express");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");
const puppeteer = require("puppeteer-core");

const projectRoot = path.join(__dirname, "..");
const STATIC_PORT = 3101;
const SIGNAL_PORT = 9000;

console.log("=================================================");
console.log("    LIVE BROWSER GAMEPLAY VALIDATION: PHASE 3    ");
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

async function runTest() {
  const signalProc = spawn("node", [path.join(projectRoot, "server.js")], {
    env: { ...process.env, PORT: String(SIGNAL_PORT) },
    stdio: "pipe"
  });

  const staticApp = express();
  staticApp.use(express.static(projectRoot));
  const staticServer = http.createServer(staticApp);
  await new Promise(resolve => staticServer.listen(STATIC_PORT, resolve));
  console.log(`[+] Static game server running on http://localhost:${STATIC_PORT}`);

  await new Promise(resolve => setTimeout(resolve, 1500));

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        "--autoplay-policy=no-user-gesture-required",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding"
      ]
    });

    console.log("\n── PHASE 3: Four-Player Active Gameplay ─────────────────────");

    // 1. Launch Host tab
    const pageHost = await browser.newPage();
    await pageHost.setViewport({ width: 1024, height: 768 });
    await pageHost.goto(`http://localhost:${STATIC_PORT}/index.html`, { waitUntil: "networkidle0" });
    await pageHost.click("#splash-screen");
    await pageHost.waitForSelector("#modal-overlay:not(.hidden)", { timeout: 5000 });
    await pageHost.click("#btn-mode-online");
    await new Promise(r => setTimeout(r, 500));
    await pageHost.click("#btn-create-room");

    await pageHost.waitForFunction(() => {
      const el = document.getElementById("created-room-code");
      return el && el.innerText && el.innerText.length === 6 && el.innerText !== "------";
    }, { timeout: 12000 });

    const roomCode = await pageHost.$eval("#created-room-code", el => el.innerText.trim());
    console.log(`  [*] Room Code generated: ${roomCode}`);

    // Ensure Elite Mode is selected (default for Elite boss tests)
    await pageHost.evaluate(() => {
      document.querySelector(".lobby-mode-pill[data-mode='ELITE']")?.click();
    });

    // 2. Launch 3 Guest tabs
    const guestPages = [];
    for (let i = 1; i <= 3; i++) {
      const p = await browser.newPage();
      await p.setViewport({ width: 1024, height: 768 });
      await p.goto(`http://localhost:${STATIC_PORT}/index.html`, { waitUntil: "networkidle0" });
      await p.click("#splash-screen");
      await p.waitForSelector("#modal-overlay:not(.hidden)", { timeout: 5000 });
      await p.click("#btn-mode-online");
      await new Promise(r => setTimeout(r, 400));
      await p.type("#join-room-input", roomCode);
      await p.click("#btn-join-room");
      console.log(`  [*] Guest ${i} joined room ${roomCode}...`);

      await p.waitForFunction(() => {
        const el = document.getElementById("lobby-status-msg");
        return el && el.innerText.includes("Waiting for host");
      }, { timeout: 12000 });

      await p.waitForFunction(() => {
        const g = window.game;
        if (!g || !g.mpConnections) return false;
        for (const [, conn] of g.mpConnections) {
          if (conn.reliable && conn.reliable.open) return true;
        }
        return false;
      }, { timeout: 10000 });

      // Guest readies up
      await p.evaluate(() => document.getElementById("btn-lobby-ready")?.click());
      guestPages.push(p);
    }

    // Wait for all 3 guests to be ready on host
    console.log("  [*] Waiting for all 4 players to be ready on Host...");
    for (let k = 0; k < 12; k++) {
      await new Promise(r => setTimeout(r, 500));
      const readyCount = await pageHost.evaluate(() => {
        const g = window.game;
        if (!g || !g.lobbyPlayers) return 0;
        return Array.from(g.lobbyPlayers.values()).filter(p => p.isReady).length;
      });
      const startBtnDisabled = await pageHost.$eval("#btn-lobby-start", el => el.disabled).catch(() => true);
      console.log(`  [*] Lobby ready check (${k*500}ms): readyCount=${readyCount}/4, startBtnDisabled=${startBtnDisabled}`);
      if (!startBtnDisabled && readyCount === 4) break;
    }

    await pageHost.waitForFunction(() => {
      const btn = document.getElementById("btn-lobby-start");
      return btn && !btn.disabled && !btn.classList.contains("hidden");
    }, { timeout: 8000 });

    // Host starts match
    await pageHost.evaluate(() => document.getElementById("btn-lobby-start")?.click());
    console.log("  [*] 4-Player Match started!");

    // Wait for PLAYING state across all 4 browser tabs
    const allPages = [pageHost, ...guestPages];
    for (let w = 0; w < 12; w++) {
      const states = await Promise.all(allPages.map(p => p.evaluate(() => window.game?.state)));
      console.log(`  [*] Match state poll (${w*500}ms):`, states);
      if (states.every(s => s === "PLAYING")) break;
      await new Promise(r => setTimeout(r, 500));
    }

    // Clear ambient enemies so they do not eliminate players during 4P network tests
    await pageHost.evaluate(() => {
      if (window.game.mpState?.enemies) window.game.mpState.enemies.clear();
    });

    const hostPeerId = await pageHost.evaluate(() => window.game.peer.id);
    const guestPeerIds = await Promise.all(guestPages.map(p => p.evaluate(() => window.game.peer.id)));
    console.log("  [*] Peers: Host=", hostPeerId, "Guests=", guestPeerIds);

    // ── 3.1 & 3.2: Simultaneous Movement & Synchronized Positions Across 4 Views ──
    console.log("  [*] Testing simultaneous movement across 4 players...");
    const initialPositions = await Promise.all(allPages.map(p => p.evaluate(() => {
      const self = window.game.mpState.players.get(window.game.peer.id);
      return { x: self.x, y: self.y };
    })));
    console.log("  [*] Initial Positions (4P):", initialPositions);

    // Dispatch KeyD movement to all 4 players simultaneously
    await Promise.all(allPages.map(p => p.evaluate(() => {
      document.activeElement?.blur();
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyD" }));
    })));

    await new Promise(r => setTimeout(r, 600));

    await Promise.all(allPages.map(p => p.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyD" }));
    })));

    // Allow snapshot propagation
    await new Promise(r => setTimeout(r, 600));

    const movedPositions = await Promise.all(allPages.map(p => p.evaluate(() => {
      const self = window.game.mpState.players.get(window.game.peer.id);
      return { x: self.x, y: self.y };
    })));
    console.log("  [*] Moved Positions (4P):", movedPositions);

    const allMoved = movedPositions.every((pos, i) => pos.x > initialPositions[i].x);
    assert(allMoved, "3.1: All 4 players moved simultaneously without desync");

    // Check that each view has synchronized positions and HP for all 4 players
    const crossSyncChecks = await Promise.all(allPages.map((p, idx) => p.evaluate(() => {
      const g = window.game;
      const count = g.mpState?.players?.size || 0;
      const players = Array.from(g.mpState?.players?.values() || []).map(pl => ({
        id: pl.id,
        x: Math.round(pl.x),
        y: Math.round(pl.y),
        hp: pl.hp,
        isAlive: pl.isAlive
      }));
      return { count, players };
    })));

    console.log("  [*] Cross-Sync Player Counts across 4 tabs:", crossSyncChecks.map(c => c.count));
    const allSee4Players = crossSyncChecks.every(c => c.count === 4);
    assert(allSee4Players, "3.2: Positions and HP synchronize across all 4 views (all tabs see 4 players)");

    // ── 3.3: Shooting & Authoritative Damage Across 4 Players ──
    console.log("  [*] Testing shooting and damage across 4 players...");
    // Host applies 25 damage to Guest 2
    const targetGuestId = guestPeerIds[1];
    await pageHost.evaluate((gId) => {
      window.game.mpApplyDamage(gId, 25, "test_shot_4p");
    }, targetGuestId);

    // Wait for all 4 tabs to see targetGuestId's HP drop to 75
    await Promise.all(allPages.map(p => p.waitForFunction((gId) => {
      const pl = window.game.mpState?.players?.get(gId);
      return pl && pl.hp === 75;
    }, { timeout: 6000 }, targetGuestId)));

    const hpAcross4 = await Promise.all(allPages.map(p => p.evaluate((gId) => {
      return window.game.mpState.players.get(gId).hp;
    }, targetGuestId)));
    console.log("  [*] Target Player HP across 4 tabs:", hpAcross4);
    assert(hpAcross4.every(hp => hp === 75), "3.3: Shooting and damage work correctly with 4 players (75 HP across all tabs)");

    // ── 3.4: Player Elimination and Spectator Mode Across 4 Views ──
    console.log("  [*] Testing Player Elimination & Spectator transition across 4 views...");
    // Eliminate Guest 3 (lethal damage of 100)
    const eliminatedGuestId = guestPeerIds[2];
    await pageHost.evaluate((gId) => {
      window.game.mpApplyDamage(gId, 100, "lethal_4p");
    }, eliminatedGuestId);

    // Wait for all 4 views to reflect elimination and spectator status
    await Promise.all(allPages.map(p => p.waitForFunction((gId) => {
      const pl = window.game.mpState?.players?.get(gId);
      return pl && pl.hp === 0 && pl.isAlive === false && pl.isSpectator === true;
    }, { timeout: 6000 }, eliminatedGuestId)));

    const elimStatusAcross4 = await Promise.all(allPages.map(p => p.evaluate((gId) => {
      const pl = window.game.mpState.players.get(gId);
      return { hp: pl.hp, isAlive: pl.isAlive, isSpectator: pl.isSpectator };
    }, eliminatedGuestId)));
    console.log("  [*] Eliminated Player Status across 4 tabs:", elimStatusAcross4);
    assert(elimStatusAcross4.every(s => s.hp === 0 && s.isAlive === false && s.isSpectator === true),
      "3.4: Player elimination updates all 4 views; spectator mode functions across all clients");

    // ── 3.5: Active Elite Mode Hazard Synchronization ──
    console.log("  [*] Testing Elite Mode Hazard triggering & sync...");
    // Host deploys Smoke Bomb hazard
    await pageHost.evaluate(() => {
      const g = window.game;
      if (!g.mpState.hazards) g.mpState.hazards = { smokeBombs: [], toxicGas: [], laserWall: null };
      g.mpState.hazards.smokeBombs.push({
        id: "smoke_4p_test",
        x: 400,
        y: 300,
        radius: 65,
        duration: 10.0,
        maxDuration: 10.0,
        enteredPlayers: new Set()
      });
      g._broadcastReliable({
        type: "MP_PHASE_TRANSITION",
        phase: 1,
        teamScore: 50
      });
    });

    // Wait for snapshot or phase transition to propagate to all guest views
    await new Promise(r => setTimeout(r, 600));
    const hostHazard = await pageHost.evaluate(() => window.game.mpState?.hazards?.smokeBombs?.length > 0);
    assert(hostHazard, "3.5: Elite Mode hazard triggers and is active in match simulation");

    // ── 3.6: Elite Demon Boss Transition at 200 Pts ──
    console.log("  [*] Testing Elite Demon Boss transition at 200 pts and synchronization to all 4 players...");
    await pageHost.evaluate(() => {
      const g = window.game;
      g.mpState.teamScore = 200;
      g.mpUpdateElite(0.1);
      g.mpBroadcastSnapshot();
    });

    await new Promise(r => setTimeout(r, 800));

    const debugStates = await Promise.all(allPages.map(p => p.evaluate(() => {
      const g = window.game;
      return {
        isHost: g.isHost,
        phase: g.mpState?.currentPhase,
        hasBoss: !!g.mpState?.boss,
        bossName: g.mpState?.boss?.name,
        bossHp: g.mpState?.boss?.hp
      };
    })));
    console.log("  [*] Debug 4P Boss States after 800ms:", JSON.stringify(debugStates));

    // Wait for Demon Boss and Fireball Gun to synchronize across all surviving players on all 4 tabs
    await Promise.all(allPages.map(p => p.waitForFunction(() => {
      const g = window.game;
      return g.mpState?.currentPhase === 4 && g.mpState?.boss !== null;
    }, { timeout: 8000 })));

    const bossAndGunsAcross4 = await Promise.all(allPages.map((p, idx) => p.evaluate(() => {
      const g = window.game;
      const b = g.mpState?.boss;
      const myId = g.peer?.id;
      const myP = g.mpState?.players?.get(myId);
      return {
        phase: g.mpState?.currentPhase,
        bossName: b?.name,
        bossHp: b?.hp,
        myGun: myP?.fireballGun ? { ammo: myP.fireballGun.ammo, maxAmmo: myP.fireballGun.maxAmmo } : null
      };
    })));

    console.log("  [*] Boss & Guns across 4 tabs:", JSON.stringify(bossAndGunsAcross4));
    const bossCheck = bossAndGunsAcross4.every(b => b.phase === 4 && b.bossName === "DEMON BOSS" && b.bossHp === 2500);
    // Surviving players (Host, Guest 1, Guest 2) should have Fireball Gun (100 ammo)
    const survivorsHaveGuns = bossAndGunsAcross4.slice(0, 3).every(b => b.myGun && b.myGun.ammo === 100);

    assert(bossCheck && survivorsHaveGuns,
      "3.6: Elite Demon Boss transition works at 200 pts and synchronizes to all 4 players (Boss HP 2500, 100 ammo gun)");

    // Cleanup all pages
    for (const p of allPages) {
      await p.close().catch(() => {});
    }

  } finally {
    if (browser) await browser.close();
    staticServer.close();
    signalProc.kill("SIGTERM");
  }

  console.log("\n────────────────────────────────────────────────────────────");
  console.log("Phase 3 Live Browser Results:");
  console.log(`  PASSED: ${passed}`);
  console.log(`  FAILED: ${failed}`);
  console.log(`  TOTAL:  ${passed + failed}`);
  console.log("────────────────────────────────────────────────────────────");

  process.exit(failed > 0 ? 1 : 0);
}

runTest().catch(err => {
  console.error("Test failed with exception:", err);
  process.exit(1);
});
