/**
 * Dodge Arena Ultimate
 * - 5 Difficulty Levels: Normal, Medium, Hard, Ultra Hard, Extreme
 * - Map Transitions: Map 1 (0-19), Map 2 Magma (20-49), Map 3 Void (50-99), Map 4 Boss Chamber (100-119)
 * - Level 1 Boss Fight: Giant boss, minion swarms, Burst attack with CAUTION banner & 3 Emergency Dodges
 * - Level 2 / Level 3 Match Started progression at 120+ points
 * - Multiplayer Custom Room: 25-pt Giant with 20s Beam ('E' / button) & 30-pt survival win condition
 */

(() => {
  "use strict";

  // --- Constants ---

  // PeerJS Signaling Server Config
  // LOCAL DEV: uses PeerJS public cloud (no config needed)
  // PRODUCTION: uses your Render backend server
  const IS_PROD = window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
  const PEER_SERVER_CONFIG = IS_PROD ? {
    host: "dodge-ultimate-arena.onrender.com", // ✅ Render backend
    port: 443,
    path: "/peerjs",
    key: "dodge-arena",
    secure: true,
  } : {}; // empty = PeerJS default public cloud for local dev

  const IS_MOBILE = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.innerWidth < 768;

  const SCREEN_WIDTH = 800;
  const SCREEN_HEIGHT = 600;

  const PLAYER_SIZE = 20;
  const GIANT_SIZE = 40;
  const PLAYER_BASE_SPEED = 260; // px/sec

  const DASH_SPEED = 780;
  const DASH_DURATION = 0.22;
  const DASH_COOLDOWN = 2.5;

  const SHOCKWAVE_RADIUS = 140;
  const SHOCKWAVE_COOLDOWN = 4.0;

  const SPRINT_COOLDOWN = 20.0; // 20s sprint cooldown
  const SPRINT_MAX_DURATION = 3.5; // 3.5s max continuous sprint
  const SPRINT_SPEED_MULT = 1.8; // 1.8x speed boost

  const BEAM_COOLDOWN = 20.0; // 20s beam reload
  const BEAM_DURATION = 0.6; // beam active duration

  const DIFFICULTIES = {
    NORMAL: { name: "NORMAL", badgeClass: "diff-normal", enemySpeed: 120, spawnInterval: 1.8, maxEnemies: 6 },
    MEDIUM: { name: "MEDIUM", badgeClass: "diff-medium", enemySpeed: 145, spawnInterval: 1.5, maxEnemies: 7 },
    HARD: { name: "HARD", badgeClass: "diff-hard", enemySpeed: 165, spawnInterval: 1.3, maxEnemies: 8 },
    ULTRA: { name: "ULTRA HARD", badgeClass: "diff-ultra", enemySpeed: 185, spawnInterval: 1.1, maxEnemies: 9 },
    EXTREME: { name: "EXTREME", badgeClass: "diff-extreme", enemySpeed: 210, spawnInterval: 0.95, maxEnemies: 10 },
  };

  const MAP_THEMES = {
    1: { name: "NEON CITY", bg: "#07091f", border: "#00e5ff", enemy: "#00e5ff",
         draw(ctx) {
           // City skyline silhouette
           ctx.fillStyle = "rgba(0,229,255,0.04)";
           const buildings = [[0,420,80,180],[90,380,60,220],[160,400,70,200],[240,360,90,240],[340,390,50,210],[400,350,110,250],[520,375,80,225],[610,340,100,260],[720,370,70,230]];
           buildings.forEach(([x,y,w,h])=>{ ctx.fillRect(x,y,w,h); });
           // Stars
           ctx.fillStyle = "rgba(255,255,255,0.4)";
           for(let i=0;i<40;i++){ ctx.beginPath(); ctx.arc(80+i*18,20+((i*37)%80),1,0,Math.PI*2); ctx.fill(); }
           // Glow lines
           ctx.strokeStyle = "rgba(0,229,255,0.07)"; ctx.lineWidth = 1;
           for(let y=0;y<600;y+=60){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(800,y); ctx.stroke(); }
         }
    },
    2: { name: "LAVA FIELDS", bg: "#190800", border: "#ff4400", enemy: "#ff4400",
         draw(ctx) {
           // Lava cracks
           ctx.strokeStyle = "rgba(255,80,0,0.15)"; ctx.lineWidth = 2;
           [[0,150,250,300],[200,0,350,200],[400,100,600,400],[600,200,800,500],[100,400,400,600],[500,350,750,600]].forEach(([x1,y1,x2,y2])=>{ ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); });
           // Lava pools
           ctx.fillStyle = "rgba(255,60,0,0.08)";
           [[100,150,80,30],[500,200,100,40],[300,400,120,35],[650,350,90,30]].forEach(([x,y,rx,ry])=>{ ctx.beginPath(); ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2); ctx.fill(); });
         }
    },
    3: { name: "VOID ECLIPSE", bg: "#0d0520", border: "#aa00ff", enemy: "#c033ff",
         draw(ctx) {
           // Purple nebula clouds
           ctx.fillStyle = "rgba(100,0,200,0.06)";
           [[200,150,180],[500,300,220],[100,400,160],[650,100,200]].forEach(([x,y,r])=>{ ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); });
           // Stars
           ctx.fillStyle = "rgba(200,150,255,0.5)";
           for(let i=0;i<50;i++){ ctx.beginPath(); ctx.arc(16+i*16,(i*53+37)%580,1,0,Math.PI*2); ctx.fill(); }
         }
    },
    4: { name: "CRYSTAL CAVE", bg: "#050e1a", border: "#00ccff", enemy: "#00b4ff",
         draw(ctx) {
           // Crystal spires from bottom
           ctx.fillStyle = "rgba(0,180,255,0.07)";
           [[50,600,30,200],[130,600,25,160],[250,600,35,230],[380,600,20,140],[470,600,30,200],[600,600,28,180],[700,600,32,210],[770,600,20,150]].forEach(([x,y,w,h])=>{ ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+w/2,y-h); ctx.lineTo(x+w,y); ctx.fill(); });
           // Reflections on ceiling
           ctx.fillStyle = "rgba(0,220,255,0.04)";
           [[100,0,20,80],[300,0,25,60],[500,0,30,100],[700,0,22,70]].forEach(([x,y,w,h])=>{ ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+w/2,y+h); ctx.lineTo(x+w,y); ctx.fill(); });
         }
    },
    5: { name: "AURORA FIELD", bg: "#020d12", border: "#ff33aa", enemy: "#ff33aa",
         draw(ctx) {
           // Aurora bands
           const grad = ctx.createLinearGradient(0,0,0,600);
           grad.addColorStop(0,"rgba(255,51,170,0.06)");
           grad.addColorStop(0.5,"rgba(0,200,255,0.03)");
           grad.addColorStop(1,"rgba(0,0,0,0)");
           ctx.fillStyle = grad; ctx.fillRect(0,0,800,600);
           // Ground details
           ctx.strokeStyle = "rgba(255,51,170,0.08)"; ctx.lineWidth = 1;
           for(let x=0;x<800;x+=50){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,600); ctx.stroke(); }
         }
    },
    6: { name: "STORM RUINS", bg: "#0a0a08", border: "#ff9900", enemy: "#ff9900",
         draw(ctx) {
           // Broken pillars
           ctx.fillStyle = "rgba(255,153,0,0.07)";
           [[60,300,30,300],[200,250,30,350],[400,280,30,320],[600,230,30,370],[730,290,30,310]].forEach(([x,y,w,h])=>{ ctx.fillRect(x,y,w,h); });
           // Lightning streaks
           ctx.strokeStyle = "rgba(255,180,0,0.09)"; ctx.lineWidth = 1;
           [[0,0,200,300],[800,0,500,400],[400,0,300,250],[600,600,700,300]].forEach(([x1,y1,x2,y2])=>{ ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); });
         }
    },
    7: { name: "DEEP OCEAN", bg: "#010d18", border: "#0088ff", enemy: "#0088ff",
         draw(ctx) {
           // Bubble trails
           ctx.fillStyle = "rgba(0,150,255,0.07)";
           for(let i=0;i<20;i++){ ctx.beginPath(); ctx.arc(40+i*38,(i*47+60)%550,4+i%4,0,Math.PI*2); ctx.fill(); }
           // Seaweed
           ctx.strokeStyle = "rgba(0,150,255,0.09)"; ctx.lineWidth = 3;
           [100,250,420,580,700].forEach(x=>{ ctx.beginPath(); ctx.moveTo(x,600); ctx.quadraticCurveTo(x+30,480,x,360); ctx.quadraticCurveTo(x-30,240,x,180); ctx.stroke(); });
         }
    },
    8: { name: "INFERNO CORE", bg: "#120300", border: "#ff2200", enemy: "#ff2200",
         draw(ctx) {
           // Radial heat waves
           for(let r=50;r<400;r+=60){ ctx.strokeStyle = `rgba(255,${30+r/5},0,${0.06-r/8000})`; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(400,300,r,0,Math.PI*2); ctx.stroke(); }
           // Ember sparks
           ctx.fillStyle = "rgba(255,100,0,0.2)";
           for(let i=0;i<15;i++){ ctx.beginPath(); ctx.arc(50+i*50,(i*73+30)%560,2,0,Math.PI*2); ctx.fill(); }
         }
    },
    9: { name: "⚠️ NIGHTMARE ZONE", bg: "#000000", border: "#ff0033", enemy: "#ff0033",
         draw(ctx) {
           // Blood red cracks across screen
           ctx.strokeStyle = "rgba(255,0,30,0.2)"; ctx.lineWidth = 2;
           [[0,100,400,300],[800,0,300,250],[0,600,350,400],[800,500,400,350],[200,0,250,600],[600,0,550,600]].forEach(([x1,y1,x2,y2])=>{ ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); });
           // Vignette darkness
           const vg = ctx.createRadialGradient(400,300,100,400,300,500);
           vg.addColorStop(0,"rgba(0,0,0,0)"); vg.addColorStop(1,"rgba(80,0,0,0.5)");
           ctx.fillStyle = vg; ctx.fillRect(0,0,800,600);
           // Red glowing particles
           ctx.fillStyle = "rgba(255,0,0,0.15)";
           for(let i=0;i<30;i++){ ctx.beginPath(); ctx.arc(26+i*26,(i*61+20)%580,3,0,Math.PI*2); ctx.fill(); }
         }
    },
    // --- Milestone 5A: Obsidian Crucible (Elite Mode exclusive map) ---
    "ELITE": { name: "🔥 OBSIDIAN CRUCIBLE", bg: "#0a0205", border: "#ff6600", enemy: "#ff4400",
         draw(ctx) {
           // Obsidian floor cracks with lava glow
           ctx.strokeStyle = "rgba(255,80,0,0.18)"; ctx.lineWidth = 2;
           [[0,80,300,220],[150,0,400,180],[500,0,700,300],[700,150,800,400],[0,350,250,500],[300,500,600,600],[600,400,800,550],[200,250,500,420]].forEach(([x1,y1,x2,y2])=>{ ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); });
           // Lava pools in cracks
           ctx.fillStyle = "rgba(255,60,0,0.10)";
           [[80,120,55,20],[450,80,70,22],[680,280,60,18],[120,420,80,25],[550,500,65,20]].forEach(([x,y,rx,ry])=>{ ctx.beginPath(); ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2); ctx.fill(); });
           // Ember sparks
           ctx.fillStyle = "rgba(255,120,0,0.22)";
           for(let i=0;i<18;i++){ ctx.beginPath(); ctx.arc(44+i*42,(i*67+30)%570,2+i%3,0,Math.PI*2); ctx.fill(); }
           // Obsidian border glow
           const grd = ctx.createLinearGradient(0,0,0,600);
           grd.addColorStop(0,"rgba(255,80,0,0.07)");
           grd.addColorStop(0.5,"rgba(0,0,0,0)");
           grd.addColorStop(1,"rgba(255,80,0,0.07)");
           ctx.fillStyle = grd; ctx.fillRect(0,0,800,600);
         }
    },
    // --- Milestone 6A: Quarantine Lab (Infection Mode exclusive map) ---
    "INFECTION": { name: "☣️ QUARANTINE LAB", bg: "#040d08", border: "#00ff66", enemy: "#39ff14",
         draw(ctx) {
           // Laboratory bio-hazard tile grid
           ctx.strokeStyle = "rgba(0,255,102,0.12)"; ctx.lineWidth = 1;
           for(let x=40; x<800; x+=40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,600); ctx.stroke(); }
           for(let y=40; y<600; y+=40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(800,y); ctx.stroke(); }
           // Bio-spore containment circles
           ctx.strokeStyle = "rgba(0,255,102,0.18)"; ctx.lineWidth = 2;
           [[200,150,50],[600,150,50],[200,450,50],[600,450,50],[400,300,70]].forEach(([cx,cy,r])=>{
             ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
           });
           // Toxic bio-mist particles
           ctx.fillStyle = "rgba(57,255,20,0.15)";
           for(let i=0;i<20;i++){ ctx.beginPath(); ctx.arc(35+i*38,(i*53+25)%580,2.5,0,Math.PI*2); ctx.fill(); }
           // Quarantine perimeter warning glow
           const grd = ctx.createLinearGradient(0,0,0,600);
           grd.addColorStop(0,"rgba(0,255,102,0.06)");
           grd.addColorStop(0.5,"rgba(0,0,0,0)");
           grd.addColorStop(1,"rgba(0,255,102,0.06)");
           ctx.fillStyle = grd; ctx.fillRect(0,0,800,600);
         }
    },
  };

  // --- Milestone 6A, 6B & 6C: Infection Mode Parameters (Configurable Appendix C) ---
  const INFECTION_CONFIG = {
    initialEnemyCount: 6,         // Configurable initial mini enemies (Appendix C)
    initialInfectedRatio: 0.5,    // 50% infected, 50% normal (Appendix C)
    enemySpeed: 140,              // Mini enemy baseline speed (Appendix C)
    enemyHp: 100,                 // Mini enemy baseline HP (Appendix C)
    contactDamage: 20,            // Contact damage on hit (Appendix C)
    // Milestone 6B provisional defaults (Appendix C)
    weaponSpawnPositions: [       // Configurable weapon spawn coordinates (Appendix C)
      { x: 220, y: 200, defaultType: "ZOMBIE_KILLER" },
      { x: 580, y: 200, defaultType: "COSMIC_BOMB" },
      { x: 400, y: 440, defaultType: "RAYBLUSTER" }
    ],
    rayblusterRarity: 0.05,       // Configurable Raybluster rarity drop rate (Appendix C)
    weaponPickupRadius: 18,       // Configurable pickup touch radius (Appendix C)
    projectileSpeed: 650,         // Configurable projectile speed (Appendix C)
    fireCooldown: 0.25,           // Configurable weapon fire cooldown (Appendix C)
    // Milestone 6C provisional defaults (Appendix C)
    branchSurvivalTime: 60.0,     // GDD exact: 60s survival threshold
    bossHp: 2500,                 // GDD exact: 2500 HP
    bossSpeed: 75,                // Provisional boss movement speed (Appendix C)
    bossRadius: 36,               // Provisional boss hitbox radius (Appendix C)
    slashInterval: 12.0,          // Provisional World Cutting Slash cooldown (Appendix C)
    slashWarningDuration: 3.0,    // GDD exact: 3s warning telegraph
    slashDamage: 50,              // GDD exact: 50 direct damage
    slashSeveranceDuration: 8.0,  // Provisional severance duration (Appendix C)
    minionSpawnInterval: 10.0,    // GDD exact: every 10s spawns 3 possessed minions
    minionHp: 80,                 // Provisional minion HP (Appendix C)
    minionSpeed: 160,             // Provisional minion speed (Appendix C)
    minionDamage: 25,             // Provisional minion contact damage (Appendix C)
    jumpInterval: 15.0,           // Provisional jump cooldown (Appendix C)
    jumpWarningDuration: 3.0,     // GDD exact: 3s warning telegraph
    jumpImpactRadius: 85,         // Provisional jump impact radius (Appendix C)
    jumpDamage: 40,               // Provisional jump impact damage (Appendix C)
    sunInterval: 14.0,            // Provisional Falling Sun cooldown (Appendix C)
    sunSpeed: 280,                // Provisional Falling Sun speed (Appendix C)
    sunRadius: 18,                // Provisional Falling Sun radius (Appendix C)
    craterRadius: 42,             // Provisional crater radius (Appendix C)
    craterDuration: 12.0,         // Provisional crater duration (Appendix C)
    blackHoleInterval: 22.0,      // Provisional Black Hole cooldown (Appendix C)
    blackHoleRadius: 70,          // Provisional Black Hole radius (Appendix C)
    blackHolePullForce: 130,      // Provisional gravitational pull (Appendix C)
    blackHoleFreezeDuration: 15.0,// GDD exact: 15s freeze
    whiteHoleInterval: 28.0,      // Provisional White Hole cooldown (Appendix C)
    whiteHoleRadius: 75,          // Provisional White Hole radius (Appendix C)
    whiteHoleRepelForce: 300,     // Provisional repulsion force (Appendix C)
    whiteHoleFreezeDuration: 15.0,// GDD exact: 15s freeze
    heartSpawnInterval: 8.0,      // Provisional heart spawn interval (Appendix C)
    heartHealAmount: 10,          // GDD exact: exactly 10 HP per heart
    maxHeartsInArena: 4           // Provisional max hearts (Appendix C)
  };

  // --- Approved Infection Mode Weapon Definitions (GDD Section 5.2) ---
  const INFECTION_WEAPONS = {
    ZOMBIE_KILLER: {
      type: "ZOMBIE_KILLER",
      name: "Zombie Killer",
      ammo: 150,
      maxAmmo: 150,
      infectedBossDamage: 100,
      cosmicBossDamage: 50,
      color: "#ff3366",
      projectileColor: "#ff0055"
    },
    COSMIC_BOMB: {
      type: "COSMIC_BOMB",
      name: "Cosmic Bomb",
      ammo: 150,
      maxAmmo: 150,
      infectedBossDamage: 50,
      cosmicBossDamage: 100,
      color: "#9933ff",
      projectileColor: "#bf00ff"
    },
    RAYBLUSTER: {
      type: "RAYBLUSTER",
      name: "Raybluster",
      ammo: Infinity,
      maxAmmo: Infinity,
      infectedBossDamage: 500,
      cosmicBossDamage: 500,
      color: "#ffff00",
      projectileColor: "#00ffff"
    }
  };

  // --- Sound Synthesizer (Web Audio API) ---
  class SoundManager {
    constructor() {
      this.ctx = null;
      this.muted = false;
      this.customFailSound = (typeof Audio !== "undefined") ? new Audio("gameover.mp3") : null;
      if (this.customFailSound) this.customFailSound.preload = "auto";

      // Pew sound buffer & audio pool for rapid overlapping gunshot sounds
      this.pewBuffer = null;
      this.pewPool = [];
      this.pewIndex = 0;
      if (typeof Audio !== "undefined") {
        for (let i = 0; i < 8; i++) {
          const a = new Audio("pew.mp3");
          a.preload = "auto";
          this.pewPool.push(a);
        }
      }
      this._loadPewAudio();

      // Score ball collect sound buffer & audio pool
      this.scoreBuffer = null;
      this.scorePool = [];
      this.scoreIndex = 0;
      if (typeof Audio !== "undefined") {
        for (let i = 0; i < 8; i++) {
          const a = new Audio("score.mp3");
          a.preload = "auto";
          this.scorePool.push(a);
        }
      }
      this._loadScoreAudio();
    }

    _loadScoreAudio() {
      if (typeof fetch === "undefined") return;
      fetch("score.mp3")
        .then(res => res.arrayBuffer())
        .then(buf => {
          this._init();
          if (this.ctx) {
            this.ctx.decodeAudioData(buf, (decoded) => {
              this.scoreBuffer = decoded;
            }, () => {});
          } else {
            this._pendingScoreBuffer = buf;
          }
        })
        .catch(() => {});
    }

    _loadPewAudio() {
      if (typeof fetch === "undefined") return;
      fetch("pew.mp3")
        .then(res => res.arrayBuffer())
        .then(buf => {
          this._init();
          if (this.ctx) {
            this.ctx.decodeAudioData(buf, (decoded) => {
              this.pewBuffer = decoded;
            }, () => {});
          } else {
            this._pendingPewBuffer = buf;
          }
        })
        .catch(() => {});
    }

    _init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
        if (this.ctx && this._pendingPewBuffer) {
          const b = this._pendingPewBuffer;
          delete this._pendingPewBuffer;
          this.ctx.decodeAudioData(b, (decoded) => {
            this.pewBuffer = decoded;
          }, () => {});
        }
        if (this.ctx && this._pendingScoreBuffer) {
          const b = this._pendingScoreBuffer;
          delete this._pendingScoreBuffer;
          this.ctx.decodeAudioData(b, (decoded) => {
            this.scoreBuffer = decoded;
          }, () => {});
        }
      }
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
    }

    playPew() {
      if (this.muted) return;
      this._init();
      // 1. Preferred: Web Audio BufferSource (0ms latency, unlimited overlapping voices)
      if (this.ctx && this.pewBuffer) {
        try {
          const src = this.ctx.createBufferSource();
          src.buffer = this.pewBuffer;
          const gain = this.ctx.createGain();
          gain.gain.value = 0.55;
          src.connect(gain);
          gain.connect(this.ctx.destination);
          src.start(0);
          return;
        } catch (_) {}
      }
      // 2. Fallback: Rotating Audio Pool
      if (this.pewPool && this.pewPool.length > 0) {
        const sound = this.pewPool[this.pewIndex % this.pewPool.length];
        this.pewIndex++;
        sound.currentTime = 0;
        sound.play().catch(() => {});
      } else {
        // 3. Fallback synth tone
        this.playTone(880, "square", 0.08, 0.3);
      }
    }

    toggleMute() {
      this.muted = !this.muted;
      return this.muted;
    }

    playTone(freq, type, duration, gainVal = 0.2) {
      if (this.muted) return;
      this._init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(gainVal, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.01);
    }

    playCollect() {
      if (this.muted) return;
      this._init();

      // 1. Preferred: Web Audio BufferSource for score.mp3 (0ms latency, handles rapid consecutive eats)
      if (this.ctx && this.scoreBuffer) {
        try {
          const src = this.ctx.createBufferSource();
          src.buffer = this.scoreBuffer;
          const gain = this.ctx.createGain();
          gain.gain.value = 0.65;
          src.connect(gain);
          gain.connect(this.ctx.destination);
          src.start(0);
          return;
        } catch (_) {}
      }

      // 2. Fallback: Rotating Audio Pool
      if (this.scorePool && this.scorePool.length > 0) {
        const sound = this.scorePool[this.scoreIndex % this.scorePool.length];
        this.scoreIndex++;
        sound.currentTime = 0;
        sound.play().catch(() => {});
        return;
      }

      // 3. Fallback synth tone
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
    }

    playDash() {
      if (this.muted) return;
      this._init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.18);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.19);
    }

    playPush() {
      if (this.muted) return;
      this._init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.28);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.29);
    }

    playEmerDodge() {
      if (this.muted) return;
      this._init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      // High-tech sci-fi phase-warp sound
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = "sawtooth";
      osc1.frequency.setValueAtTime(320, now);
      osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.12);
      osc1.frequency.exponentialRampToValueAtTime(350, now + 0.32);

      osc2.type = "sine";
      osc2.frequency.setValueAtTime(600, now);
      osc2.frequency.exponentialRampToValueAtTime(1400, now + 0.08);
      osc2.frequency.exponentialRampToValueAtTime(250, now + 0.35);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.36);
      osc2.stop(now + 0.36);
    }

    playBeam() {
      if (this.muted) return;
      this._init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.55);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.56);
    }

    playWarning() {
      this.playTone(880, "square", 0.15, 0.25);
    }

    playBurst() {
      if (this.muted) return;
      this._init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(90, now);
      osc.frequency.exponentialRampToValueAtTime(25, now + 0.5);
      gain.gain.setValueAtTime(0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.52);
    }

    playVictory() {
      if (this.muted) return;
      this._init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);
        gain.gain.setValueAtTime(0.2, now + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.1 + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.26);
      });
    }

    stopGameOver() {
      if (this.customFailSound) {
        this.customFailSound.pause();
        this.customFailSound.currentTime = 0;
      }
    }

    playGameOver() {
      if (this.muted) return;
      // Try playing custom audio if present
      if (this.customFailSound) {
        this.customFailSound.currentTime = 0;
        this.customFailSound.play().catch(() => {
          // Fallback to synthesized audio tone if custom file fails or not found
          this.playTone(200, "sawtooth", 0.4, 0.35);
        });
      } else {
        this.playTone(200, "sawtooth", 0.4, 0.35);
      }
    }
  }

  // --- Entities ---
  class Player {
    constructor(id, color, name) {
      this.id = id;
      this.color = color;
      this.name = name;
      this.size = PLAYER_SIZE;

      this.x = 0;
      this.y = 0;
      this.vx = 0;
      this.vy = 0;
      this.facingX = 1;
      this.facingY = 0;

      // Abilities
      this.dashTimer = 0;
      this.dashCooldown = 0;
      this.pushCooldown = 0;
      this.emerDodges = 3;
      this.emerDodgeTimer = 0;

      // Sprint (Hold Shift / Hold Button)
      this.isSprinting = false;
      this.sprintCooldown = 0;
      this.sprintStamina = SPRINT_MAX_DURATION;

      // Giant & Beam (Multiplayer)
      this.isGiant = false;
      this.beamCooldown = 0;
      this.activeBeam = null; // { x1, y1, x2, y2, timer }

      this.hasShield = false;
      this.speedBuffTimer = 0;
      this.knockbackVx = 0;
      this.knockbackVy = 0;

      this.shockwaveVisual = null;
      this.trails = [];
      this.isAlive = true;
      this.lives = 3;
      this.invulnerableTimer = 0; // after taking hit

      // Custom Shape and Photo Avatar
      this.customShape = "square"; // 'square', 'circle', 'triangle', 'diamond', 'star'
      this.avatarImg = null; // HTMLImageElement
      this.avatarDataUrl = null;
    }

    reset(x, y) {
      this.x = x;
      this.y = y;
      this.vx = 0;
      this.vy = 0;
      this.size = PLAYER_SIZE;
      this.dashTimer = 0;
      this.dashCooldown = 0;
      this.pushCooldown = 0;
      this.emerDodges = 3;
      this.emerDodgeTimer = 0;
      this.isSprinting = false;
      this.sprintCooldown = 0;
      this.sprintStamina = SPRINT_MAX_DURATION;
      this.isGiant = false;
      this.beamCooldown = 0;
      this.activeBeam = null;
      this.hasShield = false;
      this.speedBuffTimer = 0;
      this.knockbackVx = 0;
      this.knockbackVy = 0;
      this.shockwaveVisual = null;
      this.trails = [];
      this.isAlive = true;
      this.lives = 3;
      this.invulnerableTimer = 0;
    }

    get isInvulnerable() {
      return this.dashTimer > 0 || this.emerDodgeTimer > 0 || this.invulnerableTimer > 0;
    }

    get rect() {
      return {
        x: Math.round(this.x),
        y: Math.round(this.y),
        w: this.size,
        h: this.size,
      };
    }

    dash() {
      if (this.dashCooldown > 0 || !this.isAlive) return false;
      this.dashTimer = DASH_DURATION;
      this.dashCooldown = DASH_COOLDOWN;
      return true;
    }

    shockwave() {
      if (this.pushCooldown > 0 || !this.isAlive) return false;
      this.pushCooldown = SHOCKWAVE_COOLDOWN;
      this.shockwaveVisual = {
        radius: 10,
        maxRadius: SHOCKWAVE_RADIUS,
        alpha: 1.0,
      };
      return true;
    }

    emergencyDodge(enemies = null) {
      if (this.emerDodges <= 0 || this.emerDodgeTimer > 0 || !this.isAlive) return false;
      this.emerDodges -= 1;
      this.emerDodgeTimer = 1.5; // 1.5s invulnerable phase
      this.speedBuffTimer = 1.5; // 1.5s agility speed boost

      // 1. Instant Phase Warp / Leap (160px in facing or moving direction)
      let dirX = this.facingX;
      let dirY = this.facingY;
      if (Math.abs(dirX) < 0.05 && Math.abs(dirY) < 0.05) {
        dirX = this.vx !== 0 ? Math.sign(this.vx) : 0;
        dirY = this.vy !== 0 ? Math.sign(this.vy) : -1;
      }
      const len = Math.hypot(dirX, dirY);
      if (len > 0) {
        dirX /= len;
        dirY /= len;
      } else {
        dirY = -1;
      }

      const leapDist = 160;
      // Spawn vibrant purple warp ghosts along leap path
      for (let step = 1; step <= 4; step++) {
        const frac = step / 4;
        this.trails.push({
          x: this.x + dirX * leapDist * frac,
          y: this.y + dirY * leapDist * frac,
          alpha: 0.85 - frac * 0.15,
          color: "#c084fc",
        });
      }

      this.x += dirX * leapDist;
      this.y += dirY * leapDist;

      // Keep within arena bounds
      this.x = Math.max(15, Math.min(SCREEN_WIDTH - this.size - 15, this.x));
      this.y = Math.max(15, Math.min(SCREEN_HEIGHT - this.size - 15, this.y));

      // 2. Blast back and stun all nearby enemies within 180px
      if (enemies && Array.isArray(enemies)) {
        const pcx = this.x + this.size / 2;
        const pcy = this.y + this.size / 2;
        for (let i = 0; i < enemies.length; i++) {
          const e = enemies[i];
          const ecx = e.x + e.size / 2;
          const ecy = e.y + e.size / 2;
          let dx = ecx - pcx;
          let dy = ecy - pcy;
          let dist = Math.hypot(dx, dy);
          if (dist < 180) {
            if (dist < 10) { dx = 1; dy = 0; dist = 1; }
            const nx = dx / dist;
            const ny = dy / dist;
            e.knockbackVx = nx * 400;
            e.knockbackVy = ny * 400;
            e.stunTimer = 1.5;
          }
        }
      }

      return true;
    }

    startSprint() {
      if (this.sprintCooldown <= 0 && this.sprintStamina > 0 && this.isAlive) {
        this.isSprinting = true;
        return true;
      }
      return false;
    }

    stopSprint() {
      if (this.isSprinting) {
        this.isSprinting = false;
        this.sprintCooldown = SPRINT_COOLDOWN;
        this.sprintStamina = SPRINT_MAX_DURATION;
      }
    }

    transformToGiant() {
      this.isGiant = true;
      this.size = GIANT_SIZE;
      this.beamCooldown = 0;
    }

    fireBeam(targetX, targetY) {
      if (!this.isGiant || this.beamCooldown > 0 || !this.isAlive) return false;
      this.beamCooldown = BEAM_COOLDOWN;

      // Compute beam line from player center towards target or facing dir
      const cx = this.x + this.size / 2;
      const cy = this.y + this.size / 2;

      let dx = targetX - cx;
      let dy = targetY - cy;
      let len = Math.hypot(dx, dy);
      if (len <= 0) {
        dx = this.facingX;
        dy = this.facingY;
        len = Math.hypot(dx, dy) || 1;
      }

      const nx = dx / len;
      const ny = dy / len;
      const beamLength = 1000;

      this.activeBeam = {
        x1: cx,
        y1: cy,
        x2: cx + nx * beamLength,
        y2: cy + ny * beamLength,
        timer: BEAM_DURATION,
      };

      return true;
    }

    update(inputX, inputY, dt) {
      if (!this.isAlive) return;

      if (this.dashCooldown > 0) this.dashCooldown = Math.max(0, this.dashCooldown - dt);
      if (this.pushCooldown > 0) this.pushCooldown = Math.max(0, this.pushCooldown - dt);
      if (this.speedBuffTimer > 0) this.speedBuffTimer = Math.max(0, this.speedBuffTimer - dt);
      if (this.emerDodgeTimer > 0) this.emerDodgeTimer = Math.max(0, this.emerDodgeTimer - dt);
      if (this.invulnerableTimer > 0) this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt);
      if (this.beamCooldown > 0) this.beamCooldown = Math.max(0, this.beamCooldown - dt);
      if (this.sprintCooldown > 0) this.sprintCooldown = Math.max(0, this.sprintCooldown - dt);

      if (Math.abs(inputX) > 0.05 || Math.abs(inputY) > 0.05) {
        const len = Math.hypot(inputX, inputY);
        this.facingX = inputX / len;
        this.facingY = inputY / len;
      }

      let speed = PLAYER_BASE_SPEED;
      if (this.isGiant) speed *= 0.9; // Giant is slightly heavier
      if (this.speedBuffTimer > 0) speed *= 1.45;

      if (this.isSprinting) {
        this.sprintStamina -= dt;
        speed *= SPRINT_SPEED_MULT;
        this.trails.push({ x: this.x, y: this.y, alpha: 0.55, color: "#00ff88" });
        if (this.sprintStamina <= 0) {
          this.stopSprint();
        }
      }

      if (this.dashTimer > 0) {
        this.dashTimer -= dt;
        speed = DASH_SPEED;
        this.trails.push({ x: this.x, y: this.y, alpha: 0.65 });
      }

      this.x += this.knockbackVx * dt;
      this.y += this.knockbackVy * dt;
      this.knockbackVx *= Math.max(0, 1 - 7 * dt);
      this.knockbackVy *= Math.max(0, 1 - 7 * dt);

      let moveX = inputX;
      let moveY = inputY;
      const inLen = Math.hypot(moveX, moveY);
      if (inLen > 1) {
        moveX /= inLen;
        moveY /= inLen;
      }

      this.vx = moveX * speed;
      this.vy = moveY * speed;

      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // Bounds
      this.x = Math.max(0, Math.min(SCREEN_WIDTH - this.size, this.x));
      this.y = Math.max(0, Math.min(SCREEN_HEIGHT - this.size, this.y));

      // Update Shockwave visual
      if (this.shockwaveVisual) {
        this.shockwaveVisual.radius += (SHOCKWAVE_RADIUS / 0.22) * dt;
        this.shockwaveVisual.alpha -= 4.2 * dt;
        if (this.shockwaveVisual.alpha <= 0) this.shockwaveVisual = null;
      }

      // Update Active Beam
      if (this.activeBeam) {
        this.activeBeam.timer -= dt;
        if (this.activeBeam.timer <= 0) this.activeBeam = null;
      }

      // Update trails
      for (let i = this.trails.length - 1; i >= 0; i--) {
        this.trails[i].alpha -= 4.0 * dt;
        if (this.trails[i].alpha <= 0) this.trails.splice(i, 1);
      }
    }

    draw(ctx) {
      if (!this.isAlive) return;

      // Blink when taking damage (invulnerable iframe)
      if (this.invulnerableTimer > 0 && Math.floor(performance.now() / 80) % 2 === 0) {
        return;
      }

      // Trails
      for (let i = 0; i < this.trails.length; i++) {
        const tr = this.trails[i];
        ctx.save();
        ctx.globalAlpha = Math.max(0, tr.alpha);
        ctx.fillStyle = tr.color || this.color;
        ctx.fillRect(Math.round(tr.x), Math.round(tr.y), this.size, this.size);
        ctx.restore();
      }

      // Shockwave ring
      if (this.shockwaveVisual) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.shockwaveVisual.alpha);
        ctx.strokeStyle = "#00e5ff";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.x + this.size / 2, this.y + this.size / 2, this.shockwaveVisual.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Active Beam Cannon Line
      if (this.activeBeam) {
        ctx.save();
        ctx.strokeStyle = "#ff1155";
        ctx.shadowColor = "#ff1155";
        ctx.shadowBlur = 20;
        ctx.lineWidth = 14 + Math.sin(this.activeBeam.timer * 30) * 4;
        ctx.beginPath();
        ctx.moveTo(this.activeBeam.x1, this.activeBeam.y1);
        ctx.lineTo(this.activeBeam.x2, this.activeBeam.y2);
        ctx.stroke();

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.restore();
      }

      // Player Body (Photo Avatar OR Custom Shape)
      ctx.save();
      if (!IS_MOBILE) {
        ctx.shadowColor = this.isGiant ? "#ffcc00" : this.color;
        ctx.shadowBlur = this.isGiant ? 24 : (this.dashTimer > 0 ? 18 : 10);
      }
      const fillColor = this.isGiant ? "#ffaa00" : (this.dashTimer > 0 ? "#ffffff" : this.color);
      const px = Math.round(this.x);
      const py = Math.round(this.y);
      const s = this.size;
      const cx = px + s / 2;
      const cy = py + s / 2;

      if (this.avatarImg && this.avatarImg.complete && this.avatarImg.naturalWidth > 0) {
        // Draw Custom Photo cropped circular and balanced
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, s / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(this.avatarImg, px, py, s, s);
        ctx.restore();

        // Outer glow border around photo
        ctx.strokeStyle = fillColor;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy, s / 2, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = fillColor;
        // Render selected geometry shape
        const shape = this.customShape || "square";

        if (shape === "circle") {
          ctx.beginPath();
          ctx.arc(cx, cy, s / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (shape === "triangle") {
          ctx.beginPath();
          ctx.moveTo(cx, py);
          ctx.lineTo(px + s, py + s);
          ctx.lineTo(px, py + s);
          ctx.closePath();
          ctx.fill();
        } else if (shape === "diamond") {
          ctx.beginPath();
          ctx.moveTo(cx, py);
          ctx.lineTo(px + s, cy);
          ctx.lineTo(cx, py + s);
          ctx.lineTo(px, cy);
          ctx.closePath();
          ctx.fill();
        } else if (shape === "star") {
          ctx.beginPath();
          const spikes = 5;
          const outerRadius = s / 2;
          const innerRadius = s / 4;
          let rot = Math.PI / 2 * 3;
          let step = Math.PI / spikes;
          ctx.moveTo(cx, cy - outerRadius);
          for (let i = 0; i < spikes; i++) {
            let x = cx + Math.cos(rot) * outerRadius;
            let y = cy + Math.sin(rot) * outerRadius;
            ctx.lineTo(x, y);
            rot += step;
            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            ctx.lineTo(x, y);
            rot += step;
          }
          ctx.closePath();
          ctx.fill();
        } else {
          // Default: square
          ctx.fillRect(px, py, s, s);
        }
      }

      // Emergency Dodge Radiant Forcefield Shield
      if (this.emerDodgeTimer > 0) {
        ctx.save();
        const pulse = Math.sin(performance.now() / 70) * 3;
        const shieldR = this.size / 2 + 10 + pulse;

        // Outer neon radiant aura
        ctx.strokeStyle = "#c084fc";
        if (!IS_MOBILE) {
          ctx.shadowColor = "#a855f7";
          ctx.shadowBlur = 20;
        }
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, shieldR, 0, Math.PI * 2);
        ctx.stroke();

        // Inner translucent shield bubble
        ctx.fillStyle = "rgba(168, 85, 247, 0.28)";
        ctx.fill();

        // 3 Orbital rotating shield sparks
        const angle = performance.now() / 140;
        for (let i = 0; i < 3; i++) {
          const a = angle + (i * Math.PI * 2 / 3);
          const sx = cx + Math.cos(a) * shieldR;
          const sy = cy + Math.sin(a) * shieldR;
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(sx, sy, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Sprint Aura
      if (this.isSprinting) {
        ctx.save();
        ctx.strokeStyle = "#00ff88";
        ctx.lineWidth = 3;
        ctx.shadowColor = "#00ff88";
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(this.x + this.size / 2, this.y + this.size / 2, this.size * 1.05, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Shield Aura
      if (this.hasShield) {
        ctx.strokeStyle = "#00e5ff";
        ctx.lineWidth = 2.5;
        ctx.shadowColor = "#00e5ff";
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(this.x + this.size / 2, this.y + this.size / 2, this.size * 0.95, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Name & Tag
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px monospace, sans-serif";
      ctx.textAlign = "center";
      const tag = this.isGiant ? `👑 GIANT ${this.name}` : this.name;
      ctx.fillText(tag, this.x + this.size / 2, this.y - 7);
      ctx.restore();
    }
  }

  // --- Boss Entity (Level 1 Titan Boss) ---
  class Boss {
    constructor(level = 1) {
      this.level = level;
      this.size = level === 1 ? 70 : 85;
      this.x = SCREEN_WIDTH / 2 - this.size / 2;
      this.y = 80;
      this.vx = level === 1 ? 65 : 95;
      this.maxHp = level === 1 ? 100 : 150;
      this.hp = this.maxHp;
      this.isHit = 0; // flash timer when taking damage

      // Burst Attack
      this.burstTimer = 0; // cycles every 6-8s
      this.isChargingBurst = false;
      this.chargeTimer = 0; // 2s charge
      this.burstRadius = 0;
      this.burstVisual = null; // { radius, maxRadius, alpha }

      // Minion spawn
      this.minionTimer = 0;
    }

    takeDamage(amount) {
      this.hp = Math.max(0, this.hp - amount);
      this.isHit = 0.2;
      return this.hp <= 0;
    }

    update(dt, onCaution, onBurst, spawnMinions) {
      if (this.isHit > 0) this.isHit -= dt;

      // Horizontal drift
      this.x += this.vx * dt;
      if (this.x < 30 || this.x + this.size > SCREEN_WIDTH - 30) {
        this.vx *= -1;
      }

      // Minion Spawner
      this.minionTimer += dt;
      if (this.minionTimer >= (this.level === 1 ? 4.2 : 3.2)) {
        this.minionTimer = 0;
        spawnMinions(this.x + this.size / 2, this.y + this.size / 2);
      }

      // Burst Attack Cycle
      this.burstTimer += dt;
      if (!this.isChargingBurst && this.burstTimer >= (this.level === 1 ? 6.5 : 5.0)) {
        this.isChargingBurst = true;
        this.chargeTimer = 2.0;
        onCaution(true);
      }

      if (this.isChargingBurst) {
        this.chargeTimer -= dt;
        if (this.chargeTimer <= 0) {
          this.isChargingBurst = false;
          this.burstTimer = 0;
          onCaution(false);
          onBurst(this.x + this.size / 2, this.y + this.size / 2);
          this.burstVisual = {
            x: this.x + this.size / 2,
            y: this.y + this.size / 2,
            radius: 10,
            maxRadius: this.level === 1 ? 260 : 320,
            alpha: 1.0,
          };
        }
      }

      if (this.burstVisual) {
        this.burstVisual.radius += 520 * dt;
        this.burstVisual.alpha -= 2.2 * dt;
        if (this.burstVisual.alpha <= 0) this.burstVisual = null;
      }
    }

    draw(ctx) {
      const cx = this.x + this.size / 2;
      const cy = this.y + this.size / 2;

      // Charging alert ring
      if (this.isChargingBurst) {
        const pulse = (2.0 - this.chargeTimer) / 2.0;
        ctx.save();
        ctx.strokeStyle = "#ff0055";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, 30 + pulse * 150, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Shockwave visual
      if (this.burstVisual) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.burstVisual.alpha);
        ctx.strokeStyle = "#ff2244";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(this.burstVisual.x, this.burstVisual.y, this.burstVisual.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Giant Boss Body
      ctx.save();
      ctx.shadowColor = this.isHit > 0 ? "#ffffff" : "#ff2244";
      ctx.shadowBlur = 24;
      ctx.fillStyle = this.isHit > 0 ? "#ffffff" : (this.isChargingBurst ? "#ffcc00" : (this.level === 1 ? "#ff1133" : "#9900ff"));
      ctx.fillRect(Math.round(this.x), Math.round(this.y), this.size, this.size);

      // Boss Core Eye
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = this.level === 1 ? "#ff0044" : "#aa00ff";
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.fill();

      // Boss Title Tag
      const bossName = this.level === 1 ? "TITAN VOID BOSS (LVL 1)" : "⚡ OMEGA OVERLORD (FINAL)";
      ctx.fillStyle = "#ffcc00";
      ctx.font = "bold 12px monospace, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(bossName, cx, this.y - 18);

      // Boss Health Bar
      const barW = this.size + 40;
      const barH = 7;
      const barX = cx - barW / 2;
      const barY = this.y - 12;

      ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
      ctx.fillRect(barX, barY, barW, barH);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barW, barH);

      const hpPct = Math.max(0, this.hp / this.maxHp);
      ctx.fillStyle = hpPct > 0.4 ? "#00ff88" : (hpPct > 0.2 ? "#ffcc00" : "#ff0044");
      ctx.fillRect(barX, barY, barW * hpPct, barH);

      ctx.restore();
    }
  }

  // --- Solo Boss: Ashley (melee drift + burst + minion swarm) ---
  class AshleyBoss {
    constructor(hp = 2500) {
      this.size = 70;
      this.x = SCREEN_WIDTH / 2 - this.size / 2;
      this.y = 80;
      this.vx = 65;
      this.maxHp = hp;
      this.hp = hp;
      this.isHit = 0;
      this.burstTimer = 0;
      this.isChargingBurst = false;
      this.chargeTimer = 0;
      this.burstVisual = null;
      this.minionTimer = 0;
      this.name = "Ashley";
    }
    takeDamage(amount) {
      this.hp = Math.max(0, this.hp - amount);
      this.isHit = 0.2;
      return this.hp <= 0;
    }
    update(dt, onCaution, onBurst, spawnMinions) {
      if (this.isHit > 0) this.isHit -= dt;
      this.x += this.vx * dt;
      if (this.x < 30 || this.x + this.size > SCREEN_WIDTH - 30) this.vx *= -1;
      this.minionTimer += dt;
      if (this.minionTimer >= 4.2) { this.minionTimer = 0; spawnMinions(this.x + this.size/2, this.y + this.size/2); }
      this.burstTimer += dt;
      if (!this.isChargingBurst && this.burstTimer >= 6.5) { this.isChargingBurst = true; this.chargeTimer = 2.0; onCaution(true); }
      if (this.isChargingBurst) {
        this.chargeTimer -= dt;
        if (this.chargeTimer <= 0) {
          this.isChargingBurst = false; this.burstTimer = 0; onCaution(false);
          onBurst(this.x + this.size/2, this.y + this.size/2);
          this.burstVisual = { x: this.x+this.size/2, y: this.y+this.size/2, radius: 10, maxRadius: 260, alpha: 1.0 };
        }
      }
      if (this.burstVisual) { this.burstVisual.radius += 520*dt; this.burstVisual.alpha -= 2.2*dt; if (this.burstVisual.alpha <= 0) this.burstVisual = null; }
    }
    draw(ctx) {
      const cx = this.x + this.size/2, cy = this.y + this.size/2;
      if (this.isChargingBurst) {
        const pulse = (2.0 - this.chargeTimer) / 2.0;
        ctx.save(); ctx.strokeStyle = "#ff0055"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(cx, cy, 30 + pulse * 150, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
      if (this.burstVisual) {
        ctx.save(); ctx.globalAlpha = Math.max(0, this.burstVisual.alpha);
        ctx.strokeStyle = "#ff2244"; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(this.burstVisual.x, this.burstVisual.y, this.burstVisual.radius, 0, Math.PI*2); ctx.stroke(); ctx.restore();
      }
      ctx.save();
      ctx.shadowColor = this.isHit > 0 ? "#ffffff" : "#ff2244"; ctx.shadowBlur = 24;
      ctx.fillStyle = this.isHit > 0 ? "#ffffff" : (this.isChargingBurst ? "#ffcc00" : "#ff1133");
      ctx.fillRect(Math.round(this.x), Math.round(this.y), this.size, this.size);
      ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = "#ff0044"; ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = "#ffcc00"; ctx.font = "bold 12px monospace"; ctx.textAlign = "center";
      ctx.fillText(`👾 Ashley`, cx, this.y - 18);
      const barW = this.size + 40, barH = 7, barX = cx - barW/2, barY = this.y - 12;
      ctx.fillStyle = "rgba(0,0,0,0.75)"; ctx.fillRect(barX, barY, barW, barH);
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1; ctx.strokeRect(barX, barY, barW, barH);
      const hpPct = Math.max(0, this.hp / this.maxHp);
      ctx.fillStyle = hpPct > 0.4 ? "#00ff88" : (hpPct > 0.2 ? "#ffcc00" : "#ff0044");
      ctx.fillRect(barX, barY, barW * hpPct, barH);
      ctx.restore();
    }
  }

  // --- Solo Boss: Minigun Boss (fires every 10s) ---
  class MinigunBoss {
    constructor(hp = 2500) {
      this.size = 75;
      this.x = SCREEN_WIDTH / 2 + 80;
      this.y = 90;
      this.vx = -75;
      this.maxHp = hp;
      this.hp = hp;
      this.isHit = 0;
      this.gunTimer = 0;
      this.bullets = []; // minigun bullets
      this.minionTimer = 0;
      this.name = "Gunner";
    }
    takeDamage(amount) {
      this.hp = Math.max(0, this.hp - amount);
      this.isHit = 0.2;
      return this.hp <= 0;
    }
    update(dt, playerX, playerY, onGunShot, spawnMinions) {
      if (this.isHit > 0) this.isHit -= dt;
      this.x += this.vx * dt;
      if (this.x < 30 || this.x + this.size > SCREEN_WIDTH - 30) this.vx *= -1;
      // Minigun fire every 10s
      this.gunTimer += dt;
      if (this.gunTimer >= 10) {
        this.gunTimer = 0;
        const cx = this.x + this.size/2, cy = this.y + this.size/2;
        const dx = playerX - cx, dy = playerY - cy;
        const dist = Math.hypot(dx, dy) || 1;
        // Fire 5 rapid bullets with pew sound for each shot
        for (let i = 0; i < 5; i++) {
          setTimeout(() => {
            if (this.hp > 0 && typeof onGunShot === "function") onGunShot();
          }, i * 80);
          this.bullets.push({ x: cx, y: cy, vx: (dx/dist)*220, vy: (dy/dist)*220, life: 3.0 });
        }
      }
      // Minion spawner
      this.minionTimer += dt;
      if (this.minionTimer >= 3.2) { this.minionTimer = 0; spawnMinions(this.x+this.size/2, this.y+this.size/2); }
      // Update bullets
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i];
        b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
        if (b.life <= 0 || b.x < 0 || b.x > SCREEN_WIDTH || b.y < 0 || b.y > SCREEN_HEIGHT) this.bullets.splice(i, 1);
      }
    }
    draw(ctx) {
      const cx = this.x + this.size/2, cy = this.y + this.size/2;
      ctx.save();
      ctx.shadowColor = this.isHit > 0 ? "#ffffff" : "#ff6600"; ctx.shadowBlur = 24;
      ctx.fillStyle = this.isHit > 0 ? "#ffffff" : "#cc3300";
      ctx.fillRect(Math.round(this.x), Math.round(this.y), this.size, this.size);
      // Gun barrel
      ctx.fillStyle = "#888"; ctx.fillRect(cx - 4, cy, 8, 30);
      ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = "#ff4400"; ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = "#ffaa00"; ctx.font = "bold 11px monospace"; ctx.textAlign = "center";
      ctx.fillText(`🔫 Gunner`, cx, this.y - 18);
      const barW = this.size + 40, barH = 7, barX = cx - barW/2, barY = this.y - 12;
      ctx.fillStyle = "rgba(0,0,0,0.75)"; ctx.fillRect(barX, barY, barW, barH);
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1; ctx.strokeRect(barX, barY, barW, barH);
      const hpPct = Math.max(0, this.hp / this.maxHp);
      ctx.fillStyle = hpPct > 0.4 ? "#00ff88" : (hpPct > 0.2 ? "#ffcc00" : "#ff0044");
      ctx.fillRect(barX, barY, barW * hpPct, barH);
      // Draw bullets
      ctx.fillStyle = "#ffcc00";
      for (const b of this.bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, Math.PI*2); ctx.fill(); }
      ctx.restore();
    }
  }

  // --- Mini Enemy (Level 5 wave) ---
  class MiniEnemy {
    constructor(x, y) {
      this.x = x; this.y = y; this.size = 12; this.speed = 180; this.hp = 1;
      this.knockbackVx = 0; this.knockbackVy = 0;
    }
    get rect() { return { x: Math.round(this.x), y: Math.round(this.y), w: this.size, h: this.size }; }
    update(targetRect, dt) {
      this.x += this.knockbackVx * dt; this.y += this.knockbackVy * dt;
      this.knockbackVx *= Math.max(0, 1 - 5*dt); this.knockbackVy *= Math.max(0, 1 - 5*dt);
      this.x = Math.max(5, Math.min(SCREEN_WIDTH - this.size - 5, this.x));
      this.y = Math.max(5, Math.min(SCREEN_HEIGHT - this.size - 5, this.y));
      const tx = targetRect.x + targetRect.w/2 - this.x - this.size/2;
      const ty = targetRect.y + targetRect.h/2 - this.y - this.size/2;
      const d = Math.hypot(tx, ty) || 1;
      this.x += (tx/d) * this.speed * dt;
      this.y += (ty/d) * this.speed * dt;
    }
    draw(ctx) {
      ctx.save();
      ctx.fillStyle = "#ff4400";
      ctx.shadowColor = "#ff0000"; ctx.shadowBlur = 8;
      ctx.fillRect(Math.round(this.x), Math.round(this.y), this.size, this.size);
      ctx.restore();
    }
  }

  // --- Mini Boss (Level 5 final wave) ---
  class MiniBoss {
    constructor(x, y) {
      this.size = 45; this.x = x; this.y = y; this.vx = (Math.random() > 0.5 ? 1 : -1) * 85;
      this.maxHp = 2000; this.hp = 2000; this.isHit = 0;
      this.gunTimer = Math.random() * 5; // stagger
      this.bullets = [];
    }
    get rect() { return { x: Math.round(this.x), y: Math.round(this.y), w: this.size, h: this.size }; }
    takeDamage(amount) { this.hp = Math.max(0, this.hp - amount); this.isHit = 0.15; return this.hp <= 0; }
    update(dt, playerX, playerY, onGunShot) {
      if (this.isHit > 0) this.isHit -= dt;
      this.x += this.vx * dt;
      if (this.x < 20 || this.x + this.size > SCREEN_WIDTH - 20) this.vx *= -1;
      this.gunTimer += dt;
      if (this.gunTimer >= 8) {
        this.gunTimer = 0;
        const cx = this.x+this.size/2, cy = this.y+this.size/2;
        const dx = playerX-cx, dy = playerY-cy;
        const dist = Math.hypot(dx,dy)||1;
        this.bullets.push({ x:cx, y:cy, vx:(dx/dist)*200, vy:(dy/dist)*200, life:3 });
        onGunShot();
      }
      for (let i = this.bullets.length-1; i>=0; i--) {
        const b = this.bullets[i];
        b.x += b.vx*dt; b.y += b.vy*dt; b.life -= dt;
        if (b.life<=0||b.x<0||b.x>SCREEN_WIDTH||b.y<0||b.y>SCREEN_HEIGHT) this.bullets.splice(i,1);
      }
    }
    draw(ctx) {
      const cx = this.x+this.size/2, cy = this.y+this.size/2;
      ctx.save();
      ctx.fillStyle = this.isHit > 0 ? "#fff" : "#990033"; ctx.shadowColor="#ff0044"; ctx.shadowBlur=16;
      ctx.fillRect(Math.round(this.x), Math.round(this.y), this.size, this.size);
      ctx.fillStyle="#ff9900"; ctx.font="bold 10px monospace"; ctx.textAlign="center";
      ctx.fillText("MINI-BOSS",cx,this.y-10);
      const barW=this.size+20, barH=5, barX=cx-barW/2, barY=this.y-8;
      ctx.fillStyle="rgba(0,0,0,0.7)"; ctx.fillRect(barX,barY,barW,barH);
      ctx.fillStyle=this.hp/this.maxHp>0.5?"#00ff88":"#ff0044"; ctx.fillRect(barX,barY,barW*(this.hp/this.maxHp),barH);
      ctx.fillStyle="#ffcc00";
      for(const b of this.bullets){ ctx.beginPath(); ctx.arc(b.x,b.y,4,0,Math.PI*2); ctx.fill(); }
      ctx.restore();
    }
  }

  // --- AK-47 Pickup Item ---
  class AK47Pickup {
    constructor(x, y, img) {
      this.x = x;
      this.y = y;
      this.size = 40;
      this.angle = 0;
      this.img = img || null;
    }
    get rect() {
      return { x: Math.round(this.x), y: Math.round(this.y), w: this.size, h: this.size };
    }
    update(dt) {
      this.angle += dt * 2.2; // Continuous 360-degree rotation around its center
    }
    draw(ctx) {
      const cx = this.x + this.size / 2;
      const cy = this.y + this.size / 2;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(this.angle);

      ctx.shadowColor = "#ffaa00";
      ctx.shadowBlur = 20;

      if (this.img && this.img.complete && this.img.naturalWidth > 0) {
        const w = 68;
        const h = 20;
        ctx.drawImage(this.img, -w / 2, -h / 2, w, h);
      } else {
        ctx.fillStyle = "#ffcc00";
        ctx.font = "bold 26px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🔫", 0, 0);
      }
      ctx.restore();

      ctx.save();
      ctx.shadowColor = "#000000";
      ctx.shadowBlur = 8;
      ctx.fillStyle = "#ffcc00";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center";
      ctx.fillText("⚡ AK-47 PICKUP ⚡", cx, this.y + this.size + 14);
      ctx.restore();
    }
  }

  class Enemy {
    constructor(x, y, speed) {
      this.x = x;
      this.y = y;
      this.size = 16;
      this.speed = speed;
      this.knockbackVx = 0;
      this.knockbackVy = 0;
      this.stunTimer = 0; // stunned when hitting player or pushed
    }

    get rect() {
      return {
        x: Math.round(this.x),
        y: Math.round(this.y),
        w: this.size,
        h: this.size,
      };
    }

    update(targetRect, dt) {
      this.x += this.knockbackVx * dt;
      this.y += this.knockbackVy * dt;
      this.knockbackVx *= Math.max(0, 1 - 5 * dt);
      this.knockbackVy *= Math.max(0, 1 - 5 * dt);

      // Keep within arena bounds
      this.x = Math.max(10, Math.min(SCREEN_WIDTH - this.size - 10, this.x));
      this.y = Math.max(10, Math.min(SCREEN_HEIGHT - this.size - 10, this.y));

      // If stunned, cannot steer towards player
      if (this.stunTimer > 0) {
        this.stunTimer -= dt;
        return;
      }

      if (!targetRect) return;

      const playerCenterX = targetRect.x + targetRect.w / 2;
      const playerCenterY = targetRect.y + targetRect.h / 2;
      const enemyCenterX = this.x + this.size / 2;
      const enemyCenterY = this.y + this.size / 2;

      const dx = playerCenterX - enemyCenterX;
      const dy = playerCenterY - enemyCenterY;
      const distance = Math.hypot(dx, dy);
      if (distance <= 0) return;

      const step = Math.min(this.speed * dt, distance);
      this.x += (dx / distance) * step;
      this.y += (dy / distance) * step;
    }

    draw(ctx, mapTheme, isMobile = false) {
      ctx.save();
      const enemyCol = mapTheme?.enemy || (mapTheme?.border && !mapTheme.border.includes("00ff88") ? mapTheme.border : "#ff2a5f");
      if (!isMobile) {
        ctx.shadowColor = enemyCol;
        ctx.shadowBlur = 8;
      }
      ctx.fillStyle = enemyCol;
      ctx.fillRect(Math.round(this.x), Math.round(this.y), this.size, this.size);
      ctx.restore();
    }
  }

  class Collectible {
    constructor(x, y, points = 10, isAttackOrb = false) {
      this.x = x;
      this.y = y;
      this.size = 20;
      this.points = points;
      this.isAttackOrb = isAttackOrb;
    }

    get rect() {
      return {
        x: Math.round(this.x),
        y: Math.round(this.y),
        w: this.size,
        h: this.size,
      };
    }

    draw(ctx, time, isMobile = false) {
      const radius = this.size / 2;
      const cx = this.x + radius;
      const cy = this.y + radius;
      const pulse = 1 + Math.sin(time * 6) * 0.15;

      ctx.save();
      const mainColor = this.isAttackOrb ? "#ffcc00" : "#46dc82";
      const innerColor = this.isAttackOrb ? "#ff9900" : "#00ff66";

      if (!isMobile) {
        ctx.shadowColor = mainColor;
        ctx.shadowBlur = 14;
      }
      // Outer bright ring
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(cx, cy, (radius + 2) * pulse, 0, Math.PI * 2);
      ctx.fill();

      // Inner vibrant core
      ctx.fillStyle = innerColor;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * pulse, 0, Math.PI * 2);
      ctx.fill();

      if (this.isAttackOrb) {
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("⚡", cx, cy);
      }
      ctx.restore();
    }
  }

  class FloatingText {
    constructor(x, y, text, color) {
      this.x = x;
      this.y = y;
      this.text = text;
      this.color = color;
      this.alpha = 1.0;
    }

    update(dt) {
      this.y -= 25 * dt;
      this.alpha -= 1.1 * dt;
    }

    draw(ctx) {
      if (this.alpha <= 0) return;
      ctx.save();
      ctx.globalAlpha = Math.max(0, this.alpha);
      ctx.fillStyle = this.color;
      ctx.font = "bold 15px monospace, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(this.text, this.x, this.y);
      ctx.restore();
    }
  }

  class Particle {
    constructor(x, y, color) {
      this.x = x;
      this.y = y;
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 140;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.alpha = 1.0;
      this.decay = 2.0 + Math.random() * 1.5;
      this.color = color;
      this.size = 2 + Math.random() * 3;
    }

    update(dt) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.alpha -= this.decay * dt;
    }

    draw(ctx) {
      if (this.alpha <= 0) return;
      ctx.save();
      ctx.globalAlpha = Math.max(0, this.alpha);
      ctx.fillStyle = this.color;
      ctx.fillRect(this.x, this.y, this.size, this.size);
      ctx.restore();
    }
  }

  // --- Main Game Orchestrator ---
  class DodgeArenaGame {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.sounds = new SoundManager();

      this.mode = "SOLO"; // 'SOLO', 'CUSTOM_ROOM'
      this.difficulty = DIFFICULTIES.NORMAL;
      this.state = "MENU"; // 'MENU', 'PLAYING', 'MATCH_OVER'
      this.hasPausedMatch = false; // Tracks ongoing match so player can return to it from menu

      // Progression
      this.level = 1;
      this.mapIndex = 1;
      this.p1Score = 0;
      this.p2Score = 0;

      // Players
      this.p1 = new Player("p1", "#4682ff", "Player 1");
      this.p2 = new Player("p2", "#ff5533", "Player 2");

      // Boss (multiplayer legacy)
      this.boss = null;

      // === SOLO PROGRESSION STATE ===
      this.soloBosses = [];        // array of AshleyBoss / MinigunBoss / MiniBoss
      this.soloLevel = 1;          // 1-5
      this.soloMapPhase = 1;       // 1-9 map phase tracker
      this.hasAK47 = false;
      this.gunEnabled = false;
      this.ammo = 0;
      this.playerBullets = [];     // bullets fired by player
      this.gunCooldown = 0;        // 0.15s between shots
      this.ak47Pickup = null;      // AK47Pickup instance
      this.bossSpawnedForLevel = false;
      this.soloWaveMode = false;
      this.currentWave = 0;
      this.waveEnemies = [];       // MiniEnemy instances
      this.waveBosses = [];        // MiniBoss instances (wave 5 final)
      this.waveCounts = [10, 15, 20, 25, 25];
      this.waveCleared = false;
      this.minigunUnlimited = false;
      this.minigunBullets = [];    // L5 minigun
      this.minigunCooldown = 0;
      this.soloWon = false;
      this.bulletImg = new Image();
      this.bulletImg.src = "bullet.png";
      this.ak47Img = new Image();
      this.ak47Img.src = "ak47.png";

      // Entities
      this.enemies = [];
      this.items = [];
      this.particles = [];
      this.floatingTexts = [];

      this.enemySpawnTimer = 0.0;
      this.itemSpawnTimer = 0.0;
      this.gameTime = 0.0;

      // Announcement Banner Overlay
      this.announcement = null; // { title, subtitle, timer }

      // Inputs
      this.p1Input = { x: 0, y: 0 };
      this.p2Input = { x: 0, y: 0 };
      this.joystickVector = { x: 0, y: 0 };

      // Multiplayer PeerJS
      this.peer = null;
      this.conn = null;
      this.isHost = false;
      this.myRole = "p1";

      // Multiplayer Lobby State (Milestone 2)
      this.lobbyRoomCode = null;        // 6-char code this client belongs to
      this.lobbyPlayers = new Map();    // peerId -> { name, shape, photo, isReady, isHost }
      this.lobbyMode = "ELITE";         // selected game mode
      this.mpConnections = new Map();   // peerId -> { reliable, unreliable }
      this.lobbyIsReady = false;        // this client's ready state

      // Multiplayer Match State (Milestone 3)
      this.mpState = null;              // null when no MP match; MPMatchState when active
      this.mpSnapshotTimer = 0;         // accumulator for 25Hz snapshot broadcast
      this.mpInputTimer = 0;            // accumulator for 30Hz input send

      this.gamerProfile = null; // null = guest, object = logged-in profile
      this.setupDOM();
      this.setupKeyboard();
      this.setupTouch();
      this.setupCanvasScaling();
      this.initUserAndLoadHUD();
      this.initAccountSystem();
    }

    // --- DOM Setup ---
    setupDOM() {
      // 0. Opening Splash Screen Trigger
      const splashScreen = document.getElementById("splash-screen");
      let splashEntered = false; // prevent double-fire from pointerdown+click on mobile
      const enterMenuFromSplash = (e) => {
        if (!splashScreen || splashScreen.classList.contains("hidden")) return;
        if (splashEntered) return;
        splashEntered = true;
        if (e && e.cancelable) e.preventDefault(); // stop click firing after pointerdown
        this.sounds._init();
        this.sounds.playTone(520, "sine", 0.12, 0.25);
        splashScreen.classList.add("hidden");
        this.showMenu();
      };
      splashScreen?.addEventListener("pointerdown", enterMenuFromSplash, { passive: false });
      window.addEventListener("keydown", (e) => {
        if (e.code === "Enter" || e.code === "Space") {
          enterMenuFromSplash(e);
        }
      });

      // Master Top-Right Button -> Auto pause and open menu/settings
      document.getElementById("master-btn")?.addEventListener("click", () => {
        if (this.state === "PLAYING") {
          this.pauseGame();
        } else if (this.state === "PAUSED") {
          this.resumeWithCountdown();
        } else {
          this.showMenu();
        }
      });

      // Menu and Top Bar options (in Pause Section)
      document.getElementById("pause-btn")?.addEventListener("click", () => this.togglePause());
      document.getElementById("menu-btn")?.addEventListener("click", () => {
        if (this.state === "PLAYING" || this.state === "PAUSED") {
          this.hasPausedMatch = true;
        }
        this.showMenu();
      });
      document.getElementById("sound-btn")?.addEventListener("click", () => {
        this.sounds._init();
        const muted = this.sounds.toggleMute();
        const btn = document.getElementById("sound-btn");
        if (btn) btn.innerHTML = muted ? "🔇 <span>Sound: OFF</span>" : "🔊 <span>Sound: ON</span>";
      });
      document.getElementById("fullscreen-btn")?.addEventListener("click", () => {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
        else document.exitFullscreen().catch(() => {});
      });

      // Active Paused Match Resume Button (In Main Menu)
      document.getElementById("btn-resume-active-match")?.addEventListener("click", () => {
        if (this.hasPausedMatch && this.p1 && this.p1.isAlive) {
          this.hideMenu();
          this.resumeWithCountdown();
        }
      });

      // Pause Modal Buttons
      document.getElementById("btn-resume-game")?.addEventListener("click", () => this.resumeWithCountdown());
      document.getElementById("btn-restart-game")?.addEventListener("click", () => {
        this.hasPausedMatch = false;
        this.hidePause();
        this.startMatch(this.mode);
      });
      document.getElementById("btn-pause-menu")?.addEventListener("click", () => {
        this.hasPausedMatch = true;
        this.hidePause();
        this.showMenu();
      });

      // Difficulty Buttons
      document.querySelectorAll(".diff-pill").forEach((btn) => {
        btn.addEventListener("click", () => {
          document.querySelectorAll(".diff-pill").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          const diffKey = btn.getAttribute("data-diff");
          this.difficulty = DIFFICULTIES[diffKey] || DIFFICULTIES.NORMAL;

          const diffBadge = document.getElementById("diff-badge");
          if (diffBadge) {
            diffBadge.innerText = this.difficulty.name;
            diffBadge.className = `badge ${this.difficulty.badgeClass}`;
          }
        });
      });

      // Custom HUD Editor Buttons
      document.getElementById("btn-open-hud-editor")?.addEventListener("click", () => this.openHudEditor());
      document.getElementById("btn-save-hud")?.addEventListener("click", () => this.saveHudLayout());
      document.getElementById("btn-reset-hud")?.addEventListener("click", () => this.resetHudLayout());
      document.getElementById("btn-close-hud")?.addEventListener("click", () => this.closeHudEditor());

      // Character Modal Windows Open/Close
      document.getElementById("btn-open-char-modal")?.addEventListener("click", () => {
        document.getElementById("char-modal-overlay")?.classList.remove("hidden");
      });
      document.getElementById("btn-close-char-modal")?.addEventListener("click", () => {
        document.getElementById("char-modal-overlay")?.classList.add("hidden");
      });
      document.getElementById("btn-confirm-char")?.addEventListener("click", () => {
        document.getElementById("char-modal-overlay")?.classList.add("hidden");
      });

      // Rules Modal Open / Close
      document.getElementById("btn-open-rules-modal")?.addEventListener("click", () => {
        document.getElementById("rules-modal-overlay")?.classList.remove("hidden");
      });
      document.getElementById("btn-close-rules-modal")?.addEventListener("click", () => {
        document.getElementById("rules-modal-overlay")?.classList.add("hidden");
      });
      document.getElementById("btn-done-rules")?.addEventListener("click", () => {
        document.getElementById("rules-modal-overlay")?.classList.add("hidden");
      });

      // Share Buttons
      (() => {
        const GAME_URL = "https://dodge-ultimate-arena.vercel.app";
        const SHARE_TEXT = "🎮 Dodgy The Unstoppable — dodge enemies, battle bosses, play multiplayer! Check it out 👇";

        document.getElementById("share-facebook")?.addEventListener("click", () => {
          window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(GAME_URL)}`, "_blank", "width=600,height=500");
        });

        document.getElementById("share-whatsapp")?.addEventListener("click", () => {
          const isMobile = /Mobi|Android/i.test(navigator.userAgent);
          const base = isMobile ? "https://wa.me/" : "https://web.whatsapp.com/send";
          window.open(`${base}?text=${encodeURIComponent(SHARE_TEXT + "\n" + GAME_URL)}`, "_blank");
        });

        document.getElementById("share-twitter")?.addEventListener("click", () => {
          window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(GAME_URL)}`, "_blank", "width=600,height=450");
        });

        document.getElementById("share-copy-link")?.addEventListener("click", () => {
          navigator.clipboard.writeText(GAME_URL).then(() => {
            const toast = document.getElementById("share-copy-toast");
            if (!toast) return;
            toast.classList.remove("hidden");
            setTimeout(() => toast.classList.add("hidden"), 2000);
          }).catch(() => {
            prompt("Copy this link:", GAME_URL);
          });
        });
      })();

      // Feedback & Bug Report Modal Open / Close
      document.getElementById("btn-open-feedback-modal")?.addEventListener("click", () => {
        document.getElementById("feedback-modal-overlay")?.classList.remove("hidden");
      });
      document.getElementById("btn-close-feedback-modal")?.addEventListener("click", () => {
        document.getElementById("feedback-modal-overlay")?.classList.add("hidden");
      });

      // Feedback Type Selection
      let selectedFeedbackType = "Bug Report";
      document.querySelectorAll(".fb-type-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          document.querySelectorAll(".fb-type-btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          selectedFeedbackType = btn.getAttribute("data-type") || "General";
        });
      });

      // Feedback Form Submit Handler
      const feedbackForm = document.getElementById("feedback-form");
      feedbackForm?.addEventListener("submit", (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById("btn-submit-feedback");
        const statusMsg = document.getElementById("feedback-status-msg");
        const name = document.getElementById("fb-user-name")?.value.trim();
        const email = document.getElementById("fb-user-email")?.value.trim();
        const message = document.getElementById("fb-user-message")?.value.trim();

        if (!message) return;

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerText = "⏳ Sending...";
        }
        if (statusMsg) statusMsg.innerText = "";

        const payload = {
          name: name || "Anonymous Player",
          email: email || "Not provided",
          type: selectedFeedbackType,
          message,
          deviceInfo: `${IS_MOBILE ? "Mobile" : "Desktop"} (${window.innerWidth}x${window.innerHeight})`,
          targetEmail: "swapnil172294@gmail.com",
        };

        // Send via EmailJS → swapnil172294@gmail.com
        const emailParams = {
          name: payload.name,
          email: payload.email || "Not provided",
          title: `🎮 Dodgy The Unstoppable — ${payload.type}`,
          message: `📩 GAME FEEDBACK — Dodgy The Unstoppable\n` +
                   `━━━━━━━━━━━━━━━━━━━━━━\n` +
                   `🗂 Type     : ${payload.type}\n` +
                   `👤 Player  : ${payload.name}\n` +
                   `📧 Email    : ${payload.email || "Not provided"}\n` +
                   `📱 Device  : ${payload.deviceInfo}\n` +
                   `🕐 Time     : ${new Date().toLocaleString("en-BD", { timeZone: "Asia/Dhaka" })}\n` +
                   `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                   `💬 Message:\n${payload.message}`,
          time: new Date().toLocaleString("en-BD", { timeZone: "Asia/Dhaka" }),
        };

        const emailjsPromise = (typeof emailjs !== "undefined")
          ? emailjs.send("service_st1ild6", "template_7vi3rr4", emailParams)
          : Promise.reject("emailjs not loaded");

        // Backup: Render Server store (no email, just log)
        const serverUrl = IS_PROD ? "https://dodge-ultimate-arena.onrender.com" : "http://localhost:9000";
        fetch(`${serverUrl}/api/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).catch(() => {});

        emailjsPromise
          .then(() => {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.innerText = "🚀 SEND FEEDBACK";
            }
            if (statusMsg) {
              statusMsg.style.color = "#10b981";
              statusMsg.innerText = "✅ Thank you! Your feedback has been sent to Abrar Swapnil!";
            }
            setTimeout(() => {
              feedbackForm.reset();
              document.getElementById("feedback-modal-overlay")?.classList.add("hidden");
              if (statusMsg) statusMsg.innerText = "";
            }, 1800);
          })
          .catch(() => {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.innerText = "🚀 SEND FEEDBACK";
            }
            if (statusMsg) {
              statusMsg.style.color = "#ef4444";
              statusMsg.innerText = "❌ Failed to send. Please try again!";
            }
          });
      });

      // Rules Translate in Bangla / English toggle
      const translateBtn = document.getElementById("btn-translate-rules");
      const rulesEn = document.getElementById("rules-en");
      const rulesBn = document.getElementById("rules-bn");
      translateBtn?.addEventListener("click", () => {
        const isEnglishActive = !rulesEn.classList.contains("hidden");
        if (isEnglishActive) {
          rulesEn.classList.add("hidden");
          rulesBn.classList.remove("hidden");
          translateBtn.innerText = "🌐 Read in English";
        } else {
          rulesBn.classList.add("hidden");
          rulesEn.classList.remove("hidden");
          translateBtn.innerText = "🌐 Translate in বাংলা";
        }
      });

      // Character Shape Selection
      document.querySelectorAll(".shape-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          document.querySelectorAll(".shape-btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          const shape = btn.getAttribute("data-shape") || "square";
          this.setPlayerShape(shape);
        });
      });

      // Character Photo Uploader
      const photoInput = document.getElementById("char-photo-input");
      photoInput?.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target?.result;
            if (dataUrl) this.setPlayerPhoto(dataUrl);
          };
          reader.readAsDataURL(file);
        }
      });

      document.getElementById("btn-remove-photo")?.addEventListener("click", () => {
        this.removePlayerPhoto();
      });

      // Mode Start Buttons
      document.getElementById("btn-mode-solo")?.addEventListener("click", () => {
        this.sounds._init();
        this.startMatch("SOLO");
      });
      document.getElementById("btn-mode-online")?.addEventListener("click", () => {
        this.sounds._init();
        // Show new lobby sub-panel (create/join choice) or directly open lobby
        document.getElementById("online-panel")?.classList.remove("hidden");
      });
      document.getElementById("online-back-btn")?.addEventListener("click", () => {
        document.getElementById("online-panel")?.classList.add("hidden");
      });

      // Host / Join — wired to new 8-player lobby system
      document.getElementById("btn-create-room")?.addEventListener("click", () => this.lobbyCreate());
      document.getElementById("btn-join-room")?.addEventListener("click", () => {
        const input = document.getElementById("join-room-input");
        if (input && input.value.trim()) this.lobbyJoin(input.value.trim().toUpperCase());
      });
      document.getElementById("btn-copy-link")?.addEventListener("click", () => {
        const code = document.getElementById("created-room-code")?.innerText;
        if (code) {
          const url = `${window.location.origin}${window.location.pathname}?room=${code}`;
          navigator.clipboard.writeText(url).then(() => {
            const btn = document.getElementById("btn-copy-link");
            if (btn) btn.innerText = "Copied!";
            setTimeout(() => { if (btn) btn.innerText = "Copy Invite Link"; }, 2000);
          }).catch(() => {});
        }
      });

      // Auto-join from URL param — route to new lobby
      const urlParams = new URLSearchParams(window.location.search);
      const roomParam = urlParams.get("room");
      if (roomParam) {
        document.getElementById("online-panel")?.classList.remove("hidden");
        const joinInput = document.getElementById("join-room-input");
        if (joinInput) joinInput.value = roomParam.toUpperCase();
        setTimeout(() => this.lobbyJoin(roomParam.toUpperCase()), 500);
      }
    }

    showMenu() {
      this.hidePause();
      this.state = "MENU";
      document.getElementById("modal-overlay")?.classList.remove("hidden");
      document.getElementById("match-banner")?.classList.add("hidden");

      // Dynamic Active Paused Match Card
      const resumeBtn = document.getElementById("btn-resume-active-match");
      const resumeText = document.getElementById("resume-match-status-text");
      if (resumeBtn) {
        if (this.hasPausedMatch && this.p1 && this.p1.isAlive) {
          resumeBtn.classList.remove("hidden");
          const modeLabel = (this.mode === "CUSTOM_ROOM") ? "Multiplayer Room" : "Solo Campaign";
          const livesLeft = this.p1.lives !== undefined ? this.p1.lives : 3;
          if (resumeText) {
            resumeText.innerText = `${modeLabel} • Score: ${this.p1Score} • Lvl ${this.level} (Map ${this.mapIndex}) • Lives: ${livesLeft}/3`;
          }
        } else {
          resumeBtn.classList.add("hidden");
        }
      }
    }

    hideMenu() {
      document.getElementById("modal-overlay")?.classList.add("hidden");
    }

    togglePause() {
      if (this.state === "PLAYING") {
        this.pauseGame();
      } else if (this.state === "PAUSED") {
        this.resumeWithCountdown();
      }
    }

    pauseGame() {
      if (this.state !== "PLAYING") return;
      this.state = "PAUSED";
      this.hasPausedMatch = true;
      const soundBtn = document.getElementById("sound-btn");
      if (soundBtn) {
        soundBtn.innerHTML = this.sounds.muted ? "🔇 <span>Sound: OFF</span>" : "🔊 <span>Sound: ON</span>";
      }
      document.getElementById("pause-overlay")?.classList.remove("hidden");
    }

    hidePause() {
      document.getElementById("pause-overlay")?.classList.add("hidden");
      document.getElementById("countdown-overlay")?.classList.add("hidden");
    }

    resumeWithCountdown() {
      document.getElementById("pause-overlay")?.classList.add("hidden");
      const countdownOverlay = document.getElementById("countdown-overlay");
      const countdownNum = document.getElementById("countdown-number");
      if (!countdownOverlay || !countdownNum) {
        this.state = "PLAYING";
        return;
      }

      this.state = "COUNTDOWN";
      countdownOverlay.classList.remove("hidden");

      let count = 3;
      countdownNum.innerText = count;
      this.sounds.playTone(587.33, "sine", 0.09, 0.2);

      const timerId = setInterval(() => {
        count--;
        if (count > 0) {
          countdownNum.innerText = count;
          this.sounds.playTone(587.33, "sine", 0.09, 0.2);
        } else if (count === 0) {
          countdownNum.innerText = "GO!";
          this.sounds.playDash();
        } else {
          clearInterval(timerId);
          countdownOverlay.classList.add("hidden");
          this.state = "PLAYING";
        }
      }, 700);
    }

    // --- Input Handlers ---
    setupKeyboard() {
      const keysDown = {};

      window.addEventListener("keydown", (e) => {
        // Ignore game hotkeys if typing in an input, textarea, or contentEditable
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : "";
        if (activeTag === "input" || activeTag === "textarea" || document.activeElement?.isContentEditable) {
          return;
        }

        this.sounds._init();
        keysDown[e.code] = true;

        const myPlayer = (this.mode === "CUSTOM_ROOM" && this.myRole === "p2") ? this.p2 : this.p1;
        const rivalPlayer = (myPlayer === this.p1) ? this.p2 : this.p1;

        // Space: Dash
        if (e.code === "Space") {
          e.preventDefault();
          const localMP = this.mpState?.players?.get(this.peer?.id || (this.isHost ? "host" : "guest"));
          if (localMP && localMP.freezeTimer > 0) return;
          if (myPlayer.dash()) {
            this.sounds.playDash();
            if (this.mode === "CUSTOM_ROOM" && !this.isHost && this.conn) this.conn.send({ type: "DASH" });
          }
        }

        // F: Push / Shockwave
        if (e.code === "KeyF") {
          if (myPlayer.shockwave()) {
            this.sounds.playPush();
            this.triggerShockwave(myPlayer);
            if (this.mode === "CUSTOM_ROOM" && !this.isHost && this.conn) this.conn.send({ type: "PUSH" });
          }
        }

        // B: Emergency Dodge (3x)
        if (e.code === "KeyB") {
          if (myPlayer.emergencyDodge(this.enemies)) {
            this.sounds.playEmerDodge();
            this.floatingTexts.push(new FloatingText(myPlayer.x, myPlayer.y, "PHASE DODGED!", "#a855f7"));
            this.updateDodgeBadge(myPlayer.emerDodges);
            if (this.mode === "CUSTOM_ROOM" && !this.isHost && this.conn) this.conn.send({ type: "EMER_DODGE" });
          }
        }

        // E: Giant Beam Cannon
        if (e.code === "KeyE") {
          if (myPlayer.isGiant) {
            const tx = rivalPlayer.x + rivalPlayer.size / 2;
            const ty = rivalPlayer.y + rivalPlayer.size / 2;
            if (myPlayer.fireBeam(tx, ty)) {
              this.sounds.playBeam();
              this.floatingTexts.push(new FloatingText(myPlayer.x, myPlayer.y, "BEAM FIRED!", "#ff0055"));
              if (this.mode === "CUSTOM_ROOM" && !this.isHost && this.conn) {
                this.conn.send({ type: "BEAM", tx, ty });
              }
            }
          }
        }

        // G: Fire Gun (Solo)
        if (e.code === "KeyG" && this.mode === "SOLO") {
          this.firePlayerBullet();
        }

        // Shift: Sprint (Hold to Sprint)
        if (e.key === "Shift" || e.code === "ShiftLeft" || e.code === "ShiftRight") {
          if (!myPlayer.isSprinting && myPlayer.startSprint()) {
            this.sounds.playDash();
            this.floatingTexts.push(new FloatingText(myPlayer.x, myPlayer.y, "SPRINT BOOST!", "#00ff88"));
            if (this.mode === "CUSTOM_ROOM" && !this.isHost && this.conn) this.conn.send({ type: "START_SPRINT" });
          }
        }

        if (e.code === "Enter") {
          if (this.state === "MATCH_OVER") this.startMatch(this.mode);
        }

        // P or Escape: Pause / Resume
        if (e.code === "KeyP" || e.code === "Escape") {
          e.preventDefault();
          this.togglePause();
        }
      });

      window.addEventListener("keyup", (e) => {
        keysDown[e.code] = false;

        if (e.key === "Shift" || e.code === "ShiftLeft" || e.code === "ShiftRight") {
          const myPlayer = (this.mode === "CUSTOM_ROOM" && this.myRole === "p2") ? this.p2 : this.p1;
          myPlayer.stopSprint();
          if (this.mode === "CUSTOM_ROOM" && !this.isHost && this.conn) this.conn.send({ type: "STOP_SPRINT" });
        }
      });

      // Clear key state on blur or tab switch so player never gets stuck
      window.addEventListener("blur", () => {
        for (const k in keysDown) keysDown[k] = false;
        this.p1Input.x = 0;
        this.p1Input.y = 0;
      });
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          for (const k in keysDown) keysDown[k] = false;
          this.p1Input.x = 0;
          this.p1Input.y = 0;
        }
      });

      // Prevent right-click context menu so player never gets frozen
      window.addEventListener("contextmenu", (e) => {
        if (this.state === "PLAYING") e.preventDefault();
      });

      this.pollKeyboard = () => {
        // WASD & Arrows
        let moveX = (keysDown["KeyD"] || keysDown["ArrowRight"] ? 1 : 0) - (keysDown["KeyA"] || keysDown["ArrowLeft"] ? 1 : 0);
        let moveY = (keysDown["KeyS"] || keysDown["ArrowDown"] ? 1 : 0) - (keysDown["KeyW"] || keysDown["ArrowUp"] ? 1 : 0);

        if (Math.abs(this.joystickVector.x) > 0.05 || Math.abs(this.joystickVector.y) > 0.05) {
          moveX = this.joystickVector.x;
          moveY = this.joystickVector.y;
        }

        if (this.mode === "CUSTOM_ROOM" && this.myRole === "p2") {
          this.p2Input.x = Math.max(-1, Math.min(1, moveX));
          this.p2Input.y = Math.max(-1, Math.min(1, moveY));
          if (this.mpState) {
            this.p1Input.x = this.p2Input.x;
            this.p1Input.y = this.p2Input.y;
          }
        } else {
          this.p1Input.x = Math.max(-1, Math.min(1, moveX));
          this.p1Input.y = Math.max(-1, Math.min(1, moveY));
        }
      };
    }

    setupTouch() {
      const zone = document.getElementById("joystick-zone");
      const base = document.getElementById("joystick-base");
      const knob = document.getElementById("joystick-knob");
      if (!zone || !base || !knob) return;

      const maxRadius = 45;
      let activeTouchId = null;
      let baseCenter = { x: 0, y: 0 };

      const updateCenter = () => {
        const rect = base.getBoundingClientRect();
        baseCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      };

      const handleMove = (clientX, clientY) => {
        const dx = clientX - baseCenter.x;
        const dy = clientY - baseCenter.y;
        const dist = Math.hypot(dx, dy);
        const clampedDist = Math.min(dist, maxRadius);
        const angle = Math.atan2(dy, dx);
        const knobX = Math.cos(angle) * clampedDist;
        const knobY = Math.sin(angle) * clampedDist;

        knob.style.transform = `translate(${knobX}px, ${knobY}px)`;
        this.joystickVector.x = knobX / maxRadius;
        this.joystickVector.y = knobY / maxRadius;
      };

      const resetKnob = () => {
        knob.style.transform = "translate(0px, 0px)";
        this.joystickVector.x = 0;
        this.joystickVector.y = 0;
      };

      // Laptop Mouse Controls
      let mouseDragging = false;

      zone.addEventListener("mousedown", (e) => {
        e.preventDefault();
        mouseDragging = true;
        this.sounds._init();
        updateCenter();
        handleMove(e.clientX, e.clientY);
      });

      window.addEventListener("mousemove", (e) => {
        if (mouseDragging) {
          handleMove(e.clientX, e.clientY);
        }
      });

      window.addEventListener("mouseup", () => {
        if (mouseDragging) {
          mouseDragging = false;
          resetKnob();
        }
      });

      zone.addEventListener("contextmenu", (e) => e.preventDefault());
      window.addEventListener("blur", () => {
        if (mouseDragging) {
          mouseDragging = false;
          resetKnob();
        }
      });

      // Mobile Touch Controls
      zone.addEventListener("touchstart", (e) => {
        e.preventDefault();
        this.sounds._init();
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (activeTouchId === null) {
            activeTouchId = t.identifier;
            updateCenter();
            handleMove(t.clientX, t.clientY);
            break;
          }
        }
      }, { passive: false });

      window.addEventListener("touchmove", (e) => {
        if (activeTouchId === null) return;
        for (let i = 0; i < e.touches.length; i++) {
          const t = e.touches[i];
          if (t.identifier === activeTouchId) {
            handleMove(t.clientX, t.clientY);
            break;
          }
        }
      }, { passive: false });

      const onTouchEnd = (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === activeTouchId) {
            activeTouchId = null;
            resetKnob();
            break;
          }
        }
      };
      window.addEventListener("touchend", onTouchEnd, { passive: false });
      window.addEventListener("touchcancel", onTouchEnd, { passive: false });

      // Mobile Ability Buttons
      const getActivePlayer = () => (this.mode === "CUSTOM_ROOM" && this.myRole === "p2") ? this.p2 : this.p1;
      const getRivalPlayer = () => (getActivePlayer() === this.p1) ? this.p2 : this.p1;

      // Sprint (Hold to Sprint, 20s Cooldown)
      const sprintBtn = document.getElementById("sprint-btn");
      const onSprintStart = (e) => {
        if (e.cancelable) e.preventDefault();
        this.sounds._init();
        const p = getActivePlayer();
        if (p.startSprint()) {
          this.sounds.playDash();
          this.floatingTexts.push(new FloatingText(p.x, p.y, "SPRINT BOOST!", "#00ff88"));
          sprintBtn?.classList.add("sprinting");
          if (this.mode === "CUSTOM_ROOM" && !this.isHost && this.conn) this.conn.send({ type: "START_SPRINT" });
        }
      };
      const onSprintStop = (e) => {
        const p = getActivePlayer();
        if (p.isSprinting) {
          p.stopSprint();
          sprintBtn?.classList.remove("sprinting");
          if (this.mode === "CUSTOM_ROOM" && !this.isHost && this.conn) this.conn.send({ type: "STOP_SPRINT" });
        }
      };

      sprintBtn?.addEventListener("pointerdown", onSprintStart);
      sprintBtn?.addEventListener("pointerup", onSprintStop);
      sprintBtn?.addEventListener("pointercancel", onSprintStop);
      sprintBtn?.addEventListener("pointerleave", onSprintStop);

      // Dash
      const dashBtn = document.getElementById("dash-btn");
      const handleDash = (e) => {
        if (e.cancelable) e.preventDefault();
        this.sounds._init();
        const localMP = this.mpState?.players?.get(this.peer?.id || (this.isHost ? "host" : "guest"));
        if (localMP && localMP.freezeTimer > 0) return;
        const p = getActivePlayer();
        if (p.dash()) {
          this.sounds.playDash();
          if (this.mode === "CUSTOM_ROOM" && !this.isHost && this.conn) this.conn.send({ type: "DASH" });
        }
      };
      dashBtn?.addEventListener("pointerdown", handleDash);

      // Push
      const pushBtn = document.getElementById("push-btn");
      const handlePush = (e) => {
        if (e.cancelable) e.preventDefault();
        this.sounds._init();
        const p = getActivePlayer();
        if (p.shockwave()) {
          this.sounds.playPush();
          this.triggerShockwave(p);
          if (this.mode === "CUSTOM_ROOM" && !this.isHost && this.conn) this.conn.send({ type: "PUSH" });
        }
      };
      pushBtn?.addEventListener("pointerdown", handlePush);

      // Emergency Dodge
      const emerBtn = document.getElementById("emer-dodge-btn");
      const handleEmerDodge = (e) => {
        if (e.cancelable) e.preventDefault();
        this.sounds._init();
        const p = getActivePlayer();
        if (p.emergencyDodge(this.enemies)) {
          this.sounds.playEmerDodge();
          this.floatingTexts.push(new FloatingText(p.x, p.y, "PHASE DODGED!", "#a855f7"));
          this.updateDodgeBadge(p.emerDodges);
          if (this.mode === "CUSTOM_ROOM" && !this.isHost && this.conn) this.conn.send({ type: "EMER_DODGE" });
        }
      };
      emerBtn?.addEventListener("pointerdown", handleEmerDodge);

      // Beam Cannon (E)
      const beamBtn = document.getElementById("beam-btn");
      const handleBeam = (e) => {
        if (e.cancelable) e.preventDefault();
        this.sounds._init();
        const p = getActivePlayer();
        if (p.isGiant) {
          const rival = getRivalPlayer();
          const tx = rival.x + rival.size / 2;
          const ty = rival.y + rival.size / 2;
          if (p.fireBeam(tx, ty)) {
            this.sounds.playBeam();
            this.floatingTexts.push(new FloatingText(p.x, p.y, "BEAM FIRED!", "#ff0055"));
            if (this.mode === "CUSTOM_ROOM" && !this.isHost && this.conn) {
              this.conn.send({ type: "BEAM", tx, ty });
            }
          }
        }
      };
      beamBtn?.addEventListener("pointerdown", handleBeam);

      // Gun Button (Solo: fires AK-47 / Minigun; MP: fires Fireball Gun or Infection Weapon)
      const gunBtn = document.getElementById("gun-btn");
      gunBtn?.addEventListener("pointerdown", (e) => {
        if (e.cancelable) e.preventDefault();
        this.sounds._init();
        if (this.mode === "SOLO" && this.state === "PLAYING") this.firePlayerBullet();
        else if (this.mode === "CUSTOM_ROOM" && this.mpState && this.state === "PLAYING") this.fireMultiplayerWeapon();
      });

      // Canvas click to restart
      this.canvas.addEventListener("click", () => {
        this.sounds._init();
        if (this.state === "MATCH_OVER") this.startMatch(this.mode);
      });

      // === Left mouse hold / Alt hold → continuous gun fire (Solo) ===
      let gunFireInterval = null;
      const startGunFire = () => {
        if (this.mode !== "SOLO" || this.state !== "PLAYING") return;
        this.sounds._init();
        this.firePlayerBullet();
        if (!gunFireInterval) {
          gunFireInterval = setInterval(() => {
            if (this.mode === "SOLO" && this.state === "PLAYING") this.firePlayerBullet();
            else stopGunFire();
          }, 90);
        }
      };
      const stopGunFire = () => {
        clearInterval(gunFireInterval);
        gunFireInterval = null;
      };

      // Block browser context menu on canvas & prevent right-click freeze
      this.canvas.addEventListener("contextmenu", (e) => {
        e.preventDefault();
      });

      // Left mouse button on canvas / Right click protection
      this.canvas.addEventListener("mousedown", (e) => {
        if (e.button === 2) {
          e.preventDefault();
          return;
        }
        if (e.button === 0) startGunFire();
      });
      window.addEventListener("mouseup", (e) => {
        if (e.button === 0) stopGunFire();
      });
      window.addEventListener("blur", () => {
        stopGunFire();
      });

      // Alt key hold (Solo) / KeyJ or Alt (MP Elite / Infection)
      window.addEventListener("keydown", (e) => {
        if ((e.code === "AltLeft" || e.code === "AltRight") && this.mode === "SOLO") {
          e.preventDefault();
          startGunFire();
        } else if ((e.code === "KeyJ" || e.code === "AltLeft" || e.code === "AltRight") && this.mode === "CUSTOM_ROOM") {
          this.fireMultiplayerWeapon();
        }
      });
      window.addEventListener("keyup", (e) => {
        if (e.code === "AltLeft" || e.code === "AltRight") stopGunFire();
      });
    }

    updateDodgeBadge(count) {
      const badge = document.getElementById("dodge-count-badge");
      if (badge) badge.innerText = count;
      const emerBtn = document.getElementById("emer-dodge-btn");
      if (emerBtn) {
        if (count <= 0) {
          emerBtn.style.opacity = "0.45";
          emerBtn.style.filter = "grayscale(0.75)";
        } else {
          emerBtn.style.opacity = "1";
          emerBtn.style.filter = "none";
        }
      }
    }

    setupCanvasScaling() {
      const resize = () => {
        const container = document.getElementById("game-wrapper");
        if (!container) return;

        const availW = container.clientWidth - 16;
        const availH = container.clientHeight - 16;
        const targetRatio = SCREEN_WIDTH / SCREEN_HEIGHT;

        let w = availW;
        let h = w / targetRatio;
        if (h > availH) {
          h = availH;
          w = h * targetRatio;
        }

        w = Math.floor(w);
        h = Math.floor(h);

        this.canvas.style.width = `${w}px`;
        this.canvas.style.height = `${h}px`;

        const dpr = IS_MOBILE ? 1 : Math.min(window.devicePixelRatio || 1, 2);
        this.canvas.width = SCREEN_WIDTH * dpr;
        this.canvas.height = SCREEN_HEIGHT * dpr;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Ensure brand text is compact on mobile / landscape across all browsers & iOS
        const brandSub = document.querySelector(".brand-sub");
        if (brandSub) {
          const isCompact = window.innerWidth <= 768 || window.innerHeight <= 550 || (window.innerWidth <= 950 && window.innerHeight < window.innerWidth);
          brandSub.style.display = isCompact ? "none" : "";
        }

        // Re-apply saved HUD layout on screen resize / orientation so buttons adapt gracefully
        if (!document.body.classList.contains("hud-editing")) {
          const savedHud = localStorage.getItem("dodgearena_hud_layout");
          if (savedHud) {
            try { this.applyHudLayout(JSON.parse(savedHud)); } catch (_) {}
          }
        }
      };

      window.addEventListener("resize", resize);
      window.addEventListener("orientationchange", () => setTimeout(resize, 200));
      resize();
    }

    // --- Custom HUD Layout & Cloud Persistence ---
    initUserAndLoadHUD() {
      // Load saved character customization
      const savedCreds = this._getStoredCreds();
      const savedShape = localStorage.getItem("dodgearena_char_shape") || "square";
      const savedPhoto = localStorage.getItem("dodgearena_char_photo");
      if (savedCreds && savedPhoto) {
        this.setPlayerPhoto(savedPhoto, false);
      } else {
        localStorage.removeItem("dodgearena_char_photo");
        this.setPlayerShape(savedShape, false);
      }

      // Generate or retrieve persistent User ID
      let uid = localStorage.getItem("dodgearena_user_id");
      if (!uid) {
        uid = "user_" + Math.random().toString(36).substring(2, 10);
        localStorage.setItem("dodgearena_user_id", uid);
      }
      this.userId = uid;

      // 1. Try loading from LocalStorage first for instant speed
      const localLayout = localStorage.getItem("dodgearena_hud_layout");
      if (localLayout) {
        try {
          this.applyHudLayout(JSON.parse(localLayout));
        } catch (e) {}
      }

      // 2. Fetch from Cloud Server in background if in browser
      if (typeof window !== "undefined" && window.location) {
        const serverUrl = IS_PROD ? "https://dodge-ultimate-arena.onrender.com" : "http://localhost:9000";
        try {
          fetch(`${serverUrl}/api/hud-layout/${this.userId}`)
            .then(res => res.json())
            .then(data => {
              if (data && data.success && data.layout) {
                this.applyHudLayout(data.layout);
                localStorage.setItem("dodgearena_hud_layout", JSON.stringify(data.layout));
              }
            })
            .catch(() => {});
        } catch (err) {}
      }
    }

    // --- Gamer Account System ---
    initAccountSystem() {
      if (typeof window === "undefined") return;

      const serverUrl = IS_PROD
        ? "https://dodge-ultimate-arena.onrender.com"
        : "http://localhost:9000";

      this.authMode = "login"; // "login" or "register"

      // Warm up Render free-tier server in background immediately on page load
      // so it's awake by the time the user clicks login
      if (IS_PROD) {
        fetch(`${serverUrl}/`, { method: "GET" }).catch(() => {});
      }

      // Open / close modal
      document.getElementById("btn-open-account-modal")?.addEventListener("click", () => {
        document.getElementById("account-modal-overlay")?.classList.remove("hidden");
      });
      const closeModal = () => {
        document.getElementById("account-modal-overlay")?.classList.add("hidden");
      };
      document.getElementById("btn-close-account-modal")?.addEventListener("click", closeModal);
      document.getElementById("account-modal-overlay")?.addEventListener("click", (e) => {
        if (e.target === document.getElementById("account-modal-overlay")) closeModal();
      });

      // Tab Switching: Login vs Register
      const tabLogin = document.getElementById("tab-auth-login");
      const tabRegister = document.getElementById("tab-auth-register");
      const descEl = document.getElementById("auth-tab-desc");
      const submitBtn = document.getElementById("btn-submit-account");
      const suggestionsBox = document.getElementById("username-suggestions");
      const msgEl = document.getElementById("account-status-msg");

      tabLogin?.addEventListener("click", () => {
        this.authMode = "login";
        tabLogin.classList.add("active");
        tabRegister?.classList.remove("active");
        if (descEl) descEl.innerText = "Enter your existing Gamer Tag and secret PIN to load your cloud profile.";
        if (submitBtn) submitBtn.innerText = "🔑 LOGIN TO ACCOUNT";
        if (suggestionsBox) suggestionsBox.classList.add("hidden");
        if (msgEl) msgEl.innerText = "";
      });

      tabRegister?.addEventListener("click", () => {
        this.authMode = "register";
        tabRegister.classList.add("active");
        tabLogin?.classList.remove("active");
        if (descEl) descEl.innerText = "Choose a unique Gamer Tag and unique secret PIN (no email needed).";
        if (submitBtn) submitBtn.innerText = "✨ CREATE NEW ACCOUNT";
        if (suggestionsBox) suggestionsBox.classList.add("hidden");
        if (msgEl) msgEl.innerText = "";
      });

      // 1. Instant Profile Bar Update (0ms latency — NO modal open, just show name in bar)
      try {
        const savedCreds = this._getStoredCreds();
        const savedProfile = JSON.parse(localStorage.getItem("dodgearena_gamer_profile") || "null");
        if (savedCreds && savedProfile && savedProfile.username &&
            savedProfile.username.toLowerCase() === savedCreds.username.toLowerCase()) {
          // Set profile data instantly — only update the profile bar, never touch account modal
          this.gamerProfile = { ...savedProfile, offline: false };
          if (this.p1) this.p1.name = savedProfile.username;
          this._updateProfileBar();
          // NOTE: Do NOT manipulate account modal views here — modal is hidden, let it be
        }
      } catch (e) {}

      // 2. Background Cloud Sync & Verification (silent — no UI interruption)
      const savedCreds = this._getStoredCreds();
      if (savedCreds) {
        this._doAuth("login", savedCreds.username, savedCreds.pin, serverUrl, true /* silent */);
      }

      // 3. Keep-Alive Ping (keeps Render container awake during gameplay)
      setInterval(() => {
        if (document.visibilityState === "visible") {
          fetch(`${serverUrl}/health`).catch(() => {});
        }
      }, 5 * 60 * 1000);

      // Login / Register form submit
      document.getElementById("gamer-login-form")?.addEventListener("submit", (e) => {
        e.preventDefault();
        const username = (document.getElementById("acc-username-input")?.value || "").trim();
        const pin = (document.getElementById("acc-pin-input")?.value || "").trim();
        if (!username || !pin) return;
        if (msgEl) {
          msgEl.style.color = "#aaa";
          msgEl.innerText = "⏳ Connecting...";
        }
        if (suggestionsBox) suggestionsBox.classList.add("hidden");
        this._doAuth(this.authMode, username, pin, serverUrl, false);
      });

      // Sync to cloud button
      document.getElementById("btn-sync-cloud-now")?.addEventListener("click", () => {
        this.syncProfileToCloud(serverUrl);
      });

      // Logout button
      document.getElementById("btn-logout-account")?.addEventListener("click", () => {
        localStorage.removeItem("dodgearena_gamer_credentials");
        localStorage.removeItem("dodgearena_gamer_profile");
        localStorage.removeItem("dodgearena_char_photo");
        this.gamerProfile = null;
        if (this.p1) this.p1.name = "Player 1";
        this.setPlayerShape("square", true);
        this._updateProfileBar();
        document.getElementById("account-logged-in-view")?.classList.add("hidden");
        document.getElementById("account-logged-out-view")?.classList.remove("hidden");
        const msgEl = document.getElementById("account-status-msg");
        if (msgEl) { msgEl.innerText = "👋 Logged out!"; msgEl.style.color = "#aaa"; }
      });

      // Direct Profile Avatar Upload / Edit in Profile Modal
      const profileAvatarInput = document.getElementById("profile-avatar-input");
      const loggedAvatarPreview = document.getElementById("logged-avatar-preview");
      const btnRemoveProfileAvatar = document.getElementById("btn-remove-profile-avatar");
      const syncStatusEl = document.getElementById("account-sync-status");

      loggedAvatarPreview?.addEventListener("click", () => {
        profileAvatarInput?.click();
      });

      profileAvatarInput?.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          const rawUrl = event.target?.result;
          if (!rawUrl) return;

          // Resize and compress to 128x128 thumbnail
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = 128;
            canvas.height = 128;
            const ctx = canvas.getContext("2d");
            const minDim = Math.min(img.width, img.height);
            const sx = (img.width - minDim) / 2;
            const sy = (img.height - minDim) / 2;
            ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, 128, 128);
            const compressed = canvas.toDataURL("image/jpeg", 0.85);

            this.setPlayerPhoto(compressed, true);

            if (syncStatusEl) {
              syncStatusEl.style.color = "#00e5ff";
              syncStatusEl.innerText = "⏳ Saving photo to cloud...";
            }
            this.syncProfileToCloud(serverUrl).then(() => {
              if (syncStatusEl) {
                syncStatusEl.style.color = "#00e5ff";
                syncStatusEl.innerText = "✅ Profile photo updated & cloud synced!";
                setTimeout(() => { if (syncStatusEl) syncStatusEl.innerText = ""; }, 3000);
              }
            });
          };
          img.src = rawUrl;
        };
        reader.readAsDataURL(file);
      });

      btnRemoveProfileAvatar?.addEventListener("click", () => {
        this.removePlayerPhoto();
        this.syncProfileToCloud(serverUrl);
        if (syncStatusEl) {
          syncStatusEl.style.color = "#ffaa00";
          syncStatusEl.innerText = "Photo removed. Geometric avatar active.";
          setTimeout(() => { if (syncStatusEl) syncStatusEl.innerText = ""; }, 3000);
        }
      });
    }

    _renderSuggestions(suggestions) {
      const container = document.getElementById("suggestion-chips-container");
      const box = document.getElementById("username-suggestions");
      if (!container || !box) return;

      container.innerHTML = "";
      if (!suggestions || suggestions.length === 0) {
        box.classList.add("hidden");
        return;
      }

      suggestions.forEach((tag) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "suggestion-chip";
        chip.innerText = tag;
        chip.addEventListener("click", () => {
          const input = document.getElementById("acc-username-input");
          if (input) input.value = tag;
          box.classList.add("hidden");
          document.getElementById("acc-pin-input")?.focus();
          const msgEl = document.getElementById("account-status-msg");
          if (msgEl) {
            msgEl.style.color = "#00e5ff";
            msgEl.innerText = `Selected '${tag}'! Now enter your PIN and click Create Account.`;
          }
        });
        container.appendChild(chip);
      });

      box.classList.remove("hidden");
    }

    _getStoredCreds() {
      try {
        const raw = localStorage.getItem("dodgearena_gamer_credentials");
        if (!raw) return null;
        const c = JSON.parse(raw);
        if (c && c.username && c.pin) return c;
      } catch (e) {}
      return null;
    }

    _doLogin(username, pin, serverUrl, silent, attempt) {
      return this._doAuth("login", username, pin, serverUrl, silent, attempt);
    }

    _doAuth(mode, username, pin, serverUrl, silent, attempt) {
      attempt = attempt || 1;
      const MAX_ATTEMPTS = 4;
      const msgEl = document.getElementById("account-status-msg");

      // 1. Instant Local Vault / Cache Login (0ms instant access)
      let matchedCachedProfile = null;
      if (mode === "login") {
        try {
          const vault = JSON.parse(localStorage.getItem("dodgearena_account_vault") || "{}");
          const lowerName = username.toLowerCase();
          const cachedUser = vault[lowerName] || JSON.parse(localStorage.getItem("dodgearena_gamer_profile") || "null");
          const savedCreds = this._getStoredCreds();
          const cachedPin = (cachedUser && cachedUser.pin) || (savedCreds && savedCreds.pin);

          if (cachedUser && cachedPin && cachedPin.toString().trim() === pin.toString().trim() && cachedUser.username.toLowerCase() === lowerName) {
            matchedCachedProfile = { ...cachedUser, offline: false }; // clear stale offline flag
            if (!this.gamerProfile) {
              this.onLoginSuccess(matchedCachedProfile);
            }
            if (!silent && msgEl && attempt === 1) {
              msgEl.style.color = "#00e5ff";
              msgEl.innerText = `✅ Welcome back, ${cachedUser.username}! (Verifying cloud sync...)`;
            }
          }
        } catch (e) {}
      }

      // Show warm-up message on first attempt if not already logged in from cache
      if (!silent && msgEl && attempt === 1 && !matchedCachedProfile) {
        msgEl.style.color = "#aaa";
        msgEl.innerText = "⏳ Connecting... (server may take ~15s to wake up)";
      }

      // Use AbortController to enforce a 15s timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const endpoint = mode === "register" ? `${serverUrl}/api/auth/register` : `${serverUrl}/api/auth/login`;

      // Read client backup from local vault for Auto-Healing (login mode only)
      let clientBackup = null;
      if (mode === "login") {
        try {
          const vault = JSON.parse(localStorage.getItem("dodgearena_account_vault") || "{}");
          const lowerName = username.toLowerCase();
          if (vault[lowerName]) {
            clientBackup = vault[lowerName];
          } else {
            const currentProfile = JSON.parse(localStorage.getItem("dodgearena_gamer_profile") || "null");
            const savedCreds = JSON.parse(localStorage.getItem("dodgearena_gamer_credentials") || "null");
            if (currentProfile && currentProfile.username && currentProfile.username.toLowerCase() === lowerName) {
              clientBackup = { ...currentProfile, pin: (savedCreds && savedCreds.pin) ? savedCreds.pin : pin };
            }
          }
        } catch (e) {}
      }

      return fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, pin, clientBackup }),
        signal: controller.signal,
      })
        .then((r) => { clearTimeout(timeoutId); return r.json(); })
        .then((data) => {
          if (data && data.success && data.profile) {
            localStorage.setItem(
              "dodgearena_gamer_credentials",
              JSON.stringify({ username, pin })
            );

            // Merge stats ONLY if the local profile belongs to the SAME user!
            const lowerName = username.toLowerCase();
            const srv = data.profile.stats || {};
            const isSameUser = !!(this.gamerProfile && this.gamerProfile.username &&
                                  this.gamerProfile.username.toLowerCase() === lowerName);
            const loc = isSameUser ? (this.gamerProfile.stats || {}) : {};
            const mergedStats = {
              highScore:      Math.max(srv.highScore      || 0, loc.highScore      || 0),
              mpWins:         Math.max(srv.mpWins         || 0, loc.mpWins         || 0),
              mpLosses:       Math.max(srv.mpLosses       || 0, loc.mpLosses       || 0),
              bossesDefeated: Math.max(srv.bossesDefeated || 0, loc.bossesDefeated || 0),
              totalMatches:   Math.max(srv.totalMatches   || 0, loc.totalMatches   || 0),
              soloMaxLevel:   Math.max(srv.soloMaxLevel   || 1, loc.soloMaxLevel   || 1),
              mpMaxLevel:     Math.max(srv.mpMaxLevel     || 1, loc.mpMaxLevel     || 1),
            };

            // Photo: strictly use account photo; NEVER inherit previous user's photo!
            let photoVal = data.profile.photo || null;
            if (!photoVal && isSameUser && this.gamerProfile && this.gamerProfile.photo) {
              photoVal = this.gamerProfile.photo;
            }

            const mergedProfile = { ...data.profile, photo: photoVal, stats: mergedStats, offline: false };
            this.onLoginSuccess(mergedProfile);

            // If local stats or photo were ahead of server for THIS user, push merged data to cloud
            const needsUpload = isSameUser && (
              Object.keys(mergedStats).some(k => mergedStats[k] > (srv[k] || (k.includes('Level') ? 1 : 0))) ||
              (!data.profile.photo && photoVal)
            );
            if (needsUpload) {
              const serverUrl = IS_PROD ? "https://dodge-ultimate-arena.onrender.com" : "http://localhost:9000";
              this.syncProfileToCloud(serverUrl, true).catch(() => {});
            }

            const suggestionsBox = document.getElementById("username-suggestions");
            if (suggestionsBox) suggestionsBox.classList.add("hidden");

            if (!silent && msgEl) {
              msgEl.style.color = "#00e5ff";
              msgEl.innerText = data.isNew
                ? "🎉 New account created! Welcome, " + data.profile.username + "!"
                : "✅ Cloud synced! Welcome back, " + data.profile.username + "!";
            }
          } else {
            if (!silent && msgEl) {
              msgEl.style.color = "#ff4455";
              msgEl.innerText = "❌ " + (data.error || data.message || "Authentication failed.");
            }

            // If username suggestions returned, display them
            if (data.suggestions && data.suggestions.length > 0) {
              this._renderSuggestions(data.suggestions);
            }
          }
        })
        .catch((err) => {
          clearTimeout(timeoutId);

          // If already logged in via cached profile, don't show scary error
          if (matchedCachedProfile || this.gamerProfile) {
            if (!silent && msgEl) {
              msgEl.style.color = "#38bdf8";
              msgEl.innerText = "☁️ Playing with local profile. Background cloud sync will reconnect shortly.";
            }
            return;
          }

          // Auto-retry up to MAX_ATTEMPTS on network/timeout errors
          if (attempt < MAX_ATTEMPTS) {
            const nextAttempt = attempt + 1;
            if (!silent && msgEl) {
              msgEl.style.color = "#ffaa00";
              msgEl.innerText = `⏳ Cloud server deploying / waking up... retrying (${nextAttempt}/${MAX_ATTEMPTS})`;
            }
            setTimeout(() => {
              this._doAuth(mode, username, pin, serverUrl, silent, nextAttempt);
            }, 4000);
          } else {
            if (!silent) {
              if (mode === "login") {
                try {
                  const savedCreds = JSON.parse(localStorage.getItem("dodgearena_gamer_credentials") || "null");
                  const savedProfile = JSON.parse(localStorage.getItem("dodgearena_gamer_profile") || "null");

                  if (savedCreds && savedCreds.username.toLowerCase() === username.toLowerCase() && savedCreds.pin === pin && savedProfile) {
                    savedProfile.offline = true;
                    this.onLoginSuccess(savedProfile);
                    if (msgEl) {
                      msgEl.style.color = "#ffaa00";
                      msgEl.innerText = "⚠️ Offline mode — using saved profile. Sync to cloud when back online.";
                    }
                    return;
                  }
                } catch (e) {}

                if (msgEl) {
                  msgEl.style.color = "#ff4455";
                  msgEl.innerText = "❌ Cloud server is rebooting. Please wait ~30s and try again.";
                }
              } else {
                if (msgEl) {
                  msgEl.style.color = "#ffaa00";
                  msgEl.innerText = "⏳ Cloud server is updating. Please wait 30 seconds for it to finish booting.";
                }
              }
            }
          }
        });
    }

    onLoginSuccess(profile) {
      this.gamerProfile = profile;
      if (this.p1) this.p1.name = profile.username;
      localStorage.setItem("dodgearena_gamer_profile", JSON.stringify(profile));

      // Store in permanent local account vault for zero-loss recovery across redeployments
      try {
        const vault = JSON.parse(localStorage.getItem("dodgearena_account_vault") || "{}");
        const creds = this._getStoredCreds() || {};
        const pinVal = creds.pin || document.getElementById("acc-pin-input")?.value?.trim() || "";
        const lowerName = profile.username.toLowerCase();
        vault[lowerName] = {
          ...profile,
          photo: profile.photo || null,
          pin: pinVal || vault[lowerName]?.pin || "",
        };
        localStorage.setItem("dodgearena_account_vault", JSON.stringify(vault));
      } catch (e) {}

      // Apply saved avatar
      if (profile.photo) {
        localStorage.setItem("dodgearena_char_photo", profile.photo);
        this.setPlayerPhoto(profile.photo, false);
      } else {
        // Account has no custom photo: clear any previous user's photo completely
        localStorage.removeItem("dodgearena_char_photo");
        this.setPlayerShape(profile.shape || "square", false);
      }

      // Apply saved HUD layout if exists and no local one
      if (profile.hudLayout) {
        try {
          this.applyHudLayout(profile.hudLayout);
        } catch (e) {}
      }

      this._updateProfileBar();
      this._updateLoggedInUI();

      document.getElementById("account-logged-out-view")?.classList.add("hidden");
      document.getElementById("account-logged-in-view")?.classList.remove("hidden");
    }

    _updateProfileBar() {
      const p = this.gamerProfile;
      const nameEl = document.getElementById("gamer-name-display");
      const summaryEl = document.getElementById("gamer-stats-summary");
      const badgeEl = document.getElementById("gamer-avatar-badge");

      if (!p) {
        if (nameEl) nameEl.innerText = "Guest Player";
        if (summaryEl) summaryEl.innerText = "No account • Stats unsaved";
        if (badgeEl) badgeEl.innerHTML = "🎮";
        return;
      }
      if (nameEl) nameEl.innerText = p.username;
      const wins = (p.stats && p.stats.mpWins) || 0;
      const hs = (p.stats && p.stats.highScore) || 0;
      const sLvl = (p.stats && p.stats.soloMaxLevel) || 1;
      const mpLvl = (p.stats && p.stats.mpMaxLevel) || 1;
      if (summaryEl) summaryEl.innerText = `Wins: ${wins} • Score: ${hs} • Solo Lvl ${sLvl} • MP Lvl ${mpLvl}`;
      if (badgeEl) {
        if (p.photo) {
          badgeEl.innerHTML = `<img src="${p.photo}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        } else {
          const shapeEmojis = { square: "🟦", circle: "🔵", triangle: "🔺", star: "⭐", diamond: "💎" };
          badgeEl.innerHTML = shapeEmojis[p.shape] || "🎮";
        }
      }
    }

    _updateLoggedInUI() {
      const p = this.gamerProfile;
      if (!p) return;
      const s = p.stats || {};
      const lud = document.getElementById("logged-username-display");
      if (lud) lud.innerText = p.username;

      // Show offline/online badge
      const badge = document.getElementById("account-badge-pill");
      if (badge) {
        if (p.offline) {
          badge.textContent = "⚠️ OFFLINE MODE";
          badge.style.background = "rgba(255,170,0,0.2)";
          badge.style.color = "#ffaa00";
          badge.style.border = "1px solid #ffaa00";
        } else {
          badge.textContent = "CLOUD SYNCED ✅";
          badge.style.background = "";
          badge.style.color = "";
          badge.style.border = "";
        }
      }

      document.getElementById("stat-mp-wins") && (document.getElementById("stat-mp-wins").innerText = s.mpWins || 0);
      document.getElementById("stat-high-score") && (document.getElementById("stat-high-score").innerText = s.highScore || 0);
      document.getElementById("stat-solo-level") && (document.getElementById("stat-solo-level").innerText = `Lvl ${s.soloMaxLevel || 1}`);
      document.getElementById("stat-mp-level") && (document.getElementById("stat-mp-level").innerText = `Lvl ${s.mpMaxLevel || 1}`);
      document.getElementById("stat-boss-kills") && (document.getElementById("stat-boss-kills").innerText = s.bossesDefeated || 0);
      document.getElementById("stat-matches-total") && (document.getElementById("stat-matches-total").innerText = s.totalMatches || 0);

      const avatarEl = document.getElementById("logged-avatar-preview");
      if (avatarEl) {
        if (p.photo) {
          avatarEl.innerHTML = `<img src="${p.photo}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        } else {
          const shapeEmojis = { square: "🟦", circle: "🔵", triangle: "🔺", star: "⭐", diamond: "💎" };
          avatarEl.innerHTML = shapeEmojis[p.shape] || "🎮";
        }
      }

      const btnRemoveProfileAvatar = document.getElementById("btn-remove-profile-avatar");
      if (btnRemoveProfileAvatar) {
        if (p.photo) btnRemoveProfileAvatar.classList.remove("hidden");
        else btnRemoveProfileAvatar.classList.add("hidden");
      }
    }

    incrementStat(key) {
      if (!this.gamerProfile) return;
      if (!this.gamerProfile.stats) this.gamerProfile.stats = {};
      this.gamerProfile.stats[key] = (this.gamerProfile.stats[key] || 0) + 1;
      localStorage.setItem("dodgearena_gamer_profile", JSON.stringify(this.gamerProfile));
      this._updateLoggedInUI();
      this._updateProfileBar();
      const serverUrl = IS_PROD
        ? "https://dodge-ultimate-arena.onrender.com"
        : "http://localhost:9000";
      this.syncProfileToCloud(serverUrl, true /* quiet */).catch(() => {});
    }

    updateHighScore(score) {
      if (!this.gamerProfile) return;
      if (!this.gamerProfile.stats) this.gamerProfile.stats = {};
      if (score > (this.gamerProfile.stats.highScore || 0)) {
        this.gamerProfile.stats.highScore = score;
        localStorage.setItem("dodgearena_gamer_profile", JSON.stringify(this.gamerProfile));
        this._updateLoggedInUI();
        this._updateProfileBar();
        // Sync new high score to cloud so it appears on all devices
        const serverUrl = IS_PROD
          ? "https://dodge-ultimate-arena.onrender.com"
          : "http://localhost:9000";
        this.syncProfileToCloud(serverUrl, true /* quiet */).catch(() => {});
      }
    }

    updateMaxLevel(mode, level) {
      if (!this.gamerProfile) return;
      if (!this.gamerProfile.stats) this.gamerProfile.stats = {};
      const key = (mode === "CUSTOM_ROOM") ? "mpMaxLevel" : "soloMaxLevel";
      const current = this.gamerProfile.stats[key] || 1;
      if (level > current) {
        this.gamerProfile.stats[key] = level;
        localStorage.setItem("dodgearena_gamer_profile", JSON.stringify(this.gamerProfile));
        this._updateLoggedInUI();
        this._updateProfileBar();
        const serverUrl = IS_PROD
          ? "https://dodge-ultimate-arena.onrender.com"
          : "http://localhost:9000";
        this.syncProfileToCloud(serverUrl, true /* quiet */).catch(() => {});
      }
    }

    syncProfileToCloud(serverUrl, quiet = false) {
      if (!this.gamerProfile) return Promise.resolve();
      const creds = this._getStoredCreds();
      if (!creds) return Promise.resolve();
      const syncEl = document.getElementById("account-sync-status");
      if (!quiet && syncEl) { syncEl.style.color = "#aaa"; syncEl.innerText = "⏳ Syncing..."; }

      const myPlayer = (this.mode === "CUSTOM_ROOM" && this.myRole === "p2") ? this.p2 : this.p1;
      const photoToSend = (this.gamerProfile && this.gamerProfile.photo) ||
                          (myPlayer && myPlayer.avatarDataUrl) ||
                          localStorage.getItem("dodgearena_char_photo") || null;
      const shapeToSend = myPlayer.customShape ||
                          (this.gamerProfile && this.gamerProfile.shape) ||
                          localStorage.getItem("dodgearena_char_shape") || "square";

      return fetch(`${serverUrl}/api/profile/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: creds.username,
          pin: creds.pin,
          shape: shapeToSend,
          photo: photoToSend,
          hudLayout: (() => {
            try { return JSON.parse(localStorage.getItem("dodgearena_hud_layout") || "null"); } catch (e) { return null; }
          })(),
          stats: this.gamerProfile.stats || {},
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (!quiet && syncEl) {
            syncEl.style.color = data.success ? "#00e5ff" : "#ff4455";
            syncEl.innerText = data.success ? "✅ Cloud synced!" : "❌ Sync failed.";
            setTimeout(() => { if (syncEl) syncEl.innerText = ""; }, 3000);
          }
          if (data.success && data.profile) {
            this.gamerProfile = data.profile;
            localStorage.setItem("dodgearena_gamer_profile", JSON.stringify(data.profile));
            try {
              const vault = JSON.parse(localStorage.getItem("dodgearena_account_vault") || "{}");
              vault[data.profile.username.toLowerCase()] = {
                ...data.profile,
                pin: creds.pin,
              };
              localStorage.setItem("dodgearena_account_vault", JSON.stringify(vault));
            } catch (e) {}
          }
        })
        .catch(() => {
          if (!quiet && syncEl) {
            syncEl.style.color = "#ffaa00";
            syncEl.innerText = "⚠️ Offline — stats saved locally.";
            setTimeout(() => { if (syncEl) syncEl.innerText = ""; }, 3000);
          }
          // Mark profile as offline so we know to retry later
          if (this.gamerProfile) this.gamerProfile.offline = true;
        });
    }

    openHudEditor() {
      document.body.classList.add("hud-editing");
      document.getElementById("modal-overlay")?.classList.add("hidden");
      document.getElementById("hud-editor-overlay")?.classList.remove("hidden");

      // 1. All 7 customizable HUD buttons
      const ids = ["joystick-zone", "sprint-btn", "dash-btn", "push-btn", "emer-dodge-btn", "beam-btn", "gun-btn"];

      // If a saved layout exists, apply it first
      const savedLayout = localStorage.getItem("dodgearena_hud_layout");
      if (savedLayout) {
        try { this.applyHudLayout(JSON.parse(savedLayout)); } catch (e) {}
      }

      // 2. Lock ALL buttons upfront to their exact rendered screen coordinates
      // This prevents ANY button from collapsing, shifting, or jumping when another is moved!
      ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (el.style.position !== "fixed" || !el.style.left || !el.style.top) {
            el.style.position = "fixed";
            el.style.left = `${rect.left}px`;
            el.style.top = `${rect.top}px`;
            el.style.bottom = "auto";
            el.style.right = "auto";
            el.style.margin = "0";
            el.style.zIndex = "65";
          }
        }
      });

      // 3. Unstack buttons if any two are accidentally right on top of each other
      for (let i = 0; i < ids.length; i++) {
        const elA = document.getElementById(ids[i]);
        if (!elA) continue;
        const rectA = elA.getBoundingClientRect();
        for (let j = i + 1; j < ids.length; j++) {
          const elB = document.getElementById(ids[j]);
          if (!elB) continue;
          const rectB = elB.getBoundingClientRect();
          const dist = Math.hypot(rectA.left - rectB.left, rectA.top - rectB.top);
          if (dist < 15) {
            const curLeft = parseFloat(elB.style.left) || rectB.left;
            elB.style.left = `${Math.min(window.innerWidth - 65, curLeft + 35)}px`;
          }
        }
      }

      this.setupHudDragAndDrop();
    }

    closeHudEditor() {
      document.body.classList.remove("hud-editing");
      document.getElementById("hud-editor-overlay")?.classList.add("hidden");
      document.getElementById("modal-overlay")?.classList.remove("hidden");

      // Re-apply saved layout or reset to cancel any unsaved movement
      const localLayout = localStorage.getItem("dodgearena_hud_layout");
      if (localLayout) {
        try { this.applyHudLayout(JSON.parse(localLayout)); } catch (e) {}
      } else {
        this.resetHudLayout();
      }
    }

    setupHudDragAndDrop() {
      if (this.hudDragInitialized) return;
      this.hudDragInitialized = true;

      const ids = ["joystick-zone", "sprint-btn", "dash-btn", "push-btn", "emer-dodge-btn", "beam-btn", "gun-btn"];

      ids.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;

        let isDragging = false;
        let startX = 0, startY = 0;
        let origLeft = 0, origTop = 0;

        const onMove = (clientX, clientY) => {
          if (!isDragging) return;
          const dx = clientX - startX;
          const dy = clientY - startY;

          const elW = el.offsetWidth || 56;
          const elH = el.offsetHeight || 56;

          const minX = 8;
          const maxX = Math.max(minX, window.innerWidth - elW - 8);
          const minY = 65; // Below header
          const maxY = Math.max(minY, window.innerHeight - elH - 8);

          const newLeft = Math.max(minX, Math.min(maxX, origLeft + dx));
          const newTop = Math.max(minY, Math.min(maxY, origTop + dy));

          el.style.left = `${newLeft}px`;
          el.style.top = `${newTop}px`;
        };

        const onEnd = () => {
          if (!isDragging) return;
          isDragging = false;
          el.classList.remove("is-dragging");
          el.style.zIndex = "65";

          window.removeEventListener("pointermove", onPointerMove);
          window.removeEventListener("pointerup", onPointerEnd);
          window.removeEventListener("pointercancel", onPointerEnd);
          window.removeEventListener("touchmove", onTouchMove);
          window.removeEventListener("touchend", onTouchEnd);
          window.removeEventListener("touchcancel", onTouchEnd);
        };

        const onPointerMove = (e) => {
          e.preventDefault();
          onMove(e.clientX, e.clientY);
        };

        const onPointerEnd = (e) => {
          if (e && e.pointerId !== undefined) {
            try { el.releasePointerCapture(e.pointerId); } catch (_) {}
          }
          onEnd();
        };

        const onTouchMove = (e) => {
          if (e.touches && e.touches[0]) {
            e.preventDefault();
            onMove(e.touches[0].clientX, e.touches[0].clientY);
          }
        };

        const onTouchEnd = () => {
          onEnd();
        };

        const onStart = (clientX, clientY, pointerId) => {
          if (!document.body.classList.contains("hud-editing")) return;

          isDragging = true;
          startX = clientX;
          startY = clientY;

          const rect = el.getBoundingClientRect();
          origLeft = rect.left;
          origTop = rect.top;

          el.style.position = "fixed";
          el.style.left = `${origLeft}px`;
          el.style.top = `${origTop}px`;
          el.style.bottom = "auto";
          el.style.right = "auto";
          el.style.margin = "0";
          el.style.zIndex = "100";
          el.classList.add("is-dragging");

          if (pointerId !== undefined) {
            try { el.setPointerCapture(pointerId); } catch (_) {}
          }

          window.addEventListener("pointermove", onPointerMove, { passive: false });
          window.addEventListener("pointerup", onPointerEnd);
          window.addEventListener("pointercancel", onPointerEnd);
          window.addEventListener("touchmove", onTouchMove, { passive: false });
          window.addEventListener("touchend", onTouchEnd);
          window.addEventListener("touchcancel", onTouchEnd);
        };

        el.addEventListener("pointerdown", (e) => {
          if (!document.body.classList.contains("hud-editing")) return;
          e.preventDefault();
          e.stopPropagation();
          onStart(e.clientX, e.clientY, e.pointerId);
        });

        el.addEventListener("touchstart", (e) => {
          if (!document.body.classList.contains("hud-editing")) return;
          if (e.touches && e.touches[0]) {
            e.stopPropagation();
            onStart(e.touches[0].clientX, e.touches[0].clientY);
          }
        }, { passive: false });
      });
    }

    saveHudLayout() {
      const ids = ["joystick-zone", "sprint-btn", "dash-btn", "push-btn", "emer-dodge-btn", "beam-btn", "gun-btn"];
      const layout = {};

      ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          const leftPx = el.style.position === "fixed" ? parseFloat(el.style.left) : rect.left;
          const topPx = el.style.position === "fixed" ? parseFloat(el.style.top) : rect.top;
          layout[id] = {
            leftPct: (leftPx / window.innerWidth) * 100,
            topPct: (topPx / window.innerHeight) * 100,
          };
        }
      });

      // 1. Save Locally
      localStorage.setItem("dodgearena_hud_layout", JSON.stringify(layout));

      // 2. Save to Render Cloud Server
      const serverUrl = IS_PROD ? "https://dodge-ultimate-arena.onrender.com" : "http://localhost:9000";
      fetch(`${serverUrl}/api/hud-layout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: this.userId, layout }),
      }).catch(() => {});

      // Feedback to user
      const statusEl = document.getElementById("hud-save-status");
      if (statusEl) {
        statusEl.innerText = "Layout saved locally & to cloud!";
        statusEl.classList.remove("hidden");
        setTimeout(() => {
          statusEl.classList.add("hidden");
          this.closeHudEditor();
        }, 1200);
      } else {
        this.closeHudEditor();
      }
    }

    applyHudLayout(layout) {
      if (!layout) return;
      const ids = ["joystick-zone", "sprint-btn", "dash-btn", "push-btn", "emer-dodge-btn", "beam-btn", "gun-btn"];
      ids.forEach((id) => {
        const el = document.getElementById(id);
        const pos = layout[id];
        if (el && pos && pos.leftPct !== undefined && pos.topPct !== undefined) {
          const elW = el.offsetWidth || 56;
          const elH = el.offsetHeight || 56;
          const targetLeft = Math.max(8, Math.min(window.innerWidth - elW - 8, (pos.leftPct / 100) * window.innerWidth));
          const targetTop = Math.max(50, Math.min(window.innerHeight - elH - 8, (pos.topPct / 100) * window.innerHeight));

          el.style.position = "fixed";
          el.style.left = `${targetLeft}px`;
          el.style.top = `${targetTop}px`;
          el.style.bottom = "auto";
          el.style.right = "auto";
          el.style.margin = "0";
        }
      });
    }

    resetHudLayout() {
      localStorage.removeItem("dodgearena_hud_layout");
      const ids = ["joystick-zone", "sprint-btn", "dash-btn", "push-btn", "emer-dodge-btn", "beam-btn", "gun-btn"];
      ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
          el.style.position = "";
          el.style.left = "";
          el.style.top = "";
          el.style.bottom = "";
          el.style.right = "";
          el.style.margin = "";
          el.style.zIndex = "";
          el.classList.remove("is-dragging");
        }
      });

      // Clear on server
      const serverUrl = IS_PROD ? "https://dodge-ultimate-arena.onrender.com" : "http://localhost:9000";
      fetch(`${serverUrl}/api/hud-layout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: this.userId, layout: {} }),
      }).catch(() => {});

      const statusEl = document.getElementById("hud-save-status");
      if (statusEl) {
        statusEl.innerText = "Layout reset to default!";
        statusEl.classList.remove("hidden");
        setTimeout(() => {
          statusEl.classList.add("hidden");
          this.closeHudEditor();
        }, 1000);
      }
    }

    // --- Character Shape & Avatar Customization Methods ---
    setPlayerShape(shape, persist = true) {
      // Fix: always set the ACTIVE player (p2 for guests in multiplayer)
      const myPlayer = (this.mode === "CUSTOM_ROOM" && this.myRole === "p2") ? this.p2 : this.p1;
      myPlayer.customShape = shape;
      myPlayer.avatarImg = null;
      myPlayer.avatarDataUrl = null;

      localStorage.removeItem("dodgearena_char_photo");
      if (persist) {
        localStorage.setItem("dodgearena_char_shape", shape);
      }
      if (this.gamerProfile) {
        this.gamerProfile.photo = null;
        this.gamerProfile.shape = shape;
      }

      // UI Update
      document.querySelectorAll(".shape-btn").forEach((b) => {
        if (b.getAttribute("data-shape") === shape) b.classList.add("active");
        else b.classList.remove("active");
      });

      const label = document.getElementById("char-active-preview-label");
      if (label) label.innerText = shape.toUpperCase();

      const uploadBtn = document.getElementById("photo-upload-btn");
      if (uploadBtn) uploadBtn.classList.remove("has-photo");
      const rmBtn = document.getElementById("btn-remove-photo");
      if (rmBtn) rmBtn.classList.add("hidden");

      // Broadcast to rival in multiplayer
      if (this.conn && this.conn.open) {
        this.conn.send({ type: "AVATAR_UPDATE", name: myPlayer.name, shape, photo: null });
      }
    }

    setPlayerPhoto(dataUrl, persist = true) {
      const img = new Image();
      img.onload = () => {
        // Fix: always set the ACTIVE player (p2 for guests in multiplayer)
        const myPlayer = (this.mode === "CUSTOM_ROOM" && this.myRole === "p2") ? this.p2 : this.p1;
        myPlayer.avatarImg = img;
        myPlayer.avatarDataUrl = dataUrl;

        if (persist) {
          localStorage.setItem("dodgearena_char_photo", dataUrl);
          if (this.gamerProfile) {
            this.gamerProfile.photo = dataUrl;
            localStorage.setItem("dodgearena_gamer_profile", JSON.stringify(this.gamerProfile));
            this._updateProfileBar();
            this._updateLoggedInUI();
            const serverUrl = IS_PROD
              ? "https://dodge-ultimate-arena.onrender.com"
              : "http://localhost:9000";
            this.syncProfileToCloud(serverUrl, true).catch(() => {});
          }
        }

        // UI Update
        document.querySelectorAll(".shape-btn").forEach((b) => b.classList.remove("active"));
        const label = document.getElementById("char-active-preview-label");
        if (label) label.innerText = "CUSTOM PHOTO";

        const uploadBtn = document.getElementById("photo-upload-btn");
        if (uploadBtn) uploadBtn.classList.add("has-photo");
        const uploadText = document.getElementById("photo-upload-text");
        if (uploadText) uploadText.innerText = "Photo Active";
        const rmBtn = document.getElementById("btn-remove-photo");
        if (rmBtn) rmBtn.classList.remove("hidden");

        // Broadcast to rival in multiplayer (resized thumbnail)
        if (this.conn && this.conn.open) {
          this.conn.send({ type: "AVATAR_UPDATE", name: myPlayer.name, shape: null, photo: dataUrl });
        }
      };
      img.src = dataUrl;
    }

    removePlayerPhoto() {
      localStorage.removeItem("dodgearena_char_photo");
      if (this.gamerProfile) {
        this.gamerProfile.photo = null;
        localStorage.setItem("dodgearena_gamer_profile", JSON.stringify(this.gamerProfile));
        this._updateProfileBar();
        this._updateLoggedInUI();
        const serverUrl = IS_PROD
          ? "https://dodge-ultimate-arena.onrender.com"
          : "http://localhost:9000";
        const creds = this._getStoredCreds();
        if (creds) {
          fetch(`${serverUrl}/api/profile/save`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username: creds.username,
              pin: creds.pin,
              removePhoto: true,
              photo: null,
              stats: this.gamerProfile.stats || {},
            }),
          }).catch(() => {});
        }
      }
      const savedShape = localStorage.getItem("dodgearena_char_shape") || "square";
      this.setPlayerShape(savedShape);
      const uploadText = document.getElementById("photo-upload-text");
      if (uploadText) uploadText.innerText = "Upload Photo";
    }

    // --- WebRTC Multiplayer ---
    hostCustomRoom() {
      const statusBox = document.getElementById("room-code-display");
      const codeSpan = document.getElementById("created-room-code");
      const hostBtn = document.getElementById("btn-create-room");
      if (hostBtn) hostBtn.disabled = true;

      const roomCode = Math.floor(1000 + Math.random() * 9000).toString();
      const peerId = `dodgearena-room-${roomCode}`;

      try {
        this.peer = new Peer(peerId, PEER_SERVER_CONFIG);
        this.peer.on("open", () => {
          this.isHost = true;
          this.myRole = "p1";
          if (codeSpan) codeSpan.innerText = roomCode;
          if (statusBox) statusBox.classList.remove("hidden");
        });

        this.peer.on("connection", (c) => {
          this.conn = c;
          this.setupOnlineConnection();
          this.startMatch("CUSTOM_ROOM");
        });

        this.peer.on("error", () => {
          if (hostBtn) hostBtn.disabled = false;
        });
      } catch (err) {
        console.error(err);
      }
    }

    joinCustomRoom(roomCode) {
      const statusDiv = document.getElementById("join-status");
      const joinBtn = document.getElementById("btn-join-room");
      if (statusDiv) statusDiv.innerText = "Connecting...";
      if (joinBtn) joinBtn.disabled = true;

      try {
        this.peer = new Peer(undefined, PEER_SERVER_CONFIG);
        this.peer.on("open", () => {
          const peerId = `dodgearena-room-${roomCode}`;
          this.conn = this.peer.connect(peerId, { reliable: true });

          this.conn.on("open", () => {
            this.isHost = false;
            this.myRole = "p2";
            if (statusDiv) statusDiv.innerText = "Connected! Starting...";
            this.setupOnlineConnection();
            this.startMatch("CUSTOM_ROOM");
          });

          this.conn.on("error", () => {
            if (statusDiv) statusDiv.innerText = "Failed to connect. Check code.";
            if (joinBtn) joinBtn.disabled = false;
          });
        });

        this.peer.on("error", () => {
          if (statusDiv) statusDiv.innerText = "Room not found.";
          if (joinBtn) joinBtn.disabled = false;
        });
      } catch (err) {
        if (statusDiv) statusDiv.innerText = "Connection error.";
      }
    }

    setupOnlineConnection() {
      this.conn.on("data", (data) => {
        if (this.isHost) {
          if (data.type === "INPUT") {
            this.p2Input.x = data.x;
            this.p2Input.y = data.y;
          } else if (data.type === "DASH") {
            this.p2.dash();
            this.sounds.playDash();
          } else if (data.type === "PUSH") {
            if (this.p2.shockwave()) {
              this.sounds.playPush();
              this.triggerShockwave(this.p2);
            }
          } else if (data.type === "EMER_DODGE") {
            this.p2.emergencyDodge(this.enemies);
            this.sounds.playEmerDodge();
          } else if (data.type === "BEAM") {
            this.p2.fireBeam(data.tx, data.ty);
            this.sounds.playBeam();
          } else if (data.type === "START_SPRINT") {
            this.p2.startSprint();
          } else if (data.type === "STOP_SPRINT") {
            this.p2.stopSprint();
          } else if (data.type === "AVATAR_UPDATE") {
            if (data.name) this.p2.name = data.name;
            if (data.photo) {
              const img = new Image();
              img.onload = () => { this.p2.avatarImg = img; };
              img.src = data.photo;
            } else {
              this.p2.customShape = data.shape || "square";
              this.p2.avatarImg = null;
            }
            this.updateHUD();
          }
        } else {
          if (data.type === "STATE") {
            this.syncStateFromHost(data);
          } else if (data.type === "AVATAR_UPDATE") {
            if (data.name) this.p1.name = data.name;
            if (data.photo) {
              const img = new Image();
              img.onload = () => { this.p1.avatarImg = img; };
              img.src = data.photo;
            } else {
              this.p1.customShape = data.shape || "square";
              this.p1.avatarImg = null;
            }
            this.updateHUD();
          }
        }
      });

      // Send local avatar & name on connection start
      const myPlayer = this.isHost ? this.p1 : this.p2;
      const myName = (this.gamerProfile && this.gamerProfile.username) ? this.gamerProfile.username : (this.isHost ? "Host" : "Guest");
      myPlayer.name = myName;
      this.conn.send({
        type: "AVATAR_UPDATE",
        name: myName,
        shape: myPlayer.customShape,
        photo: myPlayer.avatarDataUrl,
      });
      this.updateHUD();
    }

    syncStateFromHost(data) {
      const prevState = this.state;
      this.state = data.state;
      this.level = data.level;
      this.mapIndex = data.mapIndex;
      this.p1Score = data.p1Score;
      this.p2Score = data.p2Score;
      if (data.p1Name) this.p1.name = data.p1Name;
      if (data.p2Name) this.p2.name = data.p2Name;
      if (data.winner) this.matchWinner = data.winner;

      // Play victory / game over sound when match finishes
      if (this.state === "MATCH_OVER" && prevState !== "MATCH_OVER") {
        const myRole = (this.mode === "CUSTOM_ROOM" && this.myRole === "p2") ? "p2" : "p1";
        const myScore = (myRole === "p2") ? this.p2Score : this.p1Score;
        const rivalScore = (myRole === "p2") ? this.p1Score : this.p2Score;
        const myPlayer = (myRole === "p2") ? this.p2 : this.p1;
        const rivalPlayer = (myRole === "p2") ? this.p1 : this.p2;

        const isMeWinner = (myScore >= 30) || (!rivalPlayer.isAlive && myPlayer.isAlive) || (data.winner === myRole);
        if (isMeWinner) {
          this.sounds.playVictory();
        } else {
          this.sounds.playGameOver();
        }
        // Track stats for guest (p2)
        if (this.gamerProfile) {
          this.incrementStat("totalMatches");
          if (isMeWinner) this.incrementStat("mpWins");
          else this.incrementStat("mpLosses");
        }
      }

      // Track multiplayer level progression for guest
      if (this.p1Score >= 25 || this.p2Score >= 25) {
        this.updateMaxLevel("CUSTOM_ROOM", 2);
      }
      if (this.p1Score >= 30 || this.p2Score >= 30) {
        this.updateMaxLevel("CUSTOM_ROOM", 3);
      }

      // P1 (Host)
      this.p1.x = data.p1.x;
      this.p1.y = data.p1.y;
      this.p1.isGiant = data.p1.isGiant;
      this.p1.size = data.p1.size;
      this.p1.activeBeam = data.p1.activeBeam;
      this.p1.isAlive = data.p1.isAlive;
      if (data.p1.lives !== undefined) this.p1.lives = data.p1.lives;
      if (data.p1.emerDodges !== undefined) this.p1.emerDodges = data.p1.emerDodges;
      if (data.p1.invulnerableTimer !== undefined) this.p1.invulnerableTimer = data.p1.invulnerableTimer;
      if (data.p1.shockwaveVisual) this.p1.shockwaveVisual = data.p1.shockwaveVisual;

      // P2 (Guest) - Smooth reconciliation with local client prediction
      const p2Desync = Math.hypot(this.p2.x - data.p2.x, this.p2.y - data.p2.y);
      if (p2Desync > 45) {
        this.p2.x = data.p2.x;
        this.p2.y = data.p2.y;
      } else {
        this.p2.x += (data.p2.x - this.p2.x) * 0.35;
        this.p2.y += (data.p2.y - this.p2.y) * 0.35;
      }
      this.p2.isGiant = data.p2.isGiant;
      this.p2.size = data.p2.size;
      this.p2.activeBeam = data.p2.activeBeam;
      this.p2.isAlive = data.p2.isAlive;
      if (data.p2.lives !== undefined) this.p2.lives = data.p2.lives;
      if (data.p2.emerDodges !== undefined) this.p2.emerDodges = data.p2.emerDodges;
      if (data.p2.invulnerableTimer !== undefined) this.p2.invulnerableTimer = data.p2.invulnerableTimer;
      if (data.p2.shockwaveVisual) this.p2.shockwaveVisual = data.p2.shockwaveVisual;

      // Reconcile cooldowns if host reports higher cooldown
      if (data.p2.dashCooldown !== undefined && data.p2.dashCooldown > this.p2.dashCooldown) {
        this.p2.dashCooldown = data.p2.dashCooldown;
      }
      if (data.p2.pushCooldown !== undefined && data.p2.pushCooldown > this.p2.pushCooldown) {
        this.p2.pushCooldown = data.p2.pushCooldown;
      }
      if (data.p2.beamCooldown !== undefined && data.p2.beamCooldown > this.p2.beamCooldown) {
        this.p2.beamCooldown = data.p2.beamCooldown;
      }

      // Memory-efficient enemy update (eliminates garbage collection pauses & stutter on mobile)
      if (!this.enemies) this.enemies = [];
      const enLen = data.enemies.length;
      while (this.enemies.length < enLen) {
        this.enemies.push(new Enemy(0, 0, this.difficulty.enemySpeed));
      }
      this.enemies.length = enLen;
      for (let i = 0; i < enLen; i++) {
        this.enemies[i].x = data.enemies[i].x;
        this.enemies[i].y = data.enemies[i].y;
      }

      // Memory-efficient items update
      if (data.items) {
        if (!this.items) this.items = [];
        const itLen = data.items.length;
        while (this.items.length < itLen) {
          this.items.push(new Collectible(0, 0, 10));
        }
        this.items.length = itLen;
        for (let i = 0; i < itLen; i++) {
          this.items[i].x = data.items[i].x;
          this.items[i].y = data.items[i].y;
          this.items[i].points = data.items[i].points;
        }
      }

      if (data.boss) {
        if (!this.boss) this.boss = new Boss();
        this.boss.x = data.boss.x;
        this.boss.y = data.boss.y;
        this.boss.isChargingBurst = data.boss.isChargingBurst;
        this.boss.burstVisual = data.boss.burstVisual;
      } else {
        this.boss = null;
      }

      this.updateHUD();
    }

    // ══════════════════════════════════════════════════════════════
    // MULTIPLAYER LOBBY — Milestone 2
    // All lobby logic is isolated here. Solo Mode is never touched.
    // ══════════════════════════════════════════════════════════════

    // Helpers
    _serverBase() {
      return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
        ? "http://localhost:9000"
        : "https://dodge-ultimate-arena.onrender.com";
    }

    _myPlayerData() {
      const p = this.gamerProfile;
      return {
        name: p ? p.username : ("Player_" + Math.floor(Math.random() * 9999)),
        shape: p ? (p.shape || "square") : "square",
        photo: p ? (p.photo || null) : null,
      };
    }

    _setLobbyStatus(msg, type = "info") {
      const el = document.getElementById("lobby-status-msg");
      if (!el) return;
      el.textContent = msg;
      el.className = `lobby-status-msg ${type}`;
    }

    // Open the lobby overlay and render it
    _showLobbyOverlay(asHost) {
      // Hide main menu
      document.getElementById("modal-overlay")?.classList.add("hidden");
      document.getElementById("online-panel")?.classList.add("hidden");
      // Show lobby
      const overlay = document.getElementById("lobby-overlay");
      if (overlay) overlay.classList.remove("hidden");

      // Wire mode pills (host only)
      const modeRow = document.getElementById("lobby-mode-row");
      const modeDisplay = document.getElementById("lobby-mode-display");
      if (asHost) {
        modeRow?.classList.remove("hidden");
        modeDisplay?.classList.add("hidden");
        document.querySelectorAll(".lobby-mode-pill").forEach(pill => {
          pill.onclick = () => {
            document.querySelectorAll(".lobby-mode-pill").forEach(p => p.classList.remove("active"));
            pill.classList.add("active");
            this.lobbyMode = pill.dataset.mode;
            this._broadcastLobbyState();
          };
        });
      } else {
        modeRow?.classList.add("hidden");
        modeDisplay?.classList.remove("hidden");
      }

      // Show/hide host vs guest controls
      const startBtn = document.getElementById("btn-lobby-start");
      const readyBtn = document.getElementById("btn-lobby-ready");
      const hostReadyBtn = document.getElementById("btn-lobby-toggle-ready");

      if (asHost) {
        startBtn?.classList.remove("hidden");
        hostReadyBtn?.classList.add("hidden");
        readyBtn?.classList.add("hidden");
        if (startBtn) {
          startBtn.disabled = true;
          startBtn.onclick = () => this._lobbyStartMatch();
        }
      } else {
        startBtn?.classList.add("hidden");
        hostReadyBtn?.classList.add("hidden");
        readyBtn?.classList.remove("hidden");
        if (readyBtn) {
          readyBtn.onclick = () => this._lobbyToggleReady();
        }
      }

      // Room code display
      const codeEl = document.getElementById("lobby-room-code");
      if (codeEl) codeEl.textContent = this.lobbyRoomCode || "------";

      // Copy invite link
      document.getElementById("btn-lobby-copy-code")?.addEventListener("click", () => {
        const url = `${window.location.origin}${window.location.pathname}?room=${this.lobbyRoomCode}`;
        navigator.clipboard.writeText(url).then(() => {
          this._setLobbyStatus("✅ Invite link copied!", "success");
          setTimeout(() => this._setLobbyStatus(""), 2500);
        }).catch(() => {});
      });

      // Leave button
      document.getElementById("btn-lobby-leave")?.addEventListener("click", () => this._lobbyLeave());

      this._renderLobbyGrid();
    }

    // Render the 8-slot player grid
    _renderLobbyGrid() {
      const grid = document.getElementById("lobby-player-grid");
      if (!grid) return;
      grid.innerHTML = "";

      const players = Array.from(this.lobbyPlayers.values());

      for (let i = 0; i < 8; i++) {
        const card = document.createElement("div");
        const player = players[i];
        if (player) {
          card.className = "lobby-player-card occupied" + (player.isReady ? " ready" : "");

          if (player.isHost) {
            const crown = document.createElement("span");
            crown.className = "lobby-host-crown";
            crown.textContent = "👑";
            card.appendChild(crown);
          }

          // Avatar
          const avatar = document.createElement("div");
          avatar.className = "lobby-avatar";
          if (player.photo) {
            const img = document.createElement("img");
            img.src = player.photo;
            avatar.appendChild(img);
          } else {
            avatar.textContent = this._shapeEmoji(player.shape || "square");
          }
          card.appendChild(avatar);

          // Name
          const name = document.createElement("div");
          name.className = "lobby-player-name";
          name.textContent = player.name;
          card.appendChild(name);

          // Ready badge
          const badge = document.createElement("span");
          badge.className = "lobby-ready-badge " + (player.isReady || player.isHost ? "ready" : "not-ready");
          badge.textContent = player.isHost ? "HOST" : (player.isReady ? "READY" : "NOT READY");
          card.appendChild(badge);
        } else {
          card.className = "lobby-player-card empty-slot";
          const name = document.createElement("div");
          name.className = "lobby-player-name empty-label";
          name.textContent = "— empty —";
          card.appendChild(name);
        }
        grid.appendChild(card);
      }

      // Update count
      const countEl = document.getElementById("lobby-player-count");
      if (countEl) countEl.textContent = players.length;

      // Update mode display for guest
      const modeText = document.getElementById("lobby-mode-text");
      if (modeText) modeText.textContent = this.lobbyMode;

      // Update start button state (host: all guests ready)
      const startBtn = document.getElementById("btn-lobby-start");
      if (startBtn && this.isHost) {
        const guests = players.filter(p => !p.isHost);
        const allReady = guests.length > 0 && guests.every(p => p.isReady);
        startBtn.disabled = !allReady;
      }
    }

    _shapeEmoji(shape) {
      const map = { square: "🟦", circle: "🟣", triangle: "🔺", star: "⭐", diamond: "💎", hexagon: "⬡" };
      return map[shape] || "🟦";
    }

    // Broadcast current lobby state to all connected peers (host only)
    _broadcastLobbyState() {
      if (!this.isHost) return;
      const state = {
        type: "LOBBY_STATE",
        mode: this.lobbyMode,
        players: Array.from(this.lobbyPlayers.entries()).map(([id, p]) => ({ peerId: id, ...p })),
      };
      for (const [, conn] of this.mpConnections) {
        if (conn.reliable && conn.reliable.open) conn.reliable.send(state);
      }
    }

    // Reliable broadcast across all connected peers (HOST ONLY)
    _broadcastReliable(msg) {
      if (!this.isHost) return;
      for (const [, conn] of this.mpConnections) {
        if (conn.reliable && conn.reliable.open) {
          try { conn.reliable.send(msg); } catch (e) {}
        }
      }
    }

    // Unreliable / fast snapshot broadcast (uses sync channel if open, else fallback to cmd)
    _broadcastUnreliable(msg) {
      if (!this.isHost) return;
      for (const [, conn] of this.mpConnections) {
        const ch = (conn.unreliable && conn.unreliable.open) ? conn.unreliable : conn.reliable;
        if (ch && ch.open) {
          try { ch.send(msg); } catch (e) {}
        }
      }
    }

    // Send reliable request to host (guest only, approved message types only)
    _sendToHostReliable(msg) {
      if (this.isHost || !msg || !msg.type) return;
      const ALLOWED_GUEST_REQUESTS = new Set([
        "MP_INPUT",
        "MP_SHOOT",
        "MP_INFECTION_SHOOT",
        "MP_PUSH",
        "PLAYER_READY",
        "PLAYER_LEFT"
      ]);
      if (!ALLOWED_GUEST_REQUESTS.has(msg.type)) return;

      const hostId = this.hostPeerId;
      if (hostId) {
        const conn = this.mpConnections.get(hostId);
        if (conn?.reliable && conn.reliable.open) {
          try { conn.reliable.send(msg); } catch (e) {}
          return;
        }
      }
      for (const [, conn] of this.mpConnections) {
        if (conn.reliable && conn.reliable.open) {
          try { conn.reliable.send(msg); } catch (e) {}
          break;
        }
      }
    }

    _sendReliableToHost(msg) {
      this._sendToHostReliable(msg);
    }

    // Send this client's ready toggle to host (guest)
    async _lobbyToggleReady() {
      this.lobbyIsReady = !this.lobbyIsReady;
      const btn = document.getElementById("btn-lobby-ready");
      if (btn) {
        btn.textContent = this.lobbyIsReady ? "❌ Unready" : "✅ Ready";
        btn.classList.toggle("active", this.lobbyIsReady);
      }
      const myPeerId = this.peer?.id;
      if (!myPeerId) return;

      // Notify host immediately via WebRTC reliable channel
      for (const [, conn] of this.mpConnections) {
        if (conn.reliable && conn.reliable.open) {
          try {
            conn.reliable.send({ type: "PLAYER_READY", peerId: myPeerId, isReady: this.lobbyIsReady });
          } catch (e) {}
        }
      }

      // Also update Room API on server
      try {
        await fetch(`${this._serverBase()}/api/rooms/ready`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomCode: this.lobbyRoomCode, peerId: myPeerId, isReady: this.lobbyIsReady }),
        });
      } catch (e) { /* non-critical */ }
    }

    // Host starts the match
    async _lobbyStartMatch() {
      if (!this.isHost) return;
      const myPeerId = this.peer?.id;
      try {
        const res = await fetch(`${this._serverBase()}/api/rooms/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomCode: this.lobbyRoomCode, peerId: myPeerId, mode: this.lobbyMode }),
        });
        const data = await res.json();
        if (!data.success) {
          this._setLobbyStatus("⚠️ " + data.error, "error");
          return;
        }
      } catch (e) {
        this._setLobbyStatus("⚠️ Server error. Using local start.", "error");
      }
      // Broadcast START to all peers
      const startMsg = { type: "LOBBY_START", mode: this.lobbyMode };
      for (const [, conn] of this.mpConnections) {
        if (conn.reliable && conn.reliable.open) conn.reliable.send(startMsg);
      }
      this._hideLobbyAndStartGame();
    }

    // Triggered on guest by host START message or host starting match
    _hideLobbyAndStartGame() {
      document.getElementById("lobby-overlay")?.classList.add("hidden");
      this._setLobbyStatus("");
      this.initMPMatch(this.lobbyMode || "ELITE");
      this.startMatch("CUSTOM_ROOM");
    }

    // Leave lobby (both host and guest)
    async _lobbyLeave() {
      const myPeerId = this.peer?.id;
      if (myPeerId && this.lobbyRoomCode) {
        try {
          await fetch(`${this._serverBase()}/api/rooms/leave`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roomCode: this.lobbyRoomCode, peerId: myPeerId }),
          });
        } catch (e) {}
        // Notify all connected peers
        for (const [, conn] of this.mpConnections) {
          if (conn.reliable?.open) conn.reliable.send({ type: "PLAYER_LEFT", peerId: myPeerId });
          conn.reliable?.close();
          conn.unreliable?.close();
        }
        this.mpConnections.clear();
        this.peer?.destroy();
        this.peer = null;
      }
      this.lobbyRoomCode = null;
      this.lobbyPlayers.clear();
      this.lobbyIsReady = false;
      this.isHost = false;
      document.getElementById("lobby-overlay")?.classList.add("hidden");
      this.showMenu();
    }

    // ── HOST: Create Room ──────────────────────────────────────────
    async lobbyCreate() {
      const statusBox = document.getElementById("room-code-display");
      const createBtn = document.getElementById("btn-create-room");
      if (createBtn) { createBtn.disabled = true; createBtn.textContent = "⏳ Creating..."; }

      const me = this._myPlayerData();
      let roomCode, hostPeerId;

      try {
        // 1. Register room on server
        this.peer = new Peer(undefined, PEER_SERVER_CONFIG);
        await new Promise((resolve, reject) => {
          this.peer.on("open", (id) => { hostPeerId = id; resolve(); });
          this.peer.on("error", reject);
          setTimeout(reject, 10000);
        });

        const res = await fetch(`${this._serverBase()}/api/rooms/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ peerId: hostPeerId, name: me.name, shape: me.shape, photo: me.photo }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        roomCode = data.roomCode;
      } catch (err) {
        if (createBtn) { createBtn.disabled = false; createBtn.textContent = "Create Room"; }
        const statusMsg = document.getElementById("join-status");
        if (statusMsg) statusMsg.textContent = "Failed to create room: " + (err.message || "Network error");
        return;
      }

      this.isHost = true;
      this.myRole = "p1";
      this.lobbyRoomCode = roomCode;
      this.lobbyPlayers.set(hostPeerId, { ...me, isReady: true, isHost: true });

      // Show old room code UI for backwards compat
      const codeSpan = document.getElementById("created-room-code");
      if (codeSpan) codeSpan.innerText = roomCode;
      if (statusBox) statusBox.classList.remove("hidden");

      // 2. Listen for incoming peer connections (up to 7 guests)
      this.peer.on("connection", (incomingConn) => {
        const guestPeerId = incomingConn.peer;
        if (this.lobbyPlayers.size >= 8) {
          incomingConn.on("open", () => incomingConn.send({ type: "ROOM_FULL" }));
          return;
        }

        // Set up dual-channel: reliable (this) + unreliable (guest initiates second)
        incomingConn.on("open", () => {
          const existingConn = this.mpConnections.get(guestPeerId) || {};
          if (incomingConn.label === "sync") {
            existingConn.unreliable = incomingConn;
          } else {
            existingConn.reliable = incomingConn;
          }
          this.mpConnections.set(guestPeerId, existingConn);

          // Send current lobby state to new guest
          incomingConn.send({
            type: "LOBBY_STATE",
            mode: this.lobbyMode,
            players: Array.from(this.lobbyPlayers.entries()).map(([id, p]) => ({ peerId: id, ...p })),
          });
        });

        incomingConn.on("data", (msg) => this._handleLobbyMessage(msg, guestPeerId));
        incomingConn.on("close", () => this._handlePeerDisconnect(guestPeerId));
        incomingConn.on("error", () => this._handlePeerDisconnect(guestPeerId));
      });

      // 3. Open lobby overlay
      this._showLobbyOverlay(true);
      this._setLobbyStatus(`<span class="lobby-spinner"></span> Waiting for players… Room: ${roomCode}`, "info");
    }

    // ── GUEST: Join Room ───────────────────────────────────────────
    async lobbyJoin(roomCode) {
      const joinBtn = document.getElementById("btn-join-room");
      const statusDiv = document.getElementById("join-status");
      if (joinBtn) { joinBtn.disabled = true; }
      if (statusDiv) statusDiv.textContent = "Connecting…";

      const me = this._myPlayerData();

      try {
        // 1. Validate room on server
        const checkRes = await fetch(`${this._serverBase()}/api/rooms/${roomCode}`);
        const checkData = await checkRes.json();
        if (!checkData.success) throw new Error(checkData.error || "Room not found.");
        if (checkData.status !== "LOBBY") throw new Error("Match already in progress.");
        if (checkData.playerCount >= 8) throw new Error("Room is full (max 8 players).");

        const hostPeerId = checkData.hostPeerId;
        if (!hostPeerId || typeof hostPeerId !== "string" || !hostPeerId.trim()) {
          throw new Error("Invalid host identity from signaling server.");
        }
        this.hostPeerId = hostPeerId;

        // 2. Open WebRTC peer and connect to host
        this.peer = new Peer(undefined, PEER_SERVER_CONFIG);
        const myPeerId = await new Promise((resolve, reject) => {
          this.peer.on("open", resolve);
          this.peer.on("error", reject);
          setTimeout(reject, 10000);
        });

        // Star topology enforcement: Guest never accepts incoming connections from peers
        this.peer.on("connection", (incomingConn) => {
          console.warn(`[MP] Guest rejecting unauthorized incoming peer connection from ${incomingConn?.peer}`);
          try { incomingConn.close(); } catch (e) {}
        });

        // Reliable channel (critical events)
        const reliable = this.peer.connect(hostPeerId, { reliable: true, label: "cmd" });
        // Unreliable channel (movement snapshots — future use)
        const unreliable = this.peer.connect(hostPeerId, { reliable: false, maxRetransmits: 0, ordered: false, label: "sync" });

        // Immediate connection identity verification
        if (!reliable || !reliable.peer || typeof reliable.peer !== "string" || reliable.peer !== this.hostPeerId) {
          try { reliable?.close?.(); } catch (e) {}
          throw new Error("Reliable connection peer identity mismatch with trusted host.");
        }
        if (!unreliable || !unreliable.peer || typeof unreliable.peer !== "string" || unreliable.peer !== this.hostPeerId) {
          try { unreliable?.close?.(); } catch (e) {}
          throw new Error("Unreliable connection peer identity mismatch with trusted host.");
        }

        // Listen for host messages on both channels deriving sender identity exclusively from transport .peer
        reliable.on("data", (msg) => {
          const senderPeer = reliable.peer;
          if (senderPeer && typeof senderPeer === "string" && senderPeer.trim() && senderPeer === this.hostPeerId) {
            this._handleLobbyMessage(msg, senderPeer);
          } else {
            console.warn(`[MP] Dropped reliable message from invalid or untrusted transport peer identity: '${senderPeer}'`);
          }
        });
        reliable.on("close", () => this._handlePeerDisconnect(hostPeerId));
        reliable.on("error", () => this._handlePeerDisconnect(hostPeerId));
        unreliable.on("data", (msg) => {
          const senderPeer = unreliable.peer;
          if (senderPeer && typeof senderPeer === "string" && senderPeer.trim() && senderPeer === this.hostPeerId) {
            this._handleLobbyMessage(msg, senderPeer);
          } else {
            console.warn(`[MP] Dropped unreliable message from invalid or untrusted transport peer identity: '${senderPeer}'`);
          }
        });
        unreliable.on("close", () => this._handlePeerDisconnect(hostPeerId));

        await new Promise((resolve, reject) => {
          reliable.on("open", resolve);
          reliable.on("error", reject);
          setTimeout(reject, 10000);
        });

        this.mpConnections.set(hostPeerId, { reliable, unreliable });

        // 3. Register join on server
        const joinRes = await fetch(`${this._serverBase()}/api/rooms/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomCode, peerId: myPeerId, name: me.name, shape: me.shape, photo: me.photo }),
        });
        const joinData = await joinRes.json();
        if (!joinData.success) throw new Error(joinData.error);

        this.isHost = false;
        this.hostPeerId = hostPeerId;
        this.myRole = "p2";
        this.lobbyRoomCode = roomCode;

        // Seed local player list from server response
        this.lobbyPlayers.clear();
        (joinData.players || []).forEach(p => {
          this.lobbyPlayers.set(p.peerId, { name: p.name, shape: p.shape, photo: p.photo, isReady: p.isReady, isHost: p.isHost });
        });

        // Also set legacy conn for backward-compat with existing game code
        this.conn = reliable;

        // Announce self to host
        reliable.send({ type: "PLAYER_JOIN", peerId: myPeerId, ...me });

        this._showLobbyOverlay(false);
        this._setLobbyStatus("✅ Joined! Waiting for host to start…", "info");
      } catch (err) {
        if (joinBtn) joinBtn.disabled = false;
        if (statusDiv) statusDiv.textContent = "Failed: " + (err.message || "Connection error.");
      }
    }

    // Verify if incoming message is from the authoritative host connection (guest only)
    _isFromHost(fromPeerId) {
      if (this.isHost) return false; // Host is authority; never accepts authoritative events from peers
      if (!fromPeerId || typeof fromPeerId !== "string" || !fromPeerId.trim()) return false;
      // Section A: this.hostPeerId is the ONLY trusted expected host identity for guests.
      // If this.hostPeerId is missing, reject authoritative events. Never fall back to this.mpState?.hostId.
      if (!this.hostPeerId || typeof this.hostPeerId !== "string" || !this.hostPeerId.trim()) return false;
      // If both IDs exist, require exact equality
      if (this.mpState?.hostId && this.hostPeerId !== this.mpState.hostId) return false;
      return fromPeerId === this.hostPeerId;
    }

    // ── Handle incoming lobby messages ────────────────────────────
    _handleLobbyMessage(msg, fromPeerId) {
      if (!msg || !msg.type) return;

      switch (msg.type) {
        case "LOBBY_STATE":
          // Full lobby state sync from host
          if (!this.isHost && this._isFromHost(fromPeerId)) {
            this.lobbyPlayers.clear();
            (msg.players || []).forEach(p => this.lobbyPlayers.set(p.peerId, { name: p.name, shape: p.shape, photo: p.photo || null, isReady: p.isReady, isHost: p.isHost }));
            this.lobbyMode = msg.mode || this.lobbyMode;
            this._renderLobbyGrid();
          }
          break;

        case "PLAYER_JOIN":
          // Host receives this from new guest
          if (this.isHost) {
            if (this.lobbyPlayers.size >= 8) {
              const conn = this.mpConnections.get(fromPeerId);
              if (conn?.reliable?.open) conn.reliable.send({ type: "ROOM_FULL" });
              return;
            }
            this.lobbyPlayers.set(fromPeerId, { name: msg.name, shape: msg.shape || "square", photo: msg.photo || null, isReady: false, isHost: false });
            this._renderLobbyGrid();
            this._broadcastLobbyState();
            this._setLobbyStatus(`👤 ${msg.name} joined! (${this.lobbyPlayers.size}/8)`, "info");
          }
          break;

        case "PLAYER_READY":
          if (this.isHost && fromPeerId) {
            const player = this.lobbyPlayers.get(fromPeerId);
            if (player) player.isReady = !!msg.isReady;
            this._renderLobbyGrid();
            this._broadcastLobbyState();
          }
          break;

        case "PLAYER_LEFT":
          if (this.isHost) {
            if (!fromPeerId) return;
            this.lobbyPlayers.delete(fromPeerId);
            this._renderLobbyGrid();
            this._broadcastLobbyState();
            this._setLobbyStatus(`👋 A player left. (${this.lobbyPlayers.size}/8)`, "info");
          } else {
            if (!this._isFromHost(fromPeerId)) return;
            this.lobbyPlayers.delete(msg.peerId);
            this._renderLobbyGrid();
            this._setLobbyStatus("🚪 A player left the lobby.", "info");
          }
          break;

        case "ROOM_FULL":
          if (!this.isHost && this._isFromHost(fromPeerId)) {
            this._setLobbyStatus("❌ Room is full!", "error");
            setTimeout(() => this._lobbyLeave(), 2000);
          }
          break;

        case "LOBBY_START":
          if (!this.isHost && this._isFromHost(fromPeerId)) {
            this.lobbyMode = msg.mode;
            this._hideLobbyAndStartGame();
          }
          break;

        case "MP_MATCH_START":
          if (!this.isHost && this._isFromHost(fromPeerId)) {
            this.handleMPMatchStart(msg);
          }
          break;

        case "MP_INPUT":
          if (this.isHost && this.mpState && fromPeerId) {
            const senderId = fromPeerId;
            const p = this.mpState.players.get(senderId);
            if (p && p.isAlive && !p.isSpectator) {
              if (msg.seq && p.lastInputSeq && msg.seq < p.lastInputSeq) return;
              p.lastInputSeq = msg.seq || (p.lastInputSeq + 1);
              p.input.x = Math.max(-1, Math.min(1, Number(msg.x) || 0));
              p.input.y = Math.max(-1, Math.min(1, Number(msg.y) || 0));
              p.input.sprint = !!msg.sprint;
            }
          }
          break;

        case "MP_SNAPSHOT":
          if (this.mpState && this._isFromHost(fromPeerId)) {
            this.mpApplySnapshot(msg);
          }
          break;

        case "MP_DAMAGE":
          // Directional security: Accepted strictly from authenticated host by guests
          if (this.mpState && this._isFromHost(fromPeerId)) {
            if (msg.eventId && this.mpState.processedEvents.has(msg.eventId)) return;
            if (msg.eventId) this.mpState.processedEvents.add(msg.eventId);
            const target = this.mpState.players.get(msg.targetId);
            if (target) {
              target.hp = Math.max(0, msg.remainingHp !== undefined ? msg.remainingHp : (target.hp - msg.amount));
              this.floatingTexts.push(new FloatingText(target.x, target.y - 10, `-${msg.amount} HP`, "#ef4444"));
            }
          }
          break;

        case "MP_ELIMINATED":
          // Directional security: Accepted strictly from authenticated host by guests
          if (this.mpState && this._isFromHost(fromPeerId)) {
            if (msg.eventId && this.mpState.processedEvents.has(msg.eventId)) return;
            if (msg.eventId) this.mpState.processedEvents.add(msg.eventId);
            const target = this.mpState.players.get(msg.targetId);
            if (target) {
              target.hp = 0;
              target.isAlive = false;
              target.isSpectator = true;
              this.floatingTexts.push(new FloatingText(target.x, target.y - 15, "💀 ELIMINATED!", "#ff2266"));
              const myId = this.peer?.id;
              if (target.id === myId) {
                this.showAnnouncement("💀 ELIMINATED", "YOU ARE NOW SPECTATING");
              }
            }
          }
          break;

        case "MP_PLAYER_LEFT":
          if (this.mpState && this._isFromHost(fromPeerId)) {
            const p = this.mpState.players.get(msg.peerId);
            const name = msg.name || (p ? p.name : "A player");
            this.mpState.players.delete(msg.peerId);
            this.floatingTexts.push(new FloatingText(SCREEN_WIDTH / 2, 80, `👋 ${name} left match`, "#94a3b8"));
          }
          break;

        case "MP_PUSH":
          if (this.isHost && this.mpState && fromPeerId) {
            this.mpHandlePush(fromPeerId, msg.cx, msg.cy);
          }
          break;

        // Milestone 5A: Elite Mode heal sync (applied by host, mirrored to guests)
        case "MP_HEAL":
          // Directional security: Accepted strictly from authenticated host by guests
          if (this.mpState && this._isFromHost(fromPeerId)) {
            if (msg.eventId && this.mpState.processedEvents.has(msg.eventId)) return;
            if (msg.eventId) this.mpState.processedEvents.add(msg.eventId);
            const target = this.mpState.players.get(msg.targetId);
            if (target) {
              target.hp = Math.min(target.maxHp || 100, msg.remainingHp !== undefined ? msg.remainingHp : (target.hp + (msg.amount || 0)));
              this.floatingTexts.push(new FloatingText(target.x, target.y - 10, `+${msg.amount || 0} HP`, "#00ff88"));
            }
          }
          break;

        // Milestone 5A: Elite Mode team score update (host-authoritative)
        case "MP_SCORE_UPDATE":
          if (this.mpState && this._isFromHost(fromPeerId)) {
            if (msg.teamScore !== undefined) this.mpState.teamScore = msg.teamScore;
          }
          break;

        // Milestone 5B: Elite Mode phase transition event
        case "MP_PHASE_TRANSITION":
          if (this.mpState && this._isFromHost(fromPeerId)) {
            this.mpState.currentPhase = msg.phase;
            if (msg.teamScore !== undefined) this.mpState.teamScore = msg.teamScore;
            if (msg.phase === 4) {
              this.mpState.scoreActive = false;
              if (this.mpState.hazards) {
                this.mpState.hazards.toxicGas = [];
                this.mpState.hazards.laserWall = null;
              }
              // Grant Fireball Gun to all surviving players
              for (const p of this.mpState.players.values()) {
                if (p.isAlive && !p.isSpectator) {
                  p.fireballGun = { ammo: 100, maxAmmo: 100, damage: 50, cooldown: 0 };
                }
              }
              this.showAnnouncement("DEMON BOSS AWAKENS", "FIREBALL GUNS GRANTED — 100 AMMO");
            } else if (msg.phase === 3) {
              this.showAnnouncement("CRUCIBLE OVERLOAD", "LASER WALL ACTIVATED - MINI ENEMIES HALTED");
            } else if (msg.phase === 2) {
              this.showAnnouncement("HAZARD WARNING", "TOXIC GAS VAPORS DEPLOYED");
            } else if (msg.phase === 1) {
              this.showAnnouncement("HAZARD WARNING", "SMOKE BOMBS DEPLOYED");
            }
          }
          break;

        // Milestone 5C: Player shooting fireball in Elite Mode (guest -> host)
        case "MP_SHOOT":
          if (this.isHost && this.mpState && fromPeerId) {
            this.mpHandleShoot(fromPeerId, msg.x, msg.y, msg.fx, msg.fy);
          }
          break;

        // Milestone 5C & 6C: Team victory when Boss defeated
        case "MP_MATCH_VICTORY":
          // Directional security: Accepted strictly from authenticated host by guests
          if (this.mpState && this._isFromHost(fromPeerId)) {
            this.mpState.status = "VICTORY";
            this.state = "VICTORY";
            this.sounds?.playVictory?.();
            const title = msg.title || "👑 ARENA CONQUERED!";
            const sub = msg.subtitle || "BOSS DEFEATED!";
            this.showAnnouncement(title, sub);
          }
          break;

        // Milestone 6C: Team defeat when all players eliminated
        case "MP_MATCH_DEFEAT":
          // Directional security: Accepted strictly from authenticated host by guests
          if (this.mpState && this._isFromHost(fromPeerId)) {
            this.mpState.status = "DEFEAT";
            this.state = "MATCH_OVER";
            this.sounds?.playGameOver?.();
            this.showAnnouncement("💀 TEAM WIPEOUT", "ALL PLAYERS ELIMINATED!");
          }
          break;

        // Milestone 6C: Infection boss branch transition (host -> guest)
        case "MP_INFECTION_BRANCH":
          if (this.mpState && this._isFromHost(fromPeerId)) {
            this.handleMPInfectionBranch(msg);
          }
          break;

        // Milestone 6A: Infection event (host -> guest)
        case "MP_INFECTION_EVENT":
          if (this.mpState && this._isFromHost(fromPeerId)) {
            this.handleMPInfectionEvent(msg);
          }
          break;

        // Milestone 6B: Infection weapon pickup (host -> guest)
        case "MP_WEAPON_PICKUP":
          if (this.mpState && this._isFromHost(fromPeerId)) {
            this.handleMPWeaponPickup(msg);
          }
          break;

        // Milestone 6B: Infection weapon shoot request (guest -> host)
        case "MP_INFECTION_SHOOT":
          if (this.isHost && this.mpState && this.mpState.mode === "INFECTION" && fromPeerId) {
            this.mpHandleInfectionShoot(fromPeerId, msg.weaponType, msg.x, msg.y, msg.fx, msg.fy);
          }
          break;

        // Milestone 6B: Infection weapon damage event (host -> guest)
        case "MP_WEAPON_DAMAGE":
          if (this.mpState && this._isFromHost(fromPeerId)) {
            this.handleMPWeaponDamage(msg);
          }
          break;

        // Legacy connection handling (for backwards compat with 2-player mode)
        default:
          if (this.state === "PLAYING") this._handleGameplayMessage(msg);
          break;
      }
    }

    // Handle peer disconnect in lobby or active match
    _handlePeerDisconnect(peerId) {
      if (this.mpState && this.mpState.status === "PLAYING") {
        if (this.isHost) {
          const player = this.mpState.players.get(peerId);
          const name = player?.name || "A player";
          this.mpState.players.delete(peerId);
          this.mpConnections.delete(peerId);
          this._broadcastReliable({ type: "MP_PLAYER_LEFT", peerId, name });
          this.floatingTexts.push(new FloatingText(SCREEN_WIDTH / 2, 80, `👋 ${name} disconnected`, "#94a3b8"));
          fetch(`${this._serverBase()}/api/rooms/leave`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roomCode: this.lobbyRoomCode, peerId }),
          }).catch(() => {});
          return;
        } else {
          // Host disconnected during active match
          this._handleHostDisconnectDuringMatch();
          return;
        }
      }

      const player = this.lobbyPlayers.get(peerId);
      const name = player?.name || "A player";
      this.lobbyPlayers.delete(peerId);
      this.mpConnections.delete(peerId);

      if (this.isHost) {
        this._renderLobbyGrid();
        this._broadcastLobbyState();
        this._setLobbyStatus(`⚠️ ${name} disconnected. (${this.lobbyPlayers.size}/8)`, "info");
        // Post leave to server
        fetch(`${this._serverBase()}/api/rooms/leave`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomCode: this.lobbyRoomCode, peerId }),
        }).catch(() => {});
      } else {
        // Host disconnected
        this._setLobbyStatus("❌ Host disconnected. Returning to menu.", "error");
        setTimeout(() => this._lobbyLeave(), 2500);
      }
    }

    // Route legacy gameplay WebRTC messages (from setupOnlineConnection)
    _handleGameplayMessage(msg) {
      if (this.conn && this.conn.open) {
        // Legacy 2-player events
      }
    }

    // ══════════════════════════════════════════════════════════════
    // MULTIPLAYER CORE (2–8 PLAYERS) — Milestone 3
    // Health, damage, sync, spectators, authoritative host
    // ══════════════════════════════════════════════════════════════

    initMPMatch(mode) {
      const matchId = this.lobbyRoomCode || ("match_" + Date.now());
      const hostId = this.isHost ? (this.peer?.id || "host") : (this.hostPeerId || null);
      
      this.mpState = {
        matchId: matchId,
        status: "PLAYING",
        hostId: hostId,
        mode: mode || this.lobbyMode || "ELITE",
        players: new Map(),
        enemies: new Map(),
        projectiles: [],
        mines: [],
        nextEnemyId: 1,
        nextProjId: 1,
        nextMineId: 1,
        directorTimer: 0,
        processedEvents: new Set(),
        seq: 0,
        startTime: Date.now(),
        // --- Milestone 5A & 5B: Elite Mode foundation & hazards fields ---
        teamScore: 0,       // shared team score (Elite only)
        scoreActive: true,  // halts at boss spawn (200 pts)
        pickups: [],        // { id, type:"SCORE"|"HEART", x, y }
        nextPickupId: 1,
        elitePickupTimer: 0, // provisional spawn timer
        nextHazardId: 1,
        currentPhase: 0,     // 0: <30, 1: 30-69 (smoke), 2: 70-119 (gas), 3: 120-199 (laser), 4: >=200 (boss transition)
        hazards: {
          smokeBombs: [],
          toxicGas: [],
          laserWall: null
        },
        hazardTimers: {
          smoke: 0,
          gas: 0,
          laser: 0
        },
        // --- Milestone 5C: Demon Boss & Fireball Gun fields ---
        boss: null,
        bossProjectiles: [],
        bossVapors: [],
        playerFireballs: [],
        nextBossAttackId: 1,
        nextFireballId: 1,
        // --- Milestone 6B: Infection Mode weapons & projectiles fields ---
        weaponPickups: [],
        infectionProjectiles: [],
        nextWeaponPickupId: 1,
        nextInfectionProjId: 1,
        // --- Milestone 6C: Infection Boss Branch & Abilities fields ---
        infectionTimer: 0,
        bossBranch: null,       // "INFECTED_BOSS" or "COSMIC_BOSS" (mutually exclusive)
        heartTimer: 0,
        nextHeartId: 1,
        infectionHazards: {
          slashes: [],          // World Cutting Slash hazards
          craters: [],          // Falling Sun crater hazards (instant elimination)
          blackHoles: [],       // Black Hole hazards (pull & 15s freeze)
          whiteHoles: [],       // White Hole hazards (repel outside & 15s freeze)
          jumpTelegraph: null   // Targeted Jump telegraph
        }
      };

      const SPAWN_POINTS = [
        { x: 120, y: 150 },
        { x: 680, y: 150 },
        { x: 120, y: 450 },
        { x: 680, y: 450 },
        { x: 400, y: 130 },
        { x: 400, y: 470 },
        { x: 220, y: 300 },
        { x: 580, y: 300 }
      ];

      const COLORS = [
        "#00e5ff", "#ff2266", "#ffe600", "#00ff88",
        "#ff00ea", "#ff8800", "#b347ff", "#00ffea"
      ];

      let playerList = Array.from(this.lobbyPlayers.entries());
      if (playerList.length === 0) {
        playerList = [
          [this.isHost ? (this.peer?.id || "host") : "host", { name: this.p1.name || "Host", shape: "square", isHost: true }],
          [!this.isHost ? (this.peer?.id || "guest") : "guest", { name: this.p2.name || "Guest", shape: "circle", isHost: false }]
        ];
      }

      let idx = 0;
      for (const [peerId, pInfo] of playerList) {
        const pt = SPAWN_POINTS[idx % SPAWN_POINTS.length];
        const color = COLORS[idx % COLORS.length];
        const isSelf = this.peer ? (peerId === this.peer.id) : (idx === 0 && this.isHost);
        
        const playerObj = {
          id: peerId,
          name: pInfo.name || `Player ${idx + 1}`,
          shape: pInfo.shape || "square",
          photo: pInfo.photo || null,
          color: color,
          isHost: !!pInfo.isHost,
          x: pt.x,
          y: pt.y,
          vx: 0,
          vy: 0,
          facingX: 1,
          facingY: 0,
          hp: 100,
          maxHp: 100,
          isAlive: true,
          isSpectator: false,
          isInfected: false,
          infectionState: "NORMAL",
          infectionWeapon: null,
          freezeTimer: 0,
          freezeType: null,
          damageDealt: 0,
          isDashing: false,
          suppressedTimer: 0,
          input: { x: 0, y: 0, sprint: false },
          lastInputSeq: 0,
          isSelf: isSelf
        };

        this.mpState.players.set(peerId, playerObj);
        idx++;
      }

      // Milestone 6A: Spawn initial mini enemies in Infection Mode (some infected, some normal per GDD)
      if (this.isHost && this.mpState.mode === "INFECTION") {
        const count = INFECTION_CONFIG.initialEnemyCount;
        const infectedCount = Math.floor(count * INFECTION_CONFIG.initialInfectedRatio);
        const archetypes = ["CHASER", "FLANKER", "SNIPER", "BOMBER", "DISRUPTOR"];
        for (let i = 0; i < count; i++) {
          const type = archetypes[i % archetypes.length];
          const enemy = this.mpSpawnEnemy(type);
          if (enemy) {
            enemy.isInfected = (i < infectedCount);
            enemy.infectionState = enemy.isInfected ? "INFECTED" : "NORMAL";
            if (enemy.isInfected) {
              enemy.color = "#39ff14";
            }
          }
        }

        // Milestone 6B: Spawn initial weapon pickups in Infection Mode (Host authoritative)
        const positions = INFECTION_CONFIG.weaponSpawnPositions || [
          { x: 220, y: 200, defaultType: "ZOMBIE_KILLER" },
          { x: 580, y: 200, defaultType: "COSMIC_BOMB" },
          { x: 400, y: 440, defaultType: "RAYBLUSTER" }
        ];
        for (const pos of positions) {
          let chosenType = pos.defaultType;
          if (chosenType === "RAYBLUSTER") {
            const roll = Math.random();
            if (roll > (INFECTION_CONFIG.rayblusterRarity || 0.05)) {
              chosenType = (Math.random() < 0.5) ? "ZOMBIE_KILLER" : "COSMIC_BOMB";
            }
          }
          this.mpState.weaponPickups.push({
            id: "wpk_" + (this.mpState.nextWeaponPickupId++),
            type: chosenType,
            x: pos.x,
            y: pos.y,
            radius: INFECTION_CONFIG.weaponPickupRadius || 18
          });
        }
      }

      const myId = this.peer?.id;
      const myObj = myId ? this.mpState.players.get(myId) : (this.isHost ? this.mpState.players.values().next().value : null);
      if (myObj) {
        this.p1.x = myObj.x;
        this.p1.y = myObj.y;
        this.p1.color = myObj.color;
      }

      if (this.isHost) {
        const startMsg = {
          type: "MP_MATCH_START",
          matchId: matchId,
          hostId: hostId,
          mode: mode,
          players: Array.from(this.mpState.players.values()).map(p => ({
            id: p.id,
            name: p.name,
            shape: p.shape,
            photo: p.photo,
            color: p.color,
            isHost: p.isHost,
            x: p.x,
            y: p.y,
            hp: p.hp,
            maxHp: p.maxHp,
            isAlive: p.isAlive,
            isSpectator: p.isSpectator,
            isInfected: !!p.isInfected
          })),
          weaponPickups: (this.mpState.weaponPickups || []).map(wpk => ({
            id: wpk.id,
            type: wpk.type,
            x: wpk.x,
            y: wpk.y
          }))
        };
        this._broadcastReliable(startMsg);
      }
      this._checkBackgroundTimer?.();
    }

    handleMPMatchStart(msg) {
      if (!this.hostPeerId || typeof this.hostPeerId !== "string" || !this.hostPeerId.trim()) {
        console.warn("[MP] Rejected MP_MATCH_START: hostPeerId not established via trusted signaling");
        return;
      }
      if (msg.hostId && msg.hostId !== this.hostPeerId) {
        console.warn(`[MP] Ignored MP_MATCH_START with mismatched hostId ${msg.hostId} (expected ${this.hostPeerId})`);
        return;
      }
      this.mpState = {
        matchId: msg.matchId,
        status: "PLAYING",
        hostId: this.hostPeerId,
        mode: msg.mode || "ELITE",
        players: new Map(),
        enemies: new Map(),
        projectiles: [],
        mines: [],
        nextEnemyId: 1,
        nextProjId: 1,
        nextMineId: 1,
        directorTimer: 0,
        processedEvents: new Set(),
        seq: 0,
        startTime: Date.now(),
        // --- Milestone 5A & 5B: Elite Mode foundation & hazards fields ---
        teamScore: msg.teamScore || 0,
        scoreActive: msg.scoreActive !== undefined ? msg.scoreActive : true,
        pickups: [],
        nextPickupId: msg.nextPickupId || 1,
        elitePickupTimer: 0,
        currentPhase: msg.currentPhase || 0,
        hazards: {
          smokeBombs: [],
          toxicGas: [],
          laserWall: null
        },
        // --- Milestone 5C: Demon Boss & Fireball Gun fields ---
        boss: null,
        bossProjectiles: [],
        bossVapors: [],
        playerFireballs: [],
        // --- Milestone 6B: Infection Mode weapons & projectiles fields ---
        weaponPickups: (msg.weaponPickups || []).map(wpk => ({
          id: wpk.id,
          type: wpk.type,
          x: wpk.x,
          y: wpk.y
        })),
        infectionProjectiles: [],
        nextWeaponPickupId: msg.nextWeaponPickupId || 1,
        nextInfectionProjId: 1,
        // --- Milestone 6C: Infection Boss Branch & Abilities fields ---
        infectionTimer: 0,
        bossBranch: null,
        heartTimer: 0,
        nextHeartId: 1,
        infectionHazards: {
          slashes: [],
          craters: [],
          blackHoles: [],
          whiteHoles: [],
          jumpTelegraph: null
        }
      };

      if (Array.isArray(msg.players)) {
        for (const sp of msg.players) {
          this.mpState.players.set(sp.id, {
            id: sp.id,
            name: sp.name,
            shape: sp.shape,
            photo: sp.photo,
            color: sp.color,
            isHost: sp.isHost,
            x: sp.x,
            y: sp.y,
            vx: 0,
            vy: 0,
            facingX: 1,
            facingY: 0,
            hp: sp.hp !== undefined ? sp.hp : 100,
            maxHp: sp.maxHp || 100,
            isAlive: sp.isAlive !== undefined ? sp.isAlive : true,
            isSpectator: sp.isSpectator || false,
            isInfected: !!sp.isInfected,
            infectionState: sp.isInfected ? "INFECTED" : "NORMAL",
            infectionWeapon: null,
            freezeTimer: 0,
            freezeType: null,
            damageDealt: 0,
            input: { x: 0, y: 0, sprint: false },
            lastInputSeq: 0
          });
        }
      }

      const myId = this.peer?.id;
      const myObj = myId ? this.mpState.players.get(myId) : null;
      if (myObj) {
        this.p1.x = myObj.x;
        this.p1.y = myObj.y;
        this.p1.color = myObj.color;
      }
      this._checkBackgroundTimer?.();
    }

    mpBroadcastSnapshot() {
      if (!this.isHost || !this.mpState) return;
      this.mpState.seq = (this.mpState.seq || 0) + 1;
      const snapshot = {
        type: "MP_SNAPSHOT",
        seq: this.mpState.seq,
        time: Date.now(),
        players: Array.from(this.mpState.players.values()).map(p => ({
          id: p.id,
          x: Math.round(p.x * 10) / 10,
          y: Math.round(p.y * 10) / 10,
          vx: Math.round(p.vx * 10) / 10,
          vy: Math.round(p.vy * 10) / 10,
          hp: p.hp,
          isAlive: p.isAlive,
          isSpectator: p.isSpectator,
          suppressedTimer: Math.round((p.suppressedTimer || 0) * 10) / 10,
          facingX: Math.round(p.facingX * 100) / 100,
          facingY: Math.round(p.facingY * 100) / 100,
          isInfected: !!p.isInfected,
          freezeTimer: Math.round((p.freezeTimer || 0) * 10) / 10,
          freezeType: p.freezeType || null,
          damageDealt: p.damageDealt || 0,
          infectionWeapon: p.infectionWeapon ? {
            type: p.infectionWeapon.type,
            ammo: p.infectionWeapon.ammo === Infinity ? -1 : p.infectionWeapon.ammo
          } : null
        })),
        enemies: Array.from(this.mpState.enemies.values()).map(e => ({
          id: e.id,
          type: e.type,
          state: e.state,
          x: Math.round(e.x * 10) / 10,
          y: Math.round(e.y * 10) / 10,
          vx: Math.round(e.vx * 10) / 10,
          vy: Math.round(e.vy * 10) / 10,
          hp: e.hp,
          maxHp: e.maxHp,
          stateTimer: Math.round((e.stateTimer || 0) * 100) / 100,
          isInfected: !!e.isInfected
        })),
        projectiles: this.mpState.projectiles.map(pr => ({
          id: pr.id,
          x: Math.round(pr.x * 10) / 10,
          y: Math.round(pr.y * 10) / 10
        })),
        mines: this.mpState.mines.map(m => ({
          id: m.id,
          x: Math.round(m.x * 10) / 10,
          y: Math.round(m.y * 10) / 10,
          radius: m.radius,
          armed: m.armed
        })),
        // Milestone 5A: Elite Mode pickup + team score sync
        teamScore: this.mpState.teamScore || 0,
        pickups: (this.mpState.pickups || []).map(pk => ({
          id: pk.id,
          type: pk.type,
          x: Math.round(pk.x * 10) / 10,
          y: Math.round(pk.y * 10) / 10
        })),
        // Milestone 5B: Elite Mode hazards & phase sync
        currentPhase: this.mpState.currentPhase || 0,
        hazards: {
          smokeBombs: (this.mpState.hazards?.smokeBombs || []).map(sb => ({
            id: sb.id,
            x: Math.round(sb.x),
            y: Math.round(sb.y),
            radius: sb.radius,
            state: sb.state,
            fuse: Math.round(sb.fuse * 10) / 10,
            duration: Math.round(sb.duration * 10) / 10
          })),
          toxicGas: (this.mpState.hazards?.toxicGas || []).map(tg => ({
            id: tg.id,
            x: Math.round(tg.x),
            y: Math.round(tg.y),
            radius: tg.radius,
            duration: Math.round(tg.duration * 10) / 10
          })),
          laserWall: this.mpState.hazards?.laserWall && this.mpState.hazards.laserWall.active ? {
            x: Math.round(this.mpState.hazards.laserWall.x),
            width: this.mpState.hazards.laserWall.width,
            active: true
          } : null
        },
        // Milestone 5C & 6C: Boss & Projectiles sync
        boss: this.mpState.boss ? {
          id: this.mpState.boss.id,
          type: this.mpState.boss.type,
          name: this.mpState.boss.name,
          x: Math.round(this.mpState.boss.x * 10) / 10,
          y: Math.round(this.mpState.boss.y * 10) / 10,
          hp: this.mpState.boss.hp,
          maxHp: this.mpState.boss.maxHp,
          radius: this.mpState.boss.radius || 36,
          isAlive: this.mpState.boss.isAlive
        } : null,
        bossProjectiles: (this.mpState.bossProjectiles || []).map(bp => ({
          id: bp.id,
          type: bp.type,
          x: Math.round(bp.x * 10) / 10,
          y: Math.round(bp.y * 10) / 10
        })),
        bossVapors: (this.mpState.bossVapors || []).map(bv => ({
          id: bv.id,
          type: bv.type,
          x: Math.round(bv.x * 10) / 10,
          y: Math.round(bv.y * 10) / 10,
          radius: bv.radius
        })),
        playerFireballs: (this.mpState.playerFireballs || []).map(pf => ({
          id: pf.id,
          x: Math.round(pf.x * 10) / 10,
          y: Math.round(pf.y * 10) / 10
        })),
        // Milestone 6B & 6C: Infection Mode weapon pickups, projectiles & hazards sync
        weaponPickups: (this.mpState.weaponPickups || []).map(wpk => ({
          id: wpk.id,
          type: wpk.type,
          x: Math.round(wpk.x * 10) / 10,
          y: Math.round(wpk.y * 10) / 10
        })),
        infectionProjectiles: (this.mpState.infectionProjectiles || []).map(ip => ({
          id: ip.id,
          type: ip.weaponType,
          x: Math.round(ip.x * 10) / 10,
          y: Math.round(ip.y * 10) / 10,
          color: ip.color
        })),
        infectionTimer: Math.round((this.mpState.infectionTimer || 0) * 10) / 10,
        bossBranch: this.mpState.bossBranch || null,
        infectionHazards: this.mpState.infectionHazards ? {
          slashes: (this.mpState.infectionHazards.slashes || []).map(s => ({
            id: s.id,
            state: s.state,
            timer: Math.round(s.timer * 10) / 10,
            x1: Math.round(s.x1),
            y1: Math.round(s.y1),
            x2: Math.round(s.x2),
            y2: Math.round(s.y2),
            width: s.width
          })),
          craters: (this.mpState.infectionHazards.craters || []).map(c => ({
            id: c.id,
            x: Math.round(c.x),
            y: Math.round(c.y),
            radius: c.radius,
            duration: Math.round(c.duration * 10) / 10
          })),
          blackHoles: (this.mpState.infectionHazards.blackHoles || []).map(b => ({
            id: b.id,
            x: Math.round(b.x),
            y: Math.round(b.y),
            radius: b.radius
          })),
          whiteHoles: (this.mpState.infectionHazards.whiteHoles || []).map(w => ({
            id: w.id,
            x: Math.round(w.x),
            y: Math.round(w.y),
            radius: w.radius
          })),
          jumpTelegraph: this.mpState.infectionHazards.jumpTelegraph ? {
            x: Math.round(this.mpState.infectionHazards.jumpTelegraph.x),
            y: Math.round(this.mpState.infectionHazards.jumpTelegraph.y),
            radius: this.mpState.infectionHazards.jumpTelegraph.radius,
            timer: Math.round(this.mpState.infectionHazards.jumpTelegraph.timer * 10) / 10
          } : null
        } : null
      };
      this._broadcastUnreliable(snapshot);
    }

    mpApplySnapshot(msg) {
      if (!this.mpState) return;
      if (msg.seq && this.mpLastSnapshotSeq && msg.seq <= this.mpLastSnapshotSeq) return;
      this.mpLastSnapshotSeq = msg.seq || 0;

      const myId = this.peer?.id;
      if (Array.isArray(msg.players)) {
        for (const sp of msg.players) {
          let p = this.mpState.players.get(sp.id);
          if (!p) {
            p = {
              id: sp.id,
              name: sp.name || "Player",
              shape: sp.shape || "square",
              photo: sp.photo || null,
              color: sp.color || "#00e5ff",
              x: sp.x,
              y: sp.y,
              vx: sp.vx || 0,
              vy: sp.vy || 0,
              facingX: sp.facingX || 1,
              facingY: sp.facingY || 0,
              hp: sp.hp !== undefined ? sp.hp : 100,
              maxHp: 100,
              isAlive: sp.isAlive !== undefined ? sp.isAlive : true,
              isSpectator: sp.isSpectator || false,
              suppressedTimer: sp.suppressedTimer || 0,
              input: { x: 0, y: 0, sprint: false },
              lastInputSeq: 0
            };
            this.mpState.players.set(sp.id, p);
          }

          p.hp = sp.hp !== undefined ? sp.hp : p.hp;
          p.isAlive = sp.isAlive !== undefined ? sp.isAlive : p.isAlive;
          p.isSpectator = sp.isSpectator || false;
          p.suppressedTimer = sp.suppressedTimer !== undefined ? sp.suppressedTimer : (p.suppressedTimer || 0);
          p.facingX = sp.facingX !== undefined ? sp.facingX : p.facingX;
          p.facingY = sp.facingY !== undefined ? sp.facingY : p.facingY;
          if (sp.freezeTimer !== undefined) {
            p.freezeTimer = sp.freezeTimer;
            p.freezeType = sp.freezeType || null;
          }
          if (sp.damageDealt !== undefined) {
            p.damageDealt = sp.damageDealt;
          }
          if (sp.isInfected !== undefined) {
            p.isInfected = !!sp.isInfected;
            p.infectionState = p.isInfected ? "INFECTED" : "NORMAL";
          }
          if (sp.infectionWeapon !== undefined) {
            if (sp.infectionWeapon === null) {
              p.infectionWeapon = null;
            } else {
              const wDef = INFECTION_WEAPONS[sp.infectionWeapon.type];
              if (!p.infectionWeapon || p.infectionWeapon.type !== sp.infectionWeapon.type) {
                p.infectionWeapon = {
                  type: sp.infectionWeapon.type,
                  name: wDef ? wDef.name : sp.infectionWeapon.type,
                  ammo: sp.infectionWeapon.ammo === -1 ? Infinity : sp.infectionWeapon.ammo,
                  maxAmmo: wDef ? wDef.maxAmmo : 150,
                  infectedBossDamage: wDef ? wDef.infectedBossDamage : 50,
                  cosmicBossDamage: wDef ? wDef.cosmicBossDamage : 50,
                  cooldown: 0
                };
              } else {
                p.infectionWeapon.ammo = sp.infectionWeapon.ammo === -1 ? Infinity : sp.infectionWeapon.ammo;
              }
            }
          }

          if (sp.id === myId) {
            const dist = Math.hypot(this.p1.x - sp.x, this.p1.y - sp.y);
            if (dist > 25 || (dist > 0.05 && Math.abs(this.p1Input.x) < 0.05 && Math.abs(this.p1Input.y) < 0.05)) {
              this.p1.x = sp.x;
              this.p1.y = sp.y;
              p.x = sp.x;
              p.y = sp.y;
            }
          } else {
            p.vx = sp.vx || 0;
            p.vy = sp.vy || 0;
            p.x = sp.x;
            p.y = sp.y;
          }
        }
      }

      // Sync enemies on guest
      if (Array.isArray(msg.enemies)) {
        const receivedIds = new Set(msg.enemies.map(e => e.id));
        for (const [id] of this.mpState.enemies) {
          if (!receivedIds.has(id)) this.mpState.enemies.delete(id);
        }
        for (const se of msg.enemies) {
          let e = this.mpState.enemies.get(se.id);
          if (!e) {
            e = {
              id: se.id,
              type: se.type,
              state: se.state,
              x: se.x,
              y: se.y,
              vx: se.vx,
              vy: se.vy,
              hp: se.hp,
              maxHp: se.maxHp,
              stateTimer: se.stateTimer,
              isInfected: !!se.isInfected,
              infectionState: se.isInfected ? "INFECTED" : "NORMAL"
            };
            if (e.isInfected) e.color = "#39ff14";
            this.mpState.enemies.set(se.id, e);
          } else {
            e.type = se.type;
            e.state = se.state;
            e.x = se.x;
            e.y = se.y;
            e.vx = se.vx;
            e.vy = se.vy;
            e.hp = se.hp;
            e.maxHp = se.maxHp;
            e.stateTimer = se.stateTimer;
            if (se.isInfected !== undefined) {
              e.isInfected = !!se.isInfected;
              e.infectionState = e.isInfected ? "INFECTED" : "NORMAL";
              if (e.isInfected) e.color = "#39ff14";
            }
          }
        }
      }

      // Sync projectiles on guest
      if (Array.isArray(msg.projectiles)) {
        this.mpState.projectiles = msg.projectiles.map(pr => ({
          id: pr.id,
          x: pr.x,
          y: pr.y
        }));
      }

      // Sync mines on guest
      if (Array.isArray(msg.mines)) {
        this.mpState.mines = msg.mines.map(m => ({
          id: m.id,
          x: m.x,
          y: m.y,
          radius: m.radius,
          armed: m.armed
        }));
      }

      // Milestone 5A: Sync Elite Mode team score and pickups on guest
      if (msg.teamScore !== undefined) {
        this.mpState.teamScore = msg.teamScore;
      }
      if (Array.isArray(msg.pickups)) {
        // Replace entire guest pickup array from authoritative snapshot
        this.mpState.pickups = msg.pickups.map(pk => ({
          id: pk.id,
          type: pk.type,
          x: pk.x,
          y: pk.y
        }));
      }

      // Milestone 5B: Sync Elite Mode hazards & phase on guest
      if (msg.currentPhase !== undefined) {
        this.mpState.currentPhase = msg.currentPhase;
      }
      if (msg.hazards) {
        this.mpState.hazards = {
          smokeBombs: Array.isArray(msg.hazards.smokeBombs) ? msg.hazards.smokeBombs : [],
          toxicGas: Array.isArray(msg.hazards.toxicGas) ? msg.hazards.toxicGas : [],
          laserWall: msg.hazards.laserWall || null
        };
      }

      // Milestone 5C & 6C: Sync Boss & fireballs on guest
      if (msg.boss !== undefined) {
        this.mpState.boss = msg.boss ? {
          id: msg.boss.id,
          type: msg.boss.type,
          name: msg.boss.name,
          x: msg.boss.x,
          y: msg.boss.y,
          hp: msg.boss.hp,
          maxHp: msg.boss.maxHp,
          radius: msg.boss.radius || 36,
          isAlive: msg.boss.isAlive
        } : null;
      }
      if (Array.isArray(msg.bossProjectiles)) {
        this.mpState.bossProjectiles = msg.bossProjectiles;
      }
      if (Array.isArray(msg.bossVapors)) {
        this.mpState.bossVapors = msg.bossVapors;
      }
      if (Array.isArray(msg.playerFireballs)) {
        this.mpState.playerFireballs = msg.playerFireballs;
      }

      // Milestone 6B: Sync weapon pickups and infection projectiles on guest
      if (Array.isArray(msg.weaponPickups)) {
        this.mpState.weaponPickups = msg.weaponPickups.map(wpk => ({
          id: wpk.id,
          type: wpk.type,
          x: wpk.x,
          y: wpk.y
        }));
      }
      if (Array.isArray(msg.infectionProjectiles)) {
        this.mpState.infectionProjectiles = msg.infectionProjectiles.map(ip => ({
          id: ip.id,
          weaponType: ip.type,
          x: ip.x,
          y: ip.y,
          color: ip.color
        }));
      }

      // Milestone 6C: Sync infectionTimer, bossBranch, and infection hazards on guest
      if (msg.infectionTimer !== undefined) {
        this.mpState.infectionTimer = msg.infectionTimer;
      }
      if (msg.bossBranch !== undefined) {
        this.mpState.bossBranch = msg.bossBranch;
      }
      if (msg.infectionHazards) {
        this.mpState.infectionHazards = msg.infectionHazards;
      }
    }

    mpApplyDamage(targetId, amount, sourceId, explicitEventId) {
      if (!this.isHost || !this.mpState) return false;
      const target = this.mpState.players.get(targetId);
      if (!target || !target.isAlive || target.isSpectator) return false;

      const eventId = explicitEventId || `dmg_${targetId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      if (this.mpState.processedEvents.has(eventId)) return false; // Dedup
      this.mpState.processedEvents.add(eventId);

      target.hp = Math.max(0, target.hp - amount);
      this.floatingTexts.push(new FloatingText(target.x, target.y - 10, `-${amount} HP`, "#ef4444"));

      this._broadcastReliable({
        type: "MP_DAMAGE",
        eventId: eventId,
        targetId: targetId,
        amount: amount,
        remainingHp: target.hp,
        sourceId: sourceId
      });

      if (target.hp <= 0) {
        this.mpEliminatePlayer(targetId, sourceId);
      }
      return true;
    }

    // Milestone 5A: Host-authoritative heal (heart pickups, capped at maxHp)
    mpApplyHeal(targetId, amount, explicitEventId) {
      if (!this.isHost || !this.mpState) return false;
      const target = this.mpState.players.get(targetId);
      if (!target || !target.isAlive || target.isSpectator) return false;

      const eventId = explicitEventId || `heal_${targetId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      if (this.mpState.processedEvents.has(eventId)) return false;
      this.mpState.processedEvents.add(eventId);

      const before = target.hp;
      target.hp = Math.min(target.maxHp || 100, target.hp + amount);
      const actual = target.hp - before;
      if (actual > 0) {
        this.floatingTexts.push(new FloatingText(target.x, target.y - 10, `+${actual} HP`, "#00ff88"));
      }

      this._broadcastReliable({
        type: "MP_HEAL",
        eventId: eventId,
        targetId: targetId,
        remainingHp: target.hp,
        amount: actual
      });
      return true;
    }

    mpEliminatePlayer(targetId, killerId) {
      if (!this.isHost || !this.mpState) return false;
      const target = this.mpState.players.get(targetId);
      if (!target) return false;

      const elimEventId = `elim_${targetId}_${Date.now()}`;
      if (this.mpState.processedEvents.has(elimEventId)) return false; // Dedup
      this.mpState.processedEvents.add(elimEventId);

      target.hp = 0;
      target.isAlive = false;
      target.isSpectator = true;
      this.floatingTexts.push(new FloatingText(target.x, target.y - 15, "💀 ELIMINATED!", "#ff2266"));

      this._broadcastReliable({
        type: "MP_ELIMINATED",
        eventId: elimEventId,
        targetId: targetId,
        killerId: killerId
      });

      const myId = this.peer?.id;
      if (target.id === myId) {
        this.showAnnouncement("💀 ELIMINATED", "YOU ARE NOW SPECTATING");
      }

      // Milestone 6C: Check if all players eliminated in Infection Mode -> Team Defeat
      if (this.mpState.mode === "INFECTION") {
        let anyAlive = false;
        for (const p of this.mpState.players.values()) {
          if (p.isAlive && !p.isSpectator) {
            anyAlive = true;
            break;
          }
        }
        if (!anyAlive) {
          this.mpState.status = "DEFEAT";
          this.state = "MATCH_OVER";
          this._broadcastReliable({
            type: "MP_MATCH_DEFEAT",
            reason: "ALL_PLAYERS_ELIMINATED"
          });
          this.sounds?.playGameOver?.();
          this.showAnnouncement("💀 TEAM WIPEOUT", "ALL PLAYERS ELIMINATED!");
        }
      }
      return true;
    }

    mpHandlePush(casterId, cx, cy) {
      if (!this.isHost || !this.mpState) return;
      const caster = this.mpState.players.get(casterId);
      if (!caster || !caster.isAlive || caster.isSpectator || (caster.suppressedTimer > 0)) return;

      const originX = cx !== undefined ? cx : (caster.x + PLAYER_SIZE / 2);
      const originY = cy !== undefined ? cy : (caster.y + PLAYER_SIZE / 2);

      for (const [targetId, p] of this.mpState.players) {
        if (targetId === casterId || !p.isAlive || p.isSpectator) continue;
        const pcx = p.x + PLAYER_SIZE / 2;
        const pcy = p.y + PLAYER_SIZE / 2;
        const dx = pcx - originX;
        const dy = pcy - originY;
        const dist = Math.hypot(dx, dy);

        if (dist < SHOCKWAVE_RADIUS) {
          const force = (1 - dist / SHOCKWAVE_RADIUS) * 500 + 200;
          const nx = dist > 0 ? (dx / dist) : 1;
          const ny = dist > 0 ? (dy / dist) : 0;
          p.x += nx * force * 0.05;
          p.y += ny * force * 0.05;
          p.x = Math.max(0, Math.min(SCREEN_WIDTH - PLAYER_SIZE, p.x));
          p.y = Math.max(0, Math.min(SCREEN_HEIGHT - PLAYER_SIZE, p.y));

          // Pushing in MP deals 20 damage
          this.mpApplyDamage(targetId, 20, casterId);
        }
      }
    }

    // Milestone 5C: Player shooting Fireball Gun in Elite Mode (Host authoritative)
    mpHandleShoot(shooterId, sx, sy, fx, fy) {
      if (!this.isHost || !this.mpState) return;
      const shooter = this.mpState.players.get(shooterId);
      if (!shooter || !shooter.isAlive || shooter.isSpectator || (shooter.suppressedTimer > 0)) return;
      if (!shooter.fireballGun || shooter.fireballGun.ammo <= 0) return;

      shooter.fireballGun.ammo--;
      const originX = sx !== undefined ? sx : (shooter.x + PLAYER_SIZE / 2);
      const originY = sy !== undefined ? sy : (shooter.y + PLAYER_SIZE / 2);
      let dirX = fx !== undefined ? fx : (shooter.facingX || 1);
      let dirY = fy !== undefined ? fy : (shooter.facingY || 0);
      const len = Math.hypot(dirX, dirY);
      if (len > 0.001) { dirX /= len; dirY /= len; } else { dirX = 1; dirY = 0; }

      const fb = {
        id: "pfb_" + (this.mpState.nextFireballId++),
        shooterId: shooterId,
        x: originX,
        y: originY,
        vx: dirX * 650,
        vy: dirY * 650,
        radius: 8,
        damage: 50,
        life: 2.0
      };
      if (!this.mpState.playerFireballs) this.mpState.playerFireballs = [];
      this.mpState.playerFireballs.push(fb);
      this.sounds?.playGunShot?.();
    }

    _handleHostDisconnectDuringMatch() {
      if (this.state === "PLAYING") {
        this.state = "MENU";
        this.mpState = null;
        this.showAnnouncement("HOST DISCONNECTED", "MATCH TERMINATED");
        setTimeout(() => {
          this._lobbyLeave();
        }, 1500);
      }
    }

    // ══════════════════════════════════════════════════════════════
    // MULTIPLAYER ENEMY AI (5 ARCHETYPES) — Milestone 4
    // Chaser, Flanker, Sniper, Bomber, Disruptor + Adaptive Director
    // ══════════════════════════════════════════════════════════════

    mpSpawnEnemy(type, x, y) {
      if (!this.isHost || !this.mpState) return null;
      const id = "mpe_" + (this.mpState.nextEnemyId++);
      
      // Default spawn edge if not specified
      if (x === undefined || y === undefined) {
        const edge = Math.floor(Math.random() * 4);
        if (edge === 0) { x = Math.random() * SCREEN_WIDTH; y = 10; }
        else if (edge === 1) { x = Math.random() * SCREEN_WIDTH; y = SCREEN_HEIGHT - 25; }
        else if (edge === 2) { x = 10; y = Math.random() * SCREEN_HEIGHT; }
        else { x = SCREEN_WIDTH - 25; y = Math.random() * SCREEN_HEIGHT; }
      }

      let enemyObj = {
        id,
        type, // "CHASER", "FLANKER", "SNIPER", "BOMBER", "DISRUPTOR"
        state: "IDLE", // FSM: "IDLE", "CHASE", "ORBIT", "DIVE", "CHARGE", "FIRE", "DEPLOY", "PULL", "STUN"
        x,
        y,
        vx: 0,
        vy: 0,
        size: 18,
        hp: 100,
        maxHp: 100,
        speed: 150,
        targetId: null,
        decisionTimer: 0,
        stateTimer: 0,
        attackCooldown: 0,
        color: "#ff2a5f"
      };

      if (type === "CHASER") {
        enemyObj.speed = 175;
        enemyObj.size = 18;
        enemyObj.color = "#ff3344"; // Aggressive red
        enemyObj.state = "CHASE";
      } else if (type === "FLANKER") {
        enemyObj.speed = 210;
        enemyObj.size = 16;
        enemyObj.color = "#eab308"; // Amber
        enemyObj.state = "ORBIT";
        enemyObj.stateTimer = 2.0; // Orbit for 2s before dive
      } else if (type === "SNIPER") {
        enemyObj.speed = 100;
        enemyObj.size = 20;
        enemyObj.color = "#a855f7"; // Purple
        enemyObj.state = "REPOSITION";
        enemyObj.attackCooldown = 3.0;
      } else if (type === "BOMBER") {
        enemyObj.speed = 120;
        enemyObj.size = 22;
        enemyObj.color = "#f97316"; // Orange
        enemyObj.state = "PATROL";
        enemyObj.attackCooldown = 4.0;
      } else if (type === "DISRUPTOR") {
        enemyObj.speed = 135;
        enemyObj.size = 24;
        enemyObj.color = "#06b6d4"; // Cyan
        enemyObj.state = "PULL";
        enemyObj.attackCooldown = 5.0;
      }

      this.mpState.enemies.set(id, enemyObj);
      return enemyObj;
    }

    mpSelectTarget(enemy) {
      if (!this.mpState || this.mpState.players.size === 0) return null;
      let bestTarget = null;
      let bestScore = -Infinity;

      // Count assignments per target to prevent dogpiling
      const targetCounts = {};
      for (const e of this.mpState.enemies.values()) {
        if (e.targetId) targetCounts[e.targetId] = (targetCounts[e.targetId] || 0) + 1;
      }

      for (const [peerId, p] of this.mpState.players) {
        if (!p.isAlive || p.isSpectator) continue;

        const dist = Math.hypot(p.x - enemy.x, p.y - enemy.y);
        const healthRatio = (p.hp || 100) / (p.maxHp || 100);
        const assignedCount = targetCounts[peerId] || 0;

        let score = 0;
        if (enemy.type === "CHASER") {
          // Prefers closest player with low load balancing penalty
          score = (1000 - dist) - assignedCount * 120;
        } else if (enemy.type === "FLANKER") {
          // Prefers isolated players
          score = (dist > 250 ? 500 : 200) - healthRatio * 150 - assignedCount * 200;
        } else if (enemy.type === "SNIPER") {
          // Strongly prefers lowest health targets
          score = (1 - healthRatio) * 600 - assignedCount * 250;
        } else if (enemy.type === "BOMBER") {
          // Area denial near cluster of players
          score = (800 - dist) - assignedCount * 100;
        } else if (enemy.type === "DISRUPTOR") {
          // Disrupts most dangerous or highest health player
          score = healthRatio * 400 - dist * 0.5 - assignedCount * 150;
        }

        if (score > bestScore) {
          bestScore = score;
          bestTarget = peerId;
        }
      }

      enemy.targetId = bestTarget;
      return bestTarget;
    }

    // ══════════════════════════════════════════════════════════════
    // MILESTONE 5A & 5B: Elite Mode Host-Authoritative Engine
    // Pickups (5A) + Environmental Hazards & Score Thresholds (5B)
    // 30 pts: Smoke Bombs (2s fuse, 3s duration, 20 HP on entry)
    // 70 pts: Toxic Gas (spawns every 5s, lasts 10s, 10 HP every 0.5s)
    // 120 pts: Mini enemies halt. Laser Wall (every 15s, 60 HP direct hit)
    // 200 pts: Toxic gas & laser halt. Smoke bombs continue. Scoring halts.
    // ══════════════════════════════════════════════════════════════
    mpUpdateElite(dt) {
      if (!this.isHost || !this.mpState) return;
      if (this.mpState.mode !== "ELITE") return;

      const st = this.mpState;
      if (!st.hazards) {
        st.hazards = { smokeBombs: [], toxicGas: [], laserWall: null };
      }
      if (!st.hazardTimers) {
        st.hazardTimers = { smoke: 0, gas: 0, laser: 0 };
      }

      // ── 1. Evaluate Score Thresholds & Phase Transitions ──
      const score = st.teamScore || 0;
      let targetPhase = 0;
      if (score >= 200) targetPhase = 4;
      else if (score >= 120) targetPhase = 3;
      else if (score >= 70) targetPhase = 2;
      else if (score >= 30) targetPhase = 1;

      if (targetPhase !== st.currentPhase) {
        st.currentPhase = targetPhase;
        if (st.currentPhase === 4) {
          // 200 pts: Demon Boss threshold
          st.scoreActive = false; // Stop score collection permanently
          st.hazards.toxicGas = [];
          st.hazards.laserWall = null;
          this.showAnnouncement("DEMON BOSS AWAKENS", "SURVIVE THE FINAL CONQUEST");
        } else if (st.currentPhase === 3) {
          this.showAnnouncement("CRUCIBLE OVERLOAD", "LASER WALL ACTIVATED - MINI ENEMIES HALTED");
        } else if (st.currentPhase === 2) {
          this.showAnnouncement("HAZARD WARNING", "TOXIC GAS VAPORS DEPLOYED");
        } else if (st.currentPhase === 1) {
          this.showAnnouncement("HAZARD WARNING", "SMOKE BOMBS DEPLOYED");
        }

        this._broadcastReliable({
          type: "MP_PHASE_TRANSITION",
          phase: st.currentPhase,
          teamScore: st.teamScore
        });
      }

      // ── 2. Pickups Spawning & Collection (Active only before 200 pts) ──
      if (st.scoreActive) {
        st.elitePickupTimer = (st.elitePickupTimer || 0) + dt;
        const SCORE_INTERVAL = 3.0; // provisional
        const SCORE_MAX      = 5;   // provisional
        const HEART_INTERVAL = 8.0; // provisional
        const HEART_MAX      = 3;   // provisional

        const scoreCount = st.pickups.filter(p => p.type === "SCORE").length;
        const heartCount = st.pickups.filter(p => p.type === "HEART").length;

        if (st.elitePickupTimer >= Math.min(SCORE_INTERVAL, HEART_INTERVAL)) {
          if (scoreCount < SCORE_MAX) {
            st.pickups.push({
              id: st.nextPickupId++,
              type: "SCORE",
              x: 60 + Math.random() * (SCREEN_WIDTH  - 120),
              y: 60 + Math.random() * (SCREEN_HEIGHT - 120)
            });
          }
          if (heartCount < HEART_MAX && (st.eliteHeartTimer || 0) >= HEART_INTERVAL) {
            st.pickups.push({
              id: st.nextPickupId++,
              type: "HEART",
              x: 60 + Math.random() * (SCREEN_WIDTH  - 120),
              y: 60 + Math.random() * (SCREEN_HEIGHT - 120)
            });
            st.eliteHeartTimer = 0;
          }
          st.elitePickupTimer = 0;
        }
        st.eliteHeartTimer = (st.eliteHeartTimer || 0) + dt;

        // Pickup collection
        const PICKUP_RADIUS = 22;
        const collected = new Set();
        for (const p of st.players.values()) {
          if (!p.isAlive || p.isSpectator) continue;
          const pcx = p.x + PLAYER_SIZE / 2;
          const pcy = p.y + PLAYER_SIZE / 2;

          for (const pk of st.pickups) {
            if (collected.has(pk.id)) continue;
            const dist = Math.hypot(pcx - pk.x, pcy - pk.y);
            if (dist <= PICKUP_RADIUS) {
              collected.add(pk.id);
              if (pk.type === "SCORE") {
                st.teamScore += 5;
                this.floatingTexts.push(new FloatingText(pk.x, pk.y - 10, "+5 🏆", "#00ff88"));
                this._broadcastReliable({
                  type: "MP_SCORE_UPDATE",
                  teamScore: st.teamScore
                });
              } else if (pk.type === "HEART") {
                const eventId = `heal_pk_${pk.id}_${p.id}`;
                this.mpApplyHeal(p.id, 10, eventId);
              }
            }
          }
        }
        if (collected.size > 0) {
          st.pickups = st.pickups.filter(pk => !collected.has(pk.id));
        }
      }

      // ── 3. Environmental Hazards: Smoke Bombs (Phases 1, 2, 3, 4) ──
      // GDD exact: activates at 30 pts, 2.0s fuse, 3.0s duration, 20 HP on entry. Continues at 200 pts.
      if (st.currentPhase >= 1) {
        st.hazardTimers.smoke = (st.hazardTimers.smoke || 0) + dt;
        const SMOKE_SPAWN_INTERVAL = 4.0; // provisional (Appendix C)
        const SMOKE_MAX = 4;              // provisional
        if (st.hazardTimers.smoke >= SMOKE_SPAWN_INTERVAL) {
          st.hazardTimers.smoke = 0;
          if (st.hazards.smokeBombs.length < SMOKE_MAX) {
            st.hazards.smokeBombs.push({
              id: "sb_" + (st.nextHazardId++),
              x: 80 + Math.random() * (SCREEN_WIDTH - 160),
              y: 80 + Math.random() * (SCREEN_HEIGHT - 160),
              radius: 50,      // provisional (Appendix C)
              fuse: 2.0,       // GDD exact: 2s fuse
              duration: 3.0,   // GDD exact: 3s duration
              state: "FUSE",
              enteredPlayers: new Set()
            });
          }
        }

        // Update active smoke bombs
        for (let i = st.hazards.smokeBombs.length - 1; i >= 0; i--) {
          const sb = st.hazards.smokeBombs[i];
          if (sb.state === "FUSE") {
            sb.fuse -= dt;
            if (sb.fuse <= 0) {
              sb.state = "ACTIVE";
              this.floatingTexts.push(new FloatingText(sb.x, sb.y - 15, "💥 SMOKE!", "#ff8800"));
            }
          }
          if (sb.state === "ACTIVE") {
            sb.duration -= dt;
            // Entry damage check: 20 HP on entry
            for (const p of st.players.values()) {
              if (!p.isAlive || p.isSpectator) continue;
              const pcx = p.x + PLAYER_SIZE / 2;
              const pcy = p.y + PLAYER_SIZE / 2;
              const dist = Math.hypot(pcx - sb.x, pcy - sb.y);
              if (dist <= sb.radius + PLAYER_SIZE / 2) {
                if (!sb.enteredPlayers.has(p.id)) {
                  sb.enteredPlayers.add(p.id);
                  this.mpApplyDamage(p.id, 20, "hazard_smoke");
                }
              } else {
                // Left the smoke bomb radius: allow re-entry damage
                sb.enteredPlayers.delete(p.id);
              }
            }
            if (sb.duration <= 0) {
              st.hazards.smokeBombs.splice(i, 1);
            }
          }
        }
      }

      // ── 4. Environmental Hazards: Toxic Gas (Phases 2 & 3 only) ──
      // GDD exact: activates at 70 pts, spawns every 5s, lasts 10s, deals 10 HP every 0.5s. Stops at 200 pts.
      if (st.currentPhase === 2 || st.currentPhase === 3) {
        st.hazardTimers.gas = (st.hazardTimers.gas || 0) + dt;
        const GAS_SPAWN_INTERVAL = 5.0; // GDD exact: every 5.0s
        const GAS_MAX = 4;              // provisional
        if (st.hazardTimers.gas >= GAS_SPAWN_INTERVAL) {
          st.hazardTimers.gas = 0;
          if (st.hazards.toxicGas.length < GAS_MAX) {
            st.hazards.toxicGas.push({
              id: "tg_" + (st.nextHazardId++),
              x: 90 + Math.random() * (SCREEN_WIDTH - 180),
              y: 90 + Math.random() * (SCREEN_HEIGHT - 180),
              radius: 65,      // provisional (Appendix C)
              duration: 10.0,  // GDD exact: lasts 10s
              tickTimer: 0.5   // GDD exact: deals 10 HP every 0.5s
            });
          }
        }

        // Update toxic gas clouds
        for (let i = st.hazards.toxicGas.length - 1; i >= 0; i--) {
          const tg = st.hazards.toxicGas[i];
          tg.duration -= dt;
          tg.tickTimer -= dt;
          if (tg.tickTimer <= 0) {
            tg.tickTimer = 0.5;
            for (const p of st.players.values()) {
              if (!p.isAlive || p.isSpectator) continue;
              const pcx = p.x + PLAYER_SIZE / 2;
              const pcy = p.y + PLAYER_SIZE / 2;
              const dist = Math.hypot(pcx - tg.x, pcy - tg.y);
              if (dist <= tg.radius + PLAYER_SIZE / 2) {
                this.mpApplyDamage(p.id, 10, "hazard_toxic_gas");
              }
            }
          }
          if (tg.duration <= 0) {
            st.hazards.toxicGas.splice(i, 1);
          }
        }
      } else {
        // Toxic gas not active in phases < 2 or >= 4
        if (st.hazards.toxicGas.length > 0) st.hazards.toxicGas = [];
      }

      // ── 5. Environmental Hazards: Laser Wall (Phase 3 only) ──
      // GDD exact: activates at 120 pts, cycle every 15s, deals 60 HP on direct hit. Stops at 200 pts.
      if (st.currentPhase === 3) {
        st.hazardTimers.laser = (st.hazardTimers.laser || 0) + dt;
        const LASER_CYCLE = 15.0; // GDD exact: activates every 15s
        if (st.hazardTimers.laser >= LASER_CYCLE && !st.hazards.laserWall) {
          st.hazardTimers.laser = 0;
          st.hazards.laserWall = {
            id: "lw_" + (st.nextHazardId++),
            x: -20,
            width: 16,               // provisional (Appendix C)
            speed: (840 / 3.5),      // provisional: 3.5s sweep across 800px arena
            active: true,
            hitPlayers: new Set()
          };
          this.floatingTexts.push(new FloatingText(SCREEN_WIDTH / 2, 50, "⚡ LASER WALL SWEEP!", "#ff0055"));
        }

        if (st.hazards.laserWall && st.hazards.laserWall.active) {
          const lw = st.hazards.laserWall;
          lw.x += lw.speed * dt;
          for (const p of st.players.values()) {
            if (!p.isAlive || p.isSpectator) continue;
            const px = p.x + PLAYER_SIZE / 2;
            if (Math.abs(px - lw.x) <= (lw.width / 2 + PLAYER_SIZE / 2)) {
              if (!lw.hitPlayers.has(p.id)) {
                lw.hitPlayers.add(p.id);
                this.mpApplyDamage(p.id, 60, "hazard_laser"); // GDD exact: 60 HP direct hit
              }
            }
          }
          if (lw.x > SCREEN_WIDTH + lw.width + 20) {
            st.hazards.laserWall = null;
          }
        }
      } else {
        // Laser wall not active in phases !== 3
        if (st.hazards.laserWall) st.hazards.laserWall = null;
      }

      // ── 6. Milestone 5C: Demon Boss & Boss Combat (Phase 4, 200+ pts) ──
      if (st.currentPhase >= 4) {
        if (!st.boss) {
          st.boss = {
            id: "demon_boss_1",
            name: "DEMON BOSS",
            x: SCREEN_WIDTH / 2,
            y: SCREEN_HEIGHT / 2,
            radius: 35,
            hp: 2500,       // GDD exact: 2500 HP fixed
            maxHp: 2500,
            isAlive: true,
            speed: 80,
            targetId: null,
            contactCooldown: 0,
            fireballTimer: 5.0,  // GDD exact: every 5.0s, 10 damage
            vaporTimer: 15.0,    // GDD exact: every 15.0s (lasts 7.0s), 5 damage every 0.5s
            gasTimer: 20.0       // GDD exact: every 20.0s (lasts 30.0s), 2 damage/s
          };
          // Grant Fireball Gun to every surviving player (100 ammo, 50 damage)
          for (const p of st.players.values()) {
            if (p.isAlive && !p.isSpectator) {
              p.fireballGun = { ammo: 100, maxAmmo: 100, damage: 50, cooldown: 0 };
            }
          }
        }

        if (st.boss && st.boss.isAlive) {
          // Threat priority: targets the surviving player with highest individual score contribution
          let bestTarget = null;
          let maxScore = -1;
          for (const [pId, p] of st.players) {
            if (!p.isAlive || p.isSpectator) continue;
            const contrib = p.scoreContribution || 0;
            if (contrib > maxScore || bestTarget === null) {
              maxScore = contrib;
              bestTarget = p;
            }
          }
          const target = bestTarget;
          st.boss.targetId = target ? target.id : null;

          // Boss movement
          if (target) {
            const dx = (target.x + PLAYER_SIZE / 2) - st.boss.x;
            const dy = (target.y + PLAYER_SIZE / 2) - st.boss.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 10) {
              st.boss.x += (dx / dist) * st.boss.speed * dt;
              st.boss.y += (dy / dist) * st.boss.speed * dt;
            }
            st.boss.x = Math.max(50, Math.min(SCREEN_WIDTH - 50, st.boss.x));
            st.boss.y = Math.max(50, Math.min(SCREEN_HEIGHT - 50, st.boss.y));

            // Contact damage
            st.boss.contactCooldown = Math.max(0, (st.boss.contactCooldown || 0) - dt);
            if (dist <= st.boss.radius + PLAYER_SIZE / 2 && st.boss.contactCooldown <= 0) {
              st.boss.contactCooldown = 1.0;
              this.mpApplyDamage(target.id, 20, "demon_boss_contact");
            }
          }

          // Ability 1: Fireball (every 5.0s, 10 damage)
          st.boss.fireballTimer = (st.boss.fireballTimer || 5.0) - dt;
          if (st.boss.fireballTimer <= 0) {
            st.boss.fireballTimer = 5.0;
            if (target) {
              const dx = (target.x + PLAYER_SIZE / 2) - st.boss.x;
              const dy = (target.y + PLAYER_SIZE / 2) - st.boss.y;
              const dist = Math.hypot(dx, dy);
              const vx = dist > 0 ? (dx / dist) * 400 : 400;
              const vy = dist > 0 ? (dy / dist) * 400 : 0;
              if (!st.bossProjectiles) st.bossProjectiles = [];
              st.bossProjectiles.push({
                id: "bfb_" + (st.nextBossAttackId++),
                type: "FIREBALL",
                x: st.boss.x,
                y: st.boss.y,
                vx, vy,
                radius: 9,
                damage: 10, // GDD exact: 10 damage
                life: 3.0
              });
              this.floatingTexts.push(new FloatingText(st.boss.x, st.boss.y - 20, "🔥 FIREBALL!", "#ff4400"));
            }
          }

          // Ability 2: Pink Burst Vapor (every 15.0s, lasts 7.0s, 5 damage every 0.5s)
          st.boss.vaporTimer = (st.boss.vaporTimer || 15.0) - dt;
          if (st.boss.vaporTimer <= 0) {
            st.boss.vaporTimer = 15.0;
            const spawnX = target ? target.x : st.boss.x;
            const spawnY = target ? target.y : st.boss.y;
            if (!st.bossVapors) st.bossVapors = [];
            st.bossVapors.push({
              id: "bv_" + (st.nextBossAttackId++),
              type: "PINK_BURST",
              x: spawnX,
              y: spawnY,
              radius: 75,
              duration: 7.0, // GDD exact: lasts 7.0s
              tickTimer: 0.5,
              tickDamage: 5   // GDD exact: 5 damage every 0.5s
            });
            this.floatingTexts.push(new FloatingText(spawnX, spawnY - 20, "💨 PINK VAPOR!", "#ff00aa"));
          }

          // Ability 3: Targeted Green Gas (every 20.0s, lasts 30.0s, 2 damage/s)
          st.boss.gasTimer = (st.boss.gasTimer || 20.0) - dt;
          if (st.boss.gasTimer <= 0) {
            st.boss.gasTimer = 20.0;
            if (!st.bossVapors) st.bossVapors = [];
            st.bossVapors.push({
              id: "tgg_" + (st.nextBossAttackId++),
              type: "TARGETED_GREEN",
              x: st.boss.x,
              y: st.boss.y,
              radius: 55,
              duration: 30.0, // GDD exact: lasts 30.0s
              tickTimer: 1.0,
              tickDamage: 2,   // GDD exact: 2 damage per second
              targetId: target ? target.id : null,
              speed: 40
            });
            this.floatingTexts.push(new FloatingText(st.boss.x, st.boss.y - 20, "☠ TARGETED GREEN GAS!", "#00ff66"));
          }
        }

        // Process Boss Projectiles
        for (let i = (st.bossProjectiles || []).length - 1; i >= 0; i--) {
          const bp = st.bossProjectiles[i];
          bp.x += bp.vx * dt;
          bp.y += bp.vy * dt;
          bp.life -= dt;
          let hit = false;
          for (const [pId, p] of st.players) {
            if (!p.isAlive || p.isSpectator) continue;
            const dist = Math.hypot((p.x + PLAYER_SIZE / 2) - bp.x, (p.y + PLAYER_SIZE / 2) - bp.y);
            if (dist <= bp.radius + PLAYER_SIZE / 2) {
              this.mpApplyDamage(pId, bp.damage || 10, "boss_fireball");
              hit = true;
              break;
            }
          }
          if (hit || bp.life <= 0 || bp.x < -20 || bp.x > SCREEN_WIDTH + 20 || bp.y < -20 || bp.y > SCREEN_HEIGHT + 20) {
            st.bossProjectiles.splice(i, 1);
          }
        }

        // Process Boss Vapors
        for (let i = (st.bossVapors || []).length - 1; i >= 0; i--) {
          const bv = st.bossVapors[i];
          bv.duration -= dt;
          if (bv.type === "TARGETED_GREEN" && bv.targetId) {
            const tgt = st.players.get(bv.targetId);
            if (tgt && tgt.isAlive && !tgt.isSpectator) {
              const dx = (tgt.x + PLAYER_SIZE / 2) - bv.x;
              const dy = (tgt.y + PLAYER_SIZE / 2) - bv.y;
              const dist = Math.hypot(dx, dy);
              if (dist > 5) {
                bv.x += (dx / dist) * bv.speed * dt;
                bv.y += (dy / dist) * bv.speed * dt;
              }
            }
          }

          bv.tickTimer -= dt;
          if (bv.tickTimer <= 0) {
            bv.tickTimer = (bv.type === "TARGETED_GREEN") ? 1.0 : 0.5;
            for (const [pId, p] of st.players) {
              if (!p.isAlive || p.isSpectator) continue;
              const dist = Math.hypot((p.x + PLAYER_SIZE / 2) - bv.x, (p.y + PLAYER_SIZE / 2) - bv.y);
              if (dist <= bv.radius + PLAYER_SIZE / 2) {
                this.mpApplyDamage(pId, bv.tickDamage, bv.type === "TARGETED_GREEN" ? "boss_targeted_gas" : "boss_pink_vapor");
              }
            }
          }
          if (bv.duration <= 0) {
            st.bossVapors.splice(i, 1);
          }
        }
      }

      // ── 7. Process Player Fireballs (Friendly Fire OFF, hits Demon Boss only) ──
      for (let i = (st.playerFireballs || []).length - 1; i >= 0; i--) {
        const pf = st.playerFireballs[i];
        pf.x += pf.vx * dt;
        pf.y += pf.vy * dt;
        pf.life -= dt;

        let hit = false;
        if (st.boss && st.boss.isAlive) {
          const dist = Math.hypot(pf.x - st.boss.x, pf.y - st.boss.y);
          if (dist <= st.boss.radius + pf.radius) {
            hit = true;
            st.boss.hp = Math.max(0, st.boss.hp - (pf.damage || 50));
            this.floatingTexts.push(new FloatingText(st.boss.x, st.boss.y - 25, `-${pf.damage || 50} HP`, "#ffcc00"));
            if (st.boss.hp <= 0) {
              st.boss.hp = 0;
              st.boss.isAlive = false;
              st.status = "VICTORY";
              this.state = "VICTORY";
              this._broadcastReliable({ type: "MP_MATCH_VICTORY", reason: "DEMON_BOSS_DEFEATED" });
              this.sounds?.playVictory?.();
              this.showAnnouncement("👑 ARENA CONQUERED!", "DEMON BOSS DEFEATED!");
            }
          }
        }
        if (hit || pf.life <= 0 || pf.x < -20 || pf.x > SCREEN_WIDTH + 20 || pf.y < -20 || pf.y > SCREEN_HEIGHT + 20) {
          st.playerFireballs.splice(i, 1);
        }
      }

      // Decrement player fireball weapon cooldowns
      for (const p of st.players.values()) {
        if (p.fireballGun && p.fireballGun.cooldown > 0) {
          p.fireballGun.cooldown = Math.max(0, p.fireballGun.cooldown - dt);
        }
      }
    }

    // ══════════════════════════════════════════════════════════════
    // MULTIPLAYER INFECTION MODE (Milestone 6A)
    // 4 Propagation Interactions, Host Authority, Deduplication & Sync
    // ══════════════════════════════════════════════════════════════

    mpInfectEntity(targetType, targetId, sourceId, explicitEventId) {
      if (!this.isHost || !this.mpState || this.mpState.mode !== "INFECTION") return false;
      const st = this.mpState;

      if (targetType === "PLAYER") {
        const player = st.players.get(targetId);
        // Entity must exist, be alive, not spectator, and NOT already infected
        if (!player || !player.isAlive || player.isSpectator || player.isInfected) return false;

        const eventId = explicitEventId || `inf_p_${targetId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        if (st.processedEvents.has(eventId)) return false; // Dedup
        st.processedEvents.add(eventId);

        // Mutate state to infected (NO speed buff, NO extra abilities)
        player.isInfected = true;
        player.infectionState = "INFECTED";

        this.floatingTexts.push(new FloatingText(player.x, player.y - 15, "☣️ INFECTED!", "#39ff14"));

        // Reliable broadcast to all players
        this._broadcastReliable({
          type: "MP_INFECTION_EVENT",
          eventId: eventId,
          targetType: "PLAYER",
          targetId: targetId,
          sourceId: sourceId
        });
        return true;
      } else if (targetType === "ENEMY") {
        const enemy = st.enemies.get(targetId);
        // Entity must exist, have HP > 0, and NOT already infected
        if (!enemy || enemy.hp <= 0 || enemy.isInfected) return false;

        const eventId = explicitEventId || `inf_e_${targetId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        if (st.processedEvents.has(eventId)) return false; // Dedup
        st.processedEvents.add(eventId);

        // Mutate state to infected (NO speed buff, NO extra abilities)
        enemy.isInfected = true;
        enemy.infectionState = "INFECTED";
        enemy.color = "#39ff14";

        this.floatingTexts.push(new FloatingText(enemy.x, enemy.y - 15, "☣️ INFECTED!", "#39ff14"));

        // Reliable broadcast to all players
        this._broadcastReliable({
          type: "MP_INFECTION_EVENT",
          eventId: eventId,
          targetType: "ENEMY",
          targetId: targetId,
          sourceId: sourceId
        });
        return true;
      }
      return false;
    }

    handleMPInfectionEvent(msg) {
      if (!this.mpState || this.mpState.mode !== "INFECTION") return;
      if (msg.eventId && this.mpState.processedEvents.has(msg.eventId)) return; // Dedup
      if (msg.eventId) this.mpState.processedEvents.add(msg.eventId);

      if (msg.targetType === "PLAYER") {
        const p = this.mpState.players.get(msg.targetId);
        if (p && !p.isInfected) {
          p.isInfected = true;
          p.infectionState = "INFECTED";
          this.floatingTexts.push(new FloatingText(p.x, p.y - 15, "☣️ INFECTED!", "#39ff14"));
        }
      } else if (msg.targetType === "ENEMY") {
        const e = this.mpState.enemies.get(msg.targetId);
        if (e && !e.isInfected) {
          e.isInfected = true;
          e.infectionState = "INFECTED";
          e.color = "#39ff14";
          this.floatingTexts.push(new FloatingText(e.x, e.y - 15, "☣️ INFECTED!", "#39ff14"));
        }
      }
    }

    _isPointInSlash(px, py, slash) {
      if (!slash) return false;
      const x1 = slash.x1, y1 = slash.y1, x2 = slash.x2, y2 = slash.y2;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const l2 = dx * dx + dy * dy;
      if (l2 === 0) return Math.hypot(px - x1, py - y1) <= (slash.width / 2);
      let t = ((px - x1) * dx + (py - y1) * dy) / l2;
      t = Math.max(0, Math.min(1, t));
      const projX = x1 + t * dx;
      const projY = y1 + t * dy;
      const dist = Math.hypot(px - projX, py - projY);
      return dist <= (slash.width / 2);
    }

    mpTriggerBossBranch(branchType) {
      if (!this.isHost || !this.mpState || this.mpState.mode !== "INFECTION") return;
      const st = this.mpState;
      if (st.bossBranch) return; // Mutually exclusive

      st.bossBranch = branchType;
      st.weaponPickups = []; // Weapon pickups cease when boss arrives

      if (branchType === "INFECTED_BOSS") {
        // GDD: Normalize all players; all players cooperate against Infected Boss
        for (const p of st.players.values()) {
          p.isInfected = false;
          p.infectionState = "NORMAL";
        }
        st.boss = {
          id: "boss_infected",
          type: "INFECTED_BOSS",
          name: "Infected Boss",
          hp: INFECTION_CONFIG.bossHp || 2500,
          maxHp: INFECTION_CONFIG.bossHp || 2500,
          x: SCREEN_WIDTH / 2,
          y: SCREEN_HEIGHT / 2,
          radius: INFECTION_CONFIG.bossRadius || 36,
          speed: INFECTION_CONFIG.bossSpeed || 75,
          isAlive: true,
          slashTimer: 3.5,
          minionTimer: INFECTION_CONFIG.minionSpawnInterval || 10.0,
          jumpTimer: 8.0,
          isJumping: false
        };
        this.showAnnouncement("☣️ INFECTED BOSS RISES!", "ALL PLAYERS CURED — COOPERATE TO DEFEAT THE BOSS!");
        this.sounds?.playWarning?.();

        this._broadcastReliable({
          type: "MP_INFECTION_BRANCH",
          branch: "INFECTED_BOSS",
          boss: {
            id: st.boss.id,
            type: st.boss.type,
            name: st.boss.name,
            hp: st.boss.hp,
            maxHp: st.boss.maxHp,
            radius: st.boss.radius,
            x: st.boss.x,
            y: st.boss.y,
            isAlive: true
          },
          normalized: true
        });
      } else if (branchType === "COSMIC_BOSS") {
        st.boss = {
          id: "boss_cosmic",
          type: "COSMIC_BOSS",
          name: "Cosmic Boss",
          hp: INFECTION_CONFIG.bossHp || 2500,
          maxHp: INFECTION_CONFIG.bossHp || 2500,
          x: SCREEN_WIDTH / 2,
          y: SCREEN_HEIGHT / 2,
          radius: INFECTION_CONFIG.bossRadius || 36,
          speed: INFECTION_CONFIG.bossSpeed || 75,
          isAlive: true,
          sunTimer: 4.0,
          blackHoleTimer: 7.0,
          whiteHoleTimer: 16.0
        };
        this.showAnnouncement("🌌 COSMIC BOSS DESCENDS!", "ANOMALY ENGAGED — COOPERATE TO DEFEAT THE COSMOS!");
        this.sounds?.playWarning?.();

        this._broadcastReliable({
          type: "MP_INFECTION_BRANCH",
          branch: "COSMIC_BOSS",
          boss: {
            id: st.boss.id,
            type: st.boss.type,
            name: st.boss.name,
            hp: st.boss.hp,
            maxHp: st.boss.maxHp,
            radius: st.boss.radius,
            x: st.boss.x,
            y: st.boss.y,
            isAlive: true
          },
          normalized: false
        });
      }
      this.updateHUD();
    }

    handleMPInfectionBranch(msg) {
      if (!this.mpState || this.mpState.mode !== "INFECTION") return;
      this.mpState.bossBranch = msg.branch;
      this.mpState.weaponPickups = [];
      if (msg.normalized) {
        for (const p of this.mpState.players.values()) {
          p.isInfected = false;
          p.infectionState = "NORMAL";
        }
      }
      if (msg.boss) {
        this.mpState.boss = msg.boss;
      }
      if (msg.branch === "INFECTED_BOSS") {
        this.showAnnouncement("☣️ INFECTED BOSS RISES!", "ALL PLAYERS CURED — COOPERATE TO DEFEAT THE BOSS!");
      } else {
        this.showAnnouncement("🌌 COSMIC BOSS DESCENDS!", "ANOMALY ENGAGED — COOPERATE TO DEFEAT THE COSMOS!");
      }
      this.sounds?.playWarning?.();
      this.updateHUD();
    }

    mpUpdateInfection(dt) {
      if (!this.isHost || !this.mpState || this.mpState.mode !== "INFECTION") return;
      const st = this.mpState;

      // Classify living players into infected and normal
      const infectedPlayers = [];
      const normalPlayers = [];
      for (const p of st.players.values()) {
        if (!p.isAlive || p.isSpectator) continue;
        if (p.isInfected) infectedPlayers.push(p);
        else normalPlayers.push(p);
      }

      // Classify active enemies into infected and normal
      const infectedEnemies = [];
      const normalEnemies = [];
      for (const e of st.enemies.values()) {
        if (e.hp <= 0) continue;
        if (e.isInfected) infectedEnemies.push(e);
        else normalEnemies.push(e);
      }

      // ── Infection Spreading (Interactions 1-4) Active before Boss Branch ──
      if (!st.bossBranch) {
        // Interaction 1: Infected mini enemy touches normal mini enemy -> infect normal mini enemy
        for (const infE of infectedEnemies) {
          for (const normE of normalEnemies) {
            if (normE.isInfected) continue;
            const ecx1 = infE.x + infE.size / 2;
            const ecy1 = infE.y + infE.size / 2;
            const ecx2 = normE.x + normE.size / 2;
            const ecy2 = normE.y + normE.size / 2;
            const dist = Math.hypot(ecx1 - ecx2, ecy1 - ecy2);
            if (dist <= (infE.size / 2 + normE.size / 2)) {
              this.mpInfectEntity("ENEMY", normE.id, infE.id);
            }
          }
        }

        // Interaction 2: Infected mini enemy touches normal player -> infect normal player
        for (const infE of infectedEnemies) {
          for (const normP of normalPlayers) {
            if (normP.isInfected) continue;
            const ecx = infE.x + infE.size / 2;
            const ecy = infE.y + infE.size / 2;
            const pcx = normP.x + PLAYER_SIZE / 2;
            const pcy = normP.y + PLAYER_SIZE / 2;
            const dist = Math.hypot(ecx - pcx, ecy - pcy);
            if (dist <= (infE.size / 2 + PLAYER_SIZE / 2)) {
              this.mpInfectEntity("PLAYER", normP.id, infE.id);
            }
          }
        }

        // Interaction 3: Infected player touches normal player -> infect normal player
        for (const infP of infectedPlayers) {
          for (const normP of normalPlayers) {
            if (normP.isInfected) continue;
            const pcx1 = infP.x + PLAYER_SIZE / 2;
            const pcy1 = infP.y + PLAYER_SIZE / 2;
            const pcx2 = normP.x + PLAYER_SIZE / 2;
            const pcy2 = normP.y + PLAYER_SIZE / 2;
            const dist = Math.hypot(pcx1 - pcx2, pcy1 - pcy2);
            if (dist <= PLAYER_SIZE) {
              this.mpInfectEntity("PLAYER", normP.id, infP.id);
            }
          }
        }

        // Interaction 4: Infected player touches normal mini enemy -> infect normal mini enemy
        for (const infP of infectedPlayers) {
          for (const normE of normalEnemies) {
            if (normE.isInfected) continue;
            const pcx = infP.x + PLAYER_SIZE / 2;
            const pcy = infP.y + PLAYER_SIZE / 2;
            const ecx = normE.x + normE.size / 2;
            const ecy = normE.y + normE.size / 2;
            const dist = Math.hypot(pcx - ecx, pcy - ecy);
            if (dist <= (PLAYER_SIZE / 2 + normE.size / 2)) {
              this.mpInfectEntity("ENEMY", normE.id, infP.id);
            }
          }
        }

        // --- Milestone 6B: Weapon Pickup Touch Detection (Host Authoritative) ---
        if (st.weaponPickups && st.weaponPickups.length > 0) {
          const collectedIds = new Set();
          for (const p of st.players.values()) {
            if (!p.isAlive || p.isSpectator || p.infectionWeapon) continue; // 1 weapon per player; no switching
            const pcx = p.x + PLAYER_SIZE / 2;
            const pcy = p.y + PLAYER_SIZE / 2;

            for (const pk of st.weaponPickups) {
              if (collectedIds.has(pk.id)) continue;
              const dist = Math.hypot(pcx - pk.x, pcy - pk.y);
              if (dist <= (PLAYER_SIZE / 2 + (pk.radius || INFECTION_CONFIG.weaponPickupRadius || 18))) {
                collectedIds.add(pk.id);
                this.mpCollectWeaponPickup(p.id, pk.id);
                break; // Player collected one weapon, stop checking other pickups for this player
              }
            }
          }
        }

        // ── Milestone 6C: Check Branch Logic & Transitions (Host Authoritative) ──
        st.infectionTimer = (st.infectionTimer || 0) + dt;
        const livingActivePlayers = Array.from(st.players.values()).filter(p => p.isAlive && !p.isSpectator);
        const aliveNormals = livingActivePlayers.filter(p => !p.isInfected);
        const aliveInfected = livingActivePlayers.filter(p => p.isInfected);

        // Branch 1: If >=1 normal player survives continuously for 60s -> Infected Boss
        if (st.infectionTimer >= (INFECTION_CONFIG.branchSurvivalTime || 60.0) && aliveNormals.length > 0) {
          this.mpTriggerBossBranch("INFECTED_BOSS");
          return;
        }
        // Branch 2: If ALL active players become infected before 60s -> Cosmic Boss
        else if (st.infectionTimer < (INFECTION_CONFIG.branchSurvivalTime || 60.0) && livingActivePlayers.length > 0 && livingActivePlayers.length === aliveInfected.length) {
          this.mpTriggerBossBranch("COSMIC_BOSS");
          return;
        }
      }

      // --- Milestone 6B: Decrement Weapon Cooldown & Update Projectiles (Host) ---
      for (const p of st.players.values()) {
        if (p.infectionWeapon && p.infectionWeapon.cooldown > 0) {
          p.infectionWeapon.cooldown = Math.max(0, p.infectionWeapon.cooldown - dt);
        }
      }

      // --- Milestone 6C: Projectiles Update & Boss Hitbox Collision ---
      for (let i = (st.infectionProjectiles || []).length - 1; i >= 0; i--) {
        const pr = st.infectionProjectiles[i];
        pr.x += pr.vx * dt;
        pr.y += pr.vy * dt;
        pr.life -= dt;

        // Check collision with Boss
        if (st.boss && st.boss.isAlive) {
          const dist = Math.hypot(pr.x - st.boss.x, pr.y - st.boss.y);
          if (dist <= (pr.radius + (st.boss.radius || 36))) {
            st.infectionProjectiles.splice(i, 1);
            this.mpApplyWeaponDamage(st.boss.type, st.boss.id, pr.shooterId, pr.weaponType);
            continue;
          }
        }

        if (pr.life <= 0 || pr.x < -20 || pr.x > SCREEN_WIDTH + 20 || pr.y < -20 || pr.y > SCREEN_HEIGHT + 20) {
          st.infectionProjectiles.splice(i, 1);
        }
      }

      // ── Milestone 6C: Boss AI, Abilities, and Hazards Simulation (Host Authoritative) ──
      if (st.boss && st.boss.isAlive) {
        const alivePlayers = Array.from(st.players.values()).filter(p => p.isAlive && !p.isSpectator);
        let nearestPlayer = null;
        let nearestDist = Infinity;
        for (const p of alivePlayers) {
          const dist = Math.hypot(p.x + PLAYER_SIZE / 2 - st.boss.x, p.y + PLAYER_SIZE / 2 - st.boss.y);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestPlayer = p;
          }
        }

        // Movement towards nearest player
        if (nearestPlayer && !st.boss.isJumping) {
          const dx = (nearestPlayer.x + PLAYER_SIZE / 2) - st.boss.x;
          const dy = (nearestPlayer.y + PLAYER_SIZE / 2) - st.boss.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 15) {
            st.boss.x += (dx / dist) * (st.boss.speed || 75) * dt;
            st.boss.y += (dy / dist) * (st.boss.speed || 75) * dt;
          }
        }
        st.boss.x = Math.max(50, Math.min(SCREEN_WIDTH - 50, st.boss.x));
        st.boss.y = Math.max(50, Math.min(SCREEN_HEIGHT - 50, st.boss.y));

        // ══════════════ INFECTED BOSS ABILITIES ══════════════
        if (st.boss.type === "INFECTED_BOSS") {
          // 1. World Cutting Slash
          for (let sIdx = (st.infectionHazards.slashes || []).length - 1; sIdx >= 0; sIdx--) {
            const sl = st.infectionHazards.slashes[sIdx];
            if (sl.state === "WARNING") {
              sl.timer -= dt;
              if (sl.timer <= 0) {
                sl.state = "SEVERED";
                sl.severanceTimer = INFECTION_CONFIG.slashSeveranceDuration || 8.0;
                // Direct hit deals 50 damage
                for (const [pId, p] of st.players) {
                  if (!p.isAlive || p.isSpectator) continue;
                  const pcx = p.x + PLAYER_SIZE / 2;
                  const pcy = p.y + PLAYER_SIZE / 2;
                  if (this._isPointInSlash(pcx, pcy, sl)) {
                    this.mpApplyDamage(pId, sl.damage || 50, "world_cutting_slash");
                  }
                }
              }
            } else if (sl.state === "SEVERED") {
              sl.severanceTimer -= dt;
              if (sl.severanceTimer <= 0) {
                st.infectionHazards.slashes.splice(sIdx, 1);
                continue;
              }
              // Severed zone hazard
              for (const [pId, p] of st.players) {
                if (!p.isAlive || p.isSpectator) continue;
                const pcx = p.x + PLAYER_SIZE / 2;
                const pcy = p.y + PLAYER_SIZE / 2;
                if (this._isPointInSlash(pcx, pcy, sl)) {
                  this.mpApplyDamage(pId, 15 * dt, "severed_void");
                }
              }
            }
          }

          st.boss.slashTimer = (st.boss.slashTimer || 4.0) - dt;
          if (st.boss.slashTimer <= 0) {
            st.boss.slashTimer = INFECTION_CONFIG.slashInterval || 12.0;
            const targetP = nearestPlayer || { x: SCREEN_WIDTH / 2, y: SCREEN_HEIGHT / 2 };
            const angle = Math.atan2((targetP.y + PLAYER_SIZE / 2) - st.boss.y, (targetP.x + PLAYER_SIZE / 2) - st.boss.x);
            const slashLen = 1200;
            const x1 = st.boss.x - Math.cos(angle) * 400;
            const y1 = st.boss.y - Math.sin(angle) * 400;
            const x2 = st.boss.x + Math.cos(angle) * slashLen;
            const y2 = st.boss.y + Math.sin(angle) * slashLen;
            if (!st.infectionHazards.slashes) st.infectionHazards.slashes = [];
            st.infectionHazards.slashes.push({
              id: "slash_" + Date.now(),
              state: "WARNING",
              timer: INFECTION_CONFIG.slashWarningDuration || 3.0,
              x1, y1, x2, y2,
              width: 48,
              damage: INFECTION_CONFIG.slashDamage || 50
            });
            this.floatingTexts.push(new FloatingText(st.boss.x, st.boss.y - 20, "⚠️ SLASH TELEGRAPH (3s)!", "#ef4444"));
          }

          // 2. Possessed Minions: Spawns 3 possessed infected mini enemies every 10s; replaces previous summoned set
          st.boss.minionTimer = (st.boss.minionTimer || 10.0) - dt;
          if (st.boss.minionTimer <= 0) {
            st.boss.minionTimer = INFECTION_CONFIG.minionSpawnInterval || 10.0;
            // Remove previous summoned set
            for (const [id, e] of st.enemies) {
              if (e.isPossessedMinion) st.enemies.delete(id);
            }
            // Spawn 3 new possessed infected mini enemies
            for (let k = 0; k < 3; k++) {
              const mId = "pos_minion_" + (st.nextEnemyId++);
              const angle = (k * (Math.PI * 2 / 3));
              const mx = Math.max(40, Math.min(SCREEN_WIDTH - 40, st.boss.x + Math.cos(angle) * 65));
              const my = Math.max(40, Math.min(SCREEN_HEIGHT - 40, st.boss.y + Math.sin(angle) * 65));
              st.enemies.set(mId, {
                id: mId,
                type: "MINI",
                isPossessedMinion: true,
                isInfected: true,
                infectionState: "INFECTED",
                hp: INFECTION_CONFIG.minionHp || 80,
                maxHp: INFECTION_CONFIG.minionHp || 80,
                size: 20,
                speed: INFECTION_CONFIG.minionSpeed || 160,
                x: mx,
                y: my,
                vx: 0,
                vy: 0,
                color: "#39ff14"
              });
            }
            this.floatingTexts.push(new FloatingText(st.boss.x, st.boss.y - 20, "☣️ 3 POSSESSED MINIONS SUMMONED!", "#39ff14"));
          }

          // 3. Targeted Jump: 3-second warning telegraph + AoE landing damage
          if (st.infectionHazards.jumpTelegraph) {
            st.infectionHazards.jumpTelegraph.timer -= dt;
            if (st.infectionHazards.jumpTelegraph.timer <= 0) {
              st.boss.x = st.infectionHazards.jumpTelegraph.x;
              st.boss.y = st.infectionHazards.jumpTelegraph.y;
              st.boss.isJumping = false;
              const r = INFECTION_CONFIG.jumpImpactRadius || 85;
              const dmg = INFECTION_CONFIG.jumpDamage || 40;
              for (const [pId, p] of st.players) {
                if (!p.isAlive || p.isSpectator) continue;
                const dist = Math.hypot(p.x + PLAYER_SIZE / 2 - st.boss.x, p.y + PLAYER_SIZE / 2 - st.boss.y);
                if (dist <= r) {
                  this.mpApplyDamage(pId, dmg, "infected_boss_jump");
                }
              }
              st.infectionHazards.jumpTelegraph = null;
              st.boss.jumpTimer = INFECTION_CONFIG.jumpInterval || 15.0;
            }
          } else {
            st.boss.jumpTimer = (st.boss.jumpTimer || 8.0) - dt;
            if (st.boss.jumpTimer <= 0 && nearestPlayer) {
              st.boss.isJumping = true;
              st.infectionHazards.jumpTelegraph = {
                x: nearestPlayer.x + PLAYER_SIZE / 2,
                y: nearestPlayer.y + PLAYER_SIZE / 2,
                radius: INFECTION_CONFIG.jumpImpactRadius || 85,
                timer: INFECTION_CONFIG.jumpWarningDuration || 3.0
              };
              this.floatingTexts.push(new FloatingText(st.boss.x, st.boss.y - 20, "⚠️ TARGETED JUMP (3s)!", "#ffaa00"));
            }
          }
        }

        // ══════════════ COSMIC BOSS ABILITIES ══════════════
        else if (st.boss.type === "COSMIC_BOSS") {
          // 1. Falling Sun & Craters (Instant elimination on contact)
          for (let cIdx = (st.infectionHazards.craters || []).length - 1; cIdx >= 0; cIdx--) {
            const cr = st.infectionHazards.craters[cIdx];
            cr.duration -= dt;
            if (cr.duration <= 0) {
              st.infectionHazards.craters.splice(cIdx, 1);
              continue;
            }
            for (const [pId, p] of st.players) {
              if (!p.isAlive || p.isSpectator) continue;
              const dist = Math.hypot(p.x + PLAYER_SIZE / 2 - cr.x, p.y + PLAYER_SIZE / 2 - cr.y);
              if (dist <= cr.radius) {
                this.mpEliminatePlayer(pId, "falling_sun_crater");
              }
            }
          }

          // Process Falling Sun Projectiles
          for (let pIdx = (st.bossProjectiles || []).length - 1; pIdx >= 0; pIdx--) {
            const bp = st.bossProjectiles[pIdx];
            if (bp.type === "FALLING_SUN") {
              const dx = bp.targetX - bp.x;
              const dy = bp.targetY - bp.y;
              const dist = Math.hypot(dx, dy);
              bp.life -= dt;
              if (dist <= 15 || bp.life <= 0) {
                if (!st.infectionHazards.craters) st.infectionHazards.craters = [];
                st.infectionHazards.craters.push({
                  id: "crater_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
                  x: bp.targetX,
                  y: bp.targetY,
                  radius: INFECTION_CONFIG.craterRadius || 42,
                  duration: INFECTION_CONFIG.craterDuration || 12.0
                });
                st.bossProjectiles.splice(pIdx, 1);
              } else {
                bp.x += (dx / dist) * bp.speed * dt;
                bp.y += (dy / dist) * bp.speed * dt;
              }
            }
          }

          st.boss.sunTimer = (st.boss.sunTimer || 5.0) - dt;
          if (st.boss.sunTimer <= 0) {
            st.boss.sunTimer = INFECTION_CONFIG.sunInterval || 14.0;
            const targetP = nearestPlayer || { x: SCREEN_WIDTH / 2, y: SCREEN_HEIGHT / 2 };
            if (!st.bossProjectiles) st.bossProjectiles = [];
            st.bossProjectiles.push({
              id: "sun_" + (st.nextBossAttackId++),
              type: "FALLING_SUN",
              x: st.boss.x,
              y: st.boss.y,
              targetX: targetP.x + PLAYER_SIZE / 2,
              targetY: targetP.y + PLAYER_SIZE / 2,
              speed: INFECTION_CONFIG.sunSpeed || 280,
              radius: INFECTION_CONFIG.sunRadius || 18,
              life: 3.0
            });
            this.floatingTexts.push(new FloatingText(st.boss.x, st.boss.y - 20, "☀️ FALLING SUN LAUNCHED!", "#ffaa00"));
          }

          // 2. Black Hole (Pull + 15s freeze + safe return)
          for (let bIdx = (st.infectionHazards.blackHoles || []).length - 1; bIdx >= 0; bIdx--) {
            const bh = st.infectionHazards.blackHoles[bIdx];
            bh.duration -= dt;
            if (bh.duration <= 0) {
              st.infectionHazards.blackHoles.splice(bIdx, 1);
              continue;
            }
            for (const [pId, p] of st.players) {
              if (!p.isAlive || p.isSpectator || p.freezeTimer > 0) continue;
              const pcx = p.x + PLAYER_SIZE / 2;
              const pcy = p.y + PLAYER_SIZE / 2;
              const dx = bh.x - pcx;
              const dy = bh.y - pcy;
              const dist = Math.hypot(dx, dy);
              if (dist < bh.radius * 2) {
                const pull = (1 - dist / (bh.radius * 2)) * bh.pullForce;
                if (dist > 2) {
                  p.x += (dx / dist) * pull * dt;
                  p.y += (dy / dist) * pull * dt;
                }
              }
              if (dist < 22) {
                p.freezeTimer = INFECTION_CONFIG.blackHoleFreezeDuration || 15.0;
                p.freezeType = "BLACK_HOLE";
                p.vx = 0;
                p.vy = 0;
                this.floatingTexts.push(new FloatingText(p.x, p.y - 15, "🌀 BLACK HOLE FREEZE (15s)!", "#a855f7"));
              }
            }
          }

          st.boss.blackHoleTimer = (st.boss.blackHoleTimer || 8.0) - dt;
          if (st.boss.blackHoleTimer <= 0) {
            st.boss.blackHoleTimer = INFECTION_CONFIG.blackHoleInterval || 22.0;
            const targetP = nearestPlayer || { x: SCREEN_WIDTH / 2, y: SCREEN_HEIGHT / 2 };
            if (!st.infectionHazards.blackHoles) st.infectionHazards.blackHoles = [];
            st.infectionHazards.blackHoles.push({
              id: "bh_" + Date.now(),
              x: targetP.x + PLAYER_SIZE / 2,
              y: targetP.y + PLAYER_SIZE / 2,
              radius: INFECTION_CONFIG.blackHoleRadius || 70,
              pullForce: INFECTION_CONFIG.blackHolePullForce || 130,
              duration: 9.0
            });
            this.floatingTexts.push(new FloatingText(targetP.x, targetP.y - 20, "🌀 BLACK HOLE OPENED!", "#a855f7"));
          }

          // 3. White Hole (Repel outside map + 15s freeze + safe return)
          for (let wIdx = (st.infectionHazards.whiteHoles || []).length - 1; wIdx >= 0; wIdx--) {
            const wh = st.infectionHazards.whiteHoles[wIdx];
            wh.duration -= dt;
            if (wh.duration <= 0) {
              st.infectionHazards.whiteHoles.splice(wIdx, 1);
              continue;
            }
            for (const [pId, p] of st.players) {
              if (!p.isAlive || p.isSpectator || p.freezeTimer > 0) continue;
              const pcx = p.x + PLAYER_SIZE / 2;
              const pcy = p.y + PLAYER_SIZE / 2;
              const dx = pcx - wh.x;
              const dy = pcy - wh.y;
              const dist = Math.hypot(dx, dy);
              if (dist < wh.radius * 2) {
                const dirX = dist > 0 ? (dx / dist) : 1;
                const dirY = dist > 0 ? (dy / dist) : 0;
                p.x += dirX * wh.repelForce * dt;
                p.y += dirY * wh.repelForce * dt;
                if (p.x < 15 || p.x > SCREEN_WIDTH - PLAYER_SIZE - 15 || p.y < 15 || p.y > SCREEN_HEIGHT - PLAYER_SIZE - 15 || dist < 25) {
                  p.freezeTimer = INFECTION_CONFIG.whiteHoleFreezeDuration || 15.0;
                  p.freezeType = "WHITE_HOLE";
                  p.vx = 0;
                  p.vy = 0;
                  this.floatingTexts.push(new FloatingText(p.x, p.y - 15, "⚪ WHITE HOLE FREEZE (15s)!", "#ffffff"));
                }
              }
            }
          }

          st.boss.whiteHoleTimer = (st.boss.whiteHoleTimer || 18.0) - dt;
          if (st.boss.whiteHoleTimer <= 0) {
            st.boss.whiteHoleTimer = INFECTION_CONFIG.whiteHoleInterval || 28.0;
            if (!st.infectionHazards.whiteHoles) st.infectionHazards.whiteHoles = [];
            st.infectionHazards.whiteHoles.push({
              id: "wh_" + Date.now(),
              x: st.boss.x,
              y: st.boss.y,
              radius: INFECTION_CONFIG.whiteHoleRadius || 75,
              repelForce: INFECTION_CONFIG.whiteHoleRepelForce || 300,
              duration: 7.0
            });
            this.floatingTexts.push(new FloatingText(st.boss.x, st.boss.y - 20, "⚪ WHITE HOLE ACTIVATED!", "#ffffff"));
          }
        }

        // ══════════════ BOSS FIGHT HEART PICKUPS ══════════════
        st.heartTimer = (st.heartTimer || 0) + dt;
        if (st.heartTimer >= (INFECTION_CONFIG.heartSpawnInterval || 8.0)) {
          st.heartTimer = 0;
          if (!st.pickups) st.pickups = [];
          const currentHearts = st.pickups.filter(pk => pk.type === "HEART").length;
          if (currentHearts < (INFECTION_CONFIG.maxHeartsInArena || 4)) {
            st.pickups.push({
              id: "heart_" + (st.nextHeartId++),
              type: "HEART",
              x: 60 + Math.random() * (SCREEN_WIDTH - 120),
              y: 60 + Math.random() * (SCREEN_HEIGHT - 120),
              radius: 14
            });
          }
        }

        // Collect hearts (+10 HP per GDD)
        for (const p of st.players.values()) {
          if (!p.isAlive || p.isSpectator) continue;
          const pcx = p.x + PLAYER_SIZE / 2;
          const pcy = p.y + PLAYER_SIZE / 2;
          for (let hIdx = (st.pickups || []).length - 1; hIdx >= 0; hIdx--) {
            const pk = st.pickups[hIdx];
            if (pk.type !== "HEART") continue;
            const dist = Math.hypot(pcx - pk.x, pcy - pk.y);
            if (dist <= (PLAYER_SIZE / 2 + (pk.radius || 14))) {
              st.pickups.splice(hIdx, 1);
              this.mpApplyHeal(p.id, INFECTION_CONFIG.heartHealAmount || 10);
              this.floatingTexts.push(new FloatingText(p.x, p.y - 15, "+10 HP ❤️", "#22c55e"));
              break;
            }
          }
        }
      }
    }

    // ══════════════════════════════════════════════════════════════
    // MULTIPLAYER INFECTION WEAPON SYSTEM (Milestone 6B)
    // Zombie Killer, Cosmic Bomb, Raybluster, Pickup & Damage Rules
    // ══════════════════════════════════════════════════════════════

    mpCollectWeaponPickup(playerId, pickupId, explicitEventId) {
      if (!this.isHost || !this.mpState || this.mpState.mode !== "INFECTION") return false;
      const player = this.mpState.players.get(playerId);
      if (!player || !player.isAlive || player.isSpectator) return false;

      // GDD Rule: Each player may carry only ONE weapon; no switching after pickup
      if (player.infectionWeapon) return false;

      // Find pickup in authoritative list
      const pkIndex = (this.mpState.weaponPickups || []).findIndex(p => p.id === pickupId);
      if (pkIndex === -1) return false; // Already collected or doesn't exist
      const pk = this.mpState.weaponPickups[pkIndex];

      const wDef = INFECTION_WEAPONS[pk.type];
      if (!wDef) return false;

      const eventId = explicitEventId || `wpk_col_${pickupId}_${playerId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      if (this.mpState.processedEvents.has(eventId)) return false; // Dedup
      this.mpState.processedEvents.add(eventId);

      // Assign weapon to player
      player.infectionWeapon = {
        type: wDef.type,
        name: wDef.name,
        ammo: wDef.ammo,
        maxAmmo: wDef.maxAmmo,
        infectedBossDamage: wDef.infectedBossDamage,
        cosmicBossDamage: wDef.cosmicBossDamage,
        cooldown: 0
      };

      // Remove pickup from arena
      this.mpState.weaponPickups.splice(pkIndex, 1);

      this.floatingTexts.push(new FloatingText(player.x, player.y - 15, `🔫 ${wDef.name}!`, wDef.color));

      // Reliable broadcast to all peers
      this._broadcastReliable({
        type: "MP_WEAPON_PICKUP",
        eventId: eventId,
        playerId: playerId,
        weaponType: pk.type,
        pickupId: pickupId
      });

      return true;
    }

    handleMPWeaponPickup(msg) {
      if (!this.mpState || this.mpState.mode !== "INFECTION") return;
      if (msg.eventId && this.mpState.processedEvents.has(msg.eventId)) return; // Dedup
      if (msg.eventId) this.mpState.processedEvents.add(msg.eventId);

      const p = this.mpState.players.get(msg.playerId);
      const wDef = INFECTION_WEAPONS[msg.weaponType];
      if (p && wDef) {
        p.infectionWeapon = {
          type: wDef.type,
          name: wDef.name,
          ammo: wDef.ammo,
          maxAmmo: wDef.maxAmmo,
          infectedBossDamage: wDef.infectedBossDamage,
          cosmicBossDamage: wDef.cosmicBossDamage,
          cooldown: 0
        };
        this.floatingTexts.push(new FloatingText(p.x, p.y - 15, `🔫 ${wDef.name}!`, wDef.color));
      }
      if (this.mpState.weaponPickups) {
        this.mpState.weaponPickups = this.mpState.weaponPickups.filter(pk => pk.id !== msg.pickupId);
      }
      this.updateHUD();
    }

    mpHandleInfectionShoot(shooterId, weaponType, sx, sy, fx, fy) {
      if (!this.isHost || !this.mpState || this.mpState.mode !== "INFECTION") return false;
      const shooter = this.mpState.players.get(shooterId);
      if (!shooter || !shooter.isAlive || shooter.isSpectator || (shooter.suppressedTimer > 0) || (shooter.freezeTimer > 0)) return false;
      if (!shooter.infectionWeapon || shooter.infectionWeapon.type !== weaponType) return false;
      if (shooter.infectionWeapon.ammo <= 0 && shooter.infectionWeapon.ammo !== Infinity) return false;

      if (shooter.infectionWeapon.ammo !== Infinity) {
        shooter.infectionWeapon.ammo--;
      }

      const originX = sx !== undefined ? sx : (shooter.x + PLAYER_SIZE / 2);
      const originY = sy !== undefined ? sy : (shooter.y + PLAYER_SIZE / 2);
      let dirX = fx !== undefined ? fx : (shooter.facingX || 1);
      let dirY = fy !== undefined ? fy : (shooter.facingY || 0);
      const len = Math.hypot(dirX, dirY);
      if (len > 0.001) { dirX /= len; dirY /= len; } else { dirX = 1; dirY = 0; }

      const wDef = INFECTION_WEAPONS[weaponType];
      const proj = {
        id: "pip_" + (this.mpState.nextInfectionProjId++),
        shooterId: shooterId,
        weaponType: weaponType,
        x: originX,
        y: originY,
        vx: dirX * (INFECTION_CONFIG.projectileSpeed || 650),
        vy: dirY * (INFECTION_CONFIG.projectileSpeed || 650),
        radius: 8,
        life: 2.0,
        color: wDef ? wDef.projectileColor : "#ffffff"
      };
      if (!this.mpState.infectionProjectiles) this.mpState.infectionProjectiles = [];
      this.mpState.infectionProjectiles.push(proj);
      this.sounds?.playGunShot?.();
      return true;
    }

    fireInfectionWeapon() {
      if (this.mode !== "CUSTOM_ROOM" || !this.mpState || this.mpState.mode !== "INFECTION" || this.state !== "PLAYING") return;
      const myId = this.peer ? this.peer.id : (this.isHost ? "host" : "guest");
      const myP = this.mpState.players.get(myId) || (this.isHost ? this.mpState.players.values().next().value : null);
      if (!myP || !myP.isAlive || myP.isSpectator || (myP.suppressedTimer > 0) || (myP.freezeTimer > 0)) return;
      if (!myP.infectionWeapon) return;
      if (myP.infectionWeapon.ammo <= 0 && myP.infectionWeapon.ammo !== Infinity) return;
      if (myP.infectionWeapon.cooldown > 0) return;

      if (myP.infectionWeapon.ammo !== Infinity) {
        myP.infectionWeapon.ammo--;
      }
      myP.infectionWeapon.cooldown = INFECTION_CONFIG.fireCooldown || 0.25;

      const fx = myP.facingX || 1;
      const fy = myP.facingY || 0;
      const px = myP.x + PLAYER_SIZE / 2;
      const py = myP.y + PLAYER_SIZE / 2;

      if (this.isHost) {
        this.mpHandleInfectionShoot(myP.id, myP.infectionWeapon.type, px, py, fx, fy);
      } else {
        this.sounds?.playGunShot?.();
        this._sendToHostReliable({
          type: "MP_INFECTION_SHOOT",
          shooterId: myP.id,
          weaponType: myP.infectionWeapon.type,
          x: px,
          y: py,
          fx: fx,
          fy: fy
        });
      }
      this.updateHUD();
    }

    fireMultiplayerWeapon() {
      if (this.mode !== "CUSTOM_ROOM" || !this.mpState || this.state !== "PLAYING") return;
      if (this.mpState.mode === "ELITE") {
        this.fireEliteFireball();
      } else if (this.mpState.mode === "INFECTION") {
        this.fireInfectionWeapon();
      }
    }

    mpApplyWeaponDamage(targetType, targetId, shooterId, weaponType, explicitEventId) {
      if (!this.isHost || !this.mpState || this.mpState.mode !== "INFECTION") return null;
      const shooter = this.mpState.players.get(shooterId);
      if (!shooter || !shooter.isAlive || shooter.isSpectator || (shooter.suppressedTimer > 0) || (shooter.freezeTimer > 0)) return null;
      if (!shooter.infectionWeapon || shooter.infectionWeapon.type !== weaponType) return null;
      if (shooter.infectionWeapon.ammo <= 0 && shooter.infectionWeapon.ammo !== Infinity) return null;

      const wDef = INFECTION_WEAPONS[weaponType];
      if (!wDef) return null;

      let damage = 0;
      if (targetType === "INFECTED_BOSS") {
        damage = wDef.infectedBossDamage;
      } else if (targetType === "COSMIC_BOSS") {
        damage = wDef.cosmicBossDamage;
      } else {
        return null; // Invalid target per GDD
      }

      const eventId = explicitEventId || `wpk_dmg_${targetId}_${shooterId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      if (this.mpState.processedEvents.has(eventId)) return null; // Dedup
      this.mpState.processedEvents.add(eventId);

      // Decrement target boss HP if boss entity is present
      shooter.damageDealt = (shooter.damageDealt || 0) + damage;
      if (this.mpState.boss && this.mpState.boss.id === targetId) {
        this.mpState.boss.hp = Math.max(0, this.mpState.boss.hp - damage);
        if (this.mpState.boss.hp <= 0 && this.mpState.boss.isAlive) {
          this.mpState.boss.hp = 0;
          this.mpState.boss.isAlive = false;
          this.mpState.status = "VICTORY";
          this.state = "VICTORY";
          this._broadcastReliable({
            type: "MP_MATCH_VICTORY",
            reason: "BOSS_DEFEATED",
            bossType: this.mpState.boss.type,
            title: "👑 ARENA CONQUERED!",
            subtitle: `${this.mpState.boss.name.toUpperCase()} DEFEATED!`
          });
          this.sounds?.playVictory?.();
          this.showAnnouncement("👑 ARENA CONQUERED!", `${this.mpState.boss.name.toUpperCase()} DEFEATED!`);
        }
      }

      this._broadcastReliable({
        type: "MP_WEAPON_DAMAGE",
        eventId: eventId,
        targetType: targetType,
        targetId: targetId,
        shooterId: shooterId,
        weaponType: weaponType,
        damage: damage
      });

      return { damage, eventId };
    }

    handleMPWeaponDamage(msg) {
      if (!this.mpState || this.mpState.mode !== "INFECTION") return;
      if (msg.eventId && this.mpState.processedEvents.has(msg.eventId)) return; // Dedup
      if (msg.eventId) this.mpState.processedEvents.add(msg.eventId);

      if (this.mpState.boss && this.mpState.boss.id === msg.targetId) {
        this.mpState.boss.hp = Math.max(0, this.mpState.boss.hp - (msg.damage || 0));
        if (msg.shooterId) {
          const sh = this.mpState.players.get(msg.shooterId);
          if (sh) sh.damageDealt = (sh.damageDealt || 0) + (msg.damage || 0);
        }
      }
    }

    mpUpdateEnemyAI(dt) {
      if (!this.isHost || !this.mpState) return;

      const alivePlayerCount = Array.from(this.mpState.players.values()).filter(p => p.isAlive && !p.isSpectator).length;
      if (alivePlayerCount === 0) return;

      // ── Decrement Player Status Effects ──
      for (const p of this.mpState.players.values()) {
        if (p.suppressedTimer > 0) p.suppressedTimer = Math.max(0, p.suppressedTimer - dt);
        if (p.freezeTimer > 0) {
          p.freezeTimer = Math.max(0, p.freezeTimer - dt);
          if (p.freezeTimer <= 0 && p.freezeType) {
            p.x = Math.max(60, Math.min(SCREEN_WIDTH - 60 - PLAYER_SIZE, p.x));
            p.y = Math.max(60, Math.min(SCREEN_HEIGHT - 60 - PLAYER_SIZE, p.y));
            p.freezeType = null;
            p.freezeTimer = 0;
            this.floatingTexts.push(new FloatingText(p.x, p.y - 15, "✨ SAFELY RETURNED!", "#38bdf8"));
          }
        }
      }

      // ── Adaptive Difficulty Director ──
      // Scales max active enemies and spawn frequency based on player count (1 to 8)
      // Active player count: 1-2 -> max 4; 3-4 -> max 7; 5-6 -> max 10; 7-8 -> max 14
      const maxEnemies = Math.min(16, 2 + alivePlayerCount * 2);
      const spawnInterval = Math.max(1.8, 4.5 - alivePlayerCount * 0.35);

      this.mpState.directorTimer = (this.mpState.directorTimer || 0) + dt;
      // Milestone 5B: Mini enemy spawning stops permanently at 120 points in Elite Mode
      const haltMiniEnemies = (this.mpState.mode === "ELITE" && (this.mpState.teamScore || 0) >= 120);
      if (!haltMiniEnemies && this.mpState.directorTimer >= spawnInterval && this.mpState.enemies.size < maxEnemies) {
        this.mpState.directorTimer = 0;
        const archetypes = ["CHASER", "FLANKER", "SNIPER", "BOMBER", "DISRUPTOR"];
        const chosen = archetypes[Math.floor(Math.random() * archetypes.length)];
        this.mpSpawnEnemy(chosen);
      }

      // ── Process Projectiles ──
      for (let i = this.mpState.projectiles.length - 1; i >= 0; i--) {
        const pr = this.mpState.projectiles[i];
        pr.x += pr.vx * dt;
        pr.y += pr.vy * dt;
        pr.life -= dt;

        // Collision with alive players (host authoritative)
        let hit = false;
        for (const [pId, p] of this.mpState.players) {
          if (!p.isAlive || p.isSpectator) continue;
          const dist = Math.hypot(p.x + PLAYER_SIZE / 2 - pr.x, p.y + PLAYER_SIZE / 2 - pr.y);
          if (dist < PLAYER_SIZE / 2 + 5) {
            this.mpApplyDamage(pId, pr.damage || 20, "enemy_sniper");
            hit = true;
            break;
          }
        }

        if (hit || pr.life <= 0 || pr.x < 0 || pr.x > SCREEN_WIDTH || pr.y < 0 || pr.y > SCREEN_HEIGHT) {
          this.mpState.projectiles.splice(i, 1);
        }
      }

      // ── Process Mines ──
      for (let i = this.mpState.mines.length - 1; i >= 0; i--) {
        const m = this.mpState.mines[i];
        m.armTimer -= dt;
        if (m.armTimer <= 0) m.armed = true;

        if (m.armed) {
          for (const [pId, p] of this.mpState.players) {
            if (!p.isAlive || p.isSpectator) continue;
            const dist = Math.hypot(p.x + PLAYER_SIZE / 2 - m.x, p.y + PLAYER_SIZE / 2 - m.y);
            if (dist < m.radius + PLAYER_SIZE / 2) {
              // Detonate mine! Deals 20 AoE damage
              this.mpApplyDamage(pId, 20, "enemy_mine");
              this.floatingTexts.push(new FloatingText(m.x, m.y, "💥 MINE BLAST!", "#f97316"));
              this.mpState.mines.splice(i, 1);
              break;
            }
          }
        }
      }

      // ── Finite State Machine for each Enemy ──
      for (const [eId, e] of this.mpState.enemies) {
        e.decisionTimer = (e.decisionTimer || 0) + dt;
        if (e.decisionTimer >= 0.5 || !e.targetId) {
          e.decisionTimer = 0;
          this.mpSelectTarget(e);
        }

        let target = e.targetId ? this.mpState.players.get(e.targetId) : null;
        if (!target || !target.isAlive || target.isSpectator) {
          e.targetId = null;
          this.mpSelectTarget(e);
          target = e.targetId ? this.mpState.players.get(e.targetId) : null;
          if (!target) continue;
        }

        const tcx = target.x + PLAYER_SIZE / 2;
        const tcy = target.y + PLAYER_SIZE / 2;
        const ecx = e.x + e.size / 2;
        const ecy = e.y + e.size / 2;
        const dx = tcx - ecx;
        const dy = tcy - ecy;
        const dist = Math.hypot(dx, dy);

        // 1. CHASER: direct pursuit + contact damage
        if (e.type === "CHASER") {
          if (dist > 0) {
            e.vx = (dx / dist) * e.speed;
            e.vy = (dy / dist) * e.speed;
            e.x += e.vx * dt;
            e.y += e.vy * dt;
          }
          if (dist < e.size / 2 + PLAYER_SIZE / 2) {
            // Contact damage (20 HP)
            this.mpApplyDamage(e.targetId, 20, e.id);
            // Rebound bounce
            e.x -= (dx / (dist || 1)) * 30;
            e.y -= (dy / (dist || 1)) * 30;
          }
        }

        // 2. FLANKER: perimeter orbit -> dive attack
        else if (e.type === "FLANKER") {
          e.stateTimer -= dt;
          if (e.state === "ORBIT") {
            // Circle target at ~200px distance
            const orbitRadius = 180;
            const angle = Math.atan2(dy, dx) + 1.8 * dt;
            const targetOrbitX = tcx - Math.cos(angle) * orbitRadius;
            const targetOrbitY = tcy - Math.sin(angle) * orbitRadius;
            e.vx = (targetOrbitX - ecx) * 2.5;
            e.vy = (targetOrbitY - ecy) * 2.5;
            e.x += e.vx * dt;
            e.y += e.vy * dt;

            if (e.stateTimer <= 0) {
              e.state = "DIVE";
              e.stateTimer = 1.2; // 1.2s rapid dive
            }
          } else if (e.state === "DIVE") {
            if (dist > 0) {
              e.vx = (dx / dist) * (e.speed * 1.5);
              e.vy = (dy / dist) * (e.speed * 1.5);
              e.x += e.vx * dt;
              e.y += e.vy * dt;
            }
            if (dist < e.size / 2 + PLAYER_SIZE / 2) {
              this.mpApplyDamage(e.targetId, 20, e.id);
              e.state = "ORBIT";
              e.stateTimer = 2.5;
            } else if (e.stateTimer <= 0) {
              e.state = "ORBIT";
              e.stateTimer = 2.5;
            }
          }
        }

        // 3. SNIPER: Maintain range -> 1.2s telegraphed charge -> Railgun shot
        else if (e.type === "SNIPER") {
          if (e.state === "REPOSITION") {
            if (dist < 220) {
              // Back off to range
              e.vx = -(dx / (dist || 1)) * e.speed;
              e.vy = -(dy / (dist || 1)) * e.speed;
              e.x += e.vx * dt;
              e.y += e.vy * dt;
            } else if (dist > 380) {
              // Move closer into range
              e.vx = (dx / dist) * e.speed;
              e.vy = (dy / dist) * e.speed;
              e.x += e.vx * dt;
              e.y += e.vy * dt;
            } else {
              e.vx = 0;
              e.vy = 0;
              e.state = "CHARGE";
              e.stateTimer = 1.2; // 1.2s charge beam per Appendix B
            }
          } else if (e.state === "CHARGE") {
            e.stateTimer -= dt;
            e.vx = 0;
            e.vy = 0;
            if (e.stateTimer <= 0) {
              // Fire high-velocity railgun projectile!
              const pSpeed = 550;
              const angle = Math.atan2(dy, dx);
              this.mpState.projectiles.push({
                id: "pr_" + (this.mpState.nextProjId++),
                x: ecx,
                y: ecy,
                vx: Math.cos(angle) * pSpeed,
                vy: Math.sin(angle) * pSpeed,
                damage: 20,
                life: 1.5
              });
              e.state = "REPOSITION";
              e.decisionTimer = 0;
            }
          }
        }

        // 4. BOMBER: Patrol perimeter -> drop stationary proximity mine
        else if (e.type === "BOMBER") {
          e.attackCooldown -= dt;
          // Slowly wander or approach general area
          if (dist > 150) {
            e.vx = (dx / (dist || 1)) * e.speed;
            e.vy = (dy / (dist || 1)) * e.speed;
            e.x += e.vx * dt;
            e.y += e.vy * dt;
          }
          if (e.attackCooldown <= 0) {
            e.attackCooldown = 4.0;
            // Deploy mine
            if (this.mpState.mines.length < 8) {
              this.mpState.mines.push({
                id: "mine_" + (this.mpState.nextMineId++),
                x: ecx,
                y: ecy,
                radius: 36,
                armed: false,
                armTimer: 1.0 // 1s to arm
              });
            }
          }
        }

        // 5. DISRUPTOR: Pull field + slow towards center
        else if (e.type === "DISRUPTOR") {
          // Slowly glide towards center of map
          const midX = SCREEN_WIDTH / 2;
          const midY = SCREEN_HEIGHT / 2;
          const mdx = midX - ecx;
          const mdy = midY - ecy;
          const mdist = Math.hypot(mdx, mdy);
          if (mdist > 30) {
            e.vx = (mdx / mdist) * e.speed * 0.7;
            e.vy = (mdy / mdist) * e.speed * 0.7;
            e.x += e.vx * dt;
            e.y += e.vy * dt;
          }

          // Active gravity pull field + EMP ability suppression on nearby players
          const pullRadius = 160;
          for (const [pId, p] of this.mpState.players) {
            if (!p.isAlive || p.isSpectator) continue;
            const pdx = ecx - (p.x + PLAYER_SIZE / 2);
            const pdy = ecy - (p.y + PLAYER_SIZE / 2);
            const pdist = Math.hypot(pdx, pdy);
            if (pdist < pullRadius && pdist > 10) {
              const pullForce = (1 - pdist / pullRadius) * 60;
              p.x += (pdx / pdist) * pullForce * dt;
              p.y += (pdy / pdist) * pullForce * dt;

              // EMP ability suppression status effect (GDD 6.1)
              // Temporarily suppresses dash/push abilities without locking movement
              p.suppressedTimer = Math.max(p.suppressedTimer || 0, 1.0);
            }
          }
        }

        // Clamp arena bounds
        e.x = Math.max(10, Math.min(SCREEN_WIDTH - e.size - 10, e.x));
        e.y = Math.max(10, Math.min(SCREEN_HEIGHT - e.size - 10, e.y));
      }
    }

    drawMPEnemies(ctx) {
      if (!this.mpState) return;

      // 1. Draw Mines
      if (Array.isArray(this.mpState.mines)) {
        for (const m of this.mpState.mines) {
          ctx.save();
          ctx.fillStyle = m.armed ? "rgba(249, 115, 22, 0.4)" : "rgba(148, 163, 184, 0.3)";
          ctx.strokeStyle = m.armed ? "#f97316" : "#94a3b8";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Core dot
          ctx.fillStyle = m.armed ? "#ff2244" : "#ffffff";
          ctx.beginPath();
          ctx.arc(m.x, m.y, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // 2. Draw Projectiles
      if (Array.isArray(this.mpState.projectiles)) {
        for (const pr of this.mpState.projectiles) {
          ctx.save();
          ctx.fillStyle = "#a855f7";
          ctx.shadowColor = "#a855f7";
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(pr.x, pr.y, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // 3. Draw Enemies
      for (const e of this.mpState.enemies.values()) {
        ctx.save();
        const ecx = e.x + e.size / 2;
        const ecy = e.y + e.size / 2;

        ctx.fillStyle = e.isInfected ? "#39ff14" : (e.color || "#ff2a5f");
        ctx.shadowColor = e.isInfected ? "#39ff14" : (e.color || "#ff2a5f");
        ctx.shadowBlur = e.isInfected ? 14 : 10;

        if (e.isInfected) {
          ctx.strokeStyle = "#39ff14";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(ecx, ecy, e.size / 2 + 4, 0, Math.PI * 2);
          ctx.stroke();
        }

        if (e.type === "CHASER") {
          // Sharp Spiky Diamond
          ctx.beginPath();
          ctx.moveTo(ecx, e.y);
          ctx.lineTo(e.x + e.size, ecy);
          ctx.lineTo(ecx, e.y + e.size);
          ctx.lineTo(e.x, ecy);
          ctx.closePath();
          ctx.fill();
        } else if (e.type === "FLANKER") {
          // Sleek Arrow Triangle
          ctx.beginPath();
          ctx.moveTo(ecx, e.y);
          ctx.lineTo(e.x + e.size, e.y + e.size);
          ctx.lineTo(ecx, e.y + e.size * 0.7);
          ctx.lineTo(e.x, e.y + e.size);
          ctx.closePath();
          ctx.fill();
        } else if (e.type === "SNIPER") {
          // Octagon / Crosshair
          ctx.fillRect(e.x, e.y, e.size, e.size);
          if (e.state === "CHARGE") {
            // Telegraphed targeting laser beam
            ctx.strokeStyle = "rgba(168, 85, 247, 0.7)";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(ecx, ecy);
            ctx.lineTo(ecx + (e.vx || 1) * 300, ecy + (e.vy || 0) * 300);
            ctx.stroke();
          }
        } else if (e.type === "BOMBER") {
          // Heavy Hexagon
          ctx.beginPath();
          ctx.arc(ecx, ecy, e.size / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else if (e.type === "DISRUPTOR") {
          // Pulsing Gravity Orb with ring
          ctx.beginPath();
          ctx.arc(ecx, ecy, e.size / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "rgba(6, 182, 212, 0.5)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(ecx, ecy, e.size / 2 + 8, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.fillRect(e.x, e.y, e.size, e.size);
        }

        ctx.restore();
      }
    }

    drawMPPlayers(ctx) {
      if (!this.mpState) return;

      const myId = this.peer?.id;
      let localIsSpectator = false;

      for (const p of this.mpState.players.values()) {
        const isSelf = myId ? (p.id === myId) : (p.isHost && this.isHost);
        if (isSelf && (!p.isAlive || p.isSpectator)) {
          localIsSpectator = true;
        }

        ctx.save();

        if (!p.isAlive || p.isSpectator) {
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = "#64748b";
          ctx.beginPath();
          ctx.arc(p.x + PLAYER_SIZE / 2, p.y + PLAYER_SIZE / 2, PLAYER_SIZE / 2, 0, Math.PI * 2);
          ctx.fill();

          ctx.font = "12px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("💀", p.x + PLAYER_SIZE / 2, p.y - 6);
          ctx.restore();
          continue;
        }

        const cx = p.x + PLAYER_SIZE / 2;
        const cy = p.y + PLAYER_SIZE / 2;
        ctx.fillStyle = p.color || "#00e5ff";
        ctx.shadowColor = p.color || "#00e5ff";
        ctx.shadowBlur = isSelf ? 14 : 8;

        if (p.shape === "circle") {
          ctx.beginPath();
          ctx.arc(cx, cy, PLAYER_SIZE / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === "triangle") {
          ctx.beginPath();
          ctx.moveTo(cx, p.y);
          ctx.lineTo(p.x + PLAYER_SIZE, p.y + PLAYER_SIZE);
          ctx.lineTo(p.x, p.y + PLAYER_SIZE);
          ctx.closePath();
          ctx.fill();
        } else if (p.shape === "diamond") {
          ctx.beginPath();
          ctx.moveTo(cx, p.y);
          ctx.lineTo(p.x + PLAYER_SIZE, cy);
          ctx.lineTo(cx, p.y + PLAYER_SIZE);
          ctx.lineTo(p.x, cy);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillRect(p.x, p.y, PLAYER_SIZE, PLAYER_SIZE);
        }

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(cx + (p.facingX || 1) * 7, cy + (p.facingY || 0) * 7, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.font = "bold 11px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = isSelf ? "#5eead4" : "#ffffff";
        const displayName = p.name ? (p.name.length > 10 ? p.name.slice(0, 9) + "…" : p.name) : "Player";
        ctx.fillText(displayName, cx, p.y - 12);

        const barW = 32;
        const barH = 4;
        const barX = cx - barW / 2;
        const barY = p.y - 7;
        
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(barX, barY, barW, barH);

        const hpRatio = Math.max(0, Math.min(1, (p.hp || 0) / (p.maxHp || 100)));
        const hpColor = hpRatio > 0.5 ? "#22c55e" : (hpRatio > 0.25 ? "#eab308" : "#ef4444");
        ctx.fillStyle = hpColor;
        ctx.fillRect(barX, barY, barW * hpRatio, barH);

        ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(barX, barY, barW, barH);

        // Visual infection indicator (Milestone 6A)
        if (p.isInfected) {
          ctx.strokeStyle = "#39ff14";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, PLAYER_SIZE / 2 + 3, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = "#39ff14";
          ctx.font = "bold 9px monospace, sans-serif";
          ctx.fillText("☣️ INFECTED", cx, p.y - 18);
        }

        // Visual EMP indicator if suppressed
        if (p.suppressedTimer > 0) {
          ctx.fillStyle = "#06b6d4";
          ctx.font = "9px monospace";
          ctx.fillText("⚡EMP", cx, barY - 3);
        }

        // Visual Freeze indicator if frozen by Black Hole or White Hole
        if (p.freezeTimer > 0) {
          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(cx, cy, PLAYER_SIZE / 2 + 5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = "#38bdf8";
          ctx.font = "bold 9px monospace, sans-serif";
          ctx.fillText(`❄️ FROZEN (${Math.ceil(p.freezeTimer)}s)`, cx, barY - 14);
        }

        ctx.restore();
      }

      const localP = myId ? this.mpState.players.get(myId) : (this.isHost ? this.mpState.players.values().next().value : null);
      if (localP && localP.freezeTimer > 0) {
        ctx.save();
        ctx.fillStyle = "rgba(12, 28, 48, 0.9)";
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 2;
        const fbW = 340, fbH = 46;
        const fbX = (SCREEN_WIDTH - fbW) / 2;
        const fbY = 70;
        ctx.fillRect(fbX, fbY, fbW, fbH);
        ctx.strokeRect(fbX, fbY, fbW, fbH);

        ctx.font = "bold 15px monospace, sans-serif";
        ctx.fillStyle = "#38bdf8";
        ctx.textAlign = "center";
        const sourceLabel = localP.freezeType === "WHITE_HOLE" ? "WHITE HOLE EXPULSION" : "BLACK HOLE SINGULARITY";
        ctx.fillText(`❄️ ${sourceLabel}: ${Math.ceil(localP.freezeTimer)}s`, SCREEN_WIDTH / 2, fbY + 20);
        ctx.font = "11px system-ui, sans-serif";
        ctx.fillStyle = "#bae6fd";
        ctx.fillText("RETURNING SAFELY TO ARENA WHEN TIME EXPIRES", SCREEN_WIDTH / 2, fbY + 38);
        ctx.restore();
      }

      if (localIsSpectator) {
        ctx.save();
        ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 1.5;
        const bW = 280, bH = 32;
        const bX = (SCREEN_WIDTH - bW) / 2;
        const bY = 16;
        ctx.fillRect(bX, bY, bW, bH);
        ctx.strokeRect(bX, bY, bW, bH);

        ctx.font = "bold 13px system-ui, sans-serif";
        ctx.fillStyle = "#fca5a5";
        ctx.textAlign = "center";
        ctx.fillText("💀 SPECTATOR MODE — YOU ARE ELIMINATED", SCREEN_WIDTH / 2, bY + 20);
        ctx.restore();
      }
    }

    broadcastState() {      if (this.mode !== "CUSTOM_ROOM" || !this.isHost || !this.conn || !this.conn.open) return;
      this.conn.send({
        type: "STATE",
        state: this.state,
        level: this.level,
        mapIndex: this.mapIndex,
        p1Score: this.p1Score,
        p2Score: this.p2Score,
        p1Name: this.p1.name,
        p2Name: this.p2.name,
        winner: (this.p1Score >= 30 || (this.state === "MATCH_OVER" && !this.p2.isAlive)) ? "p1" :
                (this.p2Score >= 30 || (this.state === "MATCH_OVER" && !this.p1.isAlive)) ? "p2" : null,
        p1: {
          x: Math.round(this.p1.x),
          y: Math.round(this.p1.y),
          isGiant: this.p1.isGiant,
          size: this.p1.size,
          activeBeam: this.p1.activeBeam,
          isAlive: this.p1.isAlive,
          lives: this.p1.lives,
          emerDodges: this.p1.emerDodges,
          dashCooldown: Math.round(this.p1.dashCooldown * 10) / 10,
          pushCooldown: Math.round(this.p1.pushCooldown * 10) / 10,
          beamCooldown: Math.round(this.p1.beamCooldown * 10) / 10,
          sprintCooldown: Math.round(this.p1.sprintCooldown * 10) / 10,
          invulnerableTimer: Math.round(this.p1.invulnerableTimer * 10) / 10,
          shockwaveVisual: this.p1.shockwaveVisual,
        },
        p2: {
          x: Math.round(this.p2.x),
          y: Math.round(this.p2.y),
          isGiant: this.p2.isGiant,
          size: this.p2.size,
          activeBeam: this.p2.activeBeam,
          isAlive: this.p2.isAlive,
          lives: this.p2.lives,
          emerDodges: this.p2.emerDodges,
          dashCooldown: Math.round(this.p2.dashCooldown * 10) / 10,
          pushCooldown: Math.round(this.p2.pushCooldown * 10) / 10,
          beamCooldown: Math.round(this.p2.beamCooldown * 10) / 10,
          sprintCooldown: Math.round(this.p2.sprintCooldown * 10) / 10,
          invulnerableTimer: Math.round(this.p2.invulnerableTimer * 10) / 10,
          shockwaveVisual: this.p2.shockwaveVisual,
        },
        enemies: this.enemies.map(e => ({ x: Math.round(e.x), y: Math.round(e.y) })),
        items: this.items.map(it => ({ x: Math.round(it.x), y: Math.round(it.y), points: it.points })),
        boss: this.boss ? { x: Math.round(this.boss.x), y: Math.round(this.boss.y), isChargingBurst: this.boss.isChargingBurst, burstVisual: this.boss.burstVisual } : null,
      });
    }

    triggerShockwave(caster) {
      const cx = caster.x + caster.size / 2;
      const cy = caster.y + caster.size / 2;

      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        const ecx = e.x + e.size / 2;
        const ecy = e.y + e.size / 2;
        const dx = ecx - cx;
        const dy = ecy - cy;
        const dist = Math.hypot(dx, dy);

        if (dist < SHOCKWAVE_RADIUS) {
          const force = (1 - dist / SHOCKWAVE_RADIUS) * 450 + 150;
          const nx = dist > 0 ? dx / dist : 1;
          const ny = dist > 0 ? dy / dist : 0;
          e.knockbackVx = nx * force;
          e.knockbackVy = ny * force;
        }
      }

      // Multiplayer 2-8 Player Shockwave
      if (this.mode === "CUSTOM_ROOM" && this.mpState) {
        const myId = this.peer?.id;
        const casterId = this.isHost ? (myId || "host") : (myId || "guest");
        if (this.isHost) {
          this.mpHandlePush(casterId, cx, cy);
        } else {
          this._sendReliableToHost({ type: "MP_PUSH", casterId: casterId, cx: cx, cy: cy });
        }
      }

      const rival = (caster === this.p1) ? this.p2 : this.p1;
      if (this.mode === "CUSTOM_ROOM" && !this.mpState && rival.isAlive) {
        const rcx = rival.x + rival.size / 2;
        const rcy = rival.y + rival.size / 2;
        const dx = rcx - cx;
        const dy = rcy - cy;
        const dist = Math.hypot(dx, dy);

        if (dist < SHOCKWAVE_RADIUS) {
          const force = (1 - dist / SHOCKWAVE_RADIUS) * 500 + 200;
          rival.knockbackVx = (dx / dist) * force;
          rival.knockbackVy = (dy / dist) * force;
          this.floatingTexts.push(new FloatingText(rcx, rcy, "PUSHED!", "#00e5ff"));
        }
      }

      // Damage Boss if inside shockwave radius!
      if (this.boss) {
        const bcx = this.boss.x + this.boss.size / 2;
        const bcy = this.boss.y + this.boss.size / 2;
        const distToBoss = Math.hypot(bcx - cx, bcy - cy);

        if (distToBoss < SHOCKWAVE_RADIUS + this.boss.size / 2) {
          this.damageBoss(20, bcx, bcy);
        }
      }
    }

    // --- Match & Progression ---
    startMatch(mode) {
      this.hasPausedMatch = false;
      document.getElementById("btn-resume-active-match")?.classList.add("hidden");
      this.sounds.stopGameOver();
      this.mode = mode;
      this.state = "PLAYING";
      this.level = 1;
      this.mapIndex = 1;
      this.p1Score = 0;
      this.p2Score = 0;
      this.boss = null;

      // Reset solo progression
      this.soloLevel = 1;
      this.soloMapPhase = 1;
      this.soloBosses = [];
      this.hasAK47 = false;
      this.gunEnabled = false;
      this.ammo = 0;
      this.playerBullets = [];
      this.gunCooldown = 0;
      this.ak47Pickup = null;
      this.bossSpawnedForLevel = false;
      this.soloWaveMode = false;
      this.currentWave = 0;
      this.waveEnemies = [];
      this.waveBosses = [];
      this.minigunUnlimited = false;
      this.soloWon = false;
      this._updateGunButton();

      this.enemies = [];
      this.items = [];
      this.particles = [];
      this.floatingTexts = [];
      this.enemySpawnTimer = 0.0;
      this.itemSpawnTimer = 0.0;
      this.announcement = null;

      this.hideMenu();

      const banner = document.getElementById("match-banner");
      if (banner) {
        if (this.mode === "CUSTOM_ROOM") banner.classList.remove("hidden");
        else banner.classList.add("hidden");
      }

      const activeName = (this.gamerProfile && this.gamerProfile.username) ? this.gamerProfile.username : "Guest";
      if (this.mode === "SOLO") {
        this.p1.name = activeName;
      } else if (this.mode === "CUSTOM_ROOM") {
        if (this.isHost) {
          this.p1.name = activeName;
        } else {
          this.p2.name = activeName;
        }
      }

      this.p1.reset(SCREEN_WIDTH / 2 - 10, SCREEN_HEIGHT / 2 + 100);
      if (this.mode === "CUSTOM_ROOM") {
        this.p1.reset(180, SCREEN_HEIGHT / 2 + 100);
        this.p2.reset(SCREEN_WIDTH - 200, SCREEN_HEIGHT / 2 + 100);
      }

      this.setCautionBanner(false);
      this.updateHUD();
      this.showAnnouncement("MATCH STARTED", `DIFFICULTY: ${this.difficulty.name}`);
      this.updateMaxLevel(this.mode, 1);
    }

    setCautionBanner(show, text = "CAUTION! TITAN BURST CHARGING!") {
      const banner = document.getElementById("caution-banner");
      const txt = document.getElementById("caution-text");
      if (banner) {
        if (show) {
          if (txt) txt.innerText = text;
          banner.classList.remove("hidden");
          this.sounds.playWarning();
        } else {
          banner.classList.add("hidden");
        }
      }
    }

    showAnnouncement(title, subtitle) {
      this.announcement = { title, subtitle, timer: 1.8 };
    }

    updateHUD() {
      // Level & Map Badge
      const lvlBadge = document.getElementById("level-map-badge");
      if (lvlBadge) {
        const theme = MAP_THEMES[this.mapIndex] || MAP_THEMES[1];
        lvlBadge.innerText = `LVL ${this.level} - MAP ${this.mapIndex} (${theme.name})`;
      }

      // Player Lives Hearts
      const myPlayer = (this.mode === "CUSTOM_ROOM" && this.myRole === "p2") ? this.p2 : this.p1;
      const livesBadge = document.getElementById("player-lives-badge");
      if (livesBadge) {
        const fullHearts = "❤️".repeat(Math.max(0, myPlayer.lives));
        const emptyHearts = "🖤".repeat(Math.max(0, 3 - myPlayer.lives));
        livesBadge.innerText = fullHearts + emptyHearts;
      }

      // Multiplayer Scores & Names
      const p1Val = document.getElementById("p1-score-val");
      const p2Val = document.getElementById("p2-score-val");
      const p1Badge = document.getElementById("p1-name-badge");
      const p2Badge = document.getElementById("p2-name-badge");
      if (p1Val) p1Val.innerText = this.p1Score;
      if (p2Val) p2Val.innerText = this.p2Score;
      if (p1Badge) p1Badge.innerText = this.p1.name || "P1";
      if (p2Badge) p2Badge.innerText = this.p2.name || "P2";

      // Cooldown UI overlays
      const dashFill = document.getElementById("dash-cd-fill");
      const pushFill = document.getElementById("push-cd-fill");
      const beamFill = document.getElementById("beam-cd-fill");
      const sprintFill = document.getElementById("sprint-cd-fill");
      const beamBtn = document.getElementById("beam-btn");

      if (dashFill) dashFill.style.transform = `scaleY(${myPlayer.dashCooldown / DASH_COOLDOWN})`;
      if (pushFill) pushFill.style.transform = `scaleY(${myPlayer.pushCooldown / SHOCKWAVE_COOLDOWN})`;
      if (beamFill) beamFill.style.transform = `scaleY(${myPlayer.beamCooldown / BEAM_COOLDOWN})`;
      if (sprintFill) sprintFill.style.transform = `scaleY(${myPlayer.sprintCooldown / SPRINT_COOLDOWN})`;

      // Show Beam button if Giant in Multiplayer
      if (beamBtn) {
        if (this.mode === "CUSTOM_ROOM" && myPlayer.isGiant) beamBtn.classList.remove("hidden");
        else beamBtn.classList.add("hidden");
      }

      // Show gun button in Solo mode, when player has Fireball Gun in Elite mode, or when player has weapon in Infection mode
      const gunBtn = document.getElementById("gun-btn");
      if (gunBtn) {
        let hasMpGun = false;
        if (this.mode === "CUSTOM_ROOM" && this.mpState) {
          const myId = this.peer ? this.peer.id : (this.isHost ? "host" : "guest");
          const myP = this.mpState.players.get(myId) || (this.isHost ? this.mpState.players.values().next().value : null);
          if (this.mpState.mode === "ELITE") {
            hasMpGun = !!(myP?.fireballGun && myP.fireballGun.ammo > 0);
          } else if (this.mpState.mode === "INFECTION") {
            hasMpGun = !!(myP?.infectionWeapon && (myP.infectionWeapon.ammo > 0 || myP.infectionWeapon.ammo === Infinity));
          }
        }
        if (this.mode === "SOLO" || hasMpGun) gunBtn.style.display = "";
        else gunBtn.style.display = "none";
      }

      this.updateDodgeBadge(myPlayer.emerDodges);
    }

    damageBoss(amount, bx, by) {
      if (!this.boss) return;
      this.sounds.playPush();
      this.floatingTexts.push(new FloatingText(bx, by, `-${amount} HP`, "#ff0055"));

      // Blood/Sparks particles
      for (let p = 0; p < 12; p++) {
        this.particles.push(new Particle(bx, by, "#ff2244"));
      }

      const isDead = this.boss.takeDamage(amount);
      if (isDead) {
        this.onBossDefeated();
      }
    }

    onBossDefeated() {
      // Legacy multiplayer boss path only
      if (!this.boss) return;
      const bx = this.boss.x + this.boss.size / 2;
      const by = this.boss.y + this.boss.size / 2;
      if (this.gamerProfile) this.incrementStat("bossesDefeated");
      for (let p = 0; p < 45; p++) this.particles.push(new Particle(bx, by, p % 2 === 0 ? "#ffcc00" : "#ff0044"));
      this.sounds.playVictory();
      this.boss = null;
      this.setCautionBanner(false);
    }

    // --- SOLO: set map phase with announcement ---
    _setSoloMap(phase, title, sub) {
      this.soloMapPhase = phase;
      this.mapIndex = phase; // reuse mapIndex to reference MAP_THEMES 1-9
      if (title) this.showAnnouncement(title, sub || "");
      this.sounds.playVictory();
    }

    // --- SOLO: Advance to next level ---
    _advanceSoloLevel(newLevel) {
      this.soloLevel = newLevel;
      this.level = newLevel;
      this.soloBosses = [];
      this.bossSpawnedForLevel = false;
      this.enemies = [];
      this.setCautionBanner(false);
      this.updateMaxLevel("SOLO", newLevel);
      // Refill lives on level advance
      this.p1.lives = 3;
      this.updateHUD();
      this.floatingTexts.push(new FloatingText(this.p1.x, this.p1.y - 20, "❤️❤️❤️ LIVES REFILLED!", "#00ff88"));
    }

    // --- SOLO: Fire player bullet ---
    firePlayerBullet() {
      if (!this.gunEnabled) return;
      if (this.gunCooldown > 0) return;
      const isL5 = this.soloLevel === 5 && this.minigunUnlimited;
      if (!isL5 && this.ammo <= 0) return;
      if (!isL5) this.ammo--;
      const px = this.p1.x + this.p1.size/2;
      const py = this.p1.y + this.p1.size/2;
      // Shoot in facing direction, fallback to right
      const fx = this.p1.facingX || 1, fy = this.p1.facingY || 0;
      const dist = Math.hypot(fx, fy) || 1;
      this.playerBullets.push({ x: px, y: py, vx: (fx/dist)*350, vy: (fy/dist)*350, dmg: isL5 ? 200 : 100, life: 2.0 });
      this.gunCooldown = isL5 ? 0.08 : 0.15;
      this.sounds.playPew();
      this.updateHUD();
    }

    // --- MULTIPLAYER: Fire Elite Mode Fireball Gun ---
    fireEliteFireball() {
      if (this.mode !== "CUSTOM_ROOM" || !this.mpState || this.state !== "PLAYING") return;
      const myId = this.peer ? this.peer.id : (this.isHost ? "host" : "guest");
      const myP = this.mpState.players.get(myId) || (this.isHost ? this.mpState.players.values().next().value : null);
      if (!myP || !myP.isAlive || myP.isSpectator || (myP.suppressedTimer > 0)) return;
      if (!myP.fireballGun || myP.fireballGun.ammo <= 0 || myP.fireballGun.cooldown > 0) return;

      myP.fireballGun.ammo--;
      myP.fireballGun.cooldown = 0.25;

      const fx = myP.facingX || 1;
      const fy = myP.facingY || 0;
      const px = myP.x + PLAYER_SIZE / 2;
      const py = myP.y + PLAYER_SIZE / 2;

      if (this.isHost) {
        this.mpHandleShoot(myP.id, px, py, fx, fy);
      } else {
        this.sounds?.playGunShot?.();
        this._sendToHostReliable({
          type: "MP_SHOOT",
          shooterId: myP.id,
          x: px,
          y: py,
          fx: fx,
          fy: fy
        });
      }
      this.updateHUD();
    }

    // --- Map Transition & Milestone Checks ---
    checkProgression(score) {
      if (this.mode === "SOLO") {
        this._checkSoloProgression(score);
        return;
      }

      // Multiplayer 25 points Giant Transformation
      if (this.mode === "CUSTOM_ROOM") {
        if (this.p1Score >= 25 || this.p2Score >= 25) {
          this.updateMaxLevel("CUSTOM_ROOM", 2);
        }

        if (this.p1Score >= 25 && !this.p1.isGiant) {
          this.p1.transformToGiant();
          this.showAnnouncement(`${this.p1.name.toUpperCase()} TRANSFORMED!`, "TITAN GIANT UNLOCKED BEAM CANNON (E)!");
          this.sounds.playWarning();
        }
        if (this.p2Score >= 25 && !this.p2.isGiant) {
          this.p2.transformToGiant();
          this.showAnnouncement(`${this.p2.name.toUpperCase()} TRANSFORMED!`, "TITAN GIANT UNLOCKED BEAM CANNON (E)!");
          this.sounds.playWarning();
        }

        // Opponent survives and hits 30 points -> Wins!
        if (this.p1Score >= 30) {
          this.state = "MATCH_OVER";
          this.sounds.playVictory();
          this.broadcastState();
          this.updateMaxLevel("CUSTOM_ROOM", 3);
          // Track stats for host (host = p1)
          if (this.gamerProfile) {
            this.incrementStat("totalMatches");
            this.incrementStat("mpWins"); // host (p1) wins
          }
        } else if (this.p2Score >= 30) {
          this.state = "MATCH_OVER";
          this.sounds.playVictory();
          this.broadcastState();
          this.updateMaxLevel("CUSTOM_ROOM", 3);
          // Track stats for host (host = p1, so they lost)
          if (this.gamerProfile) {
            this.incrementStat("totalMatches");
            this.incrementStat("mpLosses");
          }
        }
      }
    }

    _checkSoloProgression(score) {
      const L = this.soloLevel;
      if (L === 1) {
        if (score >= 50 && this.soloMapPhase === 1) this._setSoloMap(2, "🌋 LAVA FIELDS!", "Enemies getting aggressive!");
        if (score >= 100 && !this.bossSpawnedForLevel && this.soloBosses.length === 0) {
          this.bossSpawnedForLevel = true;
          this._setSoloMap(3, "👾 ASHLEY APPEARS!", "Survive to 125! Orbs give +5 during boss!");
          this.soloBosses.push(new AshleyBoss(2500));
          this.sounds.playWarning();
        }
        if (score >= 125 && this.soloLevel === 1) {
          this._advanceSoloLevel(2);
          this._setSoloMap(4, "🏆 LEVEL 2 UNLOCKED!", "+5pts per orb. Survive to 245!");
        }
      } else if (L === 2) {
        if (score >= 162 && this.soloMapPhase === 4) this._setSoloMap(5, "☄️ AURORA FIELD!", "Two bosses incoming...");
        if (score >= 200 && !this.bossSpawnedForLevel && this.soloBosses.length === 0) {
          this.bossSpawnedForLevel = true;
          this._setSoloMap(5, "⚠️ DUAL BOSS FIGHT!", "Ashley + Gunner! Survive to 245!");
          this.soloBosses.push(new AshleyBoss(2500));
          const g = new MinigunBoss(2500); g.x = SCREEN_WIDTH/2+80; g.y = 90;
          this.soloBosses.push(g);
          this.sounds.playWarning();
        }
        if (score >= 245 && this.soloLevel === 2) {
          this._advanceSoloLevel(3);
          this._setSoloMap(6, "⚡ LEVEL 3 UNLOCKED!", "+3pts per orb. Reach 317 for boss + AK-47!");
        }
      } else if (L === 3) {
        if (score >= 280 && this.soloMapPhase === 6) this._setSoloMap(7, "🌊 DEEP OCEAN!", "Incoming threats...");
        if (score >= 317 && !this.bossSpawnedForLevel && this.soloBosses.length === 0) {
          this.bossSpawnedForLevel = true;
          this._setSoloMap(7, "🔫 AK-47 DROPPED!", "Kill both bosses to advance! Grab the AK-47!");
          this.soloBosses.push(new AshleyBoss(2500));
          const g2 = new MinigunBoss(2500); g2.x = SCREEN_WIDTH-150; g2.y = 90;
          this.soloBosses.push(g2);
          this.ak47Pickup = new AK47Pickup(
            150 + Math.random() * (SCREEN_WIDTH - 300),
            200 + Math.random() * (SCREEN_HEIGHT - 400),
            this.ak47Img
          );
          this.sounds.playWarning();
        }
        if (this.bossSpawnedForLevel && this.soloBosses.length === 0 && this.soloLevel === 3) {
          this._advanceSoloLevel(4);
          this.hasAK47 = false; this.gunEnabled = false; this.ammo = 0; this.ak47Pickup = null;
          this._setSoloMap(8, "🏆 LEVEL 4 UNLOCKED!", "+3pts. Reach 372 for Level 5!");
          this._updateGunButton();
        }
      } else if (L === 4) {
        if (score >= 372 && this.soloLevel === 4) {
          this._advanceSoloLevel(5);
          this._setSoloMap(9, "⚠️ NIGHTMARE ZONE!", "WAVE MODE! Minigun UNLOCKED!");
          this.minigunUnlimited = true; this.gunEnabled = true; this.ammo = 999;
          this.soloWaveMode = true; this.currentWave = 0;
          this.waveEnemies = []; this.waveBosses = [];
          this._startNextWave(); this._updateGunButton();
        }
      }
    }

    _startNextWave() {
      this.currentWave++;
      if (this.currentWave <= 5) {
        const count = this.waveCounts[this.currentWave-1];
        this.waveEnemies = [];
        for (let i = 0; i < count; i++) {
          const side = Math.floor(Math.random()*4);
          let x=0, y=0;
          if (side===0){x=Math.random()*SCREEN_WIDTH;y=-15;}
          else if(side===1){x=Math.random()*SCREEN_WIDTH;y=SCREEN_HEIGHT+15;}
          else if(side===2){x=-15;y=Math.random()*SCREEN_HEIGHT;}
          else{x=SCREEN_WIDTH+15;y=Math.random()*SCREEN_HEIGHT;}
          this.waveEnemies.push(new MiniEnemy(x,y));
        }
        this.showAnnouncement(`⚡ WAVE ${this.currentWave}!`, `${count} enemies! Shoot them all!`);
        this.sounds.playWarning();
      } else {
        this.waveBosses = [];
        for (let i=0;i<5;i++) this.waveBosses.push(new MiniBoss(100+i*140, 80+(i%2)*60));
        this.showAnnouncement("💀 FINAL WAVE: 5 MINI-BOSSES!", "Destroy all to WIN! 200dmg/shot!");
        this.sounds.playWarning();
      }
    }

    _updateGunButton() {
      const btn = document.getElementById("gun-btn");
      if (!btn) return;
      if (this.gunEnabled) { btn.classList.remove("locked"); btn.classList.add("active"); }
      else { btn.classList.remove("active"); btn.classList.add("locked"); }
    }

    _setSoloMap(phase, title, sub) {
      this.soloMapPhase = phase;
      this.mapIndex = phase;
      if (title) this.showAnnouncement(title, sub||"");
      this.sounds.playVictory();
    }

    _advanceSoloLevel(newLevel) {
      this.soloLevel = newLevel;
      this.level = newLevel;
      this.soloBosses = [];
      this.bossSpawnedForLevel = false;
      this.enemies = [];
      this.setCautionBanner(false);
      this.updateMaxLevel("SOLO", newLevel);
      // Refill lives on level advance
      this.p1.lives = 3;
      this.updateHUD();
      this.floatingTexts.push(new FloatingText(this.p1.x, this.p1.y - 20, "❤️❤️❤️ LIVES REFILLED!", "#00ff88"));
    }

    firePlayerBullet() {
      if (!this.gunEnabled) return;
      if (this.gunCooldown > 0) return;
      const isL5 = this.minigunUnlimited;
      if (!isL5 && this.ammo <= 0) return;
      if (!isL5) this.ammo--;
      const px = this.p1.x+this.p1.size/2, py = this.p1.y+this.p1.size/2;
      const fx = this.p1.facingX||1, fy = this.p1.facingY||0;
      const d = Math.hypot(fx,fy)||1;
      this.playerBullets.push({ x:px, y:py, vx:(fx/d)*350, vy:(fy/d)*350, dmg:isL5?200:100, life:2.0 });
      this.gunCooldown = isL5 ? 0.08 : 0.15;
      this.sounds.playPew();
      this.updateHUD();
    }

    spawnMinionSwarm(bx, by) {
      for (let i = 0; i < 3; i++) {
        const offset = (i - 1) * 35;
        const enemy = new Enemy(bx + offset, by + 40, this.difficulty.enemySpeed * 1.15);
        this.enemies.push(enemy);
      }
      this.sounds.playTone(320, "sawtooth", 0.15, 0.2);
    }

    triggerBossBurst(bx, by) {
      this.sounds.playBurst();

      const players = this.mode === "SOLO" ? [this.p1] : [this.p1, this.p2];
      players.forEach(p => {
        if (!p.isAlive) return;
        const dist = Math.hypot((p.x + p.size / 2) - bx, (p.y + p.size / 2) - by);

        if (dist < 260) {
          if (!p.isInvulnerable) {
            this.handlePlayerHit(p, "BOSS_BURST");
          } else {
            this.floatingTexts.push(new FloatingText(p.x, p.y, "BURST EVADED!", "#ffcc00"));
          }
        }
      });
    }

    // --- Physics & Game Loop ---
    update(dt) {
      this.gameTime += dt;
      this.pollKeyboard();

      if (this.announcement) {
        this.announcement.timer -= dt;
        if (this.announcement.timer <= 0) this.announcement = null;
      }

      // ══ MULTIPLAYER 2-8 PLAYERS (Milestone 3) ══
      if (this.mode === "CUSTOM_ROOM" && this.mpState && this.mpState.status === "PLAYING") {
        const myId = this.peer?.id;
        const myP = myId ? this.mpState.players.get(myId) : (this.isHost ? this.mpState.players.values().next().value : null);
        const isSpectator = myP ? (!myP.isAlive || myP.isSpectator) : false;

        if (!this.isHost) {
          if (isSpectator) {
            this.p1Input.x = 0;
            this.p1Input.y = 0;
            this.p1.isSprinting = false;
          } else {
            // Send input to host throttled at ~30Hz
            this.mpInputTimer = (this.mpInputTimer || 0) + dt;
            const inputChanged = Math.abs(this.p1Input.x - (this.lastSentInputX || 0)) > 0.02 ||
                                 Math.abs(this.p1Input.y - (this.lastSentInputY || 0)) > 0.02 ||
                                 this.p1.isSprinting !== this.lastSentSprint;
            if (inputChanged || this.mpInputTimer >= 0.033) {
              this.mpInputTimer = 0;
              this.lastSentInputX = this.p1Input.x;
              this.lastSentInputY = this.p1Input.y;
              this.lastSentSprint = this.p1.isSprinting;
              this.mpInputSeq = (this.mpInputSeq || 0) + 1;
              const inputMsg = {
                type: "MP_INPUT",
                peerId: myId,
                x: this.p1Input.x,
                y: this.p1Input.y,
                sprint: !!this.p1.isSprinting,
                seq: this.mpInputSeq
              };
              for (const [, conn] of this.mpConnections) {
                const ch = (conn.unreliable && conn.unreliable.open) ? conn.unreliable : conn.reliable;
                if (ch && ch.open) {
                  try { ch.send(inputMsg); } catch(e) {}
                }
              }
            }

            // Local prediction for smooth 60fps rendering
            if (myP && (!myP.freezeTimer || myP.freezeTimer <= 0)) {
              let speed = PLAYER_BASE_SPEED;
              if (this.p1.isSprinting) speed *= SPRINT_SPEED_MULT;
              let mx = this.p1Input.x;
              let my = this.p1Input.y;
              const len = Math.hypot(mx, my);
              if (len > 1) { mx /= len; my /= len; }
              myP.vx = mx * speed;
              myP.vy = my * speed;
              myP.x += myP.vx * dt;
              myP.y += myP.vy * dt;
              myP.x = Math.max(0, Math.min(SCREEN_WIDTH - PLAYER_SIZE, myP.x));
              myP.y = Math.max(0, Math.min(SCREEN_HEIGHT - PLAYER_SIZE, myP.y));
              this.p1.x = myP.x;
              this.p1.y = myP.y;
            }

            // Milestone 6B & 6C: Update infection projectiles, freeze & weapon cooldown on guest
            if (this.mpState.mode === "INFECTION") {
              if (myP?.infectionWeapon && myP.infectionWeapon.cooldown > 0) {
                myP.infectionWeapon.cooldown = Math.max(0, myP.infectionWeapon.cooldown - dt);
              }
              for (const p of this.mpState.players.values()) {
                if (p.freezeTimer > 0) {
                  p.freezeTimer = Math.max(0, p.freezeTimer - dt);
                  if (p.freezeTimer <= 0 && p.freezeType) {
                    p.freezeType = null;
                    p.freezeTimer = 0;
                  }
                }
              }
              for (let i = (this.mpState.infectionProjectiles || []).length - 1; i >= 0; i--) {
                const pr = this.mpState.infectionProjectiles[i];
                pr.x += pr.vx * dt;
                pr.y += pr.vy * dt;
                pr.life -= dt;
                if (pr.life <= 0 || pr.x < -20 || pr.x > SCREEN_WIDTH + 20 || pr.y < -20 || pr.y > SCREEN_HEIGHT + 20) {
                  this.mpState.infectionProjectiles.splice(i, 1);
                }
              }
            }
          }

          // Update texts & particles
          for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            this.floatingTexts[i].update(dt);
            if (this.floatingTexts[i].alpha <= 0) this.floatingTexts.splice(i, 1);
          }
          for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(dt);
            if (this.particles[i].alpha <= 0) this.particles.splice(i, 1);
          }
          this.updateHUD();
          return;
        } else {
          // HOST AUTHORITATIVE SIMULATION
          const hostId = this.peer?.id;
          const hostP = hostId ? this.mpState.players.get(hostId) : this.mpState.players.values().next().value;
          if (hostP) {
            if (hostP.isAlive && !hostP.isSpectator) {
              hostP.input.x = this.p1Input.x;
              hostP.input.y = this.p1Input.y;
              hostP.input.sprint = !!this.p1.isSprinting;
            } else {
              hostP.input.x = 0;
              hostP.input.y = 0;
              hostP.input.sprint = false;
            }
          }

          // Simulate all 2-8 players
          for (const p of this.mpState.players.values()) {
            if (!p.isAlive || p.isSpectator || (p.freezeTimer > 0)) {
              p.vx = 0;
              p.vy = 0;
              continue;
            }
            let speed = PLAYER_BASE_SPEED;
            if (p.input && p.input.sprint) speed *= SPRINT_SPEED_MULT;
            let mx = p.input ? p.input.x : 0;
            let my = p.input ? p.input.y : 0;
            const len = Math.hypot(mx, my);
            if (len > 1) { mx /= len; my /= len; }
            p.vx = mx * speed;
            p.vy = my * speed;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.x = Math.max(0, Math.min(SCREEN_WIDTH - PLAYER_SIZE, p.x));
            p.y = Math.max(0, Math.min(SCREEN_HEIGHT - PLAYER_SIZE, p.y));
            if (len > 0.05) {
              p.facingX = mx;
              p.facingY = my;
            }
            if (p === hostP) {
              this.p1.x = p.x;
              this.p1.y = p.y;
            }
          }

          // Update Multiplayer Enemy AI
          this.mpUpdateEnemyAI(dt);

          // Milestone 5A: Update Elite Mode pickups (host only)
          if (this.mpState.mode === "ELITE") {
            this.mpUpdateElite(dt);
          }

          // Milestone 6A: Update Infection Mode propagation (host only)
          if (this.mpState.mode === "INFECTION") {
            this.mpUpdateInfection(dt);
          }

          // Authoritative snapshot broadcast at 25Hz
          this.mpSnapshotTimer = (this.mpSnapshotTimer || 0) + dt;
          if (this.mpSnapshotTimer >= 0.04) {
            this.mpSnapshotTimer = 0;
            this.mpBroadcastSnapshot();
          }

          // Update texts & particles
          for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            this.floatingTexts[i].update(dt);
            if (this.floatingTexts[i].alpha <= 0) this.floatingTexts.splice(i, 1);
          }
          for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(dt);
            if (this.particles[i].alpha <= 0) this.particles.splice(i, 1);
          }
          this.updateHUD();
          return;
        }
      }

      // Guest throttled input send (send immediately if changed, else at ~30Hz)
      if (this.mode === "CUSTOM_ROOM" && !this.isHost && this.conn && this.conn.open) {
        const myInput = (this.myRole === "p2") ? this.p2Input : this.p1Input;
        this.inputSendTimer = (this.inputSendTimer || 0) + dt;
        const inputChanged = Math.abs(myInput.x - (this.lastSentInputX || 0)) > 0.02 ||
                             Math.abs(myInput.y - (this.lastSentInputY || 0)) > 0.02;
        if (inputChanged || this.inputSendTimer >= 0.035) {
          this.inputSendTimer = 0;
          this.lastSentInputX = myInput.x;
          this.lastSentInputY = myInput.y;
          this.conn.send({ type: "INPUT", x: myInput.x, y: myInput.y });
        }
      }

      if (this.mode === "CUSTOM_ROOM" && !this.isHost) {
        // Also check if match reached 30 points locally on guest
        if (this.p1Score >= 30 || this.p2Score >= 30) {
          this.state = "MATCH_OVER";
        }

        // Run guest local simulation:
        // 1. Client prediction for self so movement is instantaneous & responsive
        const myPlayer = (this.myRole === "p2") ? this.p2 : this.p1;
        const myInput = (this.myRole === "p2") ? this.p2Input : this.p1Input;
        myPlayer.update(myInput.x, myInput.y, dt);

        // 2. Decrement cooldowns & timers on rival player locally as well
        const rival = (myPlayer === this.p1) ? this.p2 : this.p1;
        if (rival.dashCooldown > 0) rival.dashCooldown = Math.max(0, rival.dashCooldown - dt);
        if (rival.pushCooldown > 0) rival.pushCooldown = Math.max(0, rival.pushCooldown - dt);
        if (rival.beamCooldown > 0) rival.beamCooldown = Math.max(0, rival.beamCooldown - dt);
        if (rival.sprintCooldown > 0) rival.sprintCooldown = Math.max(0, rival.sprintCooldown - dt);
        if (rival.invulnerableTimer > 0) rival.invulnerableTimer = Math.max(0, rival.invulnerableTimer - dt);

        // 3. Update floating texts & particles so they animate & fade
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
          this.floatingTexts[i].update(dt);
          if (this.floatingTexts[i].alpha <= 0) this.floatingTexts.splice(i, 1);
        }
        for (let i = this.particles.length - 1; i >= 0; i--) {
          this.particles[i].update(dt);
          if (this.particles[i].alpha <= 0) this.particles.splice(i, 1);
        }

        // 4. Update HUD every frame so cooldown overlays animate smoothly at 60 FPS
        this.updateHUD();

        return;
      }

      // Update Texts & Particles
      for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
        this.floatingTexts[i].update(dt);
        if (this.floatingTexts[i].alpha <= 0) this.floatingTexts.splice(i, 1);
      }
      for (let i = this.particles.length - 1; i >= 0; i--) {
        this.particles[i].update(dt);
        if (this.particles[i].alpha <= 0) this.particles.splice(i, 1);
      }

      // Broadcast state to Guest if Host (runs whether playing OR match over!)
      this.stateBroadcastTimer = (this.stateBroadcastTimer || 0) + dt;
      if (this.mode === "CUSTOM_ROOM" && this.isHost && this.conn && this.conn.open) {
        if (this.stateBroadcastTimer >= 0.04) {
          this.stateBroadcastTimer = 0;
          this.broadcastState();
        }
      }

      if (this.state !== "PLAYING") return;

      // Update Players
      this.p1.update(this.p1Input.x, this.p1Input.y, dt);
      if (this.mode === "CUSTOM_ROOM") {
        this.p2.update(this.p2Input.x, this.p2Input.y, dt);
      }

      // Update Boss if present (multiplayer legacy)
      if (this.boss) {
        this.boss.update(
          dt,
          (show) => this.setCautionBanner(show),
          (bx, by) => this.triggerBossBurst(bx, by),
          (bx, by) => this.spawnMinionSwarm(bx, by)
        );
      }

      // === SOLO: Update solo bosses ===
      if (this.mode === "SOLO") {
        const px = this.p1.x + this.p1.size/2, py = this.p1.y + this.p1.size/2;

        // Gun cooldown
        if (this.gunCooldown > 0) this.gunCooldown = Math.max(0, this.gunCooldown - dt);

        // Update AK47 pickup
        if (this.ak47Pickup) {
          this.ak47Pickup.update(dt);
          const pr = this.p1.rect, ar = this.ak47Pickup.rect;
          if (pr.x < ar.x+ar.w && pr.x+pr.w > ar.x && pr.y < ar.y+ar.h && pr.y+pr.h > ar.y) {
            this.hasAK47 = true; this.gunEnabled = true; this.ammo = 80;
            this.ak47Pickup = null;
            this._updateGunButton();
            this.showAnnouncement("🔫 AK-47 ACQUIRED!", "80 Ammo | 100 dmg/shot | Press GUN button!");
            this.sounds.playVictory();
          }
        }

        // Update solo bosses
        for (let i = this.soloBosses.length - 1; i >= 0; i--) {
          const b = this.soloBosses[i];
          if (b instanceof AshleyBoss) {
            b.update(dt, (show) => this.setCautionBanner(show),
              (bx, by) => this.triggerBossBurst(bx, by),
              (bx, by) => this.spawnMinionSwarm(bx, by));
          } else if (b instanceof MinigunBoss) {
            b.update(dt, px, py, () => this.sounds.playPew(),
              (bx, by) => this.spawnMinionSwarm(bx, by));
            // Check minigun bullet→player hits
            for (let j = b.bullets.length - 1; j >= 0; j--) {
              const bl = b.bullets[j];
              const pr = this.p1.rect;
              if (bl.x > pr.x && bl.x < pr.x+pr.w && bl.y > pr.y && bl.y < pr.y+pr.h) {
                b.bullets.splice(j, 1);
                this.handlePlayerHit(this.p1, "BULLET");
                if (!this.p1.isAlive) return;
              }
            }
          }
        }

        // Update player bullets & check solo boss hits
        for (let i = this.playerBullets.length - 1; i >= 0; i--) {
          const bl = this.playerBullets[i];
          bl.x += bl.vx * dt; bl.y += bl.vy * dt; bl.life -= dt;
          if (bl.life <= 0 || bl.x < 0 || bl.x > SCREEN_WIDTH || bl.y < 0 || bl.y > SCREEN_HEIGHT) {
            this.playerBullets.splice(i, 1); continue;
          }
          let hit = false;
          // Hit solo bosses
          for (let j = this.soloBosses.length - 1; j >= 0; j--) {
            const b = this.soloBosses[j];
            if (bl.x > b.x && bl.x < b.x+b.size && bl.y > b.y && bl.y < b.y+b.size) {
              const dead = b.takeDamage(bl.dmg);
              this.floatingTexts.push(new FloatingText(bl.x, bl.y, `-${bl.dmg}`, "#ffcc00"));
              if (dead) {
                for (let p=0;p<30;p++) this.particles.push(new Particle(b.x+b.size/2, b.y+b.size/2, p%2===0?"#ffcc00":"#ff0044"));
                this.soloBosses.splice(j, 1);
                this.sounds.playVictory();
                this.checkProgression(this.p1Score);
              }
              this.playerBullets.splice(i, 1); hit = true; break;
            }
          }
          if (hit) continue;
          // Hit wave bosses (L5)
          for (let j = this.waveBosses.length - 1; j >= 0; j--) {
            const mb = this.waveBosses[j];
            if (bl.x > mb.x && bl.x < mb.x+mb.size && bl.y > mb.y && bl.y < mb.y+mb.size) {
              const dead = mb.takeDamage(bl.dmg);
              this.floatingTexts.push(new FloatingText(bl.x, bl.y, `-${bl.dmg}`, "#ff9900"));
              if (dead) {
                for (let p=0;p<20;p++) this.particles.push(new Particle(mb.x+mb.size/2, mb.y+mb.size/2, "#ffcc00"));
                this.waveBosses.splice(j, 1);
                this.sounds.playVictory();
                if (this.waveBosses.length === 0) this._soloWin();
              }
              this.playerBullets.splice(i, 1); break;
            }
          }
        }

        // Level 5 wave mode update
        if (this.soloWaveMode) {
          // Update wave enemies
          for (let i = this.waveEnemies.length - 1; i >= 0; i--) {
            this.waveEnemies[i].update(this.p1.rect, dt);
            // Player bullet hits wave enemy
          }
          // Check player bullets vs wave enemies
          for (let i = this.playerBullets.length - 1; i >= 0; i--) {
            const bl = this.playerBullets[i];
            for (let j = this.waveEnemies.length - 1; j >= 0; j--) {
              const me = this.waveEnemies[j];
              if (bl.x > me.x && bl.x < me.x+me.size && bl.y > me.y && bl.y < me.y+me.size) {
                this.waveEnemies.splice(j, 1);
                this.playerBullets.splice(i, 1);
                this.floatingTexts.push(new FloatingText(me.x, me.y, "💥", "#ff4400"));
                this.sounds.playTone(440, "square", 0.05, 0.2);
                break;
              }
            }
          }
          // Wave mini-enemies collision with player
          for (let i = this.waveEnemies.length - 1; i >= 0; i--) {
            const me = this.waveEnemies[i];
            const pr = this.p1.rect;
            if (me.x < pr.x+pr.w && me.x+me.size > pr.x && me.y < pr.y+pr.h && me.y+me.size > pr.y) {
              if (!this.p1.isInvulnerable) {
                this.waveEnemies.splice(i, 1);
                this.handlePlayerHit(this.p1, "ENEMY");
                if (!this.p1.isAlive) return;
              }
            }
          }
          // Wave cleared?
          if (this.waveEnemies.length === 0 && this.waveBosses.length === 0 && this.currentWave <= 5) {
            this._startNextWave();
          }
          // Wave mini-boss collision
          for (const mb of this.waveBosses) {
            mb.update(dt, px, py, () => this.sounds.playPew());
            for (let j = mb.bullets.length - 1; j >= 0; j--) {
              const bl = mb.bullets[j];
              const pr = this.p1.rect;
              if (bl.x > pr.x && bl.x < pr.x+pr.w && bl.y > pr.y && bl.y < pr.y+pr.h) {
                mb.bullets.splice(j, 1);
                this.handlePlayerHit(this.p1, "BULLET");
                if (!this.p1.isAlive) return;
              }
            }
          }
          // Skip normal enemy spawning in L5 wave mode
          this.checkCollisions();
          this.updateHUD();
          return;
        }
      }

      // Spawn Enemies (non-wave)
      this.enemySpawnTimer += dt;
      let spInterval = this.difficulty.spawnInterval;
      if (this.mapIndex >= 4) spInterval *= 0.72;
      else if (this.mapIndex >= 2) spInterval *= 0.85;

      const maxEn = this.difficulty.maxEnemies + Math.min(this.mapIndex - 1, 4) * 2;
      if (this.enemySpawnTimer >= spInterval && this.enemies.length < maxEn) {
        this.enemySpawnTimer = 0.0;
        this.spawnEdgeEnemy();
      }

      // Spawn Collectible item
      this.itemSpawnTimer += dt;
      if (this.itemSpawnTimer >= 2.0 && this.items.length === 0) {
        this.itemSpawnTimer = 0.0;
        this.spawnItem();
      }

      // Update Enemies
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        let target = this.p1.rect;
        if (this.mode === "CUSTOM_ROOM") {
          const d1 = Math.hypot(this.p1.x - e.x, this.p1.y - e.y);
          const d2 = Math.hypot(this.p2.x - e.x, this.p2.y - e.y);
          target = (!this.p1.isAlive) ? this.p2.rect : ((!this.p2.isAlive) ? this.p1.rect : (d1 < d2 ? this.p1.rect : this.p2.rect));
        }
        e.update(target, dt);
      }

      this.checkCollisions();
      this.updateHUD();
    }

    spawnEdgeEnemy() {
      const sides = ["top", "bottom", "left", "right"];
      const side = sides[Math.floor(Math.random() * sides.length)];
      let x, y;

      if (side === "top") {
        x = Math.random() * (SCREEN_WIDTH - 16);
        y = -16;
      } else if (side === "bottom") {
        x = Math.random() * (SCREEN_WIDTH - 16);
        y = SCREEN_HEIGHT;
      } else if (side === "left") {
        x = -16;
        y = Math.random() * (SCREEN_HEIGHT - 16);
      } else {
        x = SCREEN_WIDTH;
        y = Math.random() * (SCREEN_HEIGHT - 16);
      }

      let speed = this.difficulty.enemySpeed;
      if (this.mapIndex === 2) speed *= 1.12; // +12% in Magma (balanced)
      else if (this.mapIndex >= 3) speed *= 1.22; // +22% in Void (balanced)

      this.enemies.push(new Enemy(x, y, speed));
    }

    spawnItem() {
      if (this.mode === "SOLO") {
        // Variable points by level/boss state
        let pts = 10;
        if (this.soloLevel === 1) pts = this.soloBosses.length > 0 ? 5 : 10;
        else if (this.soloLevel === 2) pts = 5;
        else if (this.soloLevel >= 3) pts = 3;
        const x = 30 + Math.random() * (SCREEN_WIDTH - 60);
        const y = 30 + Math.random() * (SCREEN_HEIGHT - 60);
        this.items.push(new Collectible(x, y, pts, false));
        return;
      }
      const x = 30 + Math.random() * (SCREEN_WIDTH - 60);
      const y = 30 + Math.random() * (SCREEN_HEIGHT - 60);
      let pts = 10;
      if (this.mapIndex === 2) pts = 15;
      else if (this.mapIndex >= 3) pts = 20;
      const isAttackOrb = Boolean(this.boss);
      this.items.push(new Collectible(x, y, pts, isAttackOrb));
    }

    handlePlayerHit(player, hitSource = "ENEMY") {
      if (player.isInvulnerable) return;

      if (player.hasShield) {
        player.hasShield = false;
        player.invulnerableTimer = 1.5;
        this.floatingTexts.push(new FloatingText(player.x, player.y, "SHIELD BROKE!", "#00e5ff"));
        return;
      }

      player.lives = Math.max(0, player.lives - 1);
      this.updateHUD();

      // Displace & Stun all nearby enemies away from player so they can never sticky-hit!
      const pcx = player.x + player.size / 2;
      const pcy = player.y + player.size / 2;
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        const ecx = e.x + e.size / 2;
        const ecy = e.y + e.size / 2;
        let dx = ecx - pcx;
        let dy = ecy - pcy;
        let dist = Math.hypot(dx, dy);

        if (dist < 260) {
          // If perfectly overlapping or too close, randomize push angle
          if (dist < 15) {
            const angle = Math.random() * Math.PI * 2;
            dx = Math.cos(angle);
            dy = Math.sin(angle);
            dist = 1;
          }
          const nx = dx / dist;
          const ny = dy / dist;

          // Push enemy position directly to a safe radius
          e.x = Math.max(20, Math.min(SCREEN_WIDTH - e.size - 20, pcx + nx * 220));
          e.y = Math.max(20, Math.min(SCREEN_HEIGHT - e.size - 20, pcy + ny * 220));

          // Apply high knockback & stun for 1.8s
          e.knockbackVx = nx * 350;
          e.knockbackVy = ny * 350;
          e.stunTimer = 1.8;
        }
      }

      if (player.lives > 0) {
        // Player still has lives left! Give 3.0s safe iframe and speed buff to escape
        player.invulnerableTimer = 3.0; // 3.0s invulnerability blink
        player.speedBuffTimer = 2.0;   // 2.0s speed boost to safely run away
        this.sounds.playWarning();

        const msg = player.lives === 2 ? "❤️ 2 LIVES LEFT! ESCAPE!" : "⚠️ LAST LIFE! RUN!";
        this.floatingTexts.push(new FloatingText(player.x, player.y - 15, msg, "#ff2244"));

        for (let p = 0; p < 25; p++) {
          this.particles.push(new Particle(pcx, pcy, p % 2 === 0 ? "#ffcc00" : "#ff2244"));
        }
      } else {
        // 3 Lives Lost -> ELIMINATED!
        player.isAlive = false;
        this.sounds.playGameOver();
        this.state = "MATCH_OVER";
        this.hasPausedMatch = false;
        document.getElementById("btn-resume-active-match")?.classList.add("hidden");
        this.floatingTexts.push(new FloatingText(player.x, player.y, "💀 ELIMINATED!", "#ff0000"));
        if (this.mode === "SOLO") {
          this.updateHighScore(this.p1Score);
          this.incrementStat("totalMatches");
        }
        if (this.mode === "CUSTOM_ROOM" && this.isHost) {
          this.broadcastState();
        }
      }
    }

    checkCollisions() {
      const players = this.mode === "SOLO" ? [this.p1] : [this.p1, this.p2];

      players.forEach((player) => {
        if (!player.isAlive) return;
        const pRect = player.rect;

        // 1. Enemy collisions
        for (let i = 0; i < this.enemies.length; i++) {
          const eRect = this.enemies[i].rect;
          if (
            pRect.x < eRect.x + eRect.w &&
            pRect.x + pRect.w > eRect.x &&
            pRect.y < eRect.y + eRect.h &&
            pRect.y + pRect.h > eRect.y
          ) {
            if (player.isInvulnerable) {
              this.enemies[i].knockbackVx = player.facingX * 400;
              this.enemies[i].knockbackVy = player.facingY * 400;
              this.floatingTexts.push(new FloatingText(eRect.x, eRect.y, "EVADED!", "#ffcc00"));
              continue;
            }

            if (player.hasShield) {
              player.hasShield = false;
              this.floatingTexts.push(new FloatingText(player.x, player.y, "SHIELD BROKE!", "#00e5ff"));
              continue;
            }

            this.handlePlayerHit(player, "ENEMY");
            if (!player.isAlive) return;
            continue;
          }
        }

        // 2. Beam collision (Multiplayer)
        const rival = (player === this.p1) ? this.p2 : this.p1;
        if (this.mode === "CUSTOM_ROOM" && rival.activeBeam) {
          const beam = rival.activeBeam;
          // Approximate segment collision with player center
          const pcx = player.x + player.size / 2;
          const pcy = player.y + player.size / 2;
          const distToBeam = this.pointToSegmentDistance(pcx, pcy, beam.x1, beam.y1, beam.x2, beam.y2);

          if (distToBeam < player.size / 2 + 12) {
            if (!player.isInvulnerable) {
              this.handlePlayerHit(player, "BEAM");
              if (!player.isAlive) return;
            } else {
              this.floatingTexts.push(new FloatingText(player.x, player.y, "BEAM DEFLECTED!", "#00e5ff"));
            }
          }
        }

        // 3. Collectibles
        for (let i = this.items.length - 1; i >= 0; i--) {
          const item = this.items[i];
          const iRect = item.rect;
          if (
            pRect.x < iRect.x + iRect.w &&
            pRect.x + pRect.w > iRect.x &&
            pRect.y < iRect.y + iRect.h &&
            pRect.y + pRect.h > iRect.y
          ) {
            if (player === this.p1) this.p1Score += item.points;
            else this.p2Score += item.points;

            this.sounds.playCollect();
            this.floatingTexts.push(new FloatingText(item.x, item.y, `+${item.points}`, "#46dc82"));

            for (let p = 0; p < 10; p++) {
              this.particles.push(new Particle(item.x + 7, item.y + 7, item.isAttackOrb ? "#ffcc00" : "#46dc82"));
            }

            // If Attack Orb collected during Boss fight: fire energy missile at Boss!
            if (item.isAttackOrb && this.boss) {
              const bcx = this.boss.x + this.boss.size / 2;
              const bcy = this.boss.y + this.boss.size / 2;
              this.damageBoss(25, bcx, bcy);
              this.sounds.playDash();
              this.floatingTexts.push(new FloatingText(player.x, player.y, "⚡ ORB BLAST -25 HP!", "#ffcc00"));
            }

            this.items.splice(i, 1);
            const highestScore = Math.max(this.p1Score, this.p2Score);
            this.checkProgression(highestScore);
            // Track solo high score
            if (this.mode === "SOLO") this.updateHighScore(this.p1Score);
          }
        }
      });
    }

    pointToSegmentDistance(px, py, x1, y1, x2, y2) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const l2 = dx * dx + dy * dy;
      if (l2 === 0) return Math.hypot(px - x1, py - y1);
      const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
      return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
    }

    // --- Rendering ---

    // Milestone 5A: Draw Elite Mode score and heart pickups
    _drawElitePickups(ctx, pickups) {
      const t = (this.gameTime || 0);
      for (const pk of pickups) {
        const pulse = 0.85 + 0.15 * Math.sin(t * 4 + pk.id * 1.3);
        ctx.save();
        ctx.translate(pk.x, pk.y);
        ctx.scale(pulse, pulse);
        if (pk.type === "SCORE") {
          // Green glowing orb — score pickup
          ctx.shadowColor = "#00ff88";
          ctx.shadowBlur = 14;
          ctx.fillStyle = "#00ff88";
          ctx.beginPath();
          ctx.arc(0, 0, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = "#003311";
          ctx.font = "bold 7px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("+5", 0, 0);
        } else {
          // Red heart — heal pickup
          ctx.shadowColor = "#ff4466";
          ctx.shadowBlur = 14;
          ctx.fillStyle = "#ff4466";
          ctx.font = "bold 16px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("❤", 0, 0);
          ctx.shadowBlur = 0;
        }
        ctx.restore();
      }
    }

    // Milestone 6B: Draw Infection Mode weapon pickups
    _drawInfectionWeaponPickups(ctx, pickups) {
      const t = (this.gameTime || 0);
      for (const pk of pickups) {
        const pulse = 0.85 + 0.15 * Math.sin(t * 4 + (pk.id ? pk.id.length : 1) * 1.3);
        const wDef = INFECTION_WEAPONS[pk.type] || { color: "#ffffff", name: pk.type };
        ctx.save();
        ctx.translate(pk.x, pk.y);
        ctx.scale(pulse, pulse);
        ctx.shadowColor = wDef.color;
        ctx.shadowBlur = 14;
        ctx.strokeStyle = wDef.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(-12, -12, 24, 24);
        ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
        ctx.fillRect(-12, -12, 24, 24);
        ctx.fillStyle = wDef.color;
        ctx.font = "bold 9px monospace, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const label = pk.type === "ZOMBIE_KILLER" ? "ZK" : (pk.type === "COSMIC_BOMB" ? "CB" : "RB");
        ctx.fillText(label, 0, 0);
        ctx.restore();
      }
    }

    // Milestone 6B: Draw Infection Mode projectiles
    _drawInfectionProjectiles(ctx, projectiles) {
      for (const pr of projectiles) {
        ctx.save();
        ctx.translate(pr.x, pr.y);
        const color = pr.color || "#00ffff";
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, pr.radius || 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Milestone 5B: Draw Elite Mode environmental hazards (smoke bombs, toxic gas, laser wall)
    _drawEliteHazards(ctx, hazards) {
      if (!hazards) return;
      const t = (this.gameTime || 0);

      // 1. Toxic Gas Clouds (green noxious vapor)
      if (Array.isArray(hazards.toxicGas)) {
        for (const tg of hazards.toxicGas) {
          ctx.save();
          const rad = tg.radius || 65;
          const grd = ctx.createRadialGradient(tg.x, tg.y, rad * 0.2, tg.x, tg.y, rad);
          grd.addColorStop(0, "rgba(100, 240, 50, 0.35)");
          grd.addColorStop(0.7, "rgba(80, 200, 30, 0.20)");
          grd.addColorStop(1, "rgba(60, 160, 20, 0)");
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(tg.x, tg.y, rad, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = "rgba(120, 255, 60, 0.35)";
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();
        }
      }

      // 2. Smoke Bombs (fuse warning or active dense gray smoke)
      if (Array.isArray(hazards.smokeBombs)) {
        for (const sb of hazards.smokeBombs) {
          ctx.save();
          const rad = sb.radius || 50;
          if (sb.state === "FUSE") {
            const blink = Math.sin(t * 12) > 0;
            ctx.strokeStyle = blink ? "#ff8800" : "rgba(255, 136, 0, 0.3)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(sb.x, sb.y, rad, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = "#ffaa00";
            ctx.beginPath();
            ctx.arc(sb.x, sb.y, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 9px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(Math.max(0, Math.ceil(sb.fuse || 2)), sb.x, sb.y - 12);
          } else {
            const grd = ctx.createRadialGradient(sb.x, sb.y, rad * 0.1, sb.x, sb.y, rad);
            grd.addColorStop(0, "rgba(140, 140, 150, 0.55)");
            grd.addColorStop(0.6, "rgba(90, 90, 100, 0.35)");
            grd.addColorStop(1, "rgba(50, 50, 60, 0)");
            ctx.fillStyle = grd;
            ctx.beginPath();
            ctx.arc(sb.x, sb.y, rad, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "rgba(160, 160, 170, 0.4)";
            ctx.lineWidth = 1;
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      // 3. Laser Wall (vertical neon crimson barrier)
      if (hazards.laserWall && hazards.laserWall.active) {
        ctx.save();
        const lw = hazards.laserWall;
        const w = lw.width || 16;
        const grd = ctx.createLinearGradient(lw.x - w/2, 0, lw.x + w/2, 0);
        grd.addColorStop(0, "rgba(255, 0, 68, 0.1)");
        grd.addColorStop(0.5, "rgba(255, 0, 68, 0.95)");
        grd.addColorStop(1, "rgba(255, 0, 68, 0.1)");
        ctx.fillStyle = grd;
        ctx.shadowColor = "#ff0044";
        ctx.shadowBlur = 18;
        ctx.fillRect(lw.x - w/2, 0, w, SCREEN_HEIGHT);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(lw.x, 0);
        ctx.lineTo(lw.x, SCREEN_HEIGHT);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Milestone 5C: Draw Demon Boss, boss projectiles, vapors, and player fireballs
    _drawDemonBossAndCombat(ctx) {
      if (!this.mpState) return;

      // 1. Draw Boss Vapors (Pink Burst Vapor & Targeted Green Gas)
      if (Array.isArray(this.mpState.bossVapors)) {
        for (const bv of this.mpState.bossVapors) {
          ctx.save();
          const rad = bv.radius || 60;
          if (bv.type === "PINK_BURST") {
            const grd = ctx.createRadialGradient(bv.x, bv.y, rad * 0.15, bv.x, bv.y, rad);
            grd.addColorStop(0, "rgba(255, 20, 160, 0.45)");
            grd.addColorStop(0.7, "rgba(200, 10, 120, 0.25)");
            grd.addColorStop(1, "rgba(100, 0, 60, 0)");
            ctx.fillStyle = grd;
            ctx.beginPath();
            ctx.arc(bv.x, bv.y, rad, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "rgba(255, 60, 180, 0.5)";
            ctx.lineWidth = 1.5;
            ctx.stroke();
          } else {
            // Targeted Green Gas
            const grd = ctx.createRadialGradient(bv.x, bv.y, rad * 0.15, bv.x, bv.y, rad);
            grd.addColorStop(0, "rgba(20, 240, 80, 0.45)");
            grd.addColorStop(0.7, "rgba(10, 180, 50, 0.25)");
            grd.addColorStop(1, "rgba(5, 100, 20, 0)");
            ctx.fillStyle = grd;
            ctx.beginPath();
            ctx.arc(bv.x, bv.y, rad, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "rgba(40, 255, 100, 0.5)";
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      // 2. Draw Demon Boss
      if (this.mpState.boss && this.mpState.boss.isAlive) {
        const b = this.mpState.boss;
        ctx.save();
        ctx.translate(b.x, b.y);

        // Fiery outer glow
        ctx.shadowColor = "#ff2200";
        ctx.shadowBlur = 24;

        // Demon body
        ctx.fillStyle = "#880015";
        ctx.beginPath();
        ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Inner volcanic core
        ctx.fillStyle = "#ff4400";
        ctx.beginPath();
        ctx.arc(0, 0, b.radius * 0.65, 0, Math.PI * 2);
        ctx.fill();

        // Horns
        ctx.fillStyle = "#ffcc00";
        ctx.beginPath();
        ctx.moveTo(-20, -18); ctx.lineTo(-28, -42); ctx.lineTo(-10, -28); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(20, -18); ctx.lineTo(28, -42); ctx.lineTo(10, -28); ctx.fill();

        // Eyes
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(-11, -5, 4, 0, Math.PI * 2);
        ctx.arc(11, -5, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ff0000";
        ctx.beginPath();
        ctx.arc(-11, -5, 2, 0, Math.PI * 2);
        ctx.arc(11, -5, 2, 0, Math.PI * 2);
        ctx.fill();

        // Overhead health bar
        ctx.restore();
        ctx.save();
        const barW = 90;
        const barH = 7;
        const barX = b.x - barW / 2;
        const barY = b.y - b.radius - 18;
        const hpRatio = Math.max(0, b.hp / (b.maxHp || 2500));

        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
        ctx.fillStyle = "#ff0033";
        ctx.fillRect(barX, barY, barW * hpRatio, barH);
        ctx.strokeStyle = "#ffcc00";
        ctx.lineWidth = 1;
        ctx.strokeRect(barX - 1, barY - 1, barW + 2, barH + 2);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`DEMON BOSS: ${b.hp}/${b.maxHp}`, b.x, barY - 3);
        ctx.restore();
      }

      // 3. Draw Boss Projectiles (Fireballs)
      if (Array.isArray(this.mpState.bossProjectiles)) {
        for (const bp of this.mpState.bossProjectiles) {
          ctx.save();
          ctx.shadowColor = "#ff4400";
          ctx.shadowBlur = 12;
          ctx.fillStyle = "#ff4400";
          ctx.beginPath();
          ctx.arc(bp.x, bp.y, bp.radius || 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#ffcc00";
          ctx.beginPath();
          ctx.arc(bp.x, bp.y, (bp.radius || 9) * 0.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // 4. Draw Player Fireballs
      if (Array.isArray(this.mpState.playerFireballs)) {
        for (const pf of this.mpState.playerFireballs) {
          ctx.save();
          ctx.shadowColor = "#00e5ff";
          ctx.shadowBlur = 10;
          ctx.fillStyle = "#ffdd00";
          ctx.beginPath();
          ctx.arc(pf.x, pf.y, pf.radius || 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(pf.x, pf.y, (pf.radius || 8) * 0.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }

    // Milestone 6C: Draw Infection Mode Bosses (Infected Boss & Cosmic Boss), Abilities & Hazards
    _drawInfectionBossAndCombat(ctx) {
      if (!this.mpState || this.mpState.mode !== "INFECTION") return;

      const hz = this.mpState.infectionHazards;

      // 1. Draw World Cutting Slash hazards
      if (hz && Array.isArray(hz.slashes)) {
        for (const sl of hz.slashes) {
          ctx.save();
          if (sl.state === "WARNING") {
            // 3-second red telegraph line/corridor
            ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
            ctx.lineWidth = sl.width || 48;
            ctx.beginPath();
            ctx.moveTo(sl.x1, sl.y1);
            ctx.lineTo(sl.x2, sl.y2);
            ctx.stroke();

            // Center laser guide
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 8]);
            ctx.beginPath();
            ctx.moveTo(sl.x1, sl.y1);
            ctx.lineTo(sl.x2, sl.y2);
            ctx.stroke();
            ctx.setLineDash([]);

            // Warning text
            const midX = (sl.x1 + sl.x2) / 2;
            const midY = (sl.y1 + sl.y2) / 2;
            ctx.fillStyle = "#ef4444";
            ctx.font = "bold 11px monospace, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(`⚠️ SLASH IN ${Math.max(0, Math.ceil(sl.timer))}s`, midX, midY - 10);
          } else if (sl.state === "SEVERED") {
            // Dimensional severance rift (unavailable map section)
            ctx.strokeStyle = "rgba(168, 85, 247, 0.85)";
            ctx.lineWidth = sl.width || 48;
            ctx.shadowColor = "#a855f7";
            ctx.shadowBlur = 16;
            ctx.beginPath();
            ctx.moveTo(sl.x1, sl.y1);
            ctx.lineTo(sl.x2, sl.y2);
            ctx.stroke();

            // Inner dark void
            ctx.strokeStyle = "rgba(15, 23, 42, 0.95)";
            ctx.lineWidth = (sl.width || 48) - 10;
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.moveTo(sl.x1, sl.y1);
            ctx.lineTo(sl.x2, sl.y2);
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      // 2. Draw Falling Sun Craters (Instant elimination danger)
      if (hz && Array.isArray(hz.craters)) {
        for (const cr of hz.craters) {
          ctx.save();
          // Molten rim
          ctx.shadowColor = "#ff4400";
          ctx.shadowBlur = 14;
          ctx.fillStyle = "#ff4400";
          ctx.beginPath();
          ctx.arc(cr.x, cr.y, cr.radius, 0, Math.PI * 2);
          ctx.fill();

          // Abyssal core
          ctx.fillStyle = "#09090b";
          ctx.beginPath();
          ctx.arc(cr.x, cr.y, cr.radius * 0.75, 0, Math.PI * 2);
          ctx.fill();

          // Skull indicator
          ctx.font = "14px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("💀", cr.x, cr.y + 5);
          ctx.restore();
        }
      }

      // 3. Draw Black Holes
      if (hz && Array.isArray(hz.blackHoles)) {
        for (const bh of hz.blackHoles) {
          ctx.save();
          // Accretion disk
          ctx.shadowColor = "#a855f7";
          ctx.shadowBlur = 20;
          ctx.strokeStyle = "rgba(168, 85, 247, 0.7)";
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.arc(bh.x, bh.y, bh.radius, 0, Math.PI * 2);
          ctx.stroke();

          // Event horizon
          ctx.fillStyle = "#000000";
          ctx.beginPath();
          ctx.arc(bh.x, bh.y, bh.radius * 0.45, 0, Math.PI * 2);
          ctx.fill();

          ctx.font = "bold 9px monospace";
          ctx.fillStyle = "#d8b4fe";
          ctx.textAlign = "center";
          ctx.fillText("BLACK HOLE", bh.x, bh.y - bh.radius - 4);
          ctx.restore();
        }
      }

      // 4. Draw White Holes
      if (hz && Array.isArray(hz.whiteHoles)) {
        for (const wh of hz.whiteHoles) {
          ctx.save();
          ctx.shadowColor = "#38bdf8";
          ctx.shadowBlur = 25;
          ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
          ctx.beginPath();
          ctx.arc(wh.x, wh.y, wh.radius * 0.4, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = "rgba(56, 189, 248, 0.8)";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(wh.x, wh.y, wh.radius, 0, Math.PI * 2);
          ctx.stroke();

          ctx.font = "bold 9px monospace";
          ctx.fillStyle = "#bae6fd";
          ctx.textAlign = "center";
          ctx.fillText("WHITE HOLE", wh.x, wh.y - wh.radius - 4);
          ctx.restore();
        }
      }

      // 5. Draw Targeted Jump Telegraph
      if (hz && hz.jumpTelegraph) {
        const jt = hz.jumpTelegraph;
        ctx.save();
        ctx.strokeStyle = "#ffaa00";
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.arc(jt.x, jt.y, jt.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = "rgba(255, 170, 0, 0.2)";
        ctx.beginPath();
        ctx.arc(jt.x, jt.y, jt.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = "bold 12px monospace";
        ctx.fillStyle = "#ffcc00";
        ctx.textAlign = "center";
        ctx.fillText(`JUMP IMPACT (${Math.ceil(jt.timer)}s)`, jt.x, jt.y - jt.radius - 4);
        ctx.restore();
      }

      // 6. Draw Falling Sun Projectiles
      if (Array.isArray(this.mpState.bossProjectiles)) {
        for (const bp of this.mpState.bossProjectiles) {
          if (bp.type === "FALLING_SUN") {
            ctx.save();
            ctx.shadowColor = "#ffaa00";
            ctx.shadowBlur = 18;
            ctx.fillStyle = "#ffaa00";
            ctx.beginPath();
            ctx.arc(bp.x, bp.y, bp.radius || 18, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(bp.x, bp.y, (bp.radius || 18) * 0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
      }

      // 7. Draw Boss Heart Pickups (+10 HP)
      if (Array.isArray(this.mpState.pickups)) {
        for (const pk of this.mpState.pickups) {
          if (pk.type === "HEART") {
            ctx.save();
            ctx.shadowColor = "#ef4444";
            ctx.shadowBlur = 12;
            ctx.fillStyle = "#ef4444";
            ctx.beginPath();
            ctx.arc(pk.x, pk.y, pk.radius || 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.font = "14px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("❤️", pk.x, pk.y + 5);
            ctx.restore();
          }
        }
      }

      // 8. Draw Boss (Infected Boss or Cosmic Boss)
      const b = this.mpState.boss;
      if (b && b.isAlive) {
        ctx.save();
        ctx.translate(b.x, b.y);

        if (b.type === "INFECTED_BOSS") {
          // Infected Boss: Dark mutated sludge abomination with toxic green veins & red eyes
          ctx.shadowColor = "#39ff14";
          ctx.shadowBlur = 24;
          ctx.fillStyle = "#14532d";
          ctx.beginPath();
          ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#16a34a";
          ctx.beginPath();
          ctx.arc(0, 0, b.radius * 0.7, 0, Math.PI * 2);
          ctx.fill();

          // Spikes/mutation growths
          ctx.fillStyle = "#39ff14";
          for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            ctx.beginPath();
            ctx.arc(Math.cos(angle) * (b.radius - 4), Math.sin(angle) * (b.radius - 4), 6, 0, Math.PI * 2);
            ctx.fill();
          }

          // Multiple glowing red eyes
          ctx.fillStyle = "#ef4444";
          ctx.beginPath();
          ctx.arc(-10, -6, 3.5, 0, Math.PI * 2);
          ctx.arc(10, -6, 3.5, 0, Math.PI * 2);
          ctx.arc(0, 6, 3.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (b.type === "COSMIC_BOSS") {
          // Cosmic Boss: Swirling nebula core with cosmic indigo/purple radiance
          ctx.shadowColor = "#818cf8";
          ctx.shadowBlur = 28;
          ctx.fillStyle = "#1e1b4b";
          ctx.beginPath();
          ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#4338ca";
          ctx.beginPath();
          ctx.arc(0, 0, b.radius * 0.65, 0, Math.PI * 2);
          ctx.fill();

          // Cosmic rings
          ctx.strokeStyle = "rgba(165, 180, 252, 0.75)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(0, 0, b.radius + 12, b.radius * 0.45, Math.PI / 4, 0, Math.PI * 2);
          ctx.stroke();

          // Core starlight
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(0, 0, 7, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();

        // Overhead health bar
        ctx.save();
        const barW = 110;
        const barH = 8;
        const barX = b.x - barW / 2;
        const barY = b.y - b.radius - 20;
        const hpRatio = Math.max(0, b.hp / (b.maxHp || 2500));
        const barColor = b.type === "INFECTED_BOSS" ? "#22c55e" : "#818cf8";

        ctx.fillStyle = "rgba(0,0,0,0.75)";
        ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
        ctx.fillStyle = barColor;
        ctx.fillRect(barX, barY, barW * hpRatio, barH);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.strokeRect(barX - 1, barY - 1, barW + 2, barH + 2);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`${b.name.toUpperCase()}: ${b.hp}/${b.maxHp}`, b.x, barY - 4);
        ctx.restore();
      }
    }

    draw() {
      const ctx = this.ctx;

      // Milestone 5A & 6A: Use dedicated map themes for MP matches
      const isEliteMP = (this.mode === "CUSTOM_ROOM" && this.mpState && this.mpState.mode === "ELITE");
      const isInfectionMP = (this.mode === "CUSTOM_ROOM" && this.mpState && this.mpState.mode === "INFECTION");
      const theme = isEliteMP
        ? (MAP_THEMES["ELITE"] || MAP_THEMES[1])
        : (isInfectionMP
          ? (MAP_THEMES["INFECTION"] || MAP_THEMES[1])
          : (MAP_THEMES[this.mapIndex] || MAP_THEMES[1]));

      // Dynamic Map Background
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

      // Draw themed map decoration (no grid)
      if (theme.draw) theme.draw(ctx);

      // Draw Collectibles (Solo only — MP uses mode-specific pickups)
      if (!isEliteMP && !isInfectionMP) {
        for (let i = 0; i < this.items.length; i++) {
          this.items[i].draw(ctx, this.gameTime, IS_MOBILE);
        }
      }

      // Milestone 5A: Draw Elite Mode pickups from mpState (host-authoritative array)
      if (isEliteMP && this.mpState && Array.isArray(this.mpState.pickups)) {
        this._drawElitePickups(ctx, this.mpState.pickups);
      }

      // Milestone 5B: Draw Elite Mode hazards (smoke bombs, toxic gas, laser wall)
      if (isEliteMP && this.mpState && this.mpState.hazards) {
        this._drawEliteHazards(ctx, this.mpState.hazards);
      }

      // Milestone 5C: Draw Demon Boss, combat projectiles, vapors, and player fireballs
      if (isEliteMP && this.mpState) {
        this._drawDemonBossAndCombat(ctx);
      }

      // Milestone 6B & 6C: Draw Infection Mode weapon pickups, projectiles, bosses & hazards
      if (isInfectionMP && this.mpState) {
        if (Array.isArray(this.mpState.weaponPickups)) {
          this._drawInfectionWeaponPickups(ctx, this.mpState.weaponPickups);
        }
        if (Array.isArray(this.mpState.infectionProjectiles)) {
          this._drawInfectionProjectiles(ctx, this.mpState.infectionProjectiles);
        }
        this._drawInfectionBossAndCombat(ctx);
      }

      // Draw Enemies (normal)
      for (let i = 0; i < this.enemies.length; i++) {
        this.enemies[i].draw(ctx, theme, IS_MOBILE);
      }

      // Draw Boss (multiplayer legacy)
      if (this.boss) {
        this.boss.draw(ctx);
      }

      // Draw Solo bosses
      if (this.mode === "SOLO") {
        for (const b of this.soloBosses) b.draw(ctx);
        // AK47 pickup
        if (this.ak47Pickup) this.ak47Pickup.draw(ctx);
        // Player bullets (custom realistic ammo sprite)
        for (const bl of this.playerBullets) {
          ctx.save();
          ctx.translate(bl.x, bl.y);
          const angle = Math.atan2(bl.vy, bl.vx);
          ctx.rotate(angle);
          if (this.bulletImg && this.bulletImg.complete && this.bulletImg.naturalWidth > 0) {
            ctx.shadowColor = "#ffcc00";
            ctx.shadowBlur = 6;
            ctx.drawImage(this.bulletImg, -13, -2.5, 26, 5);
          } else {
            ctx.fillStyle = "#ffcc00";
            ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
          }
          ctx.restore();
        }
        // Wave mode enemies & bosses
        if (this.soloWaveMode) {
          for (const me of this.waveEnemies) me.draw(ctx);
          for (const mb of this.waveBosses) mb.draw(ctx);
          // Wave HUD
          ctx.save();
          ctx.textAlign = "center";
          ctx.fillStyle = "#ff4400";
          ctx.font = "bold 16px monospace";
          const waveLabel = this.currentWave <= 5
            ? `WAVE ${this.currentWave}/5 — Enemies: ${this.waveEnemies.length}`
            : `FINAL BOSSES: ${this.waveBosses.length} left`;
          ctx.fillText(waveLabel, SCREEN_WIDTH/2, 20);
          ctx.restore();
        }
      }

      // Draw Players & MP Enemies
      if (this.mode === "CUSTOM_ROOM" && this.mpState && this.mpState.status === "PLAYING") {
        this.drawMPEnemies(ctx);
        this.drawMPPlayers(ctx);
      } else {
        this.p1.draw(ctx);
        if (this.mode === "CUSTOM_ROOM") this.p2.draw(ctx);
      }

      // Draw Particles & Texts
      for (let i = 0; i < this.particles.length; i++) this.particles[i].draw(ctx);
      for (let i = 0; i < this.floatingTexts.length; i++) this.floatingTexts[i].draw(ctx);

      // Milestone 5A, 5B, 5C: Elite Mode HUD (top-center)
      if (isEliteMP && this.mpState && (this.mpState.status === "PLAYING" || this.mpState.status === "VICTORY")) {
        ctx.save();
        const hasBoss = (this.mpState.boss && this.mpState.boss.isAlive);
        const myId = this.peer ? this.peer.id : (this.isHost ? "host" : "guest");
        const myP = this.mpState.players.get(myId) || (this.isHost ? this.mpState.players.values().next().value : null);
        const hasGun = myP?.fireballGun;

        const hudW = hasBoss ? 230 : 200;
        const hudH = (hasBoss && hasGun) ? 52 : (hasBoss ? 38 : 36);
        const hudX = (SCREEN_WIDTH - hudW) / 2;
        const hudY = 8;

        ctx.fillStyle = "rgba(10,2,5,0.85)";
        ctx.strokeStyle = hasBoss ? "#ff0033" : "#ff6600";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(hudX, hudY, hudW, hudH, 7);
        } else {
          ctx.rect(hudX, hudY, hudW, hudH);
        }
        ctx.fill();
        ctx.stroke();
        ctx.textAlign = "center";

        if (hasBoss) {
          ctx.fillStyle = "#ff3344";
          ctx.font = "bold 11px monospace, sans-serif";
          ctx.fillText("🔥 DEMON BOSS CONQUEST", SCREEN_WIDTH / 2, hudY + 13);
          ctx.fillStyle = "#ffcc00";
          ctx.font = "bold 13px monospace, sans-serif";
          ctx.fillText(`BOSS HP: ${this.mpState.boss.hp} / 2500`, SCREEN_WIDTH / 2, hudY + 28);
          if (hasGun) {
            ctx.fillStyle = myP.fireballGun.ammo > 20 ? "#00ffea" : "#ff4444";
            ctx.font = "bold 11px monospace, sans-serif";
            ctx.fillText(`🔫 FIREBALL AMMO: ${myP.fireballGun.ammo}/100`, SCREEN_WIDTH / 2, hudY + 44);
          }
        } else {
          ctx.fillStyle = "#ff9900";
          ctx.font = "bold 11px monospace, sans-serif";
          ctx.fillText("🔥 OBSIDIAN CRUCIBLE", SCREEN_WIDTH / 2, hudY + 13);
          ctx.fillStyle = "#00ff88";
          ctx.font = "bold 14px monospace, sans-serif";
          ctx.fillText(`TEAM SCORE: ${this.mpState.teamScore}`, SCREEN_WIDTH / 2, hudY + 29);
        }
        ctx.restore();
      }

      // Milestone 6A, 6B & 6C: Infection Mode HUD (top-center)
      if (isInfectionMP && this.mpState && (this.mpState.status === "PLAYING" || this.mpState.status === "VICTORY")) {
        ctx.save();
        const hasBoss = (this.mpState.boss && this.mpState.boss.isAlive);
        const myId = this.peer ? this.peer.id : (this.isHost ? "host" : "guest");
        const myP = this.mpState.players.get(myId) || (this.isHost ? this.mpState.players.values().next().value : null);
        const hasWeapon = myP?.infectionWeapon;

        let survivorCount = 0;
        let infectedCount = 0;
        for (const p of this.mpState.players.values()) {
          if (!p.isAlive || p.isSpectator) continue;
          if (p.isInfected) infectedCount++;
          else survivorCount++;
        }

        const hudW = hasBoss ? 260 : 240;
        const hudH = (hasBoss && hasWeapon) ? 52 : (hasBoss ? 38 : (hasWeapon ? 48 : 34));
        const hudX = (SCREEN_WIDTH - hudW) / 2;
        const hudY = 8;
        ctx.fillStyle = "rgba(4,13,8,0.88)";
        ctx.strokeStyle = hasBoss ? (this.mpState.boss.type === "INFECTED_BOSS" ? "#22c55e" : "#818cf8") : "#00ff66";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(hudX, hudY, hudW, hudH, 6);
        } else {
          ctx.rect(hudX, hudY, hudW, hudH);
        }
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = "center";
        if (hasBoss) {
          const bossColor = this.mpState.boss.type === "INFECTED_BOSS" ? "#22c55e" : "#818cf8";
          ctx.fillStyle = bossColor;
          ctx.font = "bold 11px monospace, sans-serif";
          ctx.fillText(`⚡ ${this.mpState.boss.name.toUpperCase()} CONFRONTATION`, SCREEN_WIDTH / 2, hudY + 13);
          ctx.fillStyle = "#ffcc00";
          ctx.font = "bold 13px monospace, sans-serif";
          ctx.fillText(`BOSS HP: ${this.mpState.boss.hp} / 2500`, SCREEN_WIDTH / 2, hudY + 28);
          if (hasWeapon) {
            const ammoStr = myP.infectionWeapon.ammo === Infinity ? "∞" : `${myP.infectionWeapon.ammo}/150`;
            ctx.fillStyle = myP.infectionWeapon.ammo === Infinity ? "#ffff00" : (myP.infectionWeapon.ammo > 30 ? "#00ffea" : "#ff4444");
            ctx.font = "bold 10px monospace, sans-serif";
            ctx.fillText(`🔫 ${myP.infectionWeapon.name.toUpperCase()}: ${ammoStr}`, SCREEN_WIDTH / 2, hudY + 44);
          }
        } else {
          ctx.font = "bold 11px system-ui, monospace";
          ctx.fillStyle = "#00ff66";
          ctx.fillText(`☣️ SURVIVORS: ${survivorCount}  |  INFECTED: ${infectedCount}`, SCREEN_WIDTH / 2, hudY + 18);

          if (hasWeapon) {
            const ammoStr = myP.infectionWeapon.ammo === Infinity ? "∞" : `${myP.infectionWeapon.ammo}/150`;
            ctx.fillStyle = myP.infectionWeapon.ammo === Infinity ? "#ffff00" : (myP.infectionWeapon.ammo > 30 ? "#00ffea" : "#ff4444");
            ctx.font = "bold 10px monospace, sans-serif";
            ctx.fillText(`🔫 ${myP.infectionWeapon.name.toUpperCase()}: ${ammoStr}`, SCREEN_WIDTH / 2, hudY + 36);
          }
        }
        ctx.restore();
      }

      // Solo HUD (Compact sleek badge chart top-left)
      if (this.mode === "SOLO") {
        ctx.save();
        const cardX = 14;
        const cardY = 56;
        const cardW = this.gunEnabled ? 148 : 130;
        const cardH = this.gunEnabled ? 56 : 38;
        const r = 8;

        // Semi-transparent backdrop with subtle border so game visual is never blocked
        ctx.fillStyle = "rgba(7, 18, 26, 0.7)";
        ctx.strokeStyle = "rgba(94, 234, 212, 0.28)";
        ctx.lineWidth = 1;

        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(cardX, cardY, cardW, cardH, r);
        } else {
          ctx.rect(cardX, cardY, cardW, cardH);
        }
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = "left";

        // Player Score
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px monospace, sans-serif";
        ctx.fillText(`SCORE: ${this.p1Score}`, cardX + 10, cardY + 16);

        // Dodges Left
        ctx.fillStyle = this.p1.emerDodges > 0 ? "#c084fc" : "#64748b";
        ctx.font = "11px monospace, sans-serif";
        ctx.fillText(`⚡ DODGES: ${this.p1.emerDodges}/3`, cardX + 10, cardY + 30);

        // Ammo HUD (only when gun is unlocked)
        if (this.gunEnabled) {
          ctx.fillStyle = this.ammo > 20 ? "#ffcc00" : "#ff4400";
          ctx.font = "bold 11px monospace, sans-serif";
          const ammoText = this.minigunUnlimited ? "MINIGUN ∞" : `AMMO: ${this.ammo}/80`;
          if (this.bulletImg && this.bulletImg.complete && this.bulletImg.naturalWidth > 0) {
            ctx.drawImage(this.bulletImg, cardX + 10, cardY + 38, 18, 4);
            ctx.fillText(ammoText, cardX + 34, cardY + 44);
          } else {
            ctx.fillText(`🔫 ${ammoText}`, cardX + 10, cardY + 44);
          }
        }
        ctx.restore();
      }

      // Announcement Banner
      if (this.announcement) {
        ctx.save();
        ctx.fillStyle = "rgba(10, 10, 30, 0.85)";
        ctx.strokeStyle = "#ffcc00";
        ctx.lineWidth = 2;
        ctx.strokeRect(SCREEN_WIDTH / 2 - 220, 180, 440, 80);
        ctx.fillRect(SCREEN_WIDTH / 2 - 220, 180, 440, 80);

        ctx.textAlign = "center";
        ctx.fillStyle = "#ffcc00";
        ctx.font = "bold 24px monospace, sans-serif";
        ctx.fillText(this.announcement.title, SCREEN_WIDTH / 2, 215);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 14px system-ui, sans-serif";
        ctx.fillText(this.announcement.subtitle, SCREEN_WIDTH / 2, 242);
        ctx.restore();
      }

      // Match Over Screen
      if (this.state === "MATCH_OVER" || this.state === "VICTORY") {
        this.drawMatchOverScreen();
      }
    }

    _soloWin() {
      this.soloWon = true;
      this.state = "VICTORY";
      this.sounds.playVictory();
      if (this.gamerProfile) { this.incrementStat("totalMatches"); this.updateHighScore(this.p1Score); }
    }

    drawMatchOverScreen() {
      const ctx = this.ctx;
      ctx.save();
      ctx.fillStyle = "rgba(6, 6, 18, 0.9)";
      ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

      ctx.textAlign = "center";

      if (this.state === "VICTORY" && this.mode === "SOLO" && this.soloWon) {
        // Solo win screen
        ctx.fillStyle = "#ffcc00";
        ctx.font = "bold 52px monospace, sans-serif";
        ctx.fillText("🏆 YOU WIN!", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 70);

        ctx.fillStyle = "#00ff88";
        ctx.font = "bold 22px monospace, sans-serif";
        ctx.fillText("More level are coming.. Stay Tuned", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 20);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 18px monospace, sans-serif";
        ctx.fillText(`Final Score: ${this.p1Score} | All 5 Levels Conquered!`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 20);
      } else if (this.mode === "CUSTOM_ROOM" && this.mpState && this.mpState.mode === "INFECTION") {
        // Milestone 6C: Infection Mode Match Resolution & Squad Ranking UI
        const isVictory = (this.mpState.status === "VICTORY" || this.state === "VICTORY");
        const title = isVictory ? "👑 TEAM VICTORY!" : "💀 TEAM WIPEOUT!";
        const titleColor = isVictory ? "#ffcc00" : "#ff3344";
        const bossName = this.mpState.boss?.name ? this.mpState.boss.name.toUpperCase() : "BOSS";
        const subtitle = isVictory
          ? `${bossName} DEFEATED!`
          : "ALL PLAYERS ELIMINATED!";

        ctx.fillStyle = titleColor;
        ctx.font = "bold 42px monospace, sans-serif";
        ctx.fillText(title, SCREEN_WIDTH / 2, 65);

        ctx.fillStyle = isVictory ? "#00ff88" : "#ffaa00";
        ctx.font = "bold 18px monospace, sans-serif";
        ctx.fillText(subtitle, SCREEN_WIDTH / 2, 98);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 14px monospace, sans-serif";
        ctx.fillText("── SQUAD BATTLE PERFORMANCE & RANKINGS ──", SCREEN_WIDTH / 2, 134);

        // Sort players by damageDealt descending
        const rankedPlayers = Array.from(this.mpState.players.values()).sort((a, b) => {
          return (b.damageDealt || 0) - (a.damageDealt || 0);
        });

        const startY = 168;
        const rowH = 34;

        ctx.font = "13px monospace, sans-serif";
        rankedPlayers.forEach((p, rIdx) => {
          if (rIdx >= 8) return;
          const y = startY + rIdx * rowH;
          const isAlive = p.isAlive && !p.isSpectator;
          const statusText = isAlive ? "🟢 SURVIVED" : "💀 ELIMINATED";
          const statusColor = isAlive ? "#00ff88" : "#ef4444";
          const weaponName = p.infectionWeapon ? p.infectionWeapon.name : "Unarmed";
          const dmg = p.damageDealt || 0;

          ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
          ctx.fillRect(SCREEN_WIDTH / 2 - 250, y - 20, 500, 26);

          ctx.textAlign = "left";
          ctx.fillStyle = "#ffcc00";
          ctx.fillText(`#${rIdx + 1}`, SCREEN_WIDTH / 2 - 240, y - 2);

          ctx.fillStyle = p.color || "#00e5ff";
          const pName = p.name ? (p.name.length > 12 ? p.name.slice(0, 11) + "…" : p.name) : `Player ${rIdx + 1}`;
          ctx.fillText(pName, SCREEN_WIDTH / 2 - 200, y - 2);

          ctx.fillStyle = "#94a3b8";
          ctx.fillText(`[${weaponName}]`, SCREEN_WIDTH / 2 - 80, y - 2);

          ctx.fillStyle = "#38bdf8";
          ctx.fillText(`DMG: ${dmg}`, SCREEN_WIDTH / 2 + 70, y - 2);

          ctx.textAlign = "right";
          ctx.fillStyle = statusColor;
          ctx.fillText(statusText, SCREEN_WIDTH / 2 + 240, y - 2);
        });

        ctx.textAlign = "center";
        const blink = Math.floor(this.gameTime * 2.5) % 2 === 0;
        if (blink) {
          ctx.fillStyle = "#00e5ff";
          ctx.font = "bold 15px system-ui, sans-serif";
          ctx.fillText("TAP OR PRESS ENTER TO RETURN TO LOBBY", SCREEN_WIDTH / 2, SCREEN_HEIGHT - 35);
        }
        ctx.restore();
        return;
      } else if (this.state === "VICTORY") {
        ctx.fillStyle = "#ffcc00";
        ctx.font = "bold 50px monospace, sans-serif";
        ctx.fillText("👑 ARENA CONQUERED!", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 50);

        ctx.fillStyle = "#00ff88";
        ctx.font = "bold 26px monospace, sans-serif";
        ctx.fillText(`ALL BOSSES DEFEATED! Final Score: ${this.p1Score}`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 10);
      } else if (this.mode === "SOLO") {
        ctx.fillStyle = "#ff3344";
        ctx.font = "bold 40px system-ui, -apple-system, sans-serif";
        ctx.fillText("Game Over!! U Loser😂", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 40);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 26px monospace, sans-serif";
        ctx.fillText(`Final Score: ${this.p1Score} (Level ${this.soloLevel})`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 10);
      } else {
        const myRole = (this.mode === "CUSTOM_ROOM" && this.myRole === "p2") ? "p2" : "p1";
        const myScore = (myRole === "p2") ? this.p2Score : this.p1Score;
        const rivalScore = (myRole === "p2") ? this.p1Score : this.p2Score;
        const myPlayer = (myRole === "p2") ? this.p2 : this.p1;
        const rivalPlayer = (myRole === "p2") ? this.p1 : this.p2;

        let isMeWinner = false;
        let isRivalWinner = false;

        if (myScore >= 30) isMeWinner = true;
        else if (rivalScore >= 30) isRivalWinner = true;
        else if (!rivalPlayer.isAlive && myPlayer.isAlive) isMeWinner = true;
        else if (!myPlayer.isAlive && rivalPlayer.isAlive) isRivalWinner = true;
        else if (this.matchWinner) {
          isMeWinner = (this.matchWinner === myRole);
          isRivalWinner = !isMeWinner;
        }

        if (isMeWinner) {
          ctx.fillStyle = "#ffcc00";
          ctx.font = "bold 44px monospace, sans-serif";
          ctx.fillText("👑 YOU WON THE MATCH!", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 45);

          ctx.fillStyle = "#00ff88";
          ctx.font = "bold 24px monospace, sans-serif";
          ctx.fillText("🏆 VICTORY! ARENA CHAMPION!", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 5);
        } else if (isRivalWinner) {
          ctx.fillStyle = "#ff4455";
          ctx.font = "bold 44px monospace, sans-serif";
          ctx.fillText("💀 YOU WERE DEFEATED!", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 45);

          ctx.fillStyle = "#ffaa00";
          ctx.font = "bold 24px monospace, sans-serif";
          ctx.fillText(`${rivalPlayer.name || "OPPONENT"} WINS THE MATCH!`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 5);
        } else {
          ctx.fillStyle = "#ffcc00";
          ctx.font = "bold 44px monospace, sans-serif";
          ctx.fillText("🏆 MATCH FINISHED!", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 45);
        }

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 20px monospace, sans-serif";
        ctx.fillText(`YOU: [${myScore} pts]   vs   OPPONENT: [${rivalScore} pts]`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 35);
      }

      const blink = Math.floor(this.gameTime * 2.5) % 2 === 0;
      if (blink) {
        ctx.fillStyle = "#00e5ff";
        ctx.font = "bold 18px system-ui, sans-serif";
        ctx.fillText("TAP OR PRESS ENTER TO CONTINUE", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 75);
      }
      ctx.restore();
    }

    start() {
      let lastTime = performance.now();
      let bgTimer = null;

      const stopBgTimer = () => {
        if (bgTimer !== null) {
          clearInterval(bgTimer);
          bgTimer = null;
        }
      };

      const startBgTimerIfNeeded = () => {
        stopBgTimer();
        // Mutually exclusive: Hidden Multiplayer matches (authoritative host & guest input)
        // use background timer. Hidden Solo Mode has no mpState and retains its pause behavior.
        const isHidden = (typeof document !== "undefined" && document.hidden);
        if (isHidden && this.mpState) {
          lastTime = performance.now();
          bgTimer = setInterval(() => {
            const stillHidden = (typeof document !== "undefined" && document.hidden);
            if (!stillHidden || !this.mpState) {
              stopBgTimer();
              return;
            }
            const now = performance.now();
            const delta = Math.min((now - lastTime) / 1000.0, 0.05);
            if (delta > 0) {
              lastTime = now;
              this.update(delta);
            }
          }, 25); // ~40Hz background simulation for active multiplayer
        }
      };

      this._checkBackgroundTimer = startBgTimerIfNeeded;
      this._stopBackgroundTimer = stopBgTimer;

      const loop = (currentTime) => {
        // Mutually exclusive: Visible tabs use requestAnimationFrame exclusively
        const isVisible = (typeof document === "undefined" || !document.hidden);
        if (isVisible) {
          stopBgTimer();
          const now = currentTime || performance.now();
          const delta = Math.min((now - lastTime) / 1000.0, 0.05);
          if (delta > 0) {
            lastTime = now;
            this.update(delta);
            this.draw();
          }
        }
        if (typeof requestAnimationFrame === "function") {
          requestAnimationFrame(loop);
        }
      };

      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(loop);
      }

      // Handle visibility changes safely: reset timing references and switch update sources
      if (typeof document !== "undefined" && document.addEventListener) {
        document.addEventListener("visibilitychange", () => {
          lastTime = performance.now(); // Reset timing reference on switch
          if (document.hidden) {
            startBgTimerIfNeeded();
          } else {
            stopBgTimer();
          }
        });
      }

      if (typeof document !== "undefined" && document.hidden) {
        startBgTimerIfNeeded();
      }
    }
  }

  // --- Bootloader ---
  window.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("game-canvas");
    if (!canvas) return;
    const game = new DodgeArenaGame(canvas);
    window.game = game;
    game.start();
  });
})();
