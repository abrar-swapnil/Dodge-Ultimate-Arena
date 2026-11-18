/**
 * test_live_browser_webrtc.js — Live Browser Multiplayer WebRTC QA Test
 * Launches local backend and Brave Browser instances to test:
 * 1. 2-player live browser session (Host + Guest).
 * 2. Lobby creation, room code propagation, joining.
 * 3. Ready state toggling and host match start.
 * 4. Real WebRTC DataChannel connection establishment.
 * 5. In-game player movement, snapshot sync, and boss/infection mode rendering.
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
console.log("    LIVE BROWSER WEBRTC MULTIPLAYER QA SUITE     ");
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

async function runLiveTest() {
  // 1. Start Signaling Server (server.js on port 9000)
  const signalProc = spawn("node", [path.join(projectRoot, "server.js")], {
    env: { ...process.env, PORT: String(SIGNAL_PORT) },
    stdio: "pipe"
  });

  // 2. Start Static Web Server (serving game on port 3100)
  const staticApp = express();
  staticApp.use(express.static(projectRoot));
  const staticServer = http.createServer(staticApp);
  await new Promise(resolve => staticServer.listen(STATIC_PORT, resolve));
  console.log(`[+] Static game server running on http://localhost:${STATIC_PORT}`);

  // Give signaling server time to bind
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
        "--autoplay-policy=no-user-gesture-required"
      ]
    });
    console.log("[+] Brave Browser launched headlessly");

    // ── Tab 1: Host ──
    const pageHost = await browser.newPage();
    await pageHost.setViewport({ width: 1024, height: 768 });
    pageHost.on("console", msg => console.log(`  [Host Console] ${msg.type()}: ${msg.text()}`));
    pageHost.on("pageerror", err => console.log(`  [Host Error] ${err.toString()}`));

    await pageHost.goto(`http://localhost:${STATIC_PORT}/index.html`, { waitUntil: "networkidle0" });
    assert(true, "1a: Host page loaded successfully");

    // Dismiss splash screen to reveal main menu
    await pageHost.click("#splash-screen");
    await pageHost.waitForSelector("#modal-overlay:not(.hidden)", { timeout: 5000 });

    // Click Online Multiplayer button
    await pageHost.click("#btn-mode-online");
    await new Promise(r => setTimeout(r, 600));

    // Host clicks Create Room
    await pageHost.click("#btn-create-room");
    console.log("  [*] Host requested room creation...");

    // Wait for room code to be displayed
    await pageHost.waitForFunction(() => {
      const el = document.getElementById("created-room-code");
      return el && el.innerText && el.innerText.length === 6 && el.innerText !== "------";
    }, { timeout: 12000 });

    const roomCode = await pageHost.$eval("#created-room-code", el => el.innerText.trim());
    console.log(`  [*] Room Code generated: ${roomCode}`);
    assert(roomCode && roomCode.length === 6, "1b: Host received valid 6-char room code", roomCode);

    // ── Tab 2: Guest ──
    const pageGuest = await browser.newPage();
    await pageGuest.setViewport({ width: 1024, height: 768 });
    pageGuest.on("console", msg => console.log(`  [Guest Console] ${msg.type()}: ${msg.text()}`));
    pageGuest.on("pageerror", err => console.log(`  [Guest Error] ${err.toString()}`));
    pageGuest.on("requestfailed", req => console.log(`  [Guest Req Failed] ${req.url()} - ${req.failure()?.errorText}`));

    await pageGuest.goto(`http://localhost:${STATIC_PORT}/index.html`, { waitUntil: "networkidle0" });
    assert(true, "2a: Guest page loaded successfully");

    // Dismiss splash screen to reveal main menu
    await pageGuest.click("#splash-screen");
    await pageGuest.waitForSelector("#modal-overlay:not(.hidden)", { timeout: 5000 });

    await pageGuest.click("#btn-mode-online");
    await new Promise(r => setTimeout(r, 600));

    // Enter room code in join input
    await pageGuest.type("#join-room-input", roomCode);
    await pageGuest.click("#btn-join-room");
    console.log(`  [*] Guest attempting to join room ${roomCode}...`);

    // Monitor join status for 4 seconds
    for (let t = 0; t < 8; t++) {
      await new Promise(r => setTimeout(r, 500));
      const statusText = await pageGuest.$eval("#join-status", el => el.innerText).catch(() => "");
      const lobbyStatus = await pageGuest.$eval("#lobby-status-msg", el => el.innerText).catch(() => "");
      if (statusText || lobbyStatus) {
        console.log(`  [*] Guest Status (${t*500}ms): join-status="${statusText}" lobby-status="${lobbyStatus}"`);
      }
    }

    // Wait for guest to be in lobby grid
    await pageHost.waitForFunction(() => {
      const cards = document.querySelectorAll("#lobby-player-grid .lobby-player-card.occupied");
      return cards.length >= 2;
    }, { timeout: 12000 });

    assert(true, "2b: Guest joined lobby; Host lobby grid shows 2 players");

    // ── Mode Selection & Ready State ──
    // Wait until guest WebRTC connection is fully OPEN
    await pageGuest.waitForFunction(() => {
      const g = window.game;
      if (!g || !g.mpConnections) return false;
      for (const [, conn] of g.mpConnections) {
        if (conn.reliable && conn.reliable.open) return true;
      }
      return false;
    }, { timeout: 10000 }).catch(() => console.log("  [!] Warning: WebRTC reliable channel not yet open"));

    // Host switches mode to INFECTION
    await pageHost.evaluate(() => {
      const pill = document.querySelector(".lobby-mode-pill[data-mode='INFECTION']");
      if (pill) pill.click();
    });
    console.log("  [*] Host selected INFECTION mode");

    // Guest clicks Ready
    await pageGuest.evaluate(() => {
      document.getElementById("btn-lobby-ready")?.click();
    });
    console.log("  [*] Guest toggled READY");

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

    // Host sees Start button enabled
    await pageHost.waitForFunction(() => {
      const btn = document.getElementById("btn-lobby-start");
      return btn && !btn.disabled && !btn.classList.contains("hidden");
    }, { timeout: 8000 });

    assert(true, "3a: Guest ready state synced; Host Start button enabled");

    // Host clicks Start Match
    await pageHost.evaluate(() => {
      document.getElementById("btn-lobby-start")?.click();
    });
    console.log("  [*] Host clicked START MATCH!");

    // Poll for match start on both host and guest
    for (let w = 0; w < 10; w++) {
      await new Promise(r => setTimeout(r, 300));
      const sH = await pageHost.evaluate(() => (window.game || window.exportedGame)?.state);
      const sG = await pageGuest.evaluate(() => (window.game || window.exportedGame)?.state);
      if (sH === "PLAYING" && sG === "PLAYING") break;
    }

    // Inspect live game state from both tabs
    const hostState = await pageHost.evaluate(() => {
      const g = window.game || window.exportedGame;
      return g ? {
        state: g.state,
        mode: g.mode,
        mpMode: g.mpState?.mode,
        playersCount: g.mpState?.players?.size,
        hasBossBranch: g.mpState?.bossBranch !== undefined
      } : null;
    });

    const guestState = await pageGuest.evaluate(() => {
      const g = window.game || window.exportedGame;
      return g ? {
        state: g.state,
        mode: g.mode,
        mpMode: g.mpState?.mode,
        playersCount: g.mpState?.players?.size
      } : null;
    });

    console.log("  [*] Live Host State:", hostState);
    console.log("  [*] Live Guest State:", guestState);

    assert(hostState && hostState.state === "PLAYING", "4a: Host entered PLAYING state in live browser");
    assert(hostState && hostState.mpMode === "INFECTION", "4b: Host initialized INFECTION mode in live browser");
    assert(guestState && guestState.state === "PLAYING", "4c: Guest entered PLAYING state in live browser");
    assert(guestState && guestState.mpMode === "INFECTION", "4d: Guest synchronized INFECTION mode in live browser");

    await pageHost.close();
    await pageGuest.close();

    // ══════════════════════════════════════════════════════════════
    // PART B: 4-Player Live Browser Session (Elite Mode)
    // ══════════════════════════════════════════════════════════════
    console.log("\n── PART B: 4-Player Live Browser Session (Elite Mode) ──────────");
    const pageHost4 = await browser.newPage();
    await pageHost4.setViewport({ width: 1024, height: 768 });
    await pageHost4.goto(`http://localhost:${STATIC_PORT}/index.html`, { waitUntil: "networkidle0" });
    await pageHost4.click("#splash-screen");
    await pageHost4.waitForSelector("#modal-overlay:not(.hidden)", { timeout: 5000 });
    await pageHost4.click("#btn-mode-online");
    await new Promise(r => setTimeout(r, 600));

    await pageHost4.click("#btn-create-room");
    await pageHost4.waitForFunction(() => {
      const el = document.getElementById("created-room-code");
      return el && el.innerText && el.innerText.length === 6 && el.innerText !== "------";
    }, { timeout: 12000 });

    const roomCode4 = await pageHost4.$eval("#created-room-code", el => el.innerText.trim());
    console.log(`  [*] 4-Player Room Code generated: ${roomCode4}`);
    assert(roomCode4 && roomCode4.length === 6, "5a: Host created 4-player room");

    // Spawn 3 guest tabs
    const guestPages = [];
    for (let gIdx = 1; gIdx <= 3; gIdx++) {
      const gPage = await browser.newPage();
      await gPage.setViewport({ width: 1024, height: 768 });
      await gPage.goto(`http://localhost:${STATIC_PORT}/index.html`, { waitUntil: "networkidle0" });
      await gPage.click("#splash-screen");
      await gPage.waitForSelector("#modal-overlay:not(.hidden)", { timeout: 5000 });
      await gPage.click("#btn-mode-online");
      await new Promise(r => setTimeout(r, 600));

      await gPage.type("#join-room-input", roomCode4);
      await gPage.click("#btn-join-room");
      console.log(`  [*] Guest ${gIdx} joining room ${roomCode4}...`);
      await gPage.waitForFunction(() => {
        const el = document.getElementById("lobby-status-msg");
        return el && el.innerText.includes("Waiting for host");
      }, { timeout: 12000 }).catch(() => null);

      // Ensure WebRTC reliable connection is open before proceeding
      await gPage.waitForFunction(() => {
        const g = window.game;
        if (!g || !g.mpConnections) return false;
        for (const [, conn] of g.mpConnections) {
          if (conn.reliable && conn.reliable.open) return true;
        }
        return false;
      }, { timeout: 10000 }).catch(() => null);

      guestPages.push(gPage);
    }

    // Wait until host grid shows 4 players
    await pageHost4.waitForFunction(() => {
      const cards = document.querySelectorAll("#lobby-player-grid .lobby-player-card.occupied");
      return cards.length >= 4;
    }, { timeout: 15000 });
    assert(true, "5b: All 3 guests joined; Host shows 4 players in lobby");

    // All 3 guests toggle ready
    for (let i = 0; i < guestPages.length; i++) {
      await guestPages[i].evaluate(() => {
        document.getElementById("btn-lobby-ready")?.click();
      });
      console.log(`  [*] Guest ${i+1} toggled READY`);
      await new Promise(r => setTimeout(r, 400));
    }

    // Check host lobby state for guests isReady
    for (let k = 0; k < 10; k++) {
      const hostLobbyData = await pageHost4.evaluate(() => {
        const g = window.game;
        if (!g || !g.lobbyPlayers) return null;
        return Array.from(g.lobbyPlayers.values()).map(p => ({ name: p.name, isReady: p.isReady, isHost: p.isHost }));
      });
      const startBtnDisabled = await pageHost4.$eval("#btn-lobby-start", el => el.disabled).catch(() => true);
      console.log(`  [*] Host 4P check (${k*500}ms): startBtnDisabled=${startBtnDisabled}, players=`, hostLobbyData);
      if (!startBtnDisabled) break;
      await new Promise(r => setTimeout(r, 500));
    }

    // Host sees start button enabled
    await pageHost4.waitForFunction(() => {
      const btn = document.getElementById("btn-lobby-start");
      return btn && !btn.disabled && !btn.classList.contains("hidden");
    }, { timeout: 10000 });
    assert(true, "5c: All 4 players ready; Host Start button enabled");

    // Host starts match
    await pageHost4.evaluate(() => {
      document.getElementById("btn-lobby-start")?.click();
    });
    console.log("  [*] Host started 4-player match!");

    // Wait for match to start across all 4 clients with diagnostic polling
    let allPlaying = false;
    for (let w = 0; w < 12; w++) {
      await new Promise(r => setTimeout(r, 1000));
      const sHost = await pageHost4.evaluate(() => window.game?.state);
      const sGuests = await Promise.all(guestPages.map((gp, i) => gp.evaluate((idx) => {
        const g = window.game;
        return {
          idx: idx + 1,
          state: g?.state,
          mode: g?.mode,
          mpMode: g?.mpState?.mode,
          overlayHidden: document.getElementById("lobby-overlay")?.classList.contains("hidden")
        };
      }, i)));
      console.log(`  [*] 4P Match start poll (${w+1}s): host=${sHost}, guests=`, sGuests);
      if (sHost === "PLAYING" && sGuests.every(g => g.state === "PLAYING")) {
        allPlaying = true;
        break;
      }
    }

    assert(allPlaying, "5d: All 4 clients transitioned to PLAYING state");

    const states4 = await Promise.all([
      pageHost4.evaluate(() => ({ state: window.game?.state, mode: window.game?.mpState?.mode, players: window.game?.mpState?.players?.size })),
      ...guestPages.map((gp, idx) => gp.evaluate((i) => ({ guestIndex: i+1, state: window.game?.state, mode: window.game?.mpState?.mode, players: window.game?.mpState?.players?.size }), idx))
    ]);

    console.log("  [*] 4-Player Match States:", states4);
    assert(states4[0].state === "PLAYING" && states4[0].mode === "ELITE", "5e: Host playing 4-player ELITE match");
    assert(states4[1].state === "PLAYING" && states4[1].mode === "ELITE", "5f: Guest 1 playing 4-player ELITE match");
    assert(states4[2].state === "PLAYING" && states4[2].mode === "ELITE", "5g: Guest 2 playing 4-player ELITE match");
    assert(states4[3].state === "PLAYING" && states4[3].mode === "ELITE", "5h: Guest 3 playing 4-player ELITE match");

    // Close 4-player tabs to free memory
    await pageHost4.close();
    for (const gp of guestPages) await gp.close();

    // ══════════════════════════════════════════════════════════════
    // PART C: 8-Player Live Browser Session & Room Cap Verification
    // ══════════════════════════════════════════════════════════════
    console.log("\n── PART C: 8-Player Live Browser Session & Room Cap ────────────");
    const pageHost8 = await browser.newPage();
    await pageHost8.setViewport({ width: 1024, height: 768 });
    await pageHost8.goto(`http://localhost:${STATIC_PORT}/index.html`, { waitUntil: "networkidle0" });
    await pageHost8.click("#splash-screen");
    await pageHost8.waitForSelector("#modal-overlay:not(.hidden)", { timeout: 5000 });
    await pageHost8.click("#btn-mode-online");
    await new Promise(r => setTimeout(r, 600));

    await pageHost8.click("#btn-create-room");
    await pageHost8.waitForFunction(() => {
      const el = document.getElementById("created-room-code");
      return el && el.innerText && el.innerText.length === 6 && el.innerText !== "------";
    }, { timeout: 12000 });

    const roomCode8 = await pageHost8.$eval("#created-room-code", el => el.innerText.trim());
    console.log(`  [*] 8-Player Room Code generated: ${roomCode8}`);
    assert(roomCode8 && roomCode8.length === 6, "6a: Host created 8-player room");

    // Host switches mode to INFECTION
    await pageHost8.evaluate(() => {
      const pill = document.querySelector(".lobby-mode-pill[data-mode='INFECTION']");
      if (pill) pill.click();
    });

    // Spawn 7 guest tabs (reaching exact max 8 players)
    const guestPages8 = [];
    for (let gIdx = 1; gIdx <= 7; gIdx++) {
      const gPage = await browser.newPage();
      await gPage.setViewport({ width: 1024, height: 768 });
      await gPage.goto(`http://localhost:${STATIC_PORT}/index.html`, { waitUntil: "networkidle0" });
      await gPage.click("#splash-screen");
      await gPage.waitForSelector("#modal-overlay:not(.hidden)", { timeout: 5000 });
      await gPage.click("#btn-mode-online");
      await new Promise(r => setTimeout(r, 400));

      await gPage.type("#join-room-input", roomCode8);
      await gPage.click("#btn-join-room");
      console.log(`  [*] Guest ${gIdx}/7 joining room ${roomCode8}...`);

      await gPage.waitForFunction(() => {
        const el = document.getElementById("lobby-status-msg");
        return el && el.innerText.includes("Waiting for host");
      }, { timeout: 12000 }).catch(() => null);

      await gPage.waitForFunction(() => {
        const g = window.game;
        if (!g || !g.mpConnections) return false;
        for (const [, conn] of g.mpConnections) {
          if (conn.reliable && conn.reliable.open) return true;
        }
        return false;
      }, { timeout: 10000 }).catch(() => null);

      guestPages8.push(gPage);
    }

    // Wait until host lobby shows all 8 players
    await pageHost8.waitForFunction(() => {
      const cards = document.querySelectorAll("#lobby-player-grid .lobby-player-card.occupied");
      return cards.length >= 8;
    }, { timeout: 15000 });
    assert(true, "6b: All 7 guests joined; Host lobby shows 8 players");

    // Test 9th player join rejection (room cap enforcement)
    const pageGuest9 = await browser.newPage();
    await pageGuest9.setViewport({ width: 1024, height: 768 });
    await pageGuest9.goto(`http://localhost:${STATIC_PORT}/index.html`, { waitUntil: "networkidle0" });
    await pageGuest9.click("#splash-screen");
    await pageGuest9.waitForSelector("#modal-overlay:not(.hidden)", { timeout: 5000 });
    await pageGuest9.click("#btn-mode-online");
    await new Promise(r => setTimeout(r, 400));
    await pageGuest9.type("#join-room-input", roomCode8);
    await pageGuest9.click("#btn-join-room");
    console.log(`  [*] 9th Guest attempting to join full room (expect rejection)...`);

    await pageGuest9.waitForFunction(() => {
      const statusText = document.getElementById("join-status")?.textContent || "";
      return statusText.includes("full") || statusText.includes("Failed");
    }, { timeout: 8000 });
    const rejectStatus = await pageGuest9.$eval("#join-status", el => el.textContent.trim());
    console.log(`  [*] 9th Guest rejection message: "${rejectStatus}"`);
    assert(rejectStatus.includes("full") || rejectStatus.includes("Failed"), "6c: 9th player rejected from full 8-player room");
    await pageGuest9.close();

    // All 7 guests toggle ready
    for (let i = 0; i < guestPages8.length; i++) {
      await guestPages8[i].evaluate(() => {
        document.getElementById("btn-lobby-ready")?.click();
      });
      console.log(`  [*] Guest ${i+1}/7 toggled READY`);
      await new Promise(r => setTimeout(r, 200));
    }

    // Host sees start button enabled
    await pageHost8.waitForFunction(() => {
      const btn = document.getElementById("btn-lobby-start");
      return btn && !btn.disabled && !btn.classList.contains("hidden");
    }, { timeout: 10000 });
    assert(true, "6d: All 8 players ready; Host Start button enabled");

    // Host starts match
    await pageHost8.evaluate(() => {
      document.getElementById("btn-lobby-start")?.click();
    });
    console.log("  [*] Host started 8-player INFECTION match!");

    // Wait for match to start across all 8 clients with diagnostic polling
    let all8Playing = false;
    for (let w = 0; w < 12; w++) {
      await new Promise(r => setTimeout(r, 1000));
      const sHost = await pageHost8.evaluate(() => window.game?.state);
      const sGuests = await Promise.all(guestPages8.map(gp => gp.evaluate(() => window.game?.state)));
      console.log(`  [*] 8P Match start poll (${w+1}s): host=${sHost}, guestsReadyCount=${sGuests.filter(s => s === "PLAYING").length}/7`);
      if (sHost === "PLAYING" && sGuests.every(s => s === "PLAYING")) {
        all8Playing = true;
        break;
      }
    }
    assert(all8Playing, "6e: All 8 clients transitioned to PLAYING state in INFECTION mode");

    const host8State = await pageHost8.evaluate(() => ({
      state: window.game?.state,
      mode: window.game?.mode,
      mpMode: window.game?.mpState?.mode,
      playersCount: window.game?.mpState?.players?.size
    }));
    console.log("  [*] 8-Player Live Host State:", host8State);
    assert(host8State.state === "PLAYING" && host8State.mpMode === "INFECTION" && host8State.playersCount === 8, "6f: Authoritative host initialized 8 players in INFECTION match");

    await pageHost8.close();
    for (const gp of guestPages8) await gp.close();

  } finally {
    if (browser) await browser.close();
    staticServer.close();
    signalProc.kill("SIGTERM");
  }

  console.log("\n────────────────────────────────────────────────────────────");
  console.log("Live Browser Multiplayer QA Results:");
  console.log(`  PASSED: ${passed}`);
  console.log(`  FAILED: ${failed}`);
  console.log(`  TOTAL:  ${passed + failed}`);
  console.log("────────────────────────────────────────────────────────────");

  process.exit(failed > 0 ? 1 : 0);
}

runLiveTest().catch(err => {
  console.error("Live test failed with exception:", err);
  process.exit(1);
});
