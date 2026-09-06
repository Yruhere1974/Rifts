# Rifts: Cooperative Prototype

One shared crisis, four different tabletop engines. The playable mission is **Dimensional Stabilizer**, set at Greyhaven.

## Run Locally

```sh
npm ci
npx playwright install chromium
```

Start the game server and web client in separate terminals from this directory:

```sh
npm run dev:server
```

```sh
npm run dev:web -- --host 0.0.0.0
```

Open **http://localhost:5174**. The game server uses port **2568**, proxied through Vite's `/game` route. These ports avoid the older local services on 5173/2567. If a port is already occupied by another application, adjust both the server/proxy configuration and Playwright configuration together.

Choose **Solo table** to explore all four seats, or **Cooperative table** to create a room and share its room code. Four separate devices or browser profiles are required for the cooperative table; a browser profile retains ownership of its chosen specialist. All four must join before spending capability. Reading and requesting help are available while assembling the team.

## Play

Select a location on the board. Select dice, cards, banked tokens, or placement markers, then choose a shared action. The commitment preview shows the authoritative rule's cost and effect. Components are not consumed until commitment.

Restore the relay to improve everyone's stabilization output. Share two independent readings or investigate to establish safe timing. Request help when needed, and preserve a die, card, token, or marker to respond to another player's action. Each core can become a permanent personal upgrade or two shared Power.

Reach **24 stabilization**, stay below **12 instability**, and finish before the **sixth round's world response**. Hold keeps capability available; Finish round forfeits remaining opportunities once confirmed. There are no individual player turns.

## Verify

```sh
npm run check
npm audit --audit-level=high
```

The check runs formatting, type-aware lint, strict TypeScript (including browser tests), content validation, unit tests, production builds, and Playwright. Browser tests launch the required servers if they are not already running. Screenshots are written under `test-results/` and are intentionally not committed.

## Project Ground Truth

- [Original game concept](docs/product/cooperative-asymmetric-board-game-concept.md)
- [Playable slice rules and acceptance evidence](docs/product/playable-slice.md)
- [Prototype visibility and room lifecycle](docs/architecture/adr-0002-prototype-visibility.md)
- [Critical review and comparison notes](docs/playtests/prototype-review.md)
- [Stack decision](docs/architecture/adr-0001-web-app-stack.md)
- [Coding standards](docs/standards/coding-standards.md)
- [Current handoff](MANAGER_NOTES.md)

This is a local playtest prototype. Matches live in server memory and end when the last participant leaves or the server restarts. PostgreSQL/Drizzle remain the existing persistence scaffold; this slice does not add accounts, campaign saves, hosting, or deployment.
