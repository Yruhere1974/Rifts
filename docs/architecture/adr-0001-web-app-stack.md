# ADR-0001: Web Application Stack

## Status

Accepted for prototype planning.

## Context

The game is a cooperative asymmetric board game prototype. Each player uses a different personal gameplay engine while interacting with the same shared world.

The app must support:

- authoritative multiplayer
- hidden information
- asymmetric player perception
- private objectives
- deterministic, inspectable board-game rules
- visible tabletop metaphors
- extensible character engines
- future campaign persistence

The first prototype should stay small and prove the core interaction model before expanding campaign, content, or production infrastructure.

## Decision

Use the following stack:

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

Use a monorepo shape:

```txt
/apps/web
/apps/server
/packages/rules
/packages/content
/packages/ui
/packages/shared
```

## Rationale

TypeScript gives the project shared types across rules, server, content, and client.

React + Vite keeps the browser app fast to develop without adding server-rendering complexity that the prototype does not need.

PixiJS is a strong fit for the interactive 2D board surface: map tiles, tokens, fog of war, markers, dice, and tabletop-style animation.

Colyseus provides authoritative multiplayer rooms and real-time state synchronization while still allowing the game rules to remain custom and testable.

PostgreSQL provides durable persistence for matches, players, campaigns, snapshots, and event logs.

Drizzle keeps database access typed and SQL-shaped.

Zod validates external input, content files, save files, environment variables, and multiplayer messages.

Vitest is used for fast rules, reducer, content, and server tests.

Playwright is used for browser behavior and multiplayer flow tests.

## Alternatives Considered

### Next.js

Next.js is useful for public pages, account dashboards, SEO, and server-rendered app surfaces.

It is not the best initial fit because the prototype is mostly an interactive multiplayer game client. Most gameplay surfaces need client-side interactivity, and Vite gives a simpler development loop.

Next.js can be added later for a public website, account portal, campaign dashboard, or documentation site.

### boardgame.io

boardgame.io is conceptually relevant because it supports tabletop-style phases, stages, multiplayer, and active players.

It is not selected as the foundation because the project needs a custom asymmetric engine/plugin architecture, and the package appears less active than the rest of the proposed stack.

The project can still borrow architectural ideas from boardgame.io, especially phases, active players, and move validation.

## Consequences

The project will need to own its rules architecture instead of relying on a single board game framework.

This is acceptable because the rules architecture is central to the product.

The server must filter all per-player state before sending it to clients.

The rules package must remain independent from React, PixiJS, Colyseus, Drizzle, and browser APIs.

The first implementation should start with rules and tests before visual polish.

## Non-Goals

This decision does not commit the project to:

- a final production hosting provider
- a full campaign platform
- account management
- payment systems
- final art pipeline
- commercial Rifts licensing

## Follow-Up Decisions Needed

- ADR for multiplayer state visibility model
- ADR for content file format
- ADR for seeded RNG and replay/event log model
- ADR for deployment target once the first app scaffold exists
