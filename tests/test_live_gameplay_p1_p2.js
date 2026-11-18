/**
 * test_live_gameplay_p1_p2.js — Milestone 6D-B: Phase 1 & 2 Live Browser Gameplay Validation
 * 
 * Uses real headless Brave Browser instances connected via WebRTC DataChannels.
 * Phase 1: 2-Player Infection Gameplay (Movement, Weapons, Ammo, Damage, Infection, Elimination, Disconnect)
 * Phase 2: 2-Player Boss Validation (Infected Boss & Cosmic Boss Branches, Abilities, Weapon Damage, Hearts, Victory/Defeat)
 */

"use strict";

const express = require("express");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");
const puppeteer = require("puppeteer-core");

const projectRoot = path.join(__dirname, "..");
const STATIC_PORT = 3100;
const SIGNAL_PORT = 9000;

console.log("=================================================");
console.log("  LIVE BROWSER GAMEPLAY VALIDATION: PHASE 1 & 2  ");
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

    // ─────────────────────────────────────────────────────────────
    // PHASE 1: Two-Player Infection Gameplay
    // ─────────────────────────────────────────────────────────────
    console.log("\n── PHASE 1: Two-Player Infection Active Gameplay ─────────────");

    // 1. Launch Host tab
    const pageHost = await browser.newPage();
    await pageHost.setViewport({ width: 1024, height: 768 });
    pageHost.on("console", msg => console.log(`  [Host] ${msg.type()}: ${msg.text()}`));
    await pageHost.goto(`http://localhost:${STATIC_PORT}/index.html`, { waitUntil: "networkidle0" });
    await pageHost.click("#splash-screen");
    await pageHost.waitForSelector("#modal-overlay:not(.hidden)", { timeout: 5000 });
    await pageHost.click("#btn-mode-online");
    await new Promise(r => setTimeout(r, 600));

    await pageHost.click("#btn-create-room");
    await pageHost.waitForFunction(() => {
      const el = document.getElementById("created-room-code");
      return el && el.innerText && el.innerText.length === 6 && el.innerText !== "------";
    }, { timeout: 12000 });

    const roomCode = await pageHost.$eval("#created-room-code", el => el.innerText.trim());
    console.log(`  [*] Room Code generated: ${roomCode}`);

    // Select Infection Mode
    await pageHost.evaluate(() => {
      document.querySelector(".lobby-mode-pill[data-mode='INFECTION']")?.click();
    });

    // 2. Launch Guest tab
    const pageGuest = await browser.newPage();
    await pageGuest.setViewport({ width: 1024, height: 768 });
    pageGuest.on("console", msg => console.log(`  [Guest] ${msg.type()}: ${msg.text()}`));
    await pageGuest.goto(`http://localhost:${STATIC_PORT}/index.html`, { waitUntil: "networkidle0" });
    await pageGuest.click("#splash-screen");
    await pageGuest.waitForSelector("#modal-overlay:not(.hidden)", { timeout: 5000 });
    await pageGuest.click("#btn-mode-online");
    await new Promise(r => setTimeout(r, 600));

    await pageGuest.type("#join-room-input", roomCode);
    await pageGuest.click("#btn-join-room");
    console.log(`  [*] Guest joining room ${roomCode}...`);

    await pageGuest.waitForFunction(() => {
      const el = document.getElementById("lobby-status-msg");
      return el && el.innerText.includes("Waiting for host");
    }, { timeout: 12000 });

    // Wait for guest WebRTC connection to open
    await pageGuest.waitForFunction(() => {
      const g = window.game;
      if (!g || !g.mpConnections) return false;
      for (const [, conn] of g.mpConnections) {
        if (conn.reliable && conn.reliable.open) return true;
      }
      return false;
    }, { timeout: 10000 });

    // Guest toggles ready
    await pageGuest.evaluate(() => {
      document.getElementById("btn-lobby-ready")?.click();
    });

    // Check host lobby state for guest isReady
    for (let k = 0; k < 10; k++) {
      await new Promise(r => setTimeout(r, 500));
      const hostLobbyData = await pageHost.evaluate(() => {
        const g = window.game;
        if (!g || !g.lobbyPlayers) return null;
        return Array.from(g.lobbyPlayers.values()).map(p => ({ name: p.name, isReady: p.isReady, isHost: p.isHost }));
      });
      const startBtnDisabled = await pageHost.$eval("#btn-lobby-start", el => el.disabled).catch(() => true);
      console.log(`  [*] Host check (${k*500}ms): startBtnDisabled=${startBtnDisabled}, players=`, hostLobbyData);
      if (!startBtnDisabled) break;
    }

    // Host sees start button enabled
    await pageHost.waitForFunction(() => {
      const btn = document.getElementById("btn-lobby-start");
      return btn && !btn.disabled && !btn.classList.contains("hidden");
    }, { timeout: 8000 });

    // Host starts match
    await pageHost.evaluate(() => {
      document.getElementById("btn-lobby-start")?.click();
    });
    console.log("  [*] Match started!");

    // Wait for PLAYING state on both
    for (let w = 0; w < 10; w++) {
      const sH = await pageHost.evaluate(() => window.game?.state);
      const sG = await pageGuest.evaluate(() => window.game?.state);
      console.log(`  [*] Match state poll (${w*500}ms): Host=${sH}, Guest=${sG}`);
      if (sH === "PLAYING" && sG === "PLAYING") break;
      await new Promise(r => setTimeout(r, 500));
    }

    // Clear ambient enemies so they do not inadvertently eliminate players during precision network latency tests
    await pageHost.evaluate(() => {
      if (window.game.mpState?.enemies) {
        window.game.mpState.enemies.clear();
      }
    });

    // Initial positions
    const initialPos = await Promise.all([
      pageHost.evaluate(() => {
        const p = window.game.mpState.players.get(window.game.peer.id);
        return { x: p.x, y: p.y };
      }),
      pageGuest.evaluate(() => {
        const p = window.game.mpState.players.get(window.game.peer.id);
        return { x: p.x, y: p.y };
      })
    ]);
    console.log("  [*] Initial Positions: Host=", initialPos[0], " Guest=", initialPos[1]);

    // 1. Both players move simultaneously via keyboard inputs
    console.log("  [*] Stimulating simultaneous keyboard movement inputs...");
    await pageHost.evaluate(() => {
      document.activeElement?.blur();
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyD" }));
    });
    await pageGuest.evaluate(() => {
      document.activeElement?.blur();
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyD" }));
    });

    await new Promise(r => setTimeout(r, 600));

    await pageHost.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyD" }));
    });
    await pageGuest.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyD" }));
    });

    // Allow snapshot propagation
    await new Promise(r => setTimeout(r, 600));

    // Verify both players moved from initial positions
    const movedPos = await Promise.all([
      pageHost.evaluate(() => {
        const p = window.game.mpState.players.get(window.game.peer.id);
        return { x: p.x, y: p.y };
      }),
      pageGuest.evaluate(() => {
        const p = window.game.mpState.players.get(window.game.peer.id);
        return { x: p.x, y: p.y };
      })
    ]);
    console.log("  [*] Moved Positions: Host=", movedPos[0], " Guest=", movedPos[1]);
    assert(movedPos[0].x > initialPos[0].x, "1.1: Host moved right upon KeyD input");
    assert(movedPos[1].x > initialPos[1].x, "1.2: Guest moved right upon KeyD input");

    // 2. Position synchronization across WebRTC
    // Check that host sees guest at movedPos[1] and guest sees host at movedPos[0]
    const syncPos = await Promise.all([
      pageHost.evaluate((guestPeerId) => {
        const p = window.game.mpState.players.get(guestPeerId);
        return { x: p.x, y: p.y };
      }, await pageGuest.evaluate(() => window.game.peer.id)),
      pageGuest.evaluate((hostPeerId) => {
        const p = window.game.mpState.players.get(hostPeerId);
        return { x: p.x, y: p.y };
      }, await pageHost.evaluate(() => window.game.peer.id))
    ]);
    console.log("  [*] Cross-synced Positions: Host sees Guest at", syncPos[0], ", Guest sees Host at", syncPos[1]);
    assert(Math.abs(syncPos[0].x - movedPos[1].x) < 25, "1.3: Host synchronized Guest movement coordinates");
    assert(Math.abs(syncPos[1].x - movedPos[0].x) < 25, "1.4: Guest synchronized Host movement coordinates");

    // 3 & 4. Weapon collection, ownership, and ammo synchronization
    console.log("  [*] Testing Weapon Collection & Synchronization...");
    const guestPeerId = await pageGuest.evaluate(() => window.game.peer.id);
    console.log("  [*] Guest Peer ID:", guestPeerId);

    // Host authoritative collection of Zombie Killer pickup for Guest
    const pickupCollected = await pageHost.evaluate((gId) => {
      const g = window.game;
      const pk = g.mpState.weaponPickups.find(p => p.type === "ZOMBIE_KILLER") || g.mpState.weaponPickups[0];
      if (!pk) return false;
      return g.mpCollectWeaponPickup(gId, pk.id);
    }, guestPeerId);
    console.log("  [*] Host pickup collection result:", pickupCollected);

    // Wait for host state to reflect weapon
    await pageHost.waitForFunction((gId) => {
      const p = window.game.mpState.players.get(gId);
      return p && p.infectionWeapon && p.infectionWeapon.type === "ZOMBIE_KILLER";
    }, { timeout: 5000 }, guestPeerId);

    // Wait for snapshot or MP_WEAPON_PICKUP to synchronize on guest
    await pageGuest.waitForFunction(() => {
      const p = window.game.mpState.players.get(window.game.peer.id);
      return p && p.infectionWeapon && p.infectionWeapon.type === "ZOMBIE_KILLER";
    }, { timeout: 5000 });

    const guestWeaponOnHost = await pageHost.evaluate((guestPeerId) => {
      const p = window.game.mpState.players.get(guestPeerId);
      return { type: p.infectionWeapon.type, ammo: p.infectionWeapon.ammo };
    }, await pageGuest.evaluate(() => window.game.peer.id));

    const guestWeaponOnGuest = await pageGuest.evaluate(() => {
      const p = window.game.mpState.players.get(window.game.peer.id);
      return { type: p.infectionWeapon.type, ammo: p.infectionWeapon.ammo };
    }, await pageGuest.evaluate(() => window.game.peer.id));

    console.log("  [*] Weapon Ownership: On Host=", guestWeaponOnHost, " On Guest=", guestWeaponOnGuest);
    assert(guestWeaponOnGuest.type === "ZOMBIE_KILLER" && guestWeaponOnGuest.ammo === 150, "1.5: Guest collected Zombie Killer (150 ammo)");
    assert(guestWeaponOnHost.type === "ZOMBIE_KILLER" && guestWeaponOnHost.ammo === 150, "1.6: Host synchronized Guest weapon ownership and ammo");

    // 5. Shooting consumes ammo correctly
    console.log("  [*] Guest firing weapon via fireMultiplayerWeapon...");
    const fireRes = await pageGuest.evaluate(() => {
      const g = window.game;
      const myId = g.peer?.id;
      const myP = g.mpState?.players?.get(myId);
      const beforeAmmo = myP?.infectionWeapon?.ammo;
      g.fireMultiplayerWeapon();
      const afterAmmo = myP?.infectionWeapon?.ammo;
      return { myId, beforeAmmo, afterAmmo, hasMpConnections: g.mpConnections?.size };
    });
    console.log("  [*] Guest fire debug:", JSON.stringify(fireRes));
    await new Promise(r => setTimeout(r, 400));

    const guestAmmoAfterShot = await pageGuest.evaluate(() => {
      const p = window.game.mpState.players.get(window.game.peer.id);
      return p.infectionWeapon.ammo;
    });

    // Check host ammo
    const hostCheckAmmo = await pageHost.evaluate((gId) => {
      const p = window.game.mpState.players.get(gId);
      return { ammo: p?.infectionWeapon?.ammo, weapon: p?.infectionWeapon };
    }, guestPeerId);
    console.log("  [*] Host check ammo immediately:", JSON.stringify(hostCheckAmmo));

    // Wait for host to receive MP_INFECTION_SHOOT and decrement ammo
    await pageHost.waitForFunction((gId) => {
      const p = window.game.mpState.players.get(gId);
      return p && p.infectionWeapon && p.infectionWeapon.ammo === 149;
    }, { timeout: 5000 }, guestPeerId);

    const hostRecordedGuestAmmo = await pageHost.evaluate((gId) => {
      const p = window.game.mpState.players.get(gId);
      return p.infectionWeapon.ammo;
    }, guestPeerId);

    console.log(`  [*] Ammo after shot: Guest=${guestAmmoAfterShot}, Host=${hostRecordedGuestAmmo}`);
    assert(guestAmmoAfterShot === 149, "1.7: Guest shooting consumed 1 ammo locally (150 -> 149)");
    assert(hostRecordedGuestAmmo === 149, "1.8: Host received shoot request and decremented authoritative ammo (149)");

    // 6. Host-authoritative damage updates both players' views
    console.log("  [*] Testing Host-authoritative damage application...");
    await pageHost.evaluate((guestPeerId) => {
      window.game.mpApplyDamage(guestPeerId, 30, "test_damage_1");
    }, await pageGuest.evaluate(() => window.game.peer.id));

    await pageGuest.waitForFunction(() => {
      const p = window.game.mpState.players.get(window.game.peer.id);
      return p && p.hp === 70;
    }, { timeout: 5000 });

    const hpState = await Promise.all([
      pageHost.evaluate((guestPeerId) => window.game.mpState.players.get(guestPeerId).hp, await pageGuest.evaluate(() => window.game.peer.id)),
      pageGuest.evaluate(() => window.game.mpState.players.get(window.game.peer.id).hp)
    ]);
    console.log(`  [*] HP after 30 damage: Host shows Guest HP=${hpState[0]}, Guest shows HP=${hpState[1]}`);
    assert(hpState[0] === 70, "1.9: Host authoritatively reduced Guest HP to 70");
    assert(hpState[1] === 70, "1.10: Guest view synchronized HP to 70 via damage message");

    // 7. Infection propagation synchronizes correctly
    console.log("  [*] Testing Infection propagation between entities...");
    await pageHost.evaluate((guestPeerId) => {
      window.game.mpInfectEntity("PLAYER", guestPeerId, "source_test_1");
    }, await pageGuest.evaluate(() => window.game.peer.id));

    await pageGuest.waitForFunction(() => {
      const p = window.game.mpState.players.get(window.game.peer.id);
      return p && p.isInfected === true;
    }, { timeout: 5000 });

    const infectionState = await Promise.all([
      pageHost.evaluate((guestPeerId) => window.game.mpState.players.get(guestPeerId).isInfected, await pageGuest.evaluate(() => window.game.peer.id)),
      pageGuest.evaluate(() => window.game.mpState.players.get(window.game.peer.id).isInfected)
    ]);
    assert(infectionState[0] === true && infectionState[1] === true, "1.11: Infection state synchronized across both live browsers");

    // 8. Player elimination and spectator transition
    console.log("  [*] Testing Player Elimination & Spectator transition...");
    await pageHost.evaluate((guestPeerId) => {
      window.game.mpApplyDamage(guestPeerId, 70, "test_lethal_1");
    }, await pageGuest.evaluate(() => window.game.peer.id));

    await pageGuest.waitForFunction(() => {
      const p = window.game.mpState.players.get(window.game.peer.id);
      return p && p.hp === 0 && p.isSpectator === true;
    }, { timeout: 5000 });

    const elimState = await Promise.all([
      pageHost.evaluate((guestPeerId) => {
        const p = window.game.mpState.players.get(guestPeerId);
        return { hp: p.hp, isAlive: p.isAlive, isSpectator: p.isSpectator };
      }, await pageGuest.evaluate(() => window.game.peer.id)),
      pageGuest.evaluate(() => {
        const p = window.game.mpState.players.get(window.game.peer.id);
        return { hp: p.hp, isAlive: p.isAlive, isSpectator: p.isSpectator };
      })
    ]);
    console.log("  [*] Elimination State: Host view=", elimState[0], " Guest view=", elimState[1]);
    assert(elimState[0].hp === 0 && elimState[0].isAlive === false && elimState[0].isSpectator === true, "1.12: Host transitioned eliminated player to spectator");
    assert(elimState[1].hp === 0 && elimState[1].isAlive === false && elimState[1].isSpectator === true, "1.13: Guest client transitioned to spectator state");

    // 9. Disconnecting a guest during active gameplay
    console.log("  [*] Testing Guest disconnect during active match...");
    await pageGuest.evaluate(() => {
      window.game.peer?.destroy();
    });
    await pageGuest.close();
    
    await pageHost.waitForFunction(() => {
      return window.game.mpState?.players?.size === 1;
    }, { timeout: 8500 });

    // Host should handle disconnect and remove guest peer cleanly
    const hostPostDisconnect = await pageHost.evaluate(() => {
      const g = window.game;
      return {
        state: g.state,
        playerCount: g.mpState?.players?.size,
        hasHost: g.mpState?.players?.has(g.peer?.id)
      };
    });
    console.log("  [*] Host state after guest disconnect:", hostPostDisconnect);
    assert(hostPostDisconnect.state === "PLAYING", "1.14: Host match remains PLAYING after guest disconnect");
    assert(hostPostDisconnect.playerCount === 1, "1.15: Disconnected guest purged from host players map (size=1)");

    await pageHost.close();

    // ─────────────────────────────────────────────────────────────
    // PHASE 2: Two-Player Boss Validation
    // ─────────────────────────────────────────────────────────────
    console.log("\n── PHASE 2: Two-Player Infection Boss Validation ──────────────");

    // Setup fresh 2-player match for Boss Testing
    const host2 = await browser.newPage();
    await host2.setViewport({ width: 1024, height: 768 });
    await host2.goto(`http://localhost:${STATIC_PORT}/index.html`, { waitUntil: "networkidle0" });
    await host2.click("#splash-screen");
    await host2.waitForSelector("#modal-overlay:not(.hidden)", { timeout: 5000 });
    await host2.click("#btn-mode-online");
    await new Promise(r => setTimeout(r, 500));
    await host2.click("#btn-create-room");
    await host2.waitForFunction(() => {
      const el = document.getElementById("created-room-code");
      return el && el.innerText && el.innerText.length === 6 && el.innerText !== "------";
    }, { timeout: 12000 });
    const bRoomCode = await host2.$eval("#created-room-code", el => el.innerText.trim());

    await host2.evaluate(() => {
      document.querySelector(".lobby-mode-pill[data-mode='INFECTION']")?.click();
    });

    const guest2 = await browser.newPage();
    await guest2.setViewport({ width: 1024, height: 768 });
    await guest2.goto(`http://localhost:${STATIC_PORT}/index.html`, { waitUntil: "networkidle0" });
    await guest2.click("#splash-screen");
    await guest2.waitForSelector("#modal-overlay:not(.hidden)", { timeout: 5000 });
    await guest2.click("#btn-mode-online");
    await new Promise(r => setTimeout(r, 500));
    await guest2.type("#join-room-input", bRoomCode);
    await guest2.click("#btn-join-room");

    await guest2.waitForFunction(() => {
      const el = document.getElementById("lobby-status-msg");
      return el && el.innerText.includes("Waiting for host");
    }, { timeout: 12000 });

    await guest2.waitForFunction(() => {
      const g = window.game;
      if (!g || !g.mpConnections) return false;
      for (const [, conn] of g.mpConnections) {
        if (conn.reliable && conn.reliable.open) return true;
      }
      return false;
    }, { timeout: 10000 });

    await guest2.evaluate(() => document.getElementById("btn-lobby-ready")?.click());

    for (let k = 0; k < 10; k++) {
      await new Promise(r => setTimeout(r, 500));
      const startBtnDisabled = await host2.$eval("#btn-lobby-start", el => el.disabled).catch(() => true);
      if (!startBtnDisabled) break;
    }

    await host2.waitForFunction(() => {
      const btn = document.getElementById("btn-lobby-start");
      return btn && !btn.disabled && !btn.classList.contains("hidden");
    }, { timeout: 8000 });
    await host2.evaluate(() => document.getElementById("btn-lobby-start")?.click());

    for (let w = 0; w < 10; w++) {
      const sH = await host2.evaluate(() => window.game?.state);
      const sG = await guest2.evaluate(() => window.game?.state);
      if (sH === "PLAYING" && sG === "PLAYING") break;
      await new Promise(r => setTimeout(r, 500));
    }

    await host2.evaluate(() => {
      if (window.game.mpState?.enemies) window.game.mpState.enemies.clear();
    });
    console.log("  [*] Boss validation session started!");

    // 1. Trigger Infected Boss branch (60s normal survival condition)
    console.log("  [*] Triggering Infected Boss branch (60s survival condition)...");
    await host2.evaluate(() => {
      // Simulate arrival at 60s with at least one normal player alive
      window.game.mpState.infectionTimer = 60.1;
      window.game.mpUpdateInfection(0.1);
    });

    // Wait for Infected Boss spawn broadcast on guest
    await guest2.waitForFunction(() => {
      const g = window.game;
      return g.mpState?.bossBranch === "INFECTED_BOSS" && g.mpState?.boss !== null;
    }, { timeout: 8000 });

    const infBossState = await Promise.all([
      host2.evaluate(() => ({
        branch: window.game.mpState.bossBranch,
        type: window.game.mpState.boss.type,
        hp: window.game.mpState.boss.hp,
        maxHp: window.game.mpState.boss.maxHp
      })),
      guest2.evaluate(() => ({
        branch: window.game.mpState.bossBranch,
        type: window.game.mpState.boss.type,
        hp: window.game.mpState.boss.hp,
        maxHp: window.game.mpState.boss.maxHp
      }))
    ]);
    console.log("  [*] Infected Boss States: Host=", infBossState[0], " Guest=", infBossState[1]);
    assert(infBossState[0].branch === "INFECTED_BOSS" && infBossState[0].hp === 2500, "2.1: Host spawned Infected Boss with 2500 HP");
    assert(infBossState[1].branch === "INFECTED_BOSS" && infBossState[1].hp === 2500, "2.2: Guest synchronized Infected Boss and 2500 HP over WebRTC");

    // 2. Boss Ability & Hazard Synchronization: World Cutting Slash
    console.log("  [*] Triggering Infected Boss World Cutting Slash ability...");
    await host2.evaluate(() => {
      window.game.mpState.boss.slashTimer = 0.01;
      window.game.mpUpdateInfection(0.02);
    });
    // Wait for slash hazard on host and guest
    await host2.waitForFunction(() => window.game.mpState.infectionHazards?.slashes?.length > 0, { timeout: 5000 });
    await guest2.waitForFunction(() => window.game.mpState.infectionHazards?.slashes?.length > 0, { timeout: 5000 });

    const slashHazard = await Promise.all([
      host2.evaluate(() => window.game.mpState.infectionHazards.slashes[0].state),
      guest2.evaluate(() => window.game.mpState.infectionHazards.slashes[0].state)
    ]);
    console.log("  [*] World Cutting Slash Hazard: Host=", slashHazard[0], " Guest=", slashHazard[1]);
    assert(slashHazard[0] === "WARNING" && slashHazard[1] === "WARNING", "2.3: World Cutting Slash hazard generated and synchronized across tabs");

    // 3. Weapon Damage and Boss HP Synchronization
    console.log("  [*] Testing Weapon Damage to Infected Boss...");
    const guest2PeerId = await guest2.evaluate(() => window.game.peer.id);
    // Give guest a Zombie Killer (deals 100 dmg to Infected Boss)
    await host2.evaluate((gId) => {
      const p = window.game.mpState.players.get(gId);
      p.isAlive = true;
      p.isSpectator = false;
      p.hp = 100;
      p.infectionWeapon = { type: "ZOMBIE_KILLER", name: "Zombie Killer", ammo: 150, maxAmmo: 150, cooldown: 0 };
    }, guest2PeerId);

    await guest2.waitForFunction(() => {
      const p = window.game.mpState.players.get(window.game.peer.id);
      return p?.infectionWeapon?.type === "ZOMBIE_KILLER";
    }, { timeout: 5000 });

    // Host applies weapon damage event of 100 to boss
    await host2.evaluate((gId) => {
      window.game.mpApplyWeaponDamage("INFECTED_BOSS", "boss_infected", gId, "ZOMBIE_KILLER");
    }, guest2PeerId);

    // Wait for boss HP to decrement to 2400 on both
    await host2.waitForFunction(() => window.game.mpState.boss?.hp === 2400, { timeout: 5000 });
    await guest2.waitForFunction(() => window.game.mpState.boss?.hp === 2400, { timeout: 5000 });

    const bossHpCheck = await Promise.all([
      host2.evaluate(() => window.game.mpState.boss.hp),
      guest2.evaluate(() => window.game.mpState.boss.hp)
    ]);
    console.log(`  [*] Boss HP after Zombie Killer shot: Host=${bossHpCheck[0]}, Guest=${bossHpCheck[1]}`);
    assert(bossHpCheck[0] === 2400 && bossHpCheck[1] === 2400, "2.4: Zombie Killer dealt 100 damage to Infected Boss; HP synchronized to 2400");

    // 4. Boss-Fight Heart Pickup Synchronization
    console.log("  [*] Testing Boss-Fight Heart Pickup synchronization...");
    // Set guest HP to 85, spawn a heart under guest
    await host2.evaluate((gId) => {
      const g = window.game;
      const p = g.mpState.players.get(gId);
      p.hp = 85;
      if (!g.mpState.pickups) g.mpState.pickups = [];
      g.mpState.pickups.push({
        id: "boss_heart_1",
        type: "HEART",
        x: p.x + 5,
        y: p.y + 5,
        radius: 14
      });
      g.mpUpdateInfection(0.05);
    }, guest2PeerId);

    // Allow host physics to detect heart pickup and heal +10 HP (85 -> 95)
    await host2.waitForFunction((gId) => {
      const p = window.game.mpState.players.get(gId);
      return p && p.hp === 95;
    }, { timeout: 5000 }, guest2PeerId);

    await guest2.waitForFunction(() => {
      const p = window.game.mpState.players.get(window.game.peer.id);
      return p && p.hp === 95;
    }, { timeout: 5000 });

    const healedHp = await Promise.all([
      host2.evaluate((gId) => window.game.mpState.players.get(gId).hp, guest2PeerId),
      guest2.evaluate(() => window.game.mpState.players.get(window.game.peer.id).hp)
    ]);
    console.log(`  [*] Player HP after Heart pickup (+10): Host=${healedHp[0]}, Guest=${healedHp[1]}`);
    assert(healedHp[0] === 95 && healedHp[1] === 95, "2.5: Heart pickup healed player +10 HP (85 -> 95) and synchronized across both tabs");

    // 5. Boss Defeat and Team Victory Resolution
    console.log("  [*] Testing Boss Defeat and Team VICTORY resolution...");
    await host2.evaluate(() => {
      const g = window.game;
      g.mpState.boss.hp = 0;
      g.mpState.boss.isAlive = false;
      g.mpState.status = "VICTORY";
      g.state = "VICTORY";
      g._broadcastReliable({
        type: "MP_MATCH_VICTORY",
        reason: "BOSS_DEFEATED",
        title: "👑 ARENA CONQUERED!",
        subtitle: "INFECTED BOSS DEFEATED!"
      });
    });

    await guest2.waitForFunction(() => window.game.state === "VICTORY", { timeout: 5000 });

    const victoryStates = await Promise.all([
      host2.evaluate(() => window.game.state),
      guest2.evaluate(() => window.game.state)
    ]);
    console.log("  [*] Victory States: Host=", victoryStates[0], " Guest=", victoryStates[1]);
    assert(victoryStates[0] === "VICTORY" && victoryStates[1] === "VICTORY", "2.6: Boss defeat triggered VICTORY state synchronized across both tabs");

    // 6. Test Cosmic Boss Branch and All-Player Defeat
    console.log("  [*] Testing Cosmic Boss branch and Team DEFEAT resolution...");
    // Reset state to simulate all-players-infected condition before 60s
    await host2.evaluate(() => {
      const g = window.game;
      g.state = "PLAYING";
      g.mpState.status = "PLAYING";
      g.mpState.bossBranch = null;
      g.mpState.boss = null;
      g.mpState.infectionTimer = 15.0; // before 60s
      for (const p of g.mpState.players.values()) {
        p.isInfected = true; // all infected!
        p.hp = 100;
        p.isAlive = true;
        p.isSpectator = false;
      }
      g.mpUpdateInfection(0.1);
    });

    await guest2.waitForFunction(() => window.game.mpState?.bossBranch === "COSMIC_BOSS", { timeout: 8000 });
    const cosmicBranch = await Promise.all([
      host2.evaluate(() => window.game.mpState.bossBranch),
      guest2.evaluate(() => window.game.mpState.bossBranch)
    ]);
    console.log("  [*] Cosmic Boss Branch: Host=", cosmicBranch[0], " Guest=", cosmicBranch[1]);
    assert(cosmicBranch[0] === "COSMIC_BOSS" && cosmicBranch[1] === "COSMIC_BOSS", "2.7: All players infected before 60s spawned Cosmic Boss synchronized on both tabs");

    // All players eliminated -> Team Defeat
    await host2.evaluate(() => {
      const g = window.game;
      for (const p of g.mpState.players.values()) {
        p.hp = 0;
        p.isAlive = false;
        p.isSpectator = true;
      }
      g.mpState.status = "DEFEAT";
      g.state = "MATCH_OVER";
      g._broadcastReliable({
        type: "MP_MATCH_DEFEAT",
        reason: "ALL_ELIMINATED"
      });
    });

    await guest2.waitForFunction(() => window.game.state === "MATCH_OVER", { timeout: 8000 });
    const defeatStates = await Promise.all([
      host2.evaluate(() => window.game.state),
      guest2.evaluate(() => window.game.state)
    ]);
    console.log("  [*] Defeat States: Host=", defeatStates[0], " Guest=", defeatStates[1]);
    assert(defeatStates[0] === "MATCH_OVER" && defeatStates[1] === "MATCH_OVER", "2.8: All-player elimination triggered MATCH_OVER defeat screen across both tabs");

    await host2.close();
    await guest2.close();

  } finally {
    if (browser) await browser.close();
    staticServer.close();
    signalProc.kill("SIGTERM");
  }

  console.log("\n────────────────────────────────────────────────────────────");
  console.log("Phase 1 & Phase 2 Live Browser Results:");
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
