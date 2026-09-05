# Manager Notes

## Current Ratchet

The Rifts repository has been initialized with project ground truth for the cooperative asymmetric board game web application.

This repo now has a verified TypeScript monorepo infrastructure scaffold. Gameplay implementation is still intentionally minimal.

## Project Intent

Build a digital-first, web-based prototype of a cooperative asymmetric board game where each player uses a different gameplay engine while interacting with one shared world.

The first prototype should prove:

- four players can use four mechanically different engines
- all engines can interact through a shared universal event contract
- hidden and asymmetric information can be handled safely by the app
- team rounds and intermingled opportunities create meaningful cooperation
- personal advancement can compete with team advancement without encouraging griefing

## Ground Truth Documents

- Product concept: `docs/product/cooperative-asymmetric-board-game-concept.md`
- Stack recommendation: `docs/architecture/web-app-stack.md`
- Stack ADR: `docs/architecture/adr-0001-web-app-stack.md`
- Coding standards: `docs/standards/coding-standards.md`
- Repo operating model: `RATCHETING.md`

## Architectural Direction

Use a TypeScript monorepo with:

- React + Vite for the browser client
- PixiJS for the shared board/map surface
- Colyseus for authoritative multiplayer rooms
- a custom pure TypeScript rules package
- PostgreSQL for persistence
- Drizzle ORM for typed SQL access
- Zod for validation at trust boundaries
- Vitest for rules and content tests
- Playwright for browser and multiplayer flow tests

The central architecture rule is:

```txt
Player engine action -> universal game event -> shared world reducer
```

## Constraints For Future Agents

- Read `RATCHETING.md` first.
- Work on `develop` for active changes.
- Keep project-specific decisions in this repo.
- Do not put game rules inside React components or Colyseus room classes.
- Do not send full hidden game state to clients.
- Keep the first prototype small and focused on one playable mission.
- Avoid hardcoding Rifts IP into generic engine logic.

## Recommended Next Click

Build the first real v0.1 rules loop:

- define the first mission map model
- define four prototype characters, one per engine family
- expand universal events beyond the initial `MOVE`, `ACQUIRE`, and `CONTRIBUTE`
- add hidden-information filtering tests
- add the first Colyseus room integration test
- connect the web client to the server room

## In Flight

- Rules are skeletal and only cover initial universal event reducers.
- Server room exists but is not yet connected to the web client.
- Database schema is skeletal and has no migrations yet.
- CI workflow exists but has not yet been proven by a remote GitHub run.

## Handoff

Ratcheted project concept, stack decision, coding standards, and verified monorepo infrastructure into Rifts.
