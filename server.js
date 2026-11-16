/**
 * Dodge Arena Ultimate — PeerJS Signaling Server
 * Runs on Render free tier
 */

const { PeerServer } = require("peer");

const PORT = process.env.PORT || 9000;

const peerServer = PeerServer({
  port: PORT,
  path: "/peerjs",
  key: "dodge-arena",
  proxied: true,
  alive_timeout: 60000,
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

console.log(`✅ PeerJS server running on port ${PORT}`);
