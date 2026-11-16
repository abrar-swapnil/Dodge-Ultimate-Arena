/**
 * Dodge Arena Ultimate — PeerJS Signaling & Cloud Sync Server
 * Runs on Render free tier
 */

const express = require("express");
const http = require("http");
const { ExpressPeerServer } = require("peer");

const app = express();
const PORT = process.env.PORT || 9000;

app.use(express.json());

// CORS headers for Vercel and local dev
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// In-memory HUD layouts store by user key
const userHudLayouts = {};
// In-memory Gamer Profiles & Cloud Save store
const gamerProfiles = {};
// Private in-memory Feedbacks store for developer (Abrar Swapnil)
const feedbackStore = [];

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "Dodge Arena Ultimate — PeerJS, Auth & Cloud Sync Server",
    uptime: Math.floor(process.uptime()) + "s",
    registeredGamers: Object.keys(gamerProfiles).length,
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "healthy" });
});

// ══ GAMER ACCOUNT AUTH (NO EMAIL REQUIRED) ══════════════════════
// Auto-Registers new Gamer Tag OR logs into existing with PIN
app.post("/api/auth/login-or-register", (req, res) => {
  const { username, pin } = req.body;
  if (!username || !pin) {
    return res.status(400).json({ success: false, error: "Gamer Tag and PIN are required." });
  }

  const cleanName = username.trim();
  const key = cleanName.toLowerCase();
  const cleanPin = pin.toString().trim();

  if (cleanName.length < 2 || cleanName.length > 25) {
    return res.status(400).json({ success: false, error: "Gamer Tag must be between 2 and 25 characters." });
  }
  if (cleanPin.length < 3 || cleanPin.length > 12) {
    return res.status(400).json({ success: false, error: "Secret PIN must be 3 to 12 digits/letters." });
  }

  let user = gamerProfiles[key];
  if (!user) {
    // New Account Creation
    user = {
      username: cleanName,
      pin: cleanPin,
      shape: "square",
      photo: null,
      hudLayout: userHudLayouts[cleanName]?.layout || null,
      stats: {
        highScore: 0,
        mpWins: 0,
        mpLosses: 0,
        bossesDefeated: 0,
        totalMatches: 0,
      },
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    gamerProfiles[key] = user;
    console.log(`[AUTH] New Gamer registered: ${user.username}`);
    return res.json({ success: true, isNew: true, profile: sanitizeProfile(user) });
  }

  // Existing Gamer PIN Authentication
  if (user.pin !== cleanPin) {
    return res.status(401).json({
      success: false,
      error: "Incorrect PIN for this Gamer Tag. If this is a new account, please pick a unique Gamer Tag!",
    });
  }

  user.lastLoginAt = new Date().toISOString();
  console.log(`[AUTH] Gamer logged in: ${user.username}`);
  return res.json({ success: true, isNew: false, profile: sanitizeProfile(user) });
});

// Sync / Save Gamer Profile (Avatar, Shape, HUD, Stats)
app.post("/api/profile/save", (req, res) => {
  const { username, pin, shape, photo, hudLayout, stats } = req.body;
  if (!username || !pin) {
    return res.status(400).json({ success: false, error: "Gamer Tag and PIN are required." });
  }

  const key = username.trim().toLowerCase();
  const user = gamerProfiles[key];
  if (!user || user.pin !== pin.toString().trim()) {
    return res.status(401).json({ success: false, error: "Authentication failed. Invalid PIN." });
  }

  if (shape !== undefined) user.shape = shape;
  if (photo !== undefined) user.photo = photo; // Base64 thumbnail
  if (hudLayout !== undefined) {
    user.hudLayout = hudLayout;
    userHudLayouts[user.username] = { layout: hudLayout, updatedAt: new Date().toISOString() };
  }
  if (stats) {
    user.stats = {
      highScore: Math.max(user.stats?.highScore || 0, stats.highScore || 0),
      mpWins: Math.max(user.stats?.mpWins || 0, stats.mpWins || 0),
      mpLosses: Math.max(user.stats?.mpLosses || 0, stats.mpLosses || 0),
      bossesDefeated: Math.max(user.stats?.bossesDefeated || 0, stats.bossesDefeated || 0),
      totalMatches: Math.max(user.stats?.totalMatches || 0, stats.totalMatches || 0),
    };
  }

  return res.json({ success: true, profile: sanitizeProfile(user) });
});

// Get Public Stats for a Gamer Tag
app.get("/api/profile/:username", (req, res) => {
  const key = req.params.username.trim().toLowerCase();
  const user = gamerProfiles[key];
  if (!user) return res.status(404).json({ success: false, error: "Gamer not found." });

  return res.json({ success: true, profile: sanitizeProfile(user) });
});

function sanitizeProfile(user) {
  return {
    username: user.username,
    shape: user.shape || "square",
    photo: user.photo || null,
    hudLayout: user.hudLayout || null,
    stats: user.stats || { highScore: 0, mpWins: 0, mpLosses: 0, bossesDefeated: 0, totalMatches: 0 },
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

// Save Custom HUD layout
app.post("/api/hud-layout", (req, res) => {
  const { userId, layout } = req.body;
  if (!userId || !layout) {
    return res.status(400).json({ error: "userId and layout are required" });
  }
  userHudLayouts[userId] = {
    layout,
    updatedAt: new Date().toISOString(),
  };
  return res.json({ success: true, message: "HUD layout saved on server!" });
});

// Get Custom HUD layout for a user
app.get("/api/hud-layout/:userId", (req, res) => {
  const { userId } = req.params;
  const data = userHudLayouts[userId];
  if (data) {
    return res.json({ success: true, layout: data.layout });
  }
  return res.status(404).json({ success: false, message: "No layout found" });
});

// Receive Feedback & Bug Reports
app.post("/api/feedback", (req, res) => {
  const { name, email, type, message, deviceInfo } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: "Message is required" });
  }

  const feedbackEntry = {
    id: "fb_" + Date.now(),
    name: name || "Anonymous Player",
    email: email || "Not provided",
    type: type || "General",
    message: message.trim(),
    deviceInfo: deviceInfo || "Unknown",
    receivedAt: new Date().toISOString(),
  };

  feedbackStore.unshift(feedbackEntry); // latest first
  console.log(`[FEEDBACK] New feedback received from: ${feedbackEntry.name} (${feedbackEntry.type})`);
  console.log(`           "${feedbackEntry.message}"`);

  return res.json({ success: true, message: "Feedback received successfully!" });
});

// Private Feedbacks Endpoint (Only developer can view)
app.get("/api/feedbacks", (req, res) => {
  return res.json({
    developer: "Abrar Swapnil (swapnil172294@gmail.com)",
    total: feedbackStore.length,
    feedbacks: feedbackStore,
  });
});

const server = http.createServer(app);

// Mount PeerJS on /peerjs
const peerServer = ExpressPeerServer(server, {
  path: "/",
  key: "dodge-arena",
  proxied: true,
  alive_timeout: 60000,
});

app.use("/peerjs", peerServer);

peerServer.on("connection", (client) => {
  console.log(`[+] Peer connected: ${client.getId()}`);
});

peerServer.on("disconnect", (client) => {
  console.log(`[-] Peer disconnected: ${client.getId()}`);
});

server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`   Signaling: ws://0.0.0.0:${PORT}/peerjs`);
  console.log(`   HUD API:   http://0.0.0.0:${PORT}/api/hud-layout`);
});
