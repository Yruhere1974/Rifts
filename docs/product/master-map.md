# Master Map

## Status

**The Surface is built.** Everything from "What It Is" to "Persistence And Erasure" is implemented and covered by tests. **Refining A Plan is still design**, and its "do not build yet" condition stands.

The concept document remains authoritative for the engine families, the universal interaction contract and the design constitution. `playable-slice.md` remains authoritative for the mission's rules and numbers. This document adds a surface and changes neither.

It is deliberately split. **The Surface** is built and can be judged on its own. **Refining A Plan** is designed but withheld: it adds cost to a surface nobody has used yet, and building it before the first has been played would be guessing. The split exists so this lands in two clicks rather than one large maybe.

One rule changed while building, and the document records the rule as built. Resolution reach was going to include the claim's spread; that made a vague claim resolve from _further away_ than a precise one, which is backwards, and it let a wide claim settle from the deployment anchors without anyone walking anywhere. See **Briefing Markers**.

## What It Is

A separate page showing the outline of the undercroft and nothing else: the boundary of the 476 open hexes as one continuous shape, with no chambers named, no apparatus, no patrols and no units. Empty ground of a known size.

It is not a second view of the board. The board shows what is true now; the master map shows what the team believes and has decided. Those are different objects and conflating them is the mistake to avoid.

The page is reached by query parameter rather than a route, so it needs no SPA fallback: `?map=1` on a seat's own page, and a Master map control in the header. It is its own screen rather than a second socket, because a seat belongs to a browser tab and a second tab would claim a second seat. The console stays mounted behind it rather than unmounting, so opening the map does not tear down and rebuild the board's WebGL context.

A shared screen carries the same surface read-only, at `?table=1&room=<code>`: it holds no seat, so it cannot draw, erase or point.

## The Visibility Rule

Nothing appears on the master map unless it is in everyone's view.

The rule needs no enforcement machinery, because every source of marks is public by construction:

- briefing markers are public because every specialist received the same briefing
- ink is public the moment it is drawn, on a surface all four are looking at
- derived marks come from published reports, which are already public

Private assessments never reach this page. That is the same discipline `tableView()` applies with an explicit allowlist, and the master map should be built the same way: constructed field by field, never spread from mission state.

One consequence is deliberate and should not be treated as a leak. A specialist can draw a circle around something only they can see, and thereby tell the team without using `share`. See **Pointing And Proving**.

## What Appears On It

| Source           | Placed by                                   | Lifetime             | Public because                 |
| ---------------- | ------------------------------------------- | -------------------- | ------------------------------ |
| Briefing markers | The mission, authored in `packages/content` | Until struck through | Everyone received the briefing |
| Ink              | Any specialist, in a planning window        | Until erased         | Drawn on a shared surface      |
| Derived marks    | The game, when reports converge             | Until erased         | Published reports are public   |
| Pings            | Any specialist, at any time                 | Seconds              | Transient, seen by all         |

## Briefing Markers

A mission places its own marks, because a team that planned an operation knows roughly what it expects to find and where. This is what keeps the map from being empty at deployment, and it gives the page a job beyond note-taking: the master map is the difference between what planning expected and what the field found.

**Precision and reliability are separate axes, and only one of them is visible.**

Precision is how tightly the briefing localises a thing, and it reuses the status vocabulary already in `MissionIntel` rather than inventing a parallel scheme. `known` draws as a point on a hex, `inferred` as a small area, `uncertain` as a soft region over a large part of a chamber.

Reliability is whether the marker is true at all, and it is never shown. A `known` marker is therefore the most dangerous object on the page: the team trusts it, commits two rounds of travel to it, and finds bare rock. An `uncertain` marker that turns out to be wrong costs nothing, because nobody bet on it.

Markers can be wrong. They are not necessarily wrong, and there is no way to tell by looking.

**Where the lie lives.** Author which markers are _capable_ of being wrong; seed which one actually is, from the existing `createMission(seed)`. Pure authoring is the house style, but it spoils on the second play of a one-mission prototype, because the team would simply remember. The authored candidate list keeps the liar always plausible; the seed keeps each match honest.

**Reach is independent of spread.** A claim settles when a specialist gets within `size + 1` of the hex it names, whatever its precision. Counting the drawn spread would let an `uncertain` claim resolve from eight hexes away while a `known` one needed three, which is backwards: a vague claim should be harder to check, not easier. The spread says how sure planning was; the truth is still at one hex and somebody has to stand beside it.

A marker that is disproved is struck through, not deleted. "We looked, there is nothing here" is worth as much to the team as finding something, and it stops three other people walking the same ground.

## Pointing And Proving

Ink and published reports both move information, and the distinction between them is what stops the two surfaces competing:

- **Ink is pointing.** It is free, instant, and gets teammates looking at the right hex. The game does not read it and nothing mechanical follows from it.
- **A published report is proving.** It is deliberate, tracked, once per specialist per location, and it is the only thing that fires the paired discoveries in `playable-slice.md`.

So drawing a circle and saying "the cache is here" is legitimate and useful, and it is not a substitute for publishing. The team gets the attention; only the report gets the bonus.

## Routes

A line drawn from a unit to a destination is the one piece of ink worth making more than ink. It should come back costed: hexes, and the number of commitments those hexes represent at `hexesPerEffect`.

The pathing exists. `reachable()` already walks a footprint-aware, enemy-aware BFS; costing a drawn route is a short step from it rather than a new system.

This is aimed at a known problem rather than at elegance. Travel is what lengthened the mission past comfortably winnable, the map's scale is the blunt lever that has absorbed every engine change since, and no player can currently feel any of that before committing to a direction. A surface that answers "can four of us be where we need to be by round four" is an instrument. A whiteboard is not.

A costed route is also live. When a patrol moves into it, it re-costs and reads as blocked rather than sitting there looking confident. The map tells the team its plan broke instead of letting them discover it on the walk.

## Phases

Drawing and pointing belong to different phases, and the reason is the game's own timing rather than tidiness.

Rounds are simultaneous and there is no active-player lock. Drawing demands sustained attention, so a drawing tool during a live round is a trap: either a player stops to draw and falls behind, or they do not and the feature is dead weight. A ping costs one click and does not take anyone out of the round.

- **Ink: planning windows only.** At deployment, and again at every round boundary.
- **Pings: any time.** Transient, a few seconds, no trace.
- **Derived marks: any time.** They follow publication, which is already free and available during a round.

The window needs no vote and no lock, which matters because rounds are simultaneous: it is open while nobody has committed an action this round, and the first commitment closes it. Planning simply stops when the round starts being spent.

The round boundary is the right home for the second and later windows because it is the only hard synchronisation point the mission has: all four ready triggers the world response and the refill, so everyone is stopped together and the world has just changed. It gives the mission a rhythm — plan, act, consequence, re-plan — and leaves an artifact worth having, since the plan can be watched degrading across six rounds.

The mission's own `phase` is still only `"action" | "won" | "lost"`; the planning window is a separate `planning` boolean on public state. The `GamePhase` in `packages/rules/src/state.ts` that names `information` and `consequence` remains the older generic scaffold and is still unused.

## Persistence And Erasure

Ink persists until erased. A plan that has to be redrawn every round is not a plan, and the team should be able to make a decision once.

**Anyone can erase anything.** The alternative — only your own ink — silts the map up: six rounds, four specialists, and a layer of dead routes aimed at markers that turned out to be lies. A cooperative table needs someone able to tidy the whiteboard. This does hand players the only adversarial gesture available on the surface, which is true of a physical table too and has never been the problem.

Persistence means the life of the match. Rooms are ephemeral and this adds no persistence layer.

## What This Costs To Build

Rendering an outline is small. Four specialists drawing on one surface is not, and the difference should not be waved through. A shared canvas needs an owner per mark, a defined order for concurrent edits, undo, and a clear; none of that is exotic, and all of it is work that the word "annotation" hides.

The room can carry it. Mission state is already authoritative and already projected per client, so ink is more of the same rather than a new transport.

The phase split helps more than it first appears. Because ink only lands in planning windows, the concurrent-editing surface is a bounded phase in which the table is stopped together, rather than a canvas held permanently live under simultaneous play. Pings need none of this machinery at all: they are fire-and-forget and leave nothing to reconcile.

If this has to be cut down, cut it in this order: pings first, since they are nearly free and are the single most useful gesture on a shared map; then briefing markers, which carry the page on their own; then ink.

## Refining A Plan

**Designed, not built. Do not build this until the surface above has been played by people.**

Everything above is free, and free surfaces are either ignored or spammed. Making a refine cost engine capability is what would make the map load-bearing, and it fits the architecture rather than sitting beside it: `player engine action -> universal game event -> shared world reducer` means each engine pays in its own currency, so the Glitter Boy routes dice into a plan, the Ley Line Walker spends a weave, and the Juicer pushes for it. Coordination becomes something the engines can buy, which is a currency this game does not have and cooperative games are generally better for having.

**The risk, stated plainly.** This taxes talking, in a game whose premise is asymmetric information. Against 24 progress in six rounds with travel already making pressure management mandatory, the likely outcome is that nobody ever pays, because stabilization is always more urgent, and the map dies of neglect.

**The shape that survives the risk: free at the boundary, paid mid-round.** Planning windows stay free, so a team is never punished for re-planning. Paying is only for when they cannot wait — the patrol moved, the marker was the lie, and the plan has to change now rather than in four commitments' time. The cost then falls on impatience rather than on communication, which is a decision worth having. A flat tax on coordination is not.

Two questions must be answered before it is real:

**What does a refine buy?** A full engine commitment that buys permission to draw a line is thin, and nobody will pay it. The refine probably needs mechanical teeth — a marked route that is cheaper to walk, or a flagged objective that pays a bonus to whoever acts on it. That is a new mechanic with balance consequences, against constants already in debt.

**Is it an eighth verb, or a shape of `assist`?** The seven actions are a validated invariant: `MissionAction` in the rules and `.length(7)` with a matching enum in the content schema. The claim that all four engines emit into one contract rests on that union. Adding a verb spreads across the content schema, the rules union, four consoles, the tutorial and every preview string. `assist` is the existing cooperation verb and already spends components on someone else's behalf, but it is aimed at a single recipient where a plan is aimed at the table. A new verb is the likelier answer and it is not cheap.

## Playtest Questions

These are the things automation cannot settle, recorded so the first four-person game can look for them.

- Does anyone draw anything after the first planning window, or does the map freeze at deployment?
- Does a wrong briefing marker produce a good story or a wasted mission? One bad marker in six rounds may be one too many at current constants.
- Does the map get read during a round, or only between them?
- Does a specialist who spends a round planning feel useful? The stated acceptance question for this prototype is whether anyone feels unnecessary, and **Refining A Plan** points straight at it, as either the cure or the cause.

## Out Of Scope

No persistence beyond the match. No campaign record of past plans. No freehand drawing outside the hex grid, because everything the map needs to say is about hexes and routes. No voice or text chat: this surface is for pointing, and the table is expected to be talking anyway.

## Where It Lives

- `packages/shared/src/hex.ts` — `hexOutline`, `hexRegionPath`, `hexCorners` and `pixelToHex`. The silhouette is every edge with open ground on one side and rock on the other, so a contiguous region draws as one shape rather than a grid.
- `packages/content/src/briefing.ts` — the authored marks, Zod-validated like `siteObjects`. Validation refuses a mark that is not on open floor, and refuses a briefing in which nothing can be wrong.
- `packages/rules/src/mission.ts` — `planning`, `marks` and `briefing` on public state; `falseMarker` on authoritative state only; the `annotate` and `erase` commands; `routeCost`, `pathCost`, `falseMarkerFor` and `briefingReach`.
- `apps/web/src/MasterMap.tsx` — the surface, drawn as SVG rather than through Pixi. It is not a tactile board: it is mostly static, it needs text, and real elements give the marks accessible names and keyboard focus that a canvas would have to reinvent.
- Pings are relayed by `MissionRoom` and never enter mission state, because rules must not read a clock and a ping leaves nothing to reconcile.

Two notes for whoever works on it next:

- The false marker is derived from the seed by `falseMarkerFor` rather than drawn from the mission's RNG stream. Drawing from the stream would shift every existing seeded outcome and break the determinism tests. Keep it that way.
- Published reports are site-grained (`{ seat, location, text }`) against a hex-grained board, so derived marks are coarse: one per reported location. Briefing markers and ink carry the map until something hex-grained exists for specialists to say.
