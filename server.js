/**
 * Dodge Arena Ultimate — PeerJS Signaling Server
 * Deploy on Render (free tier) as a Node.js web service.
 * 
 * This server handles WebRTC peer discovery & room signaling only.
 * Actual game data travels P2P (browser-to-browser) via WebRTC DataChannel.
 */

const { PeerServer } = require("peer");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 9000;

// ── Health check endpoint (Render needs this to verify service is up) ──
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "Dodge Arena Ultimate — PeerJS Signaling Server",
    uptime: Math.floor(process.uptime()) + "s",
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "healthy" });
});

// ── PeerJS Server mounted at /peerjs path ──
const peerServer = PeerServer({
  port: PORT,
  path: "/peerjs",
  allow_discovery: false,          // don't expose peer list publicly
  proxied: true,                   // behind Render's reverse proxy
  alive_timeout: 60000,            // 60s keep-alive
  key: "dodge-arena",              // optional namespace key
  corsOptions: {
    origin: [
      "https://dodge-arena.vercel.app",   // your Vercel domain (update this!)
      "http://localhost:8080",             // local dev
      "http://localhost:3000",
      /\.vercel\.app$/,                   // any vercel preview deploy
    ],
    methods: ["GET", "POST"],
  },
});

peerServer.on("connection", (client) => {
  console.log(`[+] Peer connected: ${client.getId()}`);
});

peerServer.on("disconnect", (client) => {
  console.log(`[-] Peer disconnected: ${client.getId()}`);
});

console.log(`✅ Dodge Arena PeerJS server running on port ${PORT}`);
console.log(`   Signaling endpoint: ws://0.0.0.0:${PORT}/peerjs`);
