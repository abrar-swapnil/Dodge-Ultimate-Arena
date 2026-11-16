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

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "Dodge Arena Ultimate — PeerJS & HUD Cloud Sync Server",
    uptime: Math.floor(process.uptime()) + "s",
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "healthy" });
});

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
