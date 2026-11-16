/**
 * Dodge Arena Ultimate — PeerJS Signaling Server
 * Deploy on Render (free tier) as a Node.js web service.
 */

const { PeerServer } = require("@peerjs/server");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 9000;

// Health check
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

// PeerJS Server
const peerServer = PeerServer({
  port: PORT,
  path: "/peerjs",
  proxied: true,
  key: "dodge-arena",
  corsOptions: {
    origin: "*",
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
