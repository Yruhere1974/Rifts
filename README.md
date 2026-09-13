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

Choose **Solo table** to explore all four seats in one tab, or **Cooperative table** to open a mission from its **master tab**.

A cooperative table is opened for a number of people, not a number of characters: the mission is always four specialists, and the player count decides how many each person claims. Two players take two each, four take one each. Opening a table mints a **four-digit code**; anyone who types it into **Cooperative table** lands in the same lobby. The host watches the crew arrive and presses **Start the mission**, which is when the map opens.

The master tab is the page a cooperative mission is opened from and the one that stays open beside it. It carries the mission brief and the master map, and it holds no seat: it never counts toward the four, never gates the round and is never forfeited. Its crew roster claims specialists, and claiming one opens that specialist's console in its own browser tab. So each player ends up with two tabs — the map they plan on, and the unit they run — and switches between them rather than between screens. The solo table keeps the single-tab switch instead.

A master tab may draw on the map as a seat its own browser has claimed, because the console it spawns inherits its client key and the server can tell they are one person. A shared screen owns nothing and stays read-only. Seat ownership is per browser tab, so four tabs on one machine can hold four different specialists, as can four separate devices. Reloading a tab reclaims its seat; closing it releases the claim. All four must join before spending capability. Reading and requesting help are available while assembling the team.

### Engines

The Glitter Boy's dice are thrown across the tray at the start of each round and settle into routing order, low to high, because routing surge to a system browns out every loose die showing lower.

The Techno-Wizard's components drop into the supply rail.

The Juicer's tokens are pulled out of the bag and turn over as they land, so what a push found is the last thing to read.

The Ley Line Walker deals from a ley network of 21 links rather than from a fixed list, so no two missions open on the same hand. Woven links return to the network and are shuffled back in when it runs out, and the count beside the hand is how much is left.

### Master Map

Deploying opens the **master map**, not the cockpit. It is where the mission is laid out before anything is spent: the brief states what the team is there to do, and the planning window is already open. **Take your seat** moves on to your console, and the mission does not come back here on its own — **Master map** in the header reopens it at any time, or visit `?map=1`.

The brief names four objectives. Only one is scored — 24 stabilization at the breach before the sixth round ends — and the other three are the difference between closing the breach cheaply and not closing it at all. Each one reads live off the same public state the cockpit shows, and each names the briefing mark that claims to say where it is; pointing at an objective lights that mark on the drawing.

Below the brief, the map shows the outline of the undercroft and nothing else: no apparatus, no patrols, no units. The only things on it are marks somebody put there.

The mission places its own, from the briefing. How tightly a mark draws is how sure planning was — a point, a small area, or a soft region. Whether it is _true_ is not shown. Walking a specialist up to a mark settles it: it is confirmed, or struck through because the briefing was wrong. One mark per match is wrong, and which one depends on the table.

Draw during a planning window, which is open at deployment and again after every world response, and closes when the round starts being spent. **Mark** labels one hex; **Route** strings waypoints together and prices them in hexes and commitments, turning red when a patrol moves into the line. Ink stays until somebody erases it, and anyone can erase anything. **Point** works at any time and fades on its own.

Drawing is pointing, not proving. It costs nothing and the game does not read it; only publishing a location assessment is evidence, and only evidence triggers a team discovery.

### Table Screen

A cooperative room can also be mirrored on a shared screen. Open **Table screen** in the header, or visit `/?table=1&room=<code>` directly. It shows the board or the master map, objective, instability, reserves, crew status and field log, and offers a QR code per open seat so a phone can join by scanning. The table screen receives a strictly public projection: it holds no seat, sends no commands, and never receives any specialist's private engine, readings or ambition.

Phones need a network address rather than `localhost`. `npm run dev:web` binds the LAN by default and prints a `Network:` URL; open the table screen at that address and the QR codes resolve for other devices. The screen warns when it is on a loopback host whose codes cannot work.

## Play

The **?** beside each engine heading opens that specialist's rules reference: components, effect values, restrictions, cooperation examples, and the core tradeoff. The reference's specialist selector lets you inspect teammates' public rules without changing your seat. Expand **Shared actions and team rounds** for the common rules. The reference does not pause the match or reveal private state.

For a first game, choose **Solo table**, check **Guided tutorial / learn all four specialists**, then **Deploy to Greyhaven**. Fourteen lessons guide real actions through a shared victory, including two on the hex map itself: how far a commitment carries you, and why a large specialist has fewer routes than a small one. A yellow pulsing outline marks the expected control, starting with the correct specialist when necessary; reduced-motion settings use a steady outline. **Show me where** scrolls to and focuses that control; the compass in the header pauses or resumes the guide. On mobile, **Training** returns to the current lesson. You can revisit or skip lessons without altering the match. Tutorial progress lasts for the current table, not across reloads.

The board is a hex map. Select an objective from the strip beneath it, or a hex directly, to choose where to act; when Move is staged, the hexes your commitment could reach are highlighted. Select dice, cards, or placement markers — or push the Juicer's bag for a surge — then choose a shared action. The commitment preview shows the authoritative rule's cost and effect. Components are not consumed until commitment.

Restore the relay to improve everyone's stabilization output. Combine Glitter Boy's and Ley Line Walker's breach readings, or investigate, to establish safe timing. Request help when needed, and preserve a die, card, token, or marker to respond to another player's action. Each core can become a permanent personal upgrade or two shared Power.

Select a map location to see your specialist's **private assessment**. Other specialists see different evidence about that same place. **Share location assessment** publishes only that assessment. Glitter Boy and Juicer can expose a patrol weakness; Juicer and Techno-Wizard can locate an archive power cache. Any specialist can then spend their own engine capability to exploit these one-use team discoveries. Solo tables let you inspect every seat for learning; use separate cooperative clients for genuinely private play.

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
- [Class lineup and engine mapping](docs/product/class-lineup.md)
- [Playable slice rules and acceptance evidence](docs/product/playable-slice.md)
- [Master map design](docs/product/master-map.md)
- [Prototype visibility and room lifecycle](docs/architecture/adr-0002-prototype-visibility.md)
- [Critical review and comparison notes](docs/playtests/prototype-review.md)
- [Stack decision](docs/architecture/adr-0001-web-app-stack.md)
- [Coding standards](docs/standards/coding-standards.md)
- [Current handoff](MANAGER_NOTES.md)

This is a local playtest prototype. Matches live in server memory and end when the last participant leaves or the server restarts. PostgreSQL/Drizzle remain the existing persistence scaffold; this slice does not add accounts, campaign saves, hosting, or deployment.
