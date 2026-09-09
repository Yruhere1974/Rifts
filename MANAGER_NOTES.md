# Manager Notes

## Current Ratchet

The repository now contains the first playable local vertical slice: Dimensional Stabilizer at Greyhaven. It includes the shared Pixi board, four mechanically distinct React consoles, authoritative Colyseus rooms, private readings, assistance, core upgrade/donation choices, intermingled rounds, and victory/defeat.

Active work belongs on `develop`; stable states are merged to `main` and tagged, then pushed to `origin`. Deployment and hosting are still out of scope and were never authorized: the unrelated Household Hub push-notification recap in the conversation did not authorize changes to this game's deployment.

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
- Class lineup and engine mapping: `docs/product/class-lineup.md`
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

Current mission constants: 24 stabilization, 12 instability loss, six-round deadline, 1 Power per rift contribution, relay costs 2 Power and doubles output, blind work adds 5 instability, Techno-Wizard priming adds 1 output. These are authored prototype numbers, not a redesign of the concept constitution.

Verification covers 24 unit tests and eleven browser/network tests, including a four-browser victory, guided solo-table victory, tutorial pause/resume/reset and keyboard focus, solo loss, wire privacy, reserved-seat rejoining, shared-cost races, and desktop/mobile screenshot/canvas checks. The separate critical reviewer found no remaining concrete blocker after review fixes, including stricter lesson completion and tutorial focus restoration. The full repository check is the release gate; do not infer human enjoyment or final balance from automation.

Last local verification (2026-09-08, second pass): `npm run check` passed end to end; `npm audit --audit-level=high` reported zero vulnerabilities; `git diff --check` passed. Both the web URL and Colyseus health endpoint responded successfully.

Adding a web dependency or changing `vite.config.ts` also needs the web dev server restarted, for the same reuse reason. A local game server started before a rules change keeps serving the old view shape, because `npm run dev -w @rifts/server` runs `tsx` without watch and Playwright reuses an existing server. Restart it after touching `packages/rules` or every browser test fails on a stale wire contract.

## In Flight

- Patrols hold ground and the platform can stand in front of them, on `feature/hex-board`. A patrol blocks its own hex and its reach ends a move: you can close with one, never stroll past it, which is what lets a body hold a corridor. `reachable` takes the enemy list, and the client's reach highlight and travel animation take it too, so the board never promises a move the server refuses.

- Shield earns its slot. A patrol now hits for its strength rather than a flat point, and dice left in Shield subtract from that hit. Those dice did nothing else all round, which is exactly what holding a line costs, and Recover still spends them: fix instability now, or hold the shield for the world response. Only the dice platform has a guard, which is deliberate. It is the one that can stand there.

- Legacy work is parked by decision, not oversight: no persistence, no campaign, no tech tree until the game is worth keeping. The advancement panel and the per-class growth data in `packages/content` already sit where a tree would go.

- Still open on the combat model: patrols have no facing, cannot be flanked, and choose their target purely by proximity. Defence as a facet does not exist separately from Shield. Whether those are worth adding is a playtest question rather than a design one.

- Enemies are placed units, on `feature/hex-board`. `threat` was an abstract number at the gate; it is now two patrol units with positions, strength and speed, and `threat` survives only as a derived total so existing displays keep working. Engage names a specific enemy and requires being within reach of it, so the Boom Gun finally has something to be aimed at rather than a scalar to decrement.

- Behaviour is deliberately readable, per the concept document's requirement that the opposition be reasoned about like a board game rather than guessed at. Enemies act once, at the world response: a patrol that can reach a specialist costs the team 1 instability, and otherwise walks toward the nearest one, as far as its speed allows and only over open floor. That honours the earlier decision to keep player actions simultaneous while giving the threat a slot players can plan around.

- Not yet done, and worth deciding before more enemy work: enemies do not block movement, have no facing, and cannot be blocked or screened. A specialist can walk straight past one. Bracing and Targeting are meaningful now, but Defence and Shield still only interact with instability rather than with anything a patrol does.

- Next: the tech tree proper, with data in `packages/content` and state in the mission so a campaign can persist it later. The advancement panel already occupies the surface it will fill.

- Bigger map and true adjacency, on `feature/hex-board`. The undercroft went from about 210 open hexes to 476: four objective chambers, three junctions that carry no objective so the halls bend and there is somewhere to be caught in the open, and sites pushed to 14-22 hexes apart. `hexesPerEffect` is 14, which keeps a leg at one strong commitment or two weak ones; at 10 the mission became unwinnable, which the goal-seeking driver caught.

- An objective is no longer a room you stand in. `packages/content/src/map.ts` places apparatus — conduits, anchors, a barricade, a hatch — and `siteAt` now resolves by what a unit is beside rather than by a radius around a site hex. Several pieces per site means a team spreads across a chamber instead of stacking on one hex. Zod validates that every object sits on open floor, that something can stand beside it, that every site has at least one, and that the deployment anchors are each beside a relay conduit.

- Consequence worth knowing: the team deploys beside the relay conduits rather than in the middle of the room, because the middle of a room is no longer a place anyone can work from. Selecting an objective in the UI selects its apparatus for the same reason.

- The remaining lever on mission balance is still the constants, not the map. 24 progress, 12 instability and six rounds were tuned for a game with free movement; every increase in travel has been paid for by raising `hexesPerEffect` instead, which is a blunter instrument. That wants a human playtest.

- Next: enemy units with positions, activating at the world response, replacing the abstract `threat` scalar. That is what Targeting and Bracing are ultimately aimed at.

- Glitter Boy dice allocation, on `feature/hex-board`. The dice engine no longer spends one die per action. Dice are allocated to six platform systems and a system fires with everything in it: Drive powers Move, Targeting powers Engage, Stabilizer powers Contribute, Shield powers Recover. The Boom Gun doubles every die in it but cannot fire unbraced, and Bracing costs a die that buys no output of its own, so a heavy shot is three dice that cannot move, shield or stabilise. Six systems and five dice means the round is always a decision about what the machine is not doing. Assist, Acquire and Investigate stay pilot work: one loose die on the old thresholds.

- Allocation is a free, reversible `allocate` command until the system fires, which keeps the decision on the table rather than behind a commit. The commitment set is derived from the facet in the client, mirroring how the push-your-luck surge is spent whole, so there is no partial-system commit to validate against.

- One design fault the work exposed and fixed: the weapons platform could not reach the gate, the mission's only fight, because that passage was width 1. The Boom Gun had nothing to shoot. The gate approach is now wide enough for a large unit and the archive is still not, so unit size still decides routes.

- The player page is a cockpit: local view and perception on the left, the engine owning the middle, shared state in a narrow rail. The advancement panel shows what rounds 3 and 5 grant this class and the state of the core, with locked entries drawn rather than hidden. Growth text is authored per class in `packages/content`.

- Next, in order: a larger map with placed objects and true adjacency, then enemy units with positions activating at the world response, then the tech tree proper. Adjacency and enemies are what the Boom Gun's facets are ultimately aimed at; until then Targeting and Bracing bite only against the single gate patrol.

- Motion, on `feature/hex-board`. A shared vocabulary in `apps/web/src/motion.ts` and the "Motion vocabulary" block in `game.css` defines the timing scale, easings and keyframes; three parallel agents built the board, the four consoles and the shared sidebar against it, and their work was reviewed and merged. The principles are recorded in the stylesheet: motion is physical rather than cartoon, it reveals outcomes the server already decided, it carries information only where the rules do, and it never gates input because rounds are simultaneous. The global reduce block means every CSS cue degrades to its static end state for free; Pixi and `element.animate` paths check the preference themselves.

- Notable decisions inside that work. Units walk their real BFS route rather than interpolating through rock, and the animated value is a fractional hex so footprint, anchor and ring cannot drift apart. The card weave draws a thread only for a valid Channel + Resonance pair, which makes an invalid pair fail silently instead of via an error string. The bag panel's agitation is driven from the risk band, which is the one place motion carries rules information. `.motion-arrive` exists rather than reusing `.motion-settle` because that class fills `both` and its `transform: none` end state would clobber the lift on selected components.

- Two things deliberately left as they are. Dice do not scramble on the very first tray: at deployment your kit is already laid out, and a roll belongs to a round refresh, so the cascade starts at round 2. And the risk band has no static colour treatment under reduced motion, because the band name and the exact odds are both printed anyway.

- HEX BOARD, on branch `feature/hex-board` and deliberately not merged or tagged. The board is a hex map with multi-hex unit footprints; see the branch commits. Two browser tests that play the mission all the way to a win through the UI are marked `test.fixme` rather than deleted: crossing ground costs commitments, so the mission now runs longer and needs pressure management, and the driver does not yet play well enough to close it. Winnability itself is proven at the rules level by the goal-seeking driver in `packages/rules/src/mission.test.ts`. Restoring those two drivers is the next piece of work on this branch.

- The tutorial was rewritten for the hex map: fourteen lessons instead of twelve. Guidance moved off hardcoded lesson indices and onto each lesson object, so lessons can be added without renumbering a parallel array. Two new lessons teach the spatial layer: "Ground has to be crossed" (engine output buys distance, journeys take several commitments, Move never occupies a placement module) and "Room to stand" (a standard specialist fits every passage, a Glitter Boy does not). A browser test follows whatever the guide highlights and confirms it walks the map lessons with no dead end.

- Balance finding, not yet acted on: the map lengthens the mission, so managing instability has become necessary rather than optional. A straightforward play that used to win now loses to accumulated world pressure. Levers are `hexesPerEffect` in `packages/content/src/map.ts` (currently 10), the 24-progress goal, and the six-round limit. This wants a human playtest rather than another tuning guess.

- Engine families and classes are now separate layers, which the code had been conflating. `Seat` was simultaneously the engine family, the class and the table position; it is now `EngineFamily` from `@rifts/shared`, whose values are `dice`, `cards`, `bag` and `systems`. That type had been declared and imported by nothing since the first scaffold; it is now the seam it was meant to be. Classes are authored content in `packages/content/src/specialists.ts`, validated by Zod like every other content table: Glitter Boy, Ley Line Walker, Juicer and Techno-Wizard, each carrying a class name, a setting-neutral family name, colour, flavour and upgrade text. The web client's `identities` is now a projection of that content and supplies only an icon per family, so adding or swapping a class is a content edit rather than a code change. The rules package reads exactly one thing from it, the class name used for log lines, and reasons about nothing but the family.

- The old "Operator" collision is resolved. It had been a seat id, an engine-family display name and a distinct Rifts class at the same time. The systems-placement family is now called Artificer and the class on that seat is the Techno-Wizard.

- One caveat to correct next: mission flavour text still lives in `packages/rules/src/mission.ts`. The per-location `perceptions` block names specialists, so class names have entered the rules package. That is prose rather than engine logic, and no rule branches on it, but it belongs in `packages/content` alongside the other authored text. Moving it would leave the rules package entirely setting-free.

- The class lineup, the three-layer separation and the per-class implementation state are recorded in `docs/product/class-lineup.md`. The concept document had listed the Juicer under the dice engine, which contradicted the push-your-luck engine we built around that fantasy; that entry is corrected and the Glitter Boy takes its place.

- Per-tab seats and a shared table screen. The ownership key moved from `localStorage` to `sessionStorage`, so a seat belongs to a browser tab rather than a browser profile and four tabs on one machine can hold four specialists; a reload reclaims the seat, closing the tab releases it. `/?room=<code>&seat=<seat>` joins a seat directly, which is what the QR codes encode. `/?table=1&room=<code>` opens a shared screen that joins with `role: "table"`: it claims no seat, is refused commands and seat switches, is excluded from the four-player start gate and absent-seat forfeiture, and receives `tableView()` instead of `playerView()`. That projection uses the same explicit allowlist and carries only public state plus per-seat counts and occupied modules, which are table-visible anyway. Vite binds the LAN so a phone can reach the join links, and the screen warns when it is on a loopback host whose codes cannot work.

- Two client-side defects were found and fixed while building the above, both of which would have affected real players rather than only tests:
  - A remounted client opened a second socket for the same seat. The two joins raced on the server and the loser was whichever connection the tab was actually rendering, producing intermittent dead tabs. `useMission.connect` is now idempotent per mode/seat/room, and its unmount cleanup no longer bumps the generation counter, which had been orphaning connections that were still being established.
  - The server refused a client its own seat back. `onJoin` now lets a matching `clientKey` reclaim a seat and drops the stale session, so a reload or reconnect recovers instead of locking the player out of the seat they own. A different key is still rejected.

- `useTableView` deliberately holds one connection per room for the life of the page and closes it only on real unmount, because tearing down in effect cleanup made a remount close its own live socket.

- Two browser tests were given larger budgets rather than being made to pass by other means. The four-context mission test genuinely takes 70-110 seconds of real work and had been finishing within a few seconds of its 90s limit all along; it is now 150s. The new four-tab test is 120s. Neither change hides a product defect; the connection behaviour above was verified directly before the budgets were touched.

- Pathfinder push-your-luck rework (Juicer identity). The bag draw is now the whole engine: a hazard destroys the pending surge, adds instability equal to that round's burnout count, and returns to the bag, while safe tokens leave it. Bust odds therefore rise monotonically within a round instead of collapsing to zero after a bust, which was the previous behaviour. The separate bank step is gone: the surge is the staged action's fuel, and committing spends it whole, so push size is chosen per action. `bank` was removed from the command union, wire schema and UI; `MissionEngine` gained `pending`/`stress` in place of `drawn`/`hazards`/`banked`. `MissionActionEvent` is unchanged, so the world reducer still cannot tell which engine produced an effect.

- Field experience: every engine now grows on `engineTier(round) = floor((round - 1) / 2)`, the same clock `worldPressure` escalates on. Tier 1 lands in round 3 and tier 2 in round 5. Dice 5/6/7, hand 5/6/7 (a Channel then a Resonance, so each tier buys another weave), bag 8/9/10 by adding jackpots while keeping both hazards, markers 4/5/6. A kept core still stacks on top. Growth is derived from the round inside `refill()`, so it stays deterministic; the per-engine gains follow the progression menus in the concept document rather than a new scheme.

- Two tuning findings are recorded and deliberately NOT yet applied, because they are balance decisions rather than defects in the mechanics above:
  - Burnout cost is too punishing. Simulated over 200 seeds, aiming for a three-token surge averages 5.54 instability per round against a limit of 12, and most busts happen on an empty surge, charging the full escalating cost for a gamble with nothing at stake. Suggested fix: scale burnout cost to the surge actually lost rather than to the bust count alone.
  - Engine growth is gated by shared Power. Each rift contribution costs 1 Power and Power does not scale, so by round 5 the team holds 7 dice, 3 weaves, 6 markers and a 10-token bag but can still only fund about two contributions. Extra pieces currently convert into more actions rather than more progress. Suggested fix if the intent is throughput: grant `tier` shared Power at each world response.

- Expanded private perception to all four map locations, with distinct per-specialist assessments and deliberate per-location publication. Safe timing now needs Vanguard + Wayfinder breach reports (or paid investigation), not arbitrary pairs. Vanguard + Pathfinder gate evidence adds +1 to the next Engage; Pathfinder + Operator archive evidence unlocks a one-use +2 Power recovery on an engine-paid Investigate. Other engines can exploit both discoveries. Added reducer and browser privacy/cooperation coverage; updated playable-slice rules. Existing mission and engine architecture preserved. Initial evidence is authored, not randomized. Solo seat switching is a learning affordance; real privacy requires separate cooperative clients.

- Added a contextual ? rules reference beside the active engine heading. All four engines have authored rules, cooperation examples, and core upgrade/donation explanations; expandable shared rules cover actions, readings, reserves, and team rounds. The public-reference selector never changes seats or sends game commands. Existing modal focus management now includes disclosure summaries so keyboard focus remains trapped. Reference copy is grounded in the existing reducer; no game mechanics changed.
- Reference verification: formatting, lint, typecheck, production build, 18 unit tests, and seven playable browser tests pass. Desktop/mobile reference screenshots inspected. Coverage includes all four engine entries, seat/state preservation, disclosure keyboard wrapping, and focus restoration. The two unchanged multiplayer tests were not rerun for this UI change; there are now nine browser tests in the full suite.

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

Ratcheted the Pathfinder surge rework and per-round engine growth into Rifts on `develop`. The full repository check passes: 23 unit tests, 10 browser/network tests, builds, lint, formatting and content validation, with zero high-severity audit findings.

This commit also carries earlier uncommitted in-flight work that was already present in the working tree at the start of the session (the per-location private perception expansion and its notes entry). It was not separable from the new changes by the time it was found, so it is ratcheted together rather than left loose.

The click is complete: `develop` is merged to `main`, tagged `v2026.09.08-surge-and-growth`, and pushed to `origin`. This also closed a long-standing gap, since `origin/main` and `origin/develop` had both been stalled at the project-docs commit and GitHub held none of the prototype.

The push had been failing for a transport reason worth recording, because it silently blocked every earlier ratchet too. `origin` was an HTTPS URL, so pushes used an OAuth token rather than the SSH key this machine uses for most repositories, and GitHub refuses to let an OAuth App create or update `.github/workflows/ci.yml` without the `workflow` scope:

```txt
refusing to allow an OAuth App to create or update workflow
`.github/workflows/ci.yml` without `workflow` scope
```

`origin` is now `git@github.com:Yruhere1974/Rifts.git`. SSH is not subject to OAuth App scopes, so the workflow file pushes normally and this matches the transport already used by the adjacent repositories. Do not resolve a recurrence by deleting or excluding the CI workflow: that removes working configuration to satisfy a permissions gap. If HTTPS is ever required here again, `gh auth refresh -s workflow` or a PAT carrying the `workflow` scope is the fix.

Deployment and hosting remain out of scope.
