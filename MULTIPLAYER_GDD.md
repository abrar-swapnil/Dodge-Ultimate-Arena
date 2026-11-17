# Dodge Arena Ultimate — Multiplayer Game Design Document
**Version:** 1.0 — Source of Truth for Milestones 5 & 6
**Status:** Approved. Do not modify without explicit user sign-off.

---

## Table of Contents
1. [Global Multiplayer Rules](#1-global-multiplayer-rules)
2. [Network Architecture](#2-network-architecture)
3. [Elite Mode — Obsidian Crucible](#3-elite-mode--obsidian-crucible)
4. [Infection Mode — Quarantine Lab](#4-infection-mode--quarantine-lab)
5. [Weapons & Combat Engine](#5-weapons--combat-engine)
6. [Enemy AI System](#6-enemy-ai-system)
7. [Results & Rankings](#7-results--rankings)

---

## 1. Global Multiplayer Rules

| Rule | Value |
|---|---|
| Maximum players per room | **8** |
| Minimum players to start | **2** |
| Room code format | 6-character alphanumeric (no 0, O, 1, I) |
| Room status lifecycle | `LOBBY` → `IN_PROGRESS` → `ENDED` |
| Host authority | Host is match authority: validates all damage events, cooldown timers, ammo deductions, and broadcasts authoritative state |
| Guest start control | Guests cannot start match; only host can |
| Ready gate | Host's Start Match button is disabled until **all** connected guests toggle Ready |
| Reconnect window | 5 seconds; if host does not recover within 5 s, match terminates with abort screen |
| Host disconnect in lobby | Room destroyed on server; all guests receive `HOST_DISCONNECTED` and are returned to main menu |
| Guest disconnect in match | Host removes player slot, notifies remaining guests via reliable broadcast |
| Solo Mode | Completely isolated — no multiplayer code touches Solo campaign, scoring, levels, or bosses |

### Game Mode Selection
- Modes available: **ELITE** and **INFECTION**
- Mode is selected by the **host only** in the lobby before match start
- Mode choice is broadcast to all guests via `LOBBY_STATE` message
- Each mode uses a **separate dedicated map** — maps are never shared between modes

---

## 2. Network Architecture

### Transport Channels
| Channel | Label | Reliability | Used For |
|---|---|---|---|
| A — Command | `cmd` | `reliable: true` | `ROOM_UPDATE`, `TOGGLE_READY`, `START_MATCH`, `DAMAGE_EVENT`, `PLAYER_ELIMINATED`, `PHASE_TRANSITION`, boss events |
| B — Sync | `sync` | `reliable: false`, `maxRetransmits: 0`, `ordered: false` | Continuous position vectors, physics snapshot interpolation at 25 Hz |

### Topology
- **Star topology** — host holds up to 7 inbound peer connections
- Guests connect directly to host peer; guests do not connect to each other
- Server (`server.js`) provides signaling and room registry only; it does not relay game data

### Room Validation Flow
1. Host calls `POST /api/rooms/create` → server registers room with `status: "LOBBY"`, `maxPlayers: 8`
2. Guest calls `POST /api/rooms/join` → server verifies `players.size < 8` AND `status === "LOBBY"`; rejects with HTTP 403 if full or in-progress
3. After match starts, host calls `POST /api/rooms/start` → server sets `status: "IN_PROGRESS"`
4. Any subsequent join attempt is rejected with HTTP 403

---

## 3. Elite Mode — Obsidian Crucible

### 3.1 Overview
**Type:** Cooperative Titan Conquest — all players fight together against environmental hazards and a final boss.
**Map:** *Obsidian Crucible* — a dedicated Elite-only arena. Not shared with Infection Mode.
**Win Condition:** Defeat the Demon Boss after it spawns at 200 points.
**Loss Condition:** All players eliminated before the boss is defeated.

### 3.2 Score Thresholds & Phase Transitions

> [!IMPORTANT]
> These thresholds and mechanics are exact and final. Do not alter them.

| Global Team Score | Event |
|---|---|
| **30 points** | Smoke bombs activate (2s fuse, 3s duration, 20 HP damage on entry) |
| **70 points** | Toxic gas activates (spawns every 5s, lasts 10s, deals 10 HP damage every 0.5s) |
| **120 points** | Stop mini enemy spawning. Laser wall activates (every 15s, deals 60 HP on direct hit) |
| **200 points** | **Demon Boss Spawns** (2500 HP). Stop toxic gas and laser walls (smoke bombs continue). Stop score collection. Give every surviving player a **Fireball Gun** (100 ammo, 50 damage/shot). |

- Score is a **global team score** — all surviving players contribute to it collectively
- Score collection stops permanently once the Demon Boss spawns at 200 points
- Thresholds are evaluated by the host and broadcast via `PHASE_TRANSITION` on the reliable channel

### 3.3 Environmental Hazards

| Hazard | Activation Threshold | Exact Parameters | Description |
|---|---|---|---|
| **Smoke Bombs** | 30 pts | • Fuse: 2.0s<br>• Duration: 3.0s<br>• Damage: 20 HP on entry | Deploys periodic smoke bomb hazard zones across the arena. Persists through the final boss phase. |
| **Toxic Gas** | 70 pts | • Spawn interval: every 5.0s<br>• Duration: 10.0s<br>• Damage: 10 HP every 0.5s | Periodic noxious clouds covering arena zones. Stops completely when Demon Boss spawns at 200 pts. |
| **Laser Wall** | 120 pts | • Cycle interval: every 15.0s<br>• Damage: 60 HP on direct hit | Sweeping high-voltage laser barrier crossing the arena. Stops completely when Demon Boss spawns at 200 pts. |

- **Mini Enemy Spawning:** Active from match start until 120 points; mini enemy spawning stops permanently at 120 points.
- **Hazard Lifecycle at Boss Spawn (200 pts):** Toxic gas and laser walls immediately cease. Smoke bombs remain active and continue spawning throughout the boss fight.

### 3.4 Demon Boss

**Spawns at:** 200 points (Score collection halted)
**Health:** Exactly **2500 HP** (Fixed; does not scale with player count)

#### Abilities & Timers
| Ability | Interval / Duration | Damage | Description |
|---|---|---|---|
| **Fireball** | Every 5.0s | 10 HP | High-velocity projectile launched toward targeted players. |
| **Pink Burst Vapor** | Every 15.0s (lasts 7.0s) | 5 HP every 0.5s | Volatile expanding pink gas cloud that deals rapid tick damage. |
| **Targeted Green Gas** | Every 20.0s (lasts 30.0s) | 2 HP per second | Lingering homing/targeted green toxic cloud applying sustained poison damage. |

#### Boss Combat Rules
- Host is authoritative over all boss positioning, ability cooldowns, and hit detection
- Boss targets the surviving player with the highest individual score contribution (threat priority)
- Defeating the Demon Boss triggers match Victory screen for all surviving and spectating team players

### 3.5 Fireball Gun (Elite Weapon Grant)
**Granted at:** 200 points (Upon Demon Boss spawn)
**Recipients:** Every surviving player automatically receives the Fireball Gun

| Property | Exact Value |
|---|---|
| **Ammo** | 100 rounds per player |
| **Damage** | 50 HP damage per direct hit |
| **Friendly Fire** | OFF (Cannot damage teammates) |
| **Target** | Direct offensive weapon against the Demon Boss |

---

## 4. Infection Mode — Quarantine Lab

### 4.1 Overview
**Type:** Survival Horror PvPvE — Normal players vs. Infected, transitioning into a cooperative boss raid based on match outcome.
**Map:** *Quarantine Lab* — a dedicated Infection-only arena. Not shared with Elite Mode.
**Initial State:** All players spawn as normal players. At match start, mini enemies spawn into the arena — some initially infected and others normal. Players become infected upon contact with infected enemies or infected players according to touch rules.

### 4.2 Match Flow

```
Match Start
    │
    ▼
Mini enemies spawn into Quarantine Lab (some initially infected, others normal)
    │
    ├─── Four Propagation Rules (Only infected entities spread infection):
    │         ├── 1. Infected mini enemy touches normal mini enemy → Normal mini becomes infected
    │         ├── 2. Infected mini enemy touches normal player → Normal player becomes infected
    │         ├── 3. Infected player touches normal player → Normal player becomes infected
    │         └── 4. Infected player touches normal mini enemy → Normal mini becomes infected
    │
    ├─── [Condition 1: At 60 seconds] At least 1 normal, non-eliminated player survives continuously?
    │         │
    │         └─── BRANCH 1: Spawn Infected Boss & Normalize All Players (Mutually exclusive)
    │                   │
    │                   ├── All players cooperate against Infected Boss
    │                   ├── Heart pickups spawn during boss fight
    │                   ├── Win Condition: Team wins when Infected Boss is defeated (HP = 0)
    │                   └── Loss Condition: Team loses when all players are eliminated
    │
    └─── [Condition 2: Before 60 seconds] All active players become infected?
              │
              └─── BRANCH 2: Spawn Cosmic Boss (Mutually exclusive)
                        │
                        ├── All players cooperate against Cosmic Boss
                        ├── Heart pickups spawn during boss fight
                        ├── Win Condition: Team wins when Cosmic Boss is defeated (HP = 0)
                        └── Loss Condition: Team loses when all players are eliminated
```

### 4.3 Infection Propagation Mechanics

> [!IMPORTANT]
> **Core Propagation Rule**: **Only infected entities can spread infection.** Normal entities cannot transmit infection to each other.

All four bidirectional infection interactions operate dynamically within the arena:

| # | Interaction | Touch Event | Result |
|---|---|---|---|
| 1 | **Infected Enemy → Normal Enemy** | Infected mini enemy touches normal mini enemy | Normal mini enemy **becomes infected** |
| 2 | **Infected Enemy → Normal Player** | Infected mini enemy touches normal player | Normal player **becomes infected** |
| 3 | **Infected Player → Normal Player** | Infected player touches normal player | Normal player **becomes infected** |
| 4 | **Infected Player → Normal Enemy** | Infected player touches normal mini enemy | Normal mini enemy **becomes infected** |

#### Additional Match Timing & Transition Rules
- **Initial Infection**: At match start, mini enemies spawn into the arena; some are initially infected and others are normal.
- **Mutation**: Tagged players immediately change to the infected state/team, without any additional movement-speed buff.
- **Survivor 60-Second Rule**: If at least one normal, non-eliminated player survives continuously for 60 seconds, trigger Branch 1 (Spawn Infected Boss & normalize all players).
- **Early Total Infection Rule**: If all active players become infected before the 60-second threshold is met, trigger Branch 2 (Spawn Cosmic Boss).

### 4.4 Mutually Exclusive Boss Branches

> [!IMPORTANT]
> These two branches are **mutually exclusive** — only one can trigger per match. The Hive Boss terminology is incorrect and must never be used.

#### Branch 1 — Infected Boss
**Trigger condition:** At least one normal, non-eliminated player survives continuously for **60 seconds**.
- Spawns the **Infected Boss** (2500 HP).
- **Normalizes all players** (reverts infection status back to normal).
- **Cooperation**: All players cooperate against the Infected Boss.
- **Win Condition**: Team wins when the Infected Boss is defeated (HP = 0).
- **Loss Condition**: Team loses when all players are eliminated.

| Boss Property | Approved Specification |
|---|---|
| **Health (HP)** | Exactly **2500 HP** fixed (does not scale with player count) |
| **Ability 1 — World Cutting Slash** | Deals **50 damage**; the missed/severed arena section becomes unavailable after **3 seconds** |
| **Ability 2 — Possessed Minions** | Spawns **3 possessed infected mini enemies** every **10 seconds**; each wave replaces the previous summoned set |
| **Ability 3 — Targeted Jump** | Targeted aerial jump attack with a **3-second warning telegraph** |

#### Branch 2 — Cosmic Boss
**Trigger condition:** All active players become infected **before** the 60-second survival condition is reached.
- Spawns the **Cosmic Boss** (2500 HP).
- Mutually exclusive with the Infected Boss branch.
- **Cooperation**: All players cooperate against the Cosmic Boss.
- **Win Condition**: Team wins when the Cosmic Boss is defeated (HP = 0).
- **Loss Condition**: Team loses when all players are eliminated.

| Boss Property | Approved Specification |
|---|---|
| **Health (HP)** | Exactly **2500 HP** fixed (does not scale with player count) |
| **Ability 1 — Falling Sun** | Impact creates a hazard crater; falling into the crater **instantly eliminates** a player |
| **Ability 2 — Black Hole** | Gravitational pull draws players in, freezes them for **15 seconds**, then safely returns them to the arena |
| **Ability 3 — White Hole** | Repulsive force throws players outside the map, freezes them for **15 seconds**, then safely returns them to the arena |
| **Player UI / HUD** | Displays an on-screen **15-second countdown timer** while a player is affected by Black Hole or White Hole |

### 4.5 Infection Mode Weapons & Loadout Rules
- Players can pick one of the three approved Infection weapons (Zombie Killer, Cosmic Bomb, or Raybluster).
- Exactly **one weapon per player**; **no switching** after pickup.
- **No automatic weapon grant** at boss spawn.
- Players without a weapon remain **unarmed**.
- **Heart pickups spawn during boss fights** to restore player health.
Full weapon specs are detailed in [Section 5.2](#52-multiplayer-weapon-roster).

---

## 5. Weapons & Combat Engine

### 5.1 Shared Control Binding
| Platform | Control |
|---|---|
| Mobile | Existing `#gun-btn` HUD button |
| Desktop | `Alt` key / Left-click |

Controls are shared across all multiplayer weapons. No new HUD buttons are added for weapons.

### 5.2 Multiplayer Weapon Roster

#### Weapon 1 — Zombie Killer (Infection Mode)
| Property | Value |
|---|---|
| **Ammo** | 150 rounds |
| **Damage to Infected Boss** | **100 HP** damage per hit |
| **Damage to Cosmic Boss** | **50 HP** damage per hit |
| **Usage Rule** | 1 weapon per player; no switching after pickup |

#### Weapon 2 — Cosmic Bomb (Infection Mode)
| Property | Value |
|---|---|
| **Ammo** | 150 rounds |
| **Damage to Infected Boss** | **50 HP** damage per hit |
| **Damage to Cosmic Boss** | **100 HP** damage per hit |
| **Usage Rule** | 1 weapon per player; no switching after pickup |

#### Weapon 3 — Raybluster (Infection Mode)
| Property | Value |
|---|---|
| **Ammo** | **Unlimited** ammo |
| **Damage to Either Boss** | **500 HP** damage per hit (deals 500 HP to Infected Boss or Cosmic Boss) |
| **Rarity** | **Very rare** arena drop |
| **Usage Rule** | 1 weapon per player; no switching after pickup |

#### Weapon 4 — Fireball Gun (Elite Mode Only)
See [Section 3.5](#35-fireball-gun-elite-exclusive-weapon). Exactly 100 ammo, 50 damage/shot against Demon Boss. Friendly fire OFF.

### 5.3 Damage Validation Rules
- **Host is authoritative** for all hit detection
- Host validates: hit event origin, cooldown timers, ammo counts, player alive status
- After validation, host broadcasts authoritative damage state via reliable channel
- Guests do **not** self-apply damage; they wait for host confirmation
- Friendly fire is **OFF** in both modes (players cannot damage teammates)

---

## 6. Enemy AI System

> [!NOTE]
> Enemy AI is implemented in Milestone 3. This section documents approved archetypes for reference.

### 6.1 Five Enemy Archetypes

| # | Archetype | Behaviour |
|---|---|---|
| 1 | **Chaser (Swarm / Rush)** | Direct linear tracking toward nearest player |
| 2 | **Flanker (Orbit / Ambush)** | Maintains perimeter position; dives during player vulnerability windows |
| 3 | **Sniper (Telegraphed Railgun)** | 1.2-second charge-up beam, then high-velocity projectile |
| 4 | **Bomber (Zone Denial)** | Deploys stationary proximity plasma mines |
| 5 | **Disruptor (Gravity / EMP)** | Generates localized pull field; causes temporary ability suppression |

### 6.2 Target Selection
- Algorithmic threat scoring based on: **distance**, **health ratio**, and **weapon state**
- Each archetype weights these factors differently (e.g. Sniper prioritises low-health targets; Flanker prioritises isolated targets)

### 6.3 Adaptive Difficulty Director
- Scales active enemy count and attack frequency according to active player count (1 to 8)
- Higher player count → more simultaneous enemy spawns and shorter attack intervals

---

## 7. Results & Rankings

### 7.1 End-Game Screen (Milestone 7)
| Metric | Description |
|---|---|
| MVP | Player with highest individual score / contribution |
| Damage Matrix | Damage dealt and received per player |
| Dodges Performed | Total successful dodges per player |
| Survival Duration | Time alive per player |

### 7.2 Stat Persistence
- `mpWins` and `mpLosses` stored in gamer profile (cloud-synced via `/api/gamer-profile`)
- `mpMaxLevel` updated when new Elite/Infection milestones are reached

---

## Appendix A — Map Separation Contract

| Map Name | Mode | Used By |
|---|---|---|
| Obsidian Crucible | Elite | Elite Mode only |
| Quarantine Lab | Infection | Infection Mode only |

These two maps are completely independent. Terrain, hazards, spawn points, and boss positions are unique per map. Under no circumstances should Elite hazards render on the Infection map or vice versa.

---

## Appendix B — Approved Values Summary

| Item | Exact Value | Notes |
|---|---|---|
| Elite threshold 1 | 30 pts | Smoke bombs (2s fuse, 3s duration, 20 HP damage on entry) |
| Elite threshold 2 | 70 pts | Toxic gas (every 5s, lasts 10s, 10 HP every 0.5s) |
| Elite threshold 3 | 120 pts | Stop mini enemies. Laser wall (every 15s, 60 HP damage) |
| Elite threshold 4 | 200 pts | Spawn Demon Boss (2500 HP). Stop gas & lasers. Stop scoring. Grant Fireball Gun. |
| Demon Boss HP | 2500 HP | Fixed; does not scale with player count |
| Demon Boss Fireball | 10 HP damage | Every 5.0 seconds |
| Demon Boss Pink Burst Vapor | 5 HP every 0.5s | Every 15.0s, lasts 7.0 seconds |
| Demon Boss Targeted Green Gas | 2 HP per second | Every 20.0s, lasts 30.0 seconds |
| Fireball Gun ammo | 100 rounds | Granted to all surviving players at 200 pts |
| Fireball Gun damage | 50 HP per shot | Direct hit damage against Demon Boss |
| Initial infection onset | Match start | Mini enemies spawn (some initially infected, others normal) |
| Infection propagation | 4 Touch Rules | 1) Inf enemy -> norm enemy, 2) Inf enemy -> norm player, 3) Inf player -> norm player, 4) Inf player -> norm enemy. Only infected spread. |
| Infection 60-second rule | 60 seconds | At least 1 normal player survives continuously -> Spawn Infected Boss & normalize all players |
| Early infection threshold | Before 60s | All active players infected before 60s -> Spawn Cosmic Boss (mutually exclusive) |
| Boss match win condition | Boss HP = 0 | Team wins when either boss is defeated |
| Boss match loss condition | Team wipeout | Team loses when all players are eliminated |
| Boss raid cooperation | Full co-op | All players cooperate against whichever boss spawns |
| Infection weapon choice | 1 per player | Pick 1 of 3 Infection weapons; no switching; unarmed if no pickup; no auto-grant |
| Boss fight healing | Heart pickups | Heart pickups spawn during boss fights to restore health |
| Infected Boss HP | 2500 HP | Fixed; does not scale with player count |
| World Cutting Slash | 50 damage | Missed section becomes unavailable after 3 seconds |
| Possessed Minions | 3 enemies | Spawns 3 possessed infected mini enemies every 10s (replaces previous set) |
| Targeted Jump | 3s warning | Targeted aerial jump with 3-second warning telegraph |
| Cosmic Boss HP | 2500 HP | Fixed; does not scale with player count |
| Falling Sun | Instant death crater | Falling into crater instantly eliminates player |
| Black Hole | 15s freeze | Pulls players, freezes for 15s, returns safely to arena |
| White Hole | 15s freeze | Throws players outside map, freezes for 15s, returns safely |
| Hole UI countdown | 15 seconds | Countdown displayed on affected player's screen |
| Zombie Killer ammo & dmg | 150 ammo | 100 dmg to Infected Boss; 50 dmg to Cosmic Boss |
| Cosmic Bomb ammo & dmg | 150 ammo | 50 dmg to Infected Boss; 100 dmg to Cosmic Boss |
| Raybluster ammo & dmg | Unlimited ammo | 500 dmg to either boss; very rare drop |
| Sniper charge time | 1.2 seconds | Before projectile fires |
| Max room players | 8 | Server-enforced |
| Reconnect window | 5 seconds | Host failure during active match |

---

## Appendix C — Numerical Implementation Parameters Requiring Approval Before Implementation

The following numerical values and technical parameters have **not** been approved or finalized. These must be specified and explicitly signed off before Milestone 6 coding begins.

| Item | Needed For | Status |
|---|---|---|
| Initial mini enemies: spawn count, ratio of infected vs normal, movement speeds, HP, contact damage | Milestone 6 | Unspecified |
| World Cutting Slash: slash width, orientation, and severance boundary coordinates | Milestone 6 | Unspecified |
| Targeted Jump: impact damage upon landing and AoE radius | Milestone 6 | Unspecified |
| Possessed mini enemies: HP, movement speed, contact damage | Milestone 6 | Unspecified |
| Falling Sun: crater diameter/radius, crater persistence duration, and attack cooldown | Milestone 6 | Unspecified |
| Black Hole / White Hole: cast cooldown, radius of effect, and gravitational pull/repel force | Milestone 6 | Unspecified |
| Raybluster: exact spawn rate / rarity percentage and drop location rules | Milestone 6 | Unspecified |
| Heart pickups: spawn interval and HP restored per heart during boss fight | Milestone 6 | Unspecified |
| Quarantine Lab map dimensions, boundary geometry, obstacle collision boxes, and weapon spawn positions | Milestone 6 | Unspecified |
| Boss threat targeting: targeting priority algorithm (e.g., closest player vs lowest HP vs highest damage dealer) | Milestone 6 | Unspecified |
