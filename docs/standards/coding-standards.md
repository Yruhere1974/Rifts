# Cooperative Asymmetric Board Game Coding Standards

## Purpose

This document defines the coding standards for the web application version of the cooperative asymmetric board game.

The goal is to keep the project easy to extend as new character engines, missions, enemies, player consoles, and campaign systems are added.

## Core Engineering Principles

1. The server is authoritative.
2. The rules engine is deterministic and testable.
3. Player engines produce universal game events.
4. Shared world systems do not know about private engine internals.
5. Hidden information is never trusted to the client.
6. Content is data-driven and validated before use.
7. UI state is derived where possible, not duplicated.
8. Every gameplay rule should be testable without a browser.

## TypeScript Standards

Use strict TypeScript from the start.

Required baseline:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

Standards:

- Prefer explicit domain types over loose objects.
- Avoid `any`; use `unknown` at trust boundaries and validate it.
- Model game concepts as discriminated unions where possible.
- Keep rules functions pure: same input, same output.
- Keep random generation injectable and seedable.
- Do not use wall-clock time inside rules logic.
- Use exhaustive `switch` checks for event reducers.
- Avoid optional fields when a union variant would be clearer.

Example:

```ts
type GameEvent =
  | { type: "MOVE"; actorId: PlayerId; destinationId: LocationId }
  | { type: "INVESTIGATE"; actorId: PlayerId; targetId: EntityId; knowledge: number }
  | { type: "CONTRIBUTE"; actorId: PlayerId; projectId: ProjectId; progress: number };
```

## Linting And Formatting

Use ESLint flat config, `typescript-eslint`, React Hooks lint rules, and Prettier.

Standards:

- Formatting is handled by Prettier, not debated in review.
- ESLint handles correctness, unsafe code, React rules, and project conventions.
- Enable type-aware linting for application and rules packages.
- Enable React Hooks recommended rules.
- CI must run formatting check, lint, typecheck, unit tests, and browser tests.

Recommended scripts:

```json
{
  "scripts": {
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:e2e": "playwright test"
  }
}
```

## Monorepo Standards

Recommended shape:

```txt
/apps/web
/apps/server
/packages/rules
/packages/content
/packages/ui
/packages/shared
```

Standards:

- `/packages/rules` must not import React, PixiJS, Colyseus, Drizzle, or browser APIs.
- `/packages/content` contains validated scenario, card, enemy, project, and character definitions.
- `/apps/server` owns authorization, room lifecycle, persistence, and hidden information filtering.
- `/apps/web` owns rendering and input collection, not authoritative rule decisions.
- Shared IDs and event types live in `/packages/shared` or `/packages/rules`.

## Rules Engine Standards

The rules package is the foundation of the game.

Standards:

- Rules are pure functions.
- Moves validate input before applying state changes.
- Reducers return new state or controlled mutations using a documented pattern.
- Each rule has focused unit tests.
- Each random outcome uses seeded RNG passed into the function.
- Every public rules function accepts explicit input and returns explicit output.
- Do not read from database, network, filesystem, local storage, or global mutable state.

Preferred flow:

```txt
Client input
-> server message validation
-> rules command
-> universal game event
-> reducer
-> visibility filter
-> synchronized client state
```

## Universal Event Standards

All character engines should communicate through a small shared interaction contract.

Initial verbs:

- `MOVE`
- `ENGAGE`
- `INVESTIGATE`
- `ASSIST`
- `CONTRIBUTE`
- `ACQUIRE`
- `RECOVER`

Standards:

- Events describe what happened in game terms, not UI terms.
- Events never expose hidden state to unauthorized players.
- Events should be serializable as JSON.
- Events should be stored in the event log for debugging and replay.
- Events should use stable IDs instead of object references.

## React Standards

Use React for UI panels, player consoles, forms, cards, dice trays, bag controls, project trees, and overlays.

Standards:

- Components and hooks must be pure during render.
- Do not mutate props or state.
- Keep state as close as possible to where it is used.
- Lift state only when multiple components truly need to coordinate.
- Avoid duplicating derived state.
- Use stable keys for game entities.
- Side effects belong in event handlers, effects, or server sync layers, not render.
- Use custom hooks for reusable UI behavior, not for hiding large business logic.
- Use accessibility-first markup for buttons, inputs, dialogs, and menus.

For this game specifically:

- React components display game state; they do not decide authoritative outcomes.
- Player console components should receive a filtered player view from the server.
- UI-only state can include selected token, hovered tile, open panel, drag state, and animation state.

## Vite Standards

Use Vite for the web app build and local dev server.

Standards:

- Keep browser-only environment variables prefixed with `VITE_`.
- Never put secrets in `VITE_*` variables.
- Import static assets when they should be hashed by the production build.
- Use `/public` only for assets that must retain a stable path.
- Keep the app compatible with modern evergreen browsers unless a specific older target is required.
- In a monorepo, ensure linked packages build as ESM or configure dependency optimization explicitly.

## PixiJS Standards

Use PixiJS for the shared board, map, tokens, tile layers, fog of war, and tactile tabletop interactions.

Standards:

- Separate Pixi scene construction from game rules.
- Use containers to group board layers and entity groups.
- Prefer sprites and spritesheets for frequently rendered objects.
- Avoid constantly redrawing complex graphics.
- Avoid changing text every frame.
- Destroy Pixi objects when views unmount.
- Reuse textures where possible.
- Keep Pixi state synchronized from the filtered game view, not from private local assumptions.

Suggested scene layers:

```txt
background
map tiles
fog of war
entities
effects
selection/highlight
drag preview
```

## Colyseus Standards

Use Colyseus for authoritative multiplayer rooms and real-time state synchronization.

Standards:

- Keep room classes small.
- Put gameplay logic in `/packages/rules`, not inside room classes.
- Keep synchronized schema data as small as possible.
- Do not put heavy logic inside Colyseus `Schema` classes.
- Only the server mutates synchronized room state.
- Clients send requests; the server validates and applies them.
- Use typed room messages where possible.
- Validate every incoming message with Zod or an equivalent schema.
- Use per-player filtered views for hidden information.
- Persist important match state outside ephemeral rooms.

For this game:

- A room represents one active mission.
- The room owns connected players, seating, phase, active opportunities, and sync state.
- The event log should be persisted or exportable for playtest analysis.
- Private objectives and asymmetric perception must be sent only to authorized players.

## PostgreSQL Standards

Use PostgreSQL for durable persistence.

Standards:

- Use relational tables for stable, queryable entities.
- Use `jsonb` for flexible game snapshots, event payloads, and content metadata where shape may evolve.
- Prefer `jsonb` over `json` unless exact textual preservation is required.
- Add indexes based on real query paths.
- Use transactions for multi-table save/update operations.
- Store timestamps with time zone.
- Use database constraints for invariants that must never be violated.
- Keep schema changes in migrations.

Suggested early tables:

- `users`
- `game_rooms`
- `matches`
- `match_players`
- `match_snapshots`
- `match_events`
- `campaigns`
- `campaign_players`

## Drizzle Standards

Use Drizzle as the typed SQL layer.

Standards:

- Keep schema definitions in version control.
- Generate SQL migrations and review them before applying.
- Use `drizzle-kit migrate` for applied migrations.
- Do not use schema push against production.
- Keep database access out of rules packages.
- Prefer explicit SQL-shaped queries over hidden magic.
- Keep repository functions small and named by domain intent.

Example repository naming:

```ts
saveMatchSnapshot(...)
appendMatchEvent(...)
loadActiveRoom(...)
assignPlayerSeat(...)
```

## Zod Standards

Use Zod at trust boundaries.

Validate:

- Colyseus client messages
- scenario files
- card definitions
- character definitions
- upgrade definitions
- project/capability definitions
- imported save files
- environment variables

Standards:

- Use `safeParse` for user/client/content input.
- Use `parse` only when invalid data should throw immediately.
- Prefer `strictObject` for external input where extra keys should be rejected.
- Infer TypeScript types from schemas when the schema is the source of truth.
- Use `z.toZod<T>()` when an existing TypeScript type is the source of truth and exact schema matching matters.
- Format validation errors into useful messages for content authors and developers.

## Vitest Standards

Use Vitest for rules, content validation, utilities, and server unit tests.

Standards:

- Co-locate small tests near the module under test.
- Keep test names behavior-focused.
- Prefer real rules functions over mocks.
- Mock only boundaries such as persistence, network, clock, and RNG.
- Restore mocks between tests.
- Run `tsc --noEmit` or Vitest type tests separately because normal Vitest execution does not fully typecheck.
- Use coverage as a gap-finding tool, not as proof of correctness.

High-priority tests:

- event reducer tests
- round/phase transition tests
- hidden-information filtering tests
- each character engine's output contract
- seeded RNG repeatability tests
- content schema validation tests
- win/loss condition tests

## Playwright Standards

Use Playwright for browser behavior and multiplayer flow tests.

Standards:

- Test user-visible behavior, not implementation details.
- Use role, label, text, alt text, and test-id locators instead of brittle CSS selectors.
- Keep tests isolated with independent browser contexts.
- Use web-first assertions like `toBeVisible`.
- Avoid testing external services directly.
- Control test data.
- Record traces on CI retry, not for every passing test.
- Use one worker in CI unless the suite is proven stable with more.

High-priority browser tests:

- create/join room
- assign four players to four engines
- start mission
- complete one round
- request assistance
- send private information to only the intended player
- contribute to shared project
- hit win/loss condition

## Content Standards

Game content should be data-driven but not unstructured.

Standards:

- Define Zod schemas for every content file type.
- Validate all content in CI.
- Use stable IDs for cards, enemies, projects, locations, and upgrades.
- Keep display text separate from rule identifiers.
- Avoid hardcoding Rifts-specific names into engine logic.
- Include content versioning once save compatibility matters.

Example:

```txt
content/
  missions/
  characters/
  cards/
  bag-tokens/
  enemies/
  projects/
  private-objectives/
```

## Security And Hidden Information

Standards:

- Never send full game state to all clients.
- Never rely on the browser to hide private data.
- Server responses must be filtered by player identity.
- Event logs exposed to players must redact hidden information.
- Validate player permissions for every command.
- Treat all client messages as untrusted.

## Accessibility Standards

Standards:

- Every interactive React control needs an accessible name.
- Use semantic buttons for actions.
- Do not make clickable `div`s when a button is appropriate.
- Provide keyboard paths for core actions where practical.
- Canvas/Pixi interactions should have React-accessible mirrors for important controls.
- Color must not be the only indicator of state.

## Performance Standards

Standards:

- Optimize rules clarity before rendering micro-optimizations.
- Keep synchronized state small.
- Send events and compact views, not huge world objects, when practical.
- Avoid high-frequency updates for a discrete board game.
- Keep Pixi object counts reasonable.
- Batch visual updates from synchronized state changes.
- Profile before adding complex caching.

## Required CI Checks

Before merging meaningful code:

```txt
format:check
lint
typecheck
test
test:e2e
content:validate
```

The first prototype can start lighter, but the rules package should have tests from day one.

## Source References

- TypeScript strictness and compiler options: https://www.typescriptlang.org/docs/handbook/2/basic-types.html and https://www.typescriptlang.org/docs/handbook/compiler-options.html
- React rules, purity, and state guidance: https://react.dev/reference/rules, https://react.dev/learn/keeping-components-pure, and https://react.dev/learn/managing-state
- React Hooks linting: https://react.dev/reference/eslint-plugin-react-hooks
- Vite environment variables, assets, build, and performance: https://vite.dev/guide/env-and-mode, https://github.com/vitejs/vite/blob/main/docs/guide/assets.md, https://github.com/vitejs/vite/blob/main/docs/guide/build.md, and https://github.com/vitejs/vite/blob/main/docs/guide/performance.md
- PixiJS scene objects, containers, and performance: https://pixijs.com/8.x/guides/components/scene-objects, https://pixijs.com/7.x/guides/components/containers, and https://pixijs.com/7.x/guides/production/performance-tips
- Colyseus best practices, rooms, state sync, testing, load testing, and deployment: https://docs.colyseus.io/best-practices, https://docs.colyseus.io/room, https://docs.colyseus.io/state, https://docs.colyseus.io/tools/unit-testing/, https://docs.colyseus.io/tools/loadtest, and https://docs.colyseus.io/deployment
- PostgreSQL JSON/JSONB guidance: https://www.postgresql.org/docs/current/datatype-json.html
- Drizzle migrations: https://orm.drizzle.team/docs/migrations and https://orm.drizzle.team/docs/drizzle-kit-migrate
- Zod basics, strict mode, errors, and JSON Schema: https://zod.dev, https://zod.dev/basics, https://zod.dev/error-formatting, and https://zod.dev/json-schema
- Vitest tests, mocks, coverage, browser mode, and type testing: https://main.vitest.dev/guide/learn/writing-tests, https://github.com/vitest-dev/vitest/blob/main/docs/guide/mocking.md, https://main.vitest.dev/guide/coverage, https://main.vitest.dev/guide/browser/, and https://github.com/vitest-dev/vitest/blob/main/docs/guide/testing-types.md
- Playwright best practices, locators, isolation, and CI: https://playwright.dev/docs/best-practices, https://playwright.dev/docs/locators, https://playwright.dev/docs/browser-contexts, and https://playwright.dev/docs/ci
- typescript-eslint typed linting: https://typescript-eslint.io/getting-started/typed-linting/
- Prettier options and philosophy: https://prettier.io/docs/options and https://prettier.io/docs/option-philosophy
