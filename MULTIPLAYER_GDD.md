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
**Type:** Survival Horror PvPvE — Survivors vs. Infected team, with an environmental boss spawning based on match outcome.
**Map:** *Quarantine Lab* — a dedicated Infection-only arena. Not shared with Elite Mode.
**Teams:** Survivors (most players) vs. Infected (starts as 1 player, grows via tagging).

### 4.2 Match Flow

```
Match Start
    │
    ▼
[10-second grace period — no infection spreading]
    │
    ▼
1 player randomly designated as Alpha Infected
    │
    ├─── Alpha Infected tags Survivors → Survivors mutate into Infected
    │         (repeating; Infected team grows)
    │
    ├─── [Condition 1: At 60 seconds] At least 1 normal, non-eliminated player survives continuously?
    │         └─── BRANCH 1: Spawn Infected Boss & Normalize All Players (Mutually exclusive)
    │
    └─── [Condition 2: Before 60 seconds] All active players become infected?
              └─── BRANCH 2: Spawn Cosmic Boss (Mutually exclusive)
```

### 4.3 Infection Mechanics

| Mechanic | Detail |
|---|---|
| Grace period | **10 seconds** at match start — no infection can spread |
| Alpha Infected | 1 player randomly selected at grace period end |
| Alpha Infected attributes | Increased movement speed; can perform melee infection strike |
| Infection strike | Direct contact with a Survivor tags them; they mutate into Infected team |
| Mutation | Tagged Survivor immediately joins Infected team with same speed buff |
| Survivor 60-second rule | If at least one normal, non-eliminated player survives continuously for 60 seconds, trigger Branch 1 (Spawn Infected Boss & normalize all players) |

### 4.4 Mutually Exclusive Boss Branches

> [!IMPORTANT]
> These two branches are **mutually exclusive** — only one can trigger per match. The Hive Boss terminology is incorrect and must never be used.

#### Branch 1 — Infected Boss
**Trigger condition:** At least one normal, non-eliminated player survives continuously for **60 seconds**.
- Spawns the **Infected Boss**.
- **Normalizes all players** (reverting infection state).

> [!NOTE]
> Exact Infected Boss health, ability names, cooldowns, damage values, targeting behavior, post-normalization player mechanics, and match victory/loss conditions are **unresolved / not yet specified** and are flagged in Appendix C.

#### Branch 2 — Cosmic Boss
**Trigger condition:** All active players become infected **before** the 60-second survival condition is reached.
- Spawns the **Cosmic Boss**.
- Mutually exclusive with the Infected Boss branch.

> [!NOTE]
> Exact Cosmic Boss health, ability names, cooldowns, damage values, targeting behavior, player state/faction rules upon spawn, and match victory/loss conditions are **unresolved / not yet specified** and are flagged in Appendix C.

### 4.5 Infection Mode Weapons (Three Dedicated Weapons)
Weapon availability, ammo, and spawn points are specific to the Quarantine Lab map.
Full weapon specs are in [Section 5](#5-weapons--combat-engine).

---

## 5. Weapons & Combat Engine

### 5.1 Shared Control Binding
| Platform | Control |
|---|---|
| Mobile | Existing `#gun-btn` HUD button |
| Desktop | `Alt` key / Left-click |

Controls are shared across all multiplayer weapons. No new HUD buttons are added for weapons.

### 5.2 Multiplayer Weapon Roster

#### Weapon 1 — Scatter Shotgun
| Property | Value |
|---|---|
| Type | Close-range pellet spread |
| Secondary effect | Strong knockback on hit targets |
| Mode | Infection Mode |

> [!NOTE]
> Exact pellet count, spread angle, range, damage per pellet, knockback force, and ammo count are **not yet specified**. Must be approved before Milestone 6.

#### Weapon 2 — Plasma SMG
| Property | Value |
|---|---|
| Type | Rapid-fire energy projectile |
| Overheat mechanic | Heat gauge — overheating forces a cooldown pause |
| Mode | Infection Mode |

> [!NOTE]
> Exact fire rate, damage per shot, heat gauge capacity, overheat duration, and ammo count are **not yet specified**. Must be approved before Milestone 6.

#### Weapon 3 — Cryo Freeze-Ray
| Property | Value |
|---|---|
| Type | Continuous beam |
| Effect | Stacks **50% movement speed slow** on target |
| Mode | Infection Mode |

> [!NOTE]
> Exact beam range, slow duration, slow falloff, ammo/energy drain rate, and damage (if any) are **not yet specified**. Must be approved before Milestone 6.

#### Weapon 4 — Fireball Gun (Elite Mode Only)
See [Section 3.5](#35-fireball-gun-elite-exclusive-weapon).

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
| Infection grace period | 10 seconds | No infection spreading |
| Infection 60-second rule | 60 seconds | At least 1 normal player survives continuously -> Spawn Infected Boss & normalize all players |
| Cryo Freeze-Ray slow | 50% movement speed | Stacking |
| Sniper charge time | 1.2 seconds | Before projectile fires |
| Max room players | 8 | Server-enforced |
| Reconnect window | 5 seconds | Host failure during active match |

---

## Appendix C — Values and Unresolved Mechanics Requiring Approval Before Implementation

The following mechanics, numerical values, and design questions have **not** been approved or finalized. These must be specified and explicitly signed off before Milestone 6 coding begins.

### C.1 Missing Numerical Values (Infection Mode & Weapons)
| Item | Needed For | Status |
|---|---|---|
| Infected Boss: health (HP), movement speed, ability cooldowns, damage values, hitboxes | Milestone 6 | Unspecified |
| Cosmic Boss: health (HP), movement speed, ability cooldowns, damage values, hitboxes | Milestone 6 | Unspecified |
| Scatter Shotgun: pellet count, spread angle, effective range, damage per pellet, knockback force, ammo count | Milestone 6 | Unspecified |
| Plasma SMG: fire rate, projectile speed, damage per shot, heat capacity, overheat cooldown, ammo count | Milestone 6 | Unspecified |
| Cryo Freeze-Ray: beam range, slow duration, slow falloff, energy/ammo drain rate, damage (if any) | Milestone 6 | Unspecified |
| Quarantine Lab map dimensions, boundaries, obstacle collision boxes, and weapon spawn positions | Milestone 6 | Unspecified |

### C.2 Unresolved Design Contradictions & Gameplay Rules
| Topic | Unresolved Issue / Question | Status |
|---|---|---|
| **Infected Boss Victory Conditions** | When Infected Boss spawns after 60s survival and players are normalized, what is the team objective and win/loss condition? (e.g., Do all normalized players cooperate to defeat the Infected Boss? Does the round end if all players die?) | Awaiting User Approval |
| **Cosmic Boss Victory Conditions** | When Cosmic Boss spawns after all active players become infected before 60s, what is the win/loss condition? (e.g., Do infected players fight the Cosmic Boss together, or does infected status persist with a different objective?) | Awaiting User Approval |
| **Post-Normalization Player Mechanics** | When all players normalize upon Infected Boss spawn, what are their baseline stats, weapons, and abilities? | Awaiting User Approval |
| **Boss Targeting Rules** | How do the Infected Boss and Cosmic Boss prioritize targets among active players? | Awaiting User Approval |
