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
    1: { name: "CYBER NEON", bg: "#08081a", grid: "rgba(0, 229, 255, 0.05)", border: "#00e5ff" },
    2: { name: "CRIMSON MAGMA", bg: "#19080a", grid: "rgba(255, 51, 17, 0.08)", border: "#ff3311" },
    3: { name: "VOID ABYSS", bg: "#10061c", grid: "rgba(170, 0, 255, 0.08)", border: "#aa00ff" },
    4: { name: "TITAN CHAMBER", bg: "#140a18", grid: "rgba(255, 204, 0, 0.1)", border: "#ffcc00" },
  };

  // --- Sound Synthesizer (Web Audio API) ---
  class SoundManager {
    constructor() {
      this.ctx = null;
      this.muted = false;
      this.customFailSound = new Audio("gameover.mp3");
      this.customFailSound.preload = "auto";
    }

    _init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
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
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.3);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.31);
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
    }

    get isInvulnerable() {
      return this.dashTimer > 0 || this.emerDodgeTimer > 0;
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

    emergencyDodge() {
      if (this.emerDodges <= 0 || this.emerDodgeTimer > 0 || !this.isAlive) return false;
      this.emerDodges -= 1;
      this.emerDodgeTimer = 1.2; // 1.2s invulnerability
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

      // Player Rect
      ctx.save();
      if (!IS_MOBILE) {
        ctx.shadowColor = this.isGiant ? "#ffcc00" : this.color;
        ctx.shadowBlur = this.isGiant ? 24 : (this.dashTimer > 0 ? 18 : 10);
      }
      ctx.fillStyle = this.isGiant ? "#ffaa00" : (this.dashTimer > 0 ? "#ffffff" : this.color);
      ctx.fillRect(Math.round(this.x), Math.round(this.y), this.size, this.size);

      // Emergency Dodge Aura
      if (this.emerDodgeTimer > 0) {
        ctx.strokeStyle = "#a855f7";
        ctx.lineWidth = 3;
        ctx.shadowColor = "#a855f7";
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(this.x + this.size / 2, this.y + this.size / 2, this.size * 1.1, 0, Math.PI * 2);
        ctx.stroke();
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
    constructor() {
      this.size = 70;
      this.x = SCREEN_WIDTH / 2 - this.size / 2;
      this.y = 80;
      this.vx = 60;
      this.maxHp = 100;
      this.hp = 100;

      // Burst Attack
      this.burstTimer = 0; // cycles every 8s
      this.isChargingBurst = false;
      this.chargeTimer = 0; // 2s charge
      this.burstRadius = 0;
      this.burstVisual = null; // { radius, maxRadius, alpha }

      // Minion spawn
      this.minionTimer = 0;
    }

    update(dt, onCaution, onBurst, spawnMinions) {
      // Horizontal drift
      this.x += this.vx * dt;
      if (this.x < 30 || this.x + this.size > SCREEN_WIDTH - 30) {
        this.vx *= -1;
      }

      // Minion Spawner
      this.minionTimer += dt;
      if (this.minionTimer >= 4.5) {
        this.minionTimer = 0;
        spawnMinions(this.x + this.size / 2, this.y + this.size / 2);
      }

      // Burst Attack Cycle
      this.burstTimer += dt;
      if (!this.isChargingBurst && this.burstTimer >= 6.5) {
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
            maxRadius: 260,
            alpha: 1.0,
          };
        }
      }

      if (this.burstVisual) {
        this.burstVisual.radius += 500 * dt;
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
        ctx.arc(cx, cy, 30 + pulse * 140, 0, Math.PI * 2);
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
      ctx.shadowColor = "#ff2244";
      ctx.shadowBlur = 24;
      ctx.fillStyle = this.isChargingBurst ? "#ffcc00" : "#ff1133";
      ctx.fillRect(Math.round(this.x), Math.round(this.y), this.size, this.size);

      // Boss Core Eye
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ff0044";
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.fill();

      // Boss Title Tag
      ctx.fillStyle = "#ffcc00";
      ctx.font = "bold 12px monospace, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("TITAN VOID BOSS (LVL 1)", cx, this.y - 10);
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
      this.knockbackVx *= Math.max(0, 1 - 6 * dt);
      this.knockbackVy *= Math.max(0, 1 - 6 * dt);

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
      if (!isMobile) {
        ctx.shadowColor = mapTheme.border;
        ctx.shadowBlur = 8;
      }
      ctx.fillStyle = mapTheme.border;
      ctx.fillRect(Math.round(this.x), Math.round(this.y), this.size, this.size);
      ctx.restore();
    }
  }

  class Collectible {
    constructor(x, y, points = 10) {
      this.x = x;
      this.y = y;
      this.size = 20; // Increased from 14 to 20 for clear visibility on mobile
      this.points = points;
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
      if (!isMobile) {
        ctx.shadowColor = "#46dc82";
        ctx.shadowBlur = 12;
      }
      // Outer bright ring
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(cx, cy, (radius + 2) * pulse, 0, Math.PI * 2);
      ctx.fill();

      // Inner vibrant green core
      ctx.fillStyle = "#00ff66";
      ctx.beginPath();
      ctx.arc(cx, cy, radius * pulse, 0, Math.PI * 2);
      ctx.fill();
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

      // Progression
      this.level = 1;
      this.mapIndex = 1;
      this.p1Score = 0;
      this.p2Score = 0;

      // Players
      this.p1 = new Player("p1", "#4682ff", "Player 1");
      this.p2 = new Player("p2", "#ff5533", "Player 2");

      // Boss
      this.boss = null;

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

      this.setupDOM();
      this.setupKeyboard();
      this.setupTouch();
      this.setupCanvasScaling();
    }

    // --- DOM Setup ---
    setupDOM() {
      // Menu and Top Bar
      document.getElementById("menu-btn")?.addEventListener("click", () => this.showMenu());
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
      this.state = "MENU";
      document.getElementById("modal-overlay")?.classList.remove("hidden");
      document.getElementById("match-banner")?.classList.add("hidden");
    }

    hideMenu() {
      document.getElementById("modal-overlay")?.classList.add("hidden");
    }

    // --- Input Handlers ---
    setupKeyboard() {
      const keysDown = {};

      window.addEventListener("keydown", (e) => {
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
          if (myPlayer.emergencyDodge()) {
            this.sounds.playEmerDodge();
            this.floatingTexts.push(new FloatingText(myPlayer.x, myPlayer.y, "EMERGENCY DODGED!", "#a855f7"));
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
        if (e && e.cancelable) e.preventDefault();
        const p = getActivePlayer();
        p.stopSprint();
        sprintBtn?.classList.remove("sprinting");
        if (this.mode === "CUSTOM_ROOM" && !this.isHost && this.conn) this.conn.send({ type: "STOP_SPRINT" });
      };

      sprintBtn?.addEventListener("pointerdown", onSprintStart);
      window.addEventListener("pointerup", onSprintStop);
      window.addEventListener("pointercancel", onSprintStop);

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
        if (p.emergencyDodge()) {
          this.sounds.playEmerDodge();
          this.floatingTexts.push(new FloatingText(p.x, p.y, "EMERGENCY DODGED!", "#a855f7"));
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

      // Canvas click to restart
      this.canvas.addEventListener("click", () => {
        this.sounds._init();
        if (this.state === "MATCH_OVER") this.startMatch(this.mode);
      });
    }

    updateDodgeBadge(count) {
      const badge = document.getElementById("dodge-count-badge");
      if (badge) badge.innerText = count;
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
            this.p2.emergencyDodge();
            this.sounds.playEmerDodge();
          } else if (data.type === "BEAM") {
            this.p2.fireBeam(data.tx, data.ty);
            this.sounds.playBeam();
          } else if (data.type === "START_SPRINT") {
            this.p2.startSprint();
          } else if (data.type === "STOP_SPRINT") {
            this.p2.stopSprint();
          }
        } else {
          if (data.type === "STATE") {
            this.syncStateFromHost(data);
          }
        }
      });
    }

    syncStateFromHost(data) {
      this.state = data.state;
      this.level = data.level;
      this.mapIndex = data.mapIndex;
      this.p1Score = data.p1Score;
      this.p2Score = data.p2Score;

      this.p1.x = data.p1.x;
      this.p1.y = data.p1.y;
      this.p1.isGiant = data.p1.isGiant;
      this.p1.size = data.p1.size;
      this.p1.activeBeam = data.p1.activeBeam;
      this.p1.isAlive = data.p1.isAlive;

      this.p2.x = data.p2.x;
      this.p2.y = data.p2.y;
      this.p2.isGiant = data.p2.isGiant;
      this.p2.size = data.p2.size;
      this.p2.activeBeam = data.p2.activeBeam;
      this.p2.isAlive = data.p2.isAlive;

      this.enemies = data.enemies.map(e => new Enemy(e.x, e.y, this.difficulty.enemySpeed));

      if (data.items) {
        this.items = data.items.map(it => new Collectible(it.x, it.y, it.points));
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
    }

    // --- Match & Progression ---
    startMatch(mode) {
      this.sounds.stopGameOver();
      this.mode = mode;
      this.state = "PLAYING";
      this.level = 1;
      this.mapIndex = 1;
      this.p1Score = 0;
      this.p2Score = 0;
      this.boss = null;

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

      this.p1.reset(SCREEN_WIDTH / 2 - 10, SCREEN_HEIGHT / 2 + 100);
      if (this.mode === "CUSTOM_ROOM") {
        this.p1.reset(180, SCREEN_HEIGHT / 2 + 100);
        this.p2.reset(SCREEN_WIDTH - 200, SCREEN_HEIGHT / 2 + 100);
      }

      this.setCautionBanner(false);
      this.updateHUD();
      this.showAnnouncement("MATCH STARTED", `DIFFICULTY: ${this.difficulty.name}`);
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

      // Multiplayer Scores
      const p1Val = document.getElementById("p1-score-val");
      const p2Val = document.getElementById("p2-score-val");
      if (p1Val) p1Val.innerText = this.p1Score;
      if (p2Val) p2Val.innerText = this.p2Score;

      // Cooldown UI overlays
      const myPlayer = (this.mode === "CUSTOM_ROOM" && this.myRole === "p2") ? this.p2 : this.p1;
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

      this.updateDodgeBadge(myPlayer.emerDodges);
    }

    // --- Map Transition & Milestone Checks ---
    checkProgression(score) {
      // 1. Map 2 at 20 points
      if (score >= 20 && this.mapIndex === 1) {
        this.mapIndex = 2;
        this.showAnnouncement("MAP 2 UNLOCKED!", "CRIMSON MAGMA ARENA - ENEMIES AGGRESSIVE!");
        this.sounds.playVictory();
      }
      // 2. Map 3 at 50 points
      else if (score >= 50 && this.mapIndex === 2) {
        this.mapIndex = 3;
        this.showAnnouncement("MAP 3 UNLOCKED!", "VOID ECLIPSE ABYSS - SPEED INCREASED!");
        this.sounds.playVictory();
      }
      // 3. Map 4 & Boss Fight at 100 points
      else if (score >= 100 && this.mapIndex === 3) {
        this.mapIndex = 4;
        this.boss = new Boss();
        this.showAnnouncement("BOSS MISSION ARRIVED!", "DEFEAT TITAN VOID BOSS TO ADVANCE!");
        this.sounds.playWarning();
      }
      // 4. Level 2 at 120 points
      else if (score >= 120 && this.level === 1) {
        this.level = 2;
        this.mapIndex = 1;
        this.boss = null;
        this.showAnnouncement("LEVEL 2 MATCH STARTED!", "CONGRATULATIONS! CHALLENGE MULTIPLIED!");
        this.sounds.playVictory();
      }
      // 5. Level 3 at 240 points
      else if (score >= 240 && this.level === 2) {
        this.level = 3;
        this.mapIndex = 1;
        this.boss = null;
        this.showAnnouncement("LEVEL 3 MATCH STARTED!", "THE FINAL RUN!");
        this.sounds.playVictory();
      }

      // Multiplayer 25 points Giant Transformation
      if (this.mode === "CUSTOM_ROOM") {
        if (this.p1Score >= 25 && !this.p1.isGiant) {
          this.p1.transformToGiant();
          this.showAnnouncement("PLAYER 1 TRANSFORMED!", "TITAN GIANT UNLOCKED BEAM CANNON (E)!");
          this.sounds.playWarning();
        }
        if (this.p2Score >= 25 && !this.p2.isGiant) {
          this.p2.transformToGiant();
          this.showAnnouncement("PLAYER 2 TRANSFORMED!", "TITAN GIANT UNLOCKED BEAM CANNON (E)!");
          this.sounds.playWarning();
        }

        // Opponent survives and hits 30 points -> Wins!
        if (this.p1Score >= 30) {
          this.state = "MATCH_OVER";
          this.sounds.playVictory();
        } else if (this.p2Score >= 30) {
          this.state = "MATCH_OVER";
          this.sounds.playVictory();
        }
      }
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
            p.isAlive = false;
            this.sounds.playGameOver();
            this.state = "MATCH_OVER";
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

      if (this.mode === "CUSTOM_ROOM" && !this.isHost && this.conn && this.conn.open) {
        const myInput = (this.myRole === "p2") ? this.p2Input : this.p1Input;
        this.conn.send({ type: "INPUT", x: myInput.x, y: myInput.y });
      }

      if (this.mode === "CUSTOM_ROOM" && !this.isHost) return;

      // Update Texts & Particles
      for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
        this.floatingTexts[i].update(dt);
        if (this.floatingTexts[i].alpha <= 0) this.floatingTexts.splice(i, 1);
      }
      for (let i = this.particles.length - 1; i >= 0; i--) {
        this.particles[i].update(dt);
        if (this.particles[i].alpha <= 0) this.particles.splice(i, 1);
      }

      if (this.state !== "PLAYING") return;

      // Update Players
      this.p1.update(this.p1Input.x, this.p1Input.y, dt);
      if (this.mode === "CUSTOM_ROOM") {
        this.p2.update(this.p2Input.x, this.p2Input.y, dt);
      }

      // Update Boss if present
      if (this.boss) {
        this.boss.update(
          dt,
          (show) => this.setCautionBanner(show),
          (bx, by) => this.triggerBossBurst(bx, by),
          (bx, by) => this.spawnMinionSwarm(bx, by)
        );
      }

      // Spawn Enemies
      this.enemySpawnTimer += dt;
      let spInterval = this.difficulty.spawnInterval;
      if (this.mapIndex === 2) spInterval *= 0.85; // Faster in Magma
      else if (this.mapIndex >= 3) spInterval *= 0.72; // Even faster in Void

      const maxEn = this.difficulty.maxEnemies + (this.mapIndex - 1) * 2;
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

      // Broadcast state to Guest if Host
      if (this.mode === "CUSTOM_ROOM" && this.isHost && this.conn && this.conn.open) {
        this.conn.send({
          type: "STATE",
          state: this.state,
          level: this.level,
          mapIndex: this.mapIndex,
          p1Score: this.p1Score,
          p2Score: this.p2Score,
          p1: { x: this.p1.x, y: this.p1.y, isGiant: this.p1.isGiant, size: this.p1.size, activeBeam: this.p1.activeBeam, isAlive: this.p1.isAlive },
          p2: { x: this.p2.x, y: this.p2.y, isGiant: this.p2.isGiant, size: this.p2.size, activeBeam: this.p2.activeBeam, isAlive: this.p2.isAlive },
          enemies: this.enemies.map(e => ({ x: e.x, y: e.y })),
          items: this.items.map(it => ({ x: it.x, y: it.y, points: it.points })),
          boss: this.boss ? { x: this.boss.x, y: this.boss.y, isChargingBurst: this.boss.isChargingBurst, burstVisual: this.boss.burstVisual } : null,
        });
      }
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
      const x = 30 + Math.random() * (SCREEN_WIDTH - 60);
      const y = 30 + Math.random() * (SCREEN_HEIGHT - 60);
      let pts = 10;
      if (this.mapIndex === 2) pts = 15;
      else if (this.mapIndex >= 3) pts = 20;

      this.items.push(new Collectible(x, y, pts));
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

            player.isAlive = false;
            this.sounds.playGameOver();
            this.state = "MATCH_OVER";
            return;
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
              player.isAlive = false;
              this.sounds.playGameOver();
              this.state = "MATCH_OVER";
              return;
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
              this.particles.push(new Particle(item.x + 7, item.y + 7, "#46dc82"));
            }

            this.items.splice(i, 1);
            const highestScore = Math.max(this.p1Score, this.p2Score);
            this.checkProgression(highestScore);
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

      // Grid Lines
      ctx.strokeStyle = theme.grid;
      ctx.lineWidth = 1;
      for (let x = 0; x < SCREEN_WIDTH; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, SCREEN_HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y < SCREEN_HEIGHT; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(SCREEN_WIDTH, y);
        ctx.stroke();
      }

      // Draw Collectibles
      for (let i = 0; i < this.items.length; i++) {
        this.items[i].draw(ctx, this.gameTime, IS_MOBILE);
      }

      // Draw Enemies
      for (let i = 0; i < this.enemies.length; i++) {
        this.enemies[i].draw(ctx, theme, IS_MOBILE);
      }

      // Draw Boss
      if (this.boss) {
        this.boss.draw(ctx);
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
        ctx.font = "bold 24px monospace, sans-serif";
        ctx.fillText(`Score: ${this.p1Score}`, 20, 36);

        ctx.fillStyle = "#8888b5";
        ctx.font = "14px monospace, sans-serif";
        ctx.fillText(`⚡ Emergency Dodges: ${this.p1.emerDodges}/3`, 22, 60);
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
      if (this.state === "MATCH_OVER") {
        this.drawMatchOverScreen();
      }
    }

    drawMatchOverScreen() {
      const ctx = this.ctx;
      ctx.save();
      ctx.fillStyle = "rgba(6, 6, 18, 0.9)";
      ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

      ctx.textAlign = "center";

      if (this.mode === "SOLO") {
        ctx.fillStyle = "#ff3344";
        ctx.font = "bold 48px monospace, sans-serif";
        ctx.fillText("RUN OVER", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 40);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 26px monospace, sans-serif";
        ctx.fillText(`Final Score: ${this.p1Score} (Level ${this.level} - Map ${this.mapIndex})`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 10);
      } else {
        const winner = this.p1Score >= 30 ? "PLAYER 1" : (this.p2Score >= 30 ? "PLAYER 2" : (this.p1.isAlive ? "PLAYER 1" : "PLAYER 2"));
        ctx.fillStyle = "#ffcc00";
        ctx.font = "bold 44px monospace, sans-serif";
        ctx.fillText(`🏆 ${winner} WINS MATCH!`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 40);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 22px monospace, sans-serif";
        ctx.fillText(`Scores: P1 [${this.p1Score}] - [${this.p2Score}] P2`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 10);
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
