# Manager Notes

## Current Ratchet

The repository now contains the first playable local vertical slice: Dimensional Stabilizer at Greyhaven. It includes the shared Pixi board, four mechanically distinct React consoles, authoritative Colyseus rooms, private readings, assistance, core upgrade/donation choices, intermingled rounds, and victory/defeat.

Work remains local on `develop` by the user's instruction. Do not push, merge to `main`, deploy, or tag a release without a subsequent request. The unrelated Household Hub push-notification recap in the conversation did not authorize changes to this game's deployment.

Local web URL: `http://localhost:5174`. Game server: port `2568`, health at `/__healthcheck`. The web server proxies `/game` to it. Existing services on 5173/2567 were left alone.

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
- Executable mission details: `docs/product/playable-slice.md`
- Visibility and lifecycle: `docs/architecture/adr-0002-prototype-visibility.md`
- Critical and comparison reviews: `docs/playtests/prototype-review.md`
- Local setup and play: `README.md`

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

Run an unscripted four-person playtest. Assess whether the engines feel different, whether requests and information sharing change decisions, whether personal upgrades are tempting, and whether anyone feels unnecessary. Preserve the tested mission while tuning from observations.

Current mission constants: 24 stabilization, 12 instability loss, six-round deadline, 1 Power per rift contribution, relay costs 2 Power and doubles output, blind work adds 5 instability, Operator priming adds 1 output. These are authored prototype numbers, not a redesign of the concept constitution.

Verification covers 18 unit tests and seven browser/network tests, including a four-browser victory, guided solo-table victory, tutorial pause/resume/reset and keyboard focus, solo loss, wire privacy, reserved-seat rejoining, shared-cost races, and desktop/mobile screenshot/canvas checks. The separate critical reviewer found no remaining concrete blocker after review fixes, including stricter lesson completion and tutorial focus restoration. The full repository check is the release gate; do not infer human enjoyment or final balance from automation.

Last local verification (2026-09-06): `npm run check` passed end to end; `npm audit --audit-level=high` reported zero vulnerabilities; `git diff --check` passed. Both the web URL and Colyseus health endpoint responded successfully.

## In Flight

- Tutorial guidance now highlights the expected control with a yellow pulse, following seat changes, component selection, actions and commits. Hold capability has an exact target. Show me where focuses the same highlighted control. Completion highlights Next lesson; pausing removes highlights. Reduced motion keeps a steady outline. Added desktop/mobile browser coverage for the reported Hold-capability discoverability issue.
- Highlight verification: formatting, lint, typecheck, build, 18 unit tests, and all six playable browser tests pass. Desktop/mobile highlight screenshots inspected. The two unchanged multiplayer tests were not rerun for this UI-only change; the suite now contains eight browser tests in total.

- Added an optional 12-lesson solo tutorial using the existing filtered view and public action log; no rule, server, or hidden-state changes. Start via the lobby checkbox; pause/resume via the header compass. Includes real-state completion checks, back/skip, control targeting, mobile Training navigation, and resolution feedback. A new table resets the guide. Guided victory and mobile lifecycle are covered by Playwright. No deployment or push authorized.

- Human playtesting and balance calibration remain outstanding.
- Rooms are ephemeral; a restart or all players leaving loses the match.
- Browser ownership keys are appropriate to local playtesting, not production account authentication.
- Production bundle emits the existing Pixi-size and upstream Zod annotation warnings; builds succeed.
- Database schema is skeletal and has no migrations yet.
- CI workflow exists but has not yet been proven by a remote GitHub run.

## Handoff

Ratcheted the first cooperative four-engine playable prototype into Rifts, locally on develop. Project concept, stack decision, coding standards, and earlier infrastructure tests are preserved.
