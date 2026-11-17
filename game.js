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
        // Fire 5 rapid bullets
        for (let i = 0; i < 5; i++) {
          this.bullets.push({ x: cx, y: cy, vx: (dx/dist)*220, vy: (dy/dist)*220, life: 3.0 });
        }
        onGunShot();
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
    constructor(x, y) { this.x = x; this.y = y; this.size = 24; this.pulse = 0; }
    get rect() { return { x: Math.round(this.x), y: Math.round(this.y), w: this.size, h: this.size }; }
    update(dt) { this.pulse = (this.pulse + dt * 3) % (Math.PI * 2); }
    draw(ctx) {
      ctx.save();
      const scale = 1 + Math.sin(this.pulse) * 0.15;
      const cx = this.x + this.size/2, cy = this.y + this.size/2;
      ctx.translate(cx, cy); ctx.scale(scale, scale);
      ctx.shadowColor="#ffcc00"; ctx.shadowBlur=20;
      ctx.fillStyle="#ffcc00";
      ctx.font = "bold 22px sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillText("🔫", 0, 0);
      ctx.restore();
      ctx.save();
      ctx.fillStyle="#ffcc00"; ctx.font="bold 10px monospace"; ctx.textAlign="center";
      ctx.fillText("AK-47 PICKUP", cx, this.y + this.size + 12);
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
        this.sounds.playCollect();
        splashScreen.classList.add("hidden");
        this.showMenu();
      };
      splashScreen?.addEventListener("pointerdown", enterMenuFromSplash, { passive: false });
      window.addEventListener("keydown", (e) => {
        if (e.code === "Enter" || e.code === "Space") {
          enterMenuFromSplash(e);
        }
      });

      // Menu and Top Bar
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
        if (btn) btn.innerHTML = muted ? "🔇 <span>Muted</span>" : "🔊 <span>Sound</span>";
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
        document.getElementById("online-panel")?.classList.remove("hidden");
      });
      document.getElementById("online-back-btn")?.addEventListener("click", () => {
        document.getElementById("online-panel")?.classList.add("hidden");
      });

      // Host / Join
      document.getElementById("btn-create-room")?.addEventListener("click", () => this.hostCustomRoom());
      document.getElementById("btn-join-room")?.addEventListener("click", () => {
        const input = document.getElementById("join-room-input");
        if (input && input.value.trim()) this.joinCustomRoom(input.value.trim().toUpperCase());
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

      // Auto-join from URL param
      const urlParams = new URLSearchParams(window.location.search);
      const roomParam = urlParams.get("room");
      if (roomParam) {
        document.getElementById("online-panel")?.classList.remove("hidden");
        const joinInput = document.getElementById("join-room-input");
        if (joinInput) joinInput.value = roomParam.toUpperCase();
        setTimeout(() => this.joinCustomRoom(roomParam.toUpperCase()), 500);
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
      this.sounds.playCollect();

      const timerId = setInterval(() => {
        count--;
        if (count > 0) {
          countdownNum.innerText = count;
          this.sounds.playCollect();
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

      // Gun Button (Solo: fires AK-47 / Minigun)
      const gunBtn = document.getElementById("gun-btn");
      gunBtn?.addEventListener("pointerdown", (e) => {
        if (e.cancelable) e.preventDefault();
        this.sounds._init();
        if (this.mode === "SOLO" && this.state === "PLAYING") this.firePlayerBullet();
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

      // Left mouse button on canvas
      this.canvas.addEventListener("mousedown", (e) => {
        if (e.button === 0) startGunFire();
      });
      window.addEventListener("mouseup", (e) => {
        if (e.button === 0) stopGunFire();
      });

      // Alt key hold
      window.addEventListener("keydown", (e) => {
        if ((e.code === "AltLeft" || e.code === "AltRight") && this.mode === "SOLO") {
          e.preventDefault();
          startGunFire();
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
      this.setupHudDragAndDrop();
    }

    closeHudEditor() {
      document.body.classList.remove("hud-editing");
      document.getElementById("hud-editor-overlay")?.classList.add("hidden");
      document.getElementById("modal-overlay")?.classList.remove("hidden");
    }

    setupHudDragAndDrop() {
      if (this.hudDragInitialized) return;
      this.hudDragInitialized = true;

      const elementsToDrag = [
        document.getElementById("joystick-zone"),
        document.getElementById("sprint-btn"),
        document.getElementById("dash-btn"),
        document.getElementById("push-btn"),
        document.getElementById("emer-dodge-btn"),
        document.getElementById("beam-btn"),
      ].filter(Boolean);

      elementsToDrag.forEach((el) => {
        let isDragging = false;
        let startX = 0, startY = 0;
        let origLeft = 0, origTop = 0;

        const onPointerDown = (e) => {
          if (!document.body.classList.contains("hud-editing")) return;
          e.preventDefault();
          e.stopPropagation();

          isDragging = true;
          startX = e.clientX;
          startY = e.clientY;

          const rect = el.getBoundingClientRect();
          origLeft = rect.left;
          origTop = rect.top;

          // Make element fixed for freeform drag anywhere
          el.style.position = "fixed";
          el.style.left = `${origLeft}px`;
          el.style.top = `${origTop}px`;
          el.style.bottom = "auto";
          el.style.right = "auto";
          el.style.margin = "0";
          el.setPointerCapture(e.pointerId);
        };

        const onPointerMove = (e) => {
          if (!isDragging) return;
          e.preventDefault();
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;

          const newLeft = Math.max(10, Math.min(window.innerWidth - el.offsetWidth - 10, origLeft + dx));
          const newTop = Math.max(60, Math.min(window.innerHeight - el.offsetHeight - 10, origTop + dy));

          el.style.left = `${newLeft}px`;
          el.style.top = `${newTop}px`;
        };

        const onPointerUp = (e) => {
          if (!isDragging) return;
          isDragging = false;
          try { el.releasePointerCapture(e.pointerId); } catch (err) {}
        };

        el.addEventListener("pointerdown", onPointerDown);
        el.addEventListener("pointermove", onPointerMove);
        el.addEventListener("pointerup", onPointerUp);
        el.addEventListener("pointercancel", onPointerUp);
      });
    }

    saveHudLayout() {
      const ids = ["joystick-zone", "sprint-btn", "dash-btn", "push-btn", "emer-dodge-btn", "beam-btn"];
      const layout = {};

      ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el && el.style.position === "fixed") {
          layout[id] = {
            leftPct: (parseFloat(el.style.left) / window.innerWidth) * 100,
            topPct: (parseFloat(el.style.top) / window.innerHeight) * 100,
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
      Object.keys(layout).forEach((id) => {
        const el = document.getElementById(id);
        const pos = layout[id];
        if (el && pos && pos.leftPct !== undefined && pos.topPct !== undefined) {
          el.style.position = "fixed";
          el.style.left = `${(pos.leftPct / 100) * window.innerWidth}px`;
          el.style.top = `${(pos.topPct / 100) * window.innerHeight}px`;
          el.style.bottom = "auto";
          el.style.right = "auto";
          el.style.margin = "0";
        }
      });
    }

    resetHudLayout() {
      localStorage.removeItem("dodgearena_hud_layout");
      const ids = ["joystick-zone", "sprint-btn", "dash-btn", "push-btn", "emer-dodge-btn", "beam-btn"];
      ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
          el.style.position = "";
          el.style.left = "";
          el.style.top = "";
          el.style.bottom = "";
          el.style.right = "";
          el.style.margin = "";
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

    broadcastState() {
      if (this.mode !== "CUSTOM_ROOM" || !this.isHost || !this.conn || !this.conn.open) return;
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

      const rival = (caster === this.p1) ? this.p2 : this.p1;
      if (this.mode === "CUSTOM_ROOM" && rival.isAlive) {
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

      // Show gun button only in Solo mode
      const gunBtn = document.getElementById("gun-btn");
      if (gunBtn) {
        if (this.mode === "SOLO") gunBtn.style.display = "";
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
          this.ak47Pickup = new AK47Pickup(150+Math.random()*(SCREEN_WIDTH-300), 200+Math.random()*(SCREEN_HEIGHT-400));
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
            b.update(dt, px, py, () => this.sounds.playTone(220, "sawtooth", 0.3, 0.3),
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
            mb.update(dt, px, py, () => this.sounds.playTone(220, "sawtooth", 0.3, 0.3));
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
    draw() {
      const ctx = this.ctx;
      const theme = MAP_THEMES[this.mapIndex] || MAP_THEMES[1];

      // Dynamic Map Background
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

      // Draw themed map decoration (no grid)
      if (theme.draw) theme.draw(ctx);

      // Draw Collectibles
      for (let i = 0; i < this.items.length; i++) {
        this.items[i].draw(ctx, this.gameTime, IS_MOBILE);
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

      // Draw Players
      this.p1.draw(ctx);
      if (this.mode === "CUSTOM_ROOM") this.p2.draw(ctx);

      // Draw Particles & Texts
      for (let i = 0; i < this.particles.length; i++) this.particles[i].draw(ctx);
      for (let i = 0; i < this.floatingTexts.length; i++) this.floatingTexts[i].draw(ctx);

      // Solo HUD (Top-left)
      if (this.mode === "SOLO") {
        ctx.textAlign = "left";
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 20px monospace, sans-serif";
        const displayName = this.p1.name || (this.gamerProfile ? this.gamerProfile.username : "Player 1");
        ctx.fillText(`${displayName} • Score: ${this.p1Score}`, 20, 36);

        ctx.fillStyle = "#8888b5";
        ctx.font = "14px monospace, sans-serif";
        ctx.fillText(`⚡ Emergency Dodges: ${this.p1.emerDodges}/3`, 22, 60);

        // Ammo HUD
        if (this.gunEnabled) {
          ctx.fillStyle = this.ammo > 20 ? "#ffcc00" : "#ff4400";
          ctx.font = "bold 14px monospace";
          const ammoText = this.minigunUnlimited ? "MINIGUN ∞" : `AMMO: ${this.ammo}/80`;
          if (this.bulletImg && this.bulletImg.complete && this.bulletImg.naturalWidth > 0) {
            ctx.drawImage(this.bulletImg, 22, 69, 26, 6);
            ctx.fillText(ammoText, 54, 76);
          } else {
            ctx.fillText(`🔫 ${ammoText}`, 22, 80);
          }
        }
        // Level indicator
        ctx.fillStyle = "#aaffcc";
        ctx.font = "bold 13px monospace";
        ctx.fillText(`Level ${this.soloLevel} | Map ${this.soloMapPhase}`, 22, this.gunEnabled ? 98 : 80);
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
      } else if (this.state === "VICTORY") {
        ctx.fillStyle = "#ffcc00";
        ctx.font = "bold 50px monospace, sans-serif";
        ctx.fillText("👑 ARENA CONQUERED!", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 50);

        ctx.fillStyle = "#00ff88";
        ctx.font = "bold 26px monospace, sans-serif";
        ctx.fillText(`ALL BOSSES DEFEATED! Final Score: ${this.p1Score}`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 10);
      } else if (this.mode === "SOLO") {
        ctx.fillStyle = "#ff3344";
        ctx.font = "bold 48px monospace, sans-serif";
        ctx.fillText("RUN OVER", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 40);

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
      const loop = (currentTime) => {
        const delta = Math.min((currentTime - lastTime) / 1000.0, 0.05);
        lastTime = currentTime;

        this.update(delta);
        this.draw();

        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
  }

  // --- Bootloader ---
  window.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("game-canvas");
    if (!canvas) return;
    const game = new DodgeArenaGame(canvas);
    game.start();
  });
})();
