# Cooperative Asymmetric Board Game Web App Stack

## Recommendation

Build the first web version as a TypeScript-first multiplayer game application, not as a conventional CRUD web app.

The application should have an authoritative server, a shared deterministic rules engine, real-time multiplayer rooms, and a highly interactive browser client that preserves the feeling of a tabletop game.

## Recommended Stack

| Layer | Recommendation | Reason |
|---|---|---|
| Language | TypeScript | Shared types between rules, server, content, and client will reduce integration mistakes. |
| Frontend | React + Vite | Fast iteration and a strong component model without unnecessary framework weight for a game-heavy prototype. |
| Board and map rendering | PixiJS | Good fit for interactive 2D board surfaces, map tiles, fog of war, tokens, dice, markers, and tabletop-style motion. |
| UI panels | React components | Best fit for personal consoles, card hands, dice trays, bag controls, team resources, project trees, and modals. |
| Multiplayer server | Colyseus | Provides authoritative rooms, real-time state synchronization, player sessions, and room-based game structure. |
| Rules engine | Custom pure TypeScript package | The game needs a custom engine/plugin architecture more than a generic web framework. |
| Database | PostgreSQL | Reliable persistence for users, campaigns, save states, mission history, progression, and content metadata. |
| ORM/query layer | Drizzle ORM | Type-safe, SQL-friendly, lightweight, and suitable for a custom server architecture. |
| Validation | Zod | Useful for validating moves, scenario content, cards, upgrades, server messages, and saved game state. |
| Unit/simulation testing | Vitest | Fast TypeScript testing for rules, reducers, RNG behavior, and balance simulations. |
| Browser testing | Playwright | Good for testing multiplayer flows, UI behavior, and regressions across browser viewports. |

## Why This Stack Fits The Game

This game is built around four different player engines interacting with one shared world. The technical architecture should mirror that design.

The client should make each engine feel tactile:

- dice are visible and allocatable
- cards appear as a real hand
- bag pulls feel like drawing tokens
- action markers are placed on systems
- the shared board remains visible to the team

At the same time, the server must remain authoritative because the game includes hidden information, private objectives, asymmetric perception, multiplayer coordination, and campaign persistence.

## Core Architecture

The most important design rule is:

```txt
Player engine action -> universal game event -> shared world reducer
```

Character engines should not directly mutate arbitrary world state. They should generate universal interactions that the world can process.

Example:

```ts
type GameEvent = {
  type: "CONTRIBUTE";
  actorId: string;
  targetId: string;
  payload: {
    progress?: number;
    materiel?: number;
    power?: number;
    knowledge?: number;
    influence?: number;
  };
};
```

This lets future engines plug into the game without rewriting missions or shared systems.

## Universal Interaction Contract

The shared world should initially understand a small set of verbs:

- Move
- Engage
- Investigate
- Assist
- Contribute
- Acquire
- Recover

Each personal engine can produce those verbs differently.

Examples:

```txt
Dice engine -> allocate a 5 to Assist -> ASSIST player-3 +1 Progress
Card engine -> play Research + Channel -> INVESTIGATE +2 Knowledge
Bag engine -> draw Find + Signal -> INVESTIGATE +1 Knowledge + reveal threat
Systems engine -> place marker on Fabrication -> ACQUIRE +1 Materiel
```

## Suggested Monorepo Shape

```txt
/apps/web
  React + Vite browser client

/apps/server
  Colyseus authoritative multiplayer server

/packages/rules
  Pure TypeScript game rules, reducers, phases, RNG, move validation

/packages/content
  Missions, cards, enemies, upgrades, projects, character definitions

/packages/ui
  Shared React components used by the web client
```

## Prototype Data Model

The first version should persist only what is needed to test real play sessions:

- users or local player profiles
- game rooms
- saved matches
- scenario definitions
- player assignments
- character state
- shared world state
- team resources
- event log
- campaign/progression state, if needed later

Avoid building a large campaign system too early. The first goal is to prove that four players with four different engines can meaningfully cooperate inside one shared mission.

## What To Avoid Initially

Avoid starting with a full campaign platform, account-heavy app, marketplace, lore database, or complex inventory system.

Also avoid making the client the source of truth. Hidden information and private asymmetric views will become fragile if the browser owns the game state.

## Frameworks Considered

### Next.js

Next.js is useful for public websites, server-rendered app pages, SEO, dashboards, and content-heavy applications. This prototype is primarily a real-time interactive game surface, so React + Vite is a better starting point.

Next.js could still be added later for a public site, account area, or campaign portal.

### boardgame.io

boardgame.io is conceptually relevant because it supports tabletop-style game structure, phases, stages, multiplayer, and active players. However, its latest npm release appears old, so it is better treated as a source of architectural ideas rather than the main foundation.

For this project, Colyseus plus a custom rules package is the stronger long-term choice.

## First Build Target

The first playable web prototype should include:

- one shared map
- four connected players
- one character per engine
- one team round structure
- one mission objective
- one escalating threat track
- one private objective per player
- basic asymmetric information
- shared resources: Materiel, Power, Knowledge, Influence
- non-bankable Progress
- a small shared capability/project list
- an event log for debugging and playtest review

## Development Order

1. Build the pure rules package first.
2. Define the v0.1 mission and content as data.
3. Create a local-only React prototype that can play through one mission.
4. Add Colyseus multiplayer rooms once the rules loop works.
5. Add persistence for save/resume and playtest records.
6. Expand visuals and tabletop feel after the core loop is playable.

## Final Recommendation

Use:

```txt
TypeScript
React + Vite
PixiJS
Colyseus
PostgreSQL
Drizzle ORM
Zod
Vitest
Playwright
```

This stack supports the real needs of the design: asymmetric player consoles, hidden information, a shared authoritative world, inspectable board-game rules, extensible character engines, and multiplayer playtesting.
