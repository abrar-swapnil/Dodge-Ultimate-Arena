# 🎮 Dodge Arena Ultimate

A browser-based arcade game with solo campaign, boss fights, and real-time multiplayer.

## Features
- **5 Difficulty Levels** — Normal → Medium → Hard → Ultra Hard → Extreme
- **Map Progression** — 4 maps unlocked by score (0 / 20 / 50 / 100 pts)
- **Boss Fight** — Giant boss with Titan Burst, minion swarms & 3 Emergency Dodges
- **Level System** — Level 1 → 2 → 3 campaign progression
- **Sprint Ability** — Hold `Shift` (laptop) or 🏃 button (mobile), 20s cooldown
- **Multiplayer Custom Room** — WebRTC P2P via PeerJS, no account needed
- **Giant Mode** — First to 25 pts becomes a Giant with Beam Cannon (`E` key)
- **Mobile Ready** — Virtual joystick + touch buttons

## Deploy

### Frontend → Vercel
1. Connect this GitHub repo to [vercel.com](https://vercel.com)
2. Framework: **Other**, Root: `/`, Build: *(blank)*
3. Deploy!

### Backend (Multiplayer) → Render
1. Connect this GitHub repo to [render.com](https://render.com)
2. **New Web Service** → Runtime: Node → Build: `npm install` → Start: `node server.js`
3. After deploy, copy the Render URL
4. Update `game.js` line 17: `host: "YOUR-RENDER-URL.onrender.com"`
5. Redeploy frontend on Vercel

## Local Development
```bash
# Start local server
python3 -m http.server 8080

# Open in browser
open http://localhost:8080

# Run tests
node tests/test_live_game.js
```

## Controls
| Action | Laptop | Mobile |
|--------|--------|--------|
| Move | WASD / Arrow Keys | Virtual Joystick |
| Sprint | Hold `Shift` | Hold 🏃 SPRINT |
| Dash | `Space` | ⚡ DASH button |
| Push | `F` | 💥 PUSH button |
| Emergency Dodge | `B` | 🛡️ DODGE button |
| Beam (Giant only) | `E` | 🔴 BEAM button |
