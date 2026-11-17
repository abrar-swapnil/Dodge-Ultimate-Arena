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
**Win Condition:** Defeat the Demon Boss after it awakens at 200 points.
**Loss Condition:** All players eliminated before the boss is defeated.

### 3.2 Score Thresholds & Phase Transitions

> [!IMPORTANT]
> These thresholds are exact and final. Do not alter them.

| Global Team Score | Event |
|---|---|
| **30 points** | Arena smoke screens activate; first environmental hazard rotation begins |
| **70 points** | Poison gas zones contract arena boundaries; **Fireball Gun** weapon spawns |
| **120 points** | Grid lasers activate; **Demon Boss awakens** (Phase 1 begins) |
| **200 points** | **Demon Boss Enrage Phase** triggers; defeating the boss achieves team Victory |

- Score is a **global team score** — all surviving players contribute to it collectively
- Thresholds are evaluated by the host and broadcast via `PHASE_TRANSITION` on the reliable channel

### 3.3 Environmental Hazards

| Hazard | Activation Threshold | Description |
|---|---|---|
| Smoke Screens | 30 pts | Synchronized rotating obscuration zones; reduce player visibility |
| Gas Zones | 70 pts | Creeping poison gas contracts playable arena boundary; players outside take continuous damage |
| Grid Lasers | 120 pts | Sweeping laser grid crosses the arena floor; contact deals burst damage |

- Hazards are cumulative — once activated they remain active for the rest of the match
- Hazard timing and positions are determined by the host and broadcast to guests

### 3.4 Demon Boss

**Awakens at:** 120 points (Phase 1)
**Enrages at:** 200 points (Enrage Phase)

#### Abilities
| Ability | Phase | Description |
|---|---|---|
| Flame Waves | Phase 1 & Enrage | Radiating fire wave rings expanding outward from boss position |
| Hellfire Rain | Phase 1 & Enrage | Targeted projectile barrage at player positions |
| Enrage Charge | Enrage only | High-speed dash charge at nearest player; significantly increased speed and damage |

#### Boss Mechanics
- Boss health scales with active player count at time of awakening
- Boss targets the player with the highest individual score (threat priority)
- Host is authoritative over all boss hit detection and health broadcast
- Boss defeat triggers match Victory screen for all players

### 3.5 Fireball Gun (Elite-Exclusive Weapon)
**Spawns at:** 70 points

| Property | Value |
|---|---|
| Damage type | Explosive area splash |
| Pickup | Single world-spawn pickup in the Obsidian Crucible arena |
| Effect | Explosion damages enemies in a radius; friendly fire is OFF |

> [!NOTE]
> Exact damage values, splash radius, and cooldown for the Fireball Gun are **not yet specified** in approved documents. These must be defined and approved before Milestone 6 implementation.

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
    ├─── [Before 60 seconds] All Survivors infected?
    │         └─── BRANCH 1: Infected Boss spawns ──► Infected team wins if boss is defeated
    │
    └─── [At 60 seconds] At least 1 Survivor still alive?
              └─── BRANCH 2: Cosmic Boss invades ──► Survivors win if they defeat Cosmic Boss
```

### 4.3 Infection Mechanics

| Mechanic | Detail |
|---|---|
| Grace period | **10 seconds** at match start — no infection can spread |
| Alpha Infected | 1 player randomly selected at grace period end |
| Alpha Infected attributes | Increased movement speed; can perform melee infection strike |
| Infection strike | Direct contact with a Survivor tags them; they mutate into Infected team |
| Mutation | Tagged Survivor immediately joins Infected team with same speed buff |
| Survivor 60-second rule | If **any** Survivor remains alive at the 60-second mark, the survival threshold is triggered |
| Extraction on 60-second survival | Extraction pod and defensive power weapons deploy into the arena |

### 4.4 Mutually Exclusive Boss Branches

> [!IMPORTANT]
> These two branches are **mutually exclusive** — only one can trigger per match. The Hive Boss terminology is incorrect and must never be used.

#### Branch 1 — Infected Boss
**Trigger condition:** The Infected team completely overtakes **all** Survivors **before** the 60-second timer expires.

| Property | Detail |
|---|---|
| Faction | Fights alongside the Infected team against any remaining defenders |
| Win condition | Infected team + boss defeat all remaining resistance |

> [!NOTE]
> Exact Infected Boss ability names, damage values, and health values are **not yet specified** in approved documents. These must be defined and approved before Milestone 5 implementation.

#### Branch 2 — Cosmic Boss
**Trigger condition:** At least 1 Survivor holds out past the **60-second threshold** and triggers the beacon.

| Property | Detail |
|---|---|
| Faction | Alien entity invades the Quarantine Lab facility — fights all players (both Survivors and Infected) |
| Win condition | Survivors defeat the Cosmic Boss |

> [!NOTE]
> Exact Cosmic Boss ability names, damage values, and health values are **not yet specified** in approved documents. These must be defined and approved before Milestone 5 implementation.

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
| Elite threshold 1 | 30 pts | Smoke screens |
| Elite threshold 2 | 70 pts | Gas zones + Fireball Gun spawn |
| Elite threshold 3 | 120 pts | Grid lasers + Demon Boss Phase 1 |
| Elite threshold 4 | 200 pts | Demon Boss Enrage |
| Infection grace period | 10 seconds | No infection spreading |
| Infection 60-second rule | 60 seconds | Survivor threshold for Cosmic Boss branch |
| Cryo Freeze-Ray slow | 50% movement speed | Stacking |
| Sniper charge time | 1.2 seconds | Before projectile fires |
| Max room players | 8 | Server-enforced |
| Reconnect window | 5 seconds | Host failure during active match |

---

## Appendix C — Values Requiring Approval Before Implementation

The following mechanics have been named but their exact numeric values have **not** been approved. These must be specified and signed off before the respective milestone begins coding.

| Item | Needed For |
|---|---|
| Fireball Gun: damage, splash radius, cooldown, ammo | Milestone 6 |
| Scatter Shotgun: pellet count, spread, range, damage, knockback, ammo | Milestone 6 |
| Plasma SMG: fire rate, damage, heat capacity, overheat duration, ammo | Milestone 6 |
| Cryo Freeze-Ray: range, slow duration, energy drain, damage (if any) | Milestone 6 |
| Infected Boss: health, abilities, damage values | Milestone 5 |
| Cosmic Boss: health, abilities, damage values | Milestone 5 |
| Demon Boss: health (per player count), ability damage values | Milestone 4 |
| Elite hazard damage per tick (gas zones, lasers) | Milestone 4 |
| Infection weapon spawn positions on Quarantine Lab map | Milestone 5 |
