/**
 * test_room_api.js — Room API & Signaling Server Automated Tests
 * Tests all room lifecycle endpoints on server.js:
 * 1. Room creation (POST /api/rooms/create)
 * 2. Room lookup (GET /api/rooms/:code)
 * 3. Guest join & max capacity 8 enforcement (POST /api/rooms/join)
 * 4. Ready state toggling (POST /api/rooms/ready)
 * 5. Host start validation (min 2 players, all ready, mode selection)
 * 6. Guest leave & host leave cleanup (POST /api/rooms/leave)
 */

"use strict";

const http = require("http");
const { spawn } = require("child_process");
const path = require("path");

console.log("=================================================");
console.log("     MULTIPLAYER ROOM API AUTOMATED TESTS        ");
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

const TEST_PORT = 9188;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

function request(method, pathName, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(`${BASE_URL}${pathName}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {})
      }
    }, (res) => {
      let chunks = "";
      res.on("data", chunk => chunks += chunk);
      res.on("end", () => {
        try {
          const json = chunks ? JSON.parse(chunks) : {};
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, body: chunks });
        }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runTests() {
  const serverProc = spawn("node", [path.join(__dirname, "..", "server.js")], {
    env: { ...process.env, PORT: String(TEST_PORT) },
    stdio: "pipe"
  });

  serverProc.stdout.on("data", (d) => {
    // console.log("[server stdout]", d.toString());
  });
  serverProc.stderr.on("data", (d) => {
    console.error("[server stderr]", d.toString());
  });

  // Wait for server to start
  await new Promise((resolve) => setTimeout(resolve, 2000));

  try {
    // ── Suite 1: Room Creation ───────────────────────────────────────
    console.log("\n── Suite 1: Room Creation (POST /api/rooms/create) ───────────────");
    const createRes = await request("POST", "/api/rooms/create", {
      peerId: "host-peer-1",
      name: "Commander Host",
      shape: "square"
    });

    assertEqual(createRes.status, 200, "1a: HTTP 200 on room create");
    assertEqual(createRes.body.success, true, "1b: Success flag is true");
    assert(typeof createRes.body.roomCode === "string" && createRes.body.roomCode.length === 6, "1c: Valid 6-char roomCode returned");
    assertEqual(createRes.body.playerCount, 1, "1d: Initial playerCount is 1");
    assertEqual(createRes.body.maxPlayers, 8, "1e: maxPlayers is 8 per GDD");

    const roomCode = createRes.body.roomCode;

    // ── Suite 2: Room Lookup ─────────────────────────────────────────
    console.log("\n── Suite 2: Room Lookup (GET /api/rooms/:code) ───────────────────");
    const getRes = await request("GET", `/api/rooms/${roomCode}`);
    assertEqual(getRes.status, 200, "2a: HTTP 200 on room lookup");
    assertEqual(getRes.body.hostPeerId, "host-peer-1", "2b: Host peerId matches creator");
    assertEqual(getRes.body.mode, "ELITE", "2c: Default mode is ELITE");
    assertEqual(getRes.body.status, "LOBBY", "2d: Room status is LOBBY");
    assertEqual(getRes.body.players.length, 1, "2e: Exactly 1 player listed");

    // ── Suite 3: Player Joins & Capacity Limit ───────────────────────
    console.log("\n── Suite 3: Player Joins & 8-Player Cap (POST /api/rooms/join) ───");
    const joinRes = await request("POST", "/api/rooms/join", {
      roomCode,
      peerId: "guest-peer-2",
      name: "Player Two",
      shape: "circle"
    });
    assertEqual(joinRes.status, 200, "3a: HTTP 200 on guest join");
    assertEqual(joinRes.body.players.length, 2, "3b: Room now has 2 players");

    // Join 6 more players (to reach 8 players)
    for (let i = 3; i <= 8; i++) {
      const jRes = await request("POST", "/api/rooms/join", {
        roomCode,
        peerId: `guest-peer-${i}`,
        name: `Player ${i}`,
        shape: "triangle"
      });
      assertEqual(jRes.status, 200, `3c: Player ${i} joined successfully`);
    }

    // 9th player join must be rejected (max 8)
    const join9Res = await request("POST", "/api/rooms/join", {
      roomCode,
      peerId: "guest-peer-9",
      name: "Player Nine",
      shape: "star"
    });
    assertEqual(join9Res.status, 403, "3d: GDD exact: 9th player rejected with 403 Room is full");
    assert(join9Res.body.error.includes("full"), "3e: Error message indicates room is full");

    // ── Suite 4: Ready State Toggling ────────────────────────────────
    console.log("\n── Suite 4: Ready States (POST /api/rooms/ready) ─────────────────");
    // Non-member cannot toggle ready
    const rogueReady = await request("POST", "/api/rooms/ready", {
      roomCode,
      peerId: "outsider-peer",
      isReady: true
    });
    assertEqual(rogueReady.status, 403, "4a: Outsider cannot toggle ready in room");

    // Guest sets ready
    const readyRes = await request("POST", "/api/rooms/ready", {
      roomCode,
      peerId: "guest-peer-2",
      isReady: true
    });
    assertEqual(readyRes.status, 200, "4b: Guest 2 successfully set ready state");

    // ── Suite 5: Match Start Validation ──────────────────────────────
    console.log("\n── Suite 5: Match Start Validation (POST /api/rooms/start) ───────");
    // Guest cannot start match
    const guestStart = await request("POST", "/api/rooms/start", {
      roomCode,
      peerId: "guest-peer-2",
      mode: "INFECTION"
    });
    assertEqual(guestStart.status, 403, "5a: Non-host cannot start match");

    // Host cannot start while some players are unready
    const unreadyStart = await request("POST", "/api/rooms/start", {
      roomCode,
      peerId: "host-peer-1",
      mode: "INFECTION"
    });
    assertEqual(unreadyStart.status, 400, "5b: Cannot start match when players are not all ready");

    // Set remaining players to ready
    for (let i = 3; i <= 8; i++) {
      await request("POST", "/api/rooms/ready", {
        roomCode,
        peerId: `guest-peer-${i}`,
        isReady: true
      });
    }

    // Host starts match in INFECTION mode
    const startRes = await request("POST", "/api/rooms/start", {
      roomCode,
      peerId: "host-peer-1",
      mode: "INFECTION"
    });
    assertEqual(startRes.status, 200, "5c: Host successfully started match");
    assertEqual(startRes.body.mode, "INFECTION", "5d: Mode verified as INFECTION");

    // Joining match in progress must be rejected
    const joinLateRes = await request("POST", "/api/rooms/join", {
      roomCode,
      peerId: "late-guest",
      name: "Late Player"
    });
    assertEqual(joinLateRes.status, 403, "5e: Cannot join match in progress");

    // ── Suite 6: Disconnect & Leave Cleanup ───────────────────────────
    console.log("\n── Suite 6: Disconnect & Leave Cleanup (POST /api/rooms/leave) ───");
    const leaveGuestRes = await request("POST", "/api/rooms/leave", {
      roomCode,
      peerId: "guest-peer-8"
    });
    assertEqual(leaveGuestRes.status, 200, "6a: Guest leave returns 200");
    assertEqual(leaveGuestRes.body.playerCount, 7, "6b: Remaining player count is 7");

    // Host leaves -> room destroyed
    const leaveHostRes = await request("POST", "/api/rooms/leave", {
      roomCode,
      peerId: "host-peer-1"
    });
    assertEqual(leaveHostRes.status, 200, "6c: Host leave returns 200");
    assertEqual(leaveHostRes.body.roomDestroyed, true, "6d: Room destroyed when host leaves");

    // Room lookup now returns 404
    const deadRoomRes = await request("GET", `/api/rooms/${roomCode}`);
    assertEqual(deadRoomRes.status, 404, "6e: Destroyed room returns 404 Not Found");

  } finally {
    serverProc.kill("SIGTERM");
  }

  console.log("\n────────────────────────────────────────────────────────────");
  console.log("Room API Automated Test Results:");
  console.log(`  PASSED: ${passed}`);
  console.log(`  FAILED: ${failed}`);
  console.log(`  TOTAL:  ${passed + failed}`);
  console.log("────────────────────────────────────────────────────────────");

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
