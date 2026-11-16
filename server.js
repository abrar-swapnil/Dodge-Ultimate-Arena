/**
 * Dodge Arena Ultimate — PeerJS Signaling & Cloud Sync Server
 * Runs on Render free tier
 */

const express = require("express");
const http = require("http");
const fs = require("fs");
const path = require("path");
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
// Gamer Profiles & Cloud Save store
const gamerProfiles = {};
// Private in-memory Feedbacks store for developer (Abrar Swapnil)
const feedbackStore = [];

// Disk persistence for profiles
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "gamer_profiles.json");

function loadProfilesFromDisk() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf8");
      const loaded = JSON.parse(raw);
      if (loaded && typeof loaded === "object") {
        Object.assign(gamerProfiles, loaded);
        console.log(`[STORAGE] Restored ${Object.keys(loaded).length} profiles from disk`);
      }
    }
  } catch (err) {
    console.error("[STORAGE] Failed to load gamer_profiles.json:", err.message);
  }
}

function saveProfilesToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(gamerProfiles, null, 2), "utf8");
  } catch (err) {
    console.error("[STORAGE] Failed to save gamer_profiles.json:", err.message);
  }
}

// Load on startup
loadProfilesFromDisk();

function generateSuggestions(username) {
  const base = username.replace(/[^a-zA-Z0-9]/g, "");
  const candidates = [
    `${base}_${Math.floor(10 + Math.random() * 89)}`,
    `${base}_pro`,
    `${base}_arena`,
    `${base}_${Math.floor(100 + Math.random() * 899)}`,
    `the_${base}`,
    `${base}99`,
    `${base}_hero`,
  ];
  const available = candidates.filter(name => !gamerProfiles[name.toLowerCase()]);
  return available.slice(0, 3);
}

function isPinInUse(pin, excludeUsernameKey) {
  return Object.keys(gamerProfiles).some(k => {
    if (excludeUsernameKey && k === excludeUsernameKey) return false;
    return gamerProfiles[k].pin === pin;
  });
}

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "Dodgy The Unstoppable — PeerJS, Auth & Cloud Sync Server",
    uptime: Math.floor(process.uptime()) + "s",
    registeredGamers: Object.keys(gamerProfiles).length,
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "healthy" });
});

// ══ GAMER ACCOUNT AUTH (NO EMAIL REQUIRED) ══════════════════════

// 1. REGISTER: Create a brand new unique Gamer Tag & unique Secret PIN
app.post("/api/auth/register", (req, res) => {
  const { username, pin, clientBackup } = req.body;
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

  // If user already exists:
  if (gamerProfiles[key]) {
    // If the PIN matches, this is the owner logging in through register form!
    if (gamerProfiles[key].pin === cleanPin) {
      gamerProfiles[key].lastLoginAt = new Date().toISOString();
      saveProfilesToDisk();
      return res.json({ success: true, isNew: false, profile: sanitizeProfile(gamerProfiles[key]) });
    }
    const suggestions = generateSuggestions(cleanName);
    return res.status(409).json({
      success: false,
      error: `Gamer Tag '${cleanName}' is already taken!`,
      suggestions,
    });
  }

  // Auto-Healing on register: If account was created locally or in client vault
  if (clientBackup && clientBackup.username && clientBackup.pin) {
    const backupPin = clientBackup.pin.toString().trim();
    if (backupPin === cleanPin && clientBackup.username.toLowerCase() === key) {
      console.log(`[AUTH] Auto-Healing on Register: Restoring profile for '${cleanName}'.`);
      const restoredUser = {
        username: cleanName,
        pin: cleanPin,
        shape: clientBackup.shape || "square",
        photo: clientBackup.photo || null,
        hudLayout: clientBackup.hudLayout || null,
        stats: {
          highScore: clientBackup.stats?.highScore || 0,
          mpWins: clientBackup.stats?.mpWins || 0,
          mpLosses: clientBackup.stats?.mpLosses || 0,
          bossesDefeated: clientBackup.stats?.bossesDefeated || 0,
          totalMatches: clientBackup.stats?.totalMatches || 0,
          soloMaxLevel: clientBackup.stats?.soloMaxLevel || 1,
          mpMaxLevel: clientBackup.stats?.mpMaxLevel || 1,
        },
        createdAt: clientBackup.createdAt || new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };
      gamerProfiles[key] = restoredUser;
      saveProfilesToDisk();
      return res.json({ success: true, isNew: false, restored: true, profile: sanitizeProfile(restoredUser) });
    }
  }

  // Check 2: Secret PIN must be unique across all players
  if (isPinInUse(cleanPin, key)) {
    return res.status(409).json({
      success: false,
      error: "This secret PIN is already in use by another gamer! For your account security, please pick a unique PIN.",
    });
  }

  // Create new profile
  const user = {
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
      soloMaxLevel: 1,
      mpMaxLevel: 1,
    },
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };

  gamerProfiles[key] = user;
  saveProfilesToDisk();
  console.log(`[AUTH] New Gamer registered: ${user.username}`);
  return res.json({ success: true, isNew: true, profile: sanitizeProfile(user) });
});

// 2. LOGIN: Authenticate existing Gamer Tag with Secret PIN
app.post("/api/auth/login", (req, res) => {
  const { username, pin, clientBackup } = req.body;
  if (!username || !pin) {
    return res.status(400).json({ success: false, error: "Gamer Tag and PIN are required." });
  }

  const cleanName = username.trim();
  const key = cleanName.toLowerCase();
  const cleanPin = pin.toString().trim();

  let user = gamerProfiles[key];

  // Auto-Healing: If user is missing from server (e.g. after fresh container deploy),
  // but client provided a verified local backup with matching PIN, auto-restore the account!
  if (!user && clientBackup && clientBackup.username && clientBackup.pin) {
    const backupPin = clientBackup.pin.toString().trim();
    if (backupPin === cleanPin && clientBackup.username.toLowerCase() === key) {
      console.log(`[AUTH] Auto-Healing: Restoring profile for '${cleanName}' from client backup after server redeploy.`);
      user = {
        username: cleanName,
        pin: cleanPin,
        shape: clientBackup.shape || "square",
        photo: clientBackup.photo || null,
        hudLayout: clientBackup.hudLayout || null,
        stats: {
          highScore: clientBackup.stats?.highScore || 0,
          mpWins: clientBackup.stats?.mpWins || 0,
          mpLosses: clientBackup.stats?.mpLosses || 0,
          bossesDefeated: clientBackup.stats?.bossesDefeated || 0,
          totalMatches: clientBackup.stats?.totalMatches || 0,
          soloMaxLevel: clientBackup.stats?.soloMaxLevel || 1,
          mpMaxLevel: clientBackup.stats?.mpMaxLevel || 1,
        },
        createdAt: clientBackup.createdAt || new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };
      gamerProfiles[key] = user;
      saveProfilesToDisk();
      return res.json({ success: true, isNew: false, restored: true, profile: sanitizeProfile(user) });
    }
  }

  if (!user) {
    return res.status(404).json({
      success: false,
      error: `No account found with Gamer Tag '${cleanName}'. Switch to 'Create Account' if you are new!`,
    });
  }

  if (user.pin !== cleanPin) {
    return res.status(401).json({
      success: false,
      error: `Incorrect PIN for Gamer Tag '${cleanName}'.`,
    });
  }

  user.lastLoginAt = new Date().toISOString();
  saveProfilesToDisk();
  console.log(`[AUTH] Gamer logged in: ${user.username}`);
  return res.json({ success: true, isNew: false, profile: sanitizeProfile(user) });
});

// 3. Combined / Legacy Endpoint
app.post("/api/auth/login-or-register", (req, res) => {
  const { action } = req.body;
  if (action === "register") {
    return app._router.handle({ ...req, url: "/api/auth/register", method: "POST" }, res);
  }
  if (action === "login") {
    return app._router.handle({ ...req, url: "/api/auth/login", method: "POST" }, res);
  }

  // Default fallback behavior:
  const { username, pin } = req.body;
  if (!username || !pin) {
    return res.status(400).json({ success: false, error: "Gamer Tag and PIN are required." });
  }

  const cleanName = username.trim();
  const key = cleanName.toLowerCase();
  const cleanPin = pin.toString().trim();

  let user = gamerProfiles[key];
  if (!user) {
    // Check PIN uniqueness before creating
    if (isPinInUse(cleanPin)) {
      return res.status(409).json({
        success: false,
        error: "This secret PIN is already in use by another gamer! Please pick a unique PIN.",
      });
    }

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
        soloMaxLevel: 1,
        mpMaxLevel: 1,
      },
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    gamerProfiles[key] = user;
    saveProfilesToDisk();
    return res.json({ success: true, isNew: true, profile: sanitizeProfile(user) });
  }

  if (user.pin !== cleanPin) {
    return res.status(401).json({
      success: false,
      error: `Incorrect PIN for Gamer Tag '${cleanName}'.`,
    });
  }

  user.lastLoginAt = new Date().toISOString();
  saveProfilesToDisk();
  return res.json({ success: true, isNew: false, profile: sanitizeProfile(user) });
});

// Sync / Save Gamer Profile (Avatar, Shape, HUD, Stats)
app.post("/api/profile/save", (req, res) => {
  const { username, pin, shape, photo, hudLayout, stats } = req.body;
  if (!username || !pin) {
    return res.status(400).json({ success: false, error: "Gamer Tag and PIN are required." });
  }

  const cleanName = username.trim();
  const key = cleanName.toLowerCase();
  const cleanPin = pin.toString().trim();
  let user = gamerProfiles[key];

  // Auto-Healing: If user is missing from server (e.g. after fresh container deploy),
  // recreate from sync payload
  if (!user) {
    console.log(`[AUTH] Auto-Healing on profile save: Restoring profile for '${cleanName}'.`);
    user = {
      username: cleanName,
      pin: cleanPin,
      shape: shape || "square",
      photo: photo || null,
      hudLayout: hudLayout || null,
      stats: {
        highScore: stats?.highScore || 0,
        mpWins: stats?.mpWins || 0,
        mpLosses: stats?.mpLosses || 0,
        bossesDefeated: stats?.bossesDefeated || 0,
        totalMatches: stats?.totalMatches || 0,
        soloMaxLevel: stats?.soloMaxLevel || 1,
        mpMaxLevel: stats?.mpMaxLevel || 1,
      },
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    gamerProfiles[key] = user;
    if (hudLayout) {
      userHudLayouts[cleanName] = { layout: hudLayout, updatedAt: new Date().toISOString() };
    }
    saveProfilesToDisk();
    return res.json({ success: true, restored: true, profile: sanitizeProfile(user) });
  }

  if (user.pin !== cleanPin) {
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
      soloMaxLevel: Math.max(user.stats?.soloMaxLevel || 1, stats.soloMaxLevel || 1),
      mpMaxLevel: Math.max(user.stats?.mpMaxLevel || 1, stats.mpMaxLevel || 1),
    };
  }

  saveProfilesToDisk();
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
    stats: user.stats || {
      highScore: 0,
      mpWins: 0,
      mpLosses: 0,
      bossesDefeated: 0,
      totalMatches: 0,
      soloMaxLevel: 1,
      mpMaxLevel: 1,
    },
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
