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

Choose **Solo table** to explore all four seats, or **Cooperative table** to create a room and share its room code. Seat ownership is per browser tab, so four tabs on one machine can hold four different specialists, as can four separate devices. Reloading a tab reclaims its seat; closing it releases the claim. All four must join before spending capability. Reading and requesting help are available while assembling the team.

### Table Screen

A cooperative room can also be mirrored on a shared screen. Open **Table screen** in the header, or visit `/?table=1&room=<code>` directly. It shows the board, objective, instability, reserves, crew status and field log, and offers a QR code per open seat so a phone can join by scanning. The table screen receives a strictly public projection: it holds no seat, sends no commands, and never receives any specialist's private engine, readings or ambition.

Phones need a network address rather than `localhost`. `npm run dev:web` binds the LAN by default and prints a `Network:` URL; open the table screen at that address and the QR codes resolve for other devices. The screen warns when it is on a loopback host whose codes cannot work.

## Play

The **?** beside each engine heading opens that specialist's rules reference: components, effect values, restrictions, cooperation examples, and the core tradeoff. The reference's specialist selector lets you inspect teammates' public rules without changing your seat. Expand **Shared actions and team rounds** for the common rules. The reference does not pause the match or reveal private state.

For a first game, choose **Solo table**, check **Guided tutorial / learn all four specialists**, then **Deploy to Greyhaven**. Twelve lessons guide real actions through a shared victory. A yellow pulsing outline marks the expected control, starting with the correct specialist when necessary; reduced-motion settings use a steady outline. **Show me where** scrolls to and focuses that control; the compass in the header pauses or resumes the guide. On mobile, **Training** returns to the current lesson. You can revisit or skip lessons without altering the match. Tutorial progress lasts for the current table, not across reloads.

Select a location on the board. Select dice, cards, or placement markers — or push the Pathfinder's bag for a surge — then choose a shared action. The commitment preview shows the authoritative rule's cost and effect. Components are not consumed until commitment.

Restore the relay to improve everyone's stabilization output. Combine Vanguard's and Wayfinder's breach readings, or investigate, to establish safe timing. Request help when needed, and preserve a die, card, token, or marker to respond to another player's action. Each core can become a permanent personal upgrade or two shared Power.

Select a map location to see your specialist's **private assessment**. Other specialists see different evidence about that same place. **Share location assessment** publishes only that assessment. Vanguard and Pathfinder can expose a patrol weakness; Pathfinder and Operator can locate an archive power cache. Any specialist can then spend their own engine capability to exploit these one-use team discoveries. Solo tables let you inspect every seat for learning; use separate cooperative clients for genuinely private play.

Every engine gains capability at the start of rounds 3 and 5, on the same clock the world escalates on, so a long mission makes the team stronger as well as the crisis worse.

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
