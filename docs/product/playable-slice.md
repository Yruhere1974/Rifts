# Playable Slice: Dimensional Stabilizer

## Scope And Source

The original concept and ADR-0001 remain authoritative. They establish four engine families, universal actions and resources, asymmetric perception, personal/team tension, and intermingled team rounds. The concept explicitly leaves mission numbers and exact engine rules open. This document fixes those details for the first local vertical slice without changing that architecture.

The executable scenario definition is `packages/content/src/mission.ts`. Pure deterministic commands, previews, normalized world events, and filtered views live in `packages/rules/src/mission.ts`. React collects input; Colyseus validates and resolves it. Pixi draws the shared board from the filtered view. Three.js adds no useful spatial information to this small location graph and is not introduced.

## Mission

All four players deploy at the relay. Four locations share one state: gate, relay, archive, and rift. Moving between locations costs personal capability. Investigation, engagement, and project contributions require being at the target. Resource acquisition, assistance, and recovery are available locally or remotely as their previews specify.

The objective is 24 stabilization. Every rift contribution consumes 1 shared Power. Restoring the relay consumes an engine commitment and 2 Power, removes the shield, doubles future stabilization output, and causes a visible +1 instability surge.

Each character receives a different private assessment of every map location. Publishing Vanguard's and Wayfinder's breach readings together establishes safe timing; other pairs do not substitute. Alternatively, any character can investigate the archive or rift using capability, or spend 1 shared Knowledge. Unknown timing makes each rift contribution add 5 instability. Shield state and safe timing are separate: knowing the frequency prevents risk but does not remove the shield.

### Complementary Evidence

Assessments are authored per specialist and location with known, inferred, uncertain, or character-specific status. Only the owning specialist receives the text until they publish that location's report. Reading and sharing these initial assessments are free and can happen remotely, before action commitment. The original no-target share command publishes the breach reading; targeted sharing publishes one selected location, once per specialist per location.

- West gate: Vanguard identifies an exposed coupling; Pathfinder identifies the patrol's route and orientation. Publishing both reveals a one-use opening: the next valid Engage at the gate gains +1 effect, still paying its normal component and threshold costs.
- Silent archive: Pathfinder identifies an intact access conduit; Operator detects two usable cells in the circuit. Publishing both reveals a one-use cache: the next Investigate at the archive using engine pieces also gains 2 shared Power. A Knowledge-only investigation does not recover the cache.
- Breach: Vanguard provides pulse onset and Wayfinder provides the quiet interval. Their specific reports establish safe timing. Investigation remains a paid alternative, so no specialist is mandatory for victory.

Any specialist can exploit a published opportunity using their own engine. Consuming an opportunity is authoritative and atomic with the action; failed commands consume nothing. Relay assessments provide complementary tactical/technical context without an additional bonus. Initial observations are fixed for this authored prototype, not a procedurally generated mystery. The existing scenario goal, engine costs, and world-response rules are unchanged.

Loss occurs at 12 instability or at the end of round six if the objective remains incomplete. On a world response, instability rises by `1 + activePatrol + floor((round - 1) / 2)`. Engaging at the gate reduces its initial strength of three; eliminating it removes its contribution to subsequent pressure. Recovery reduces current instability. There is no infinite recovery/farming strategy because the sixth surge closes the mission window.

## Engine Decisions

| Engine                        | Decision                                                                  | Cost And Consequence                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dice allocation               | Allocate five rolled dice; protect high values or spend them to assist    | One die per action. Engage needs 4+, Assist needs 3+. Values 4+ produce two effect; lower values produce one. Any die moves.                                                                                                                                                                                                                                                                         |
| Card weaving                  | Spend cards singly, combine Channel + Resonance, or hold Exploit Opening  | A single card produces one effect; the two-card combo produces three. Exploit Opening produces two assistance after the relay is restored. A played card leaves the hand until the round refresh.                                                                                                                                                                                                    |
| Bag building / push your luck | Push again or commit the surge you already have                           | Eight tokens include six safe outcomes and two hazards. A hazard destroys the whole surge and adds instability equal to that round's burnout count, then returns to the bag; safe tokens leave it when drawn. Odds therefore rise monotonically within a round. Committing an action spends the entire surge, so push size is chosen per action. Remaining hazard odds are visible, order is hidden. |
| Systems placement             | Commit four markers into distinct modules; prime before a valuable effect | Each module can be occupied once per round. Recover with a marker primes the next effect placement for +1 output. Movement preserves priming. Repeated placements are rejected even if markers remain.                                                                                                                                                                                               |

### Field Experience

Every engine grows on the same clock the world escalates on: `floor((round - 1) / 2)`, so tier 1 arrives in round 3 and tier 2 in round 5. Growth is automatic and identical for all four seats' timing, but each engine grows in its own currency, following the per-engine progression menus in the concept document.

| Engine            | Tier 1 (round 3)    | Tier 2 (round 5)     | Shape of the gain                                                        |
| ----------------- | ------------------- | -------------------- | ------------------------------------------------------------------------ |
| Dice allocation   | Sixth die           | Seventh die          | More simultaneous commitments; the 4+/3+ thresholds never move.          |
| Card weaving      | Third Channel       | Third Resonance      | Another possible weave per round rather than a stronger single card.     |
| Push your luck    | First extra jackpot | Second extra jackpot | Larger payouts with both hazards still in the bag; risk is not reduced.  |
| Systems placement | Fifth marker        | Sixth marker         | Breadth across the seven modules; one placement per module is unchanged. |

A kept core stacks on top of the tier for the dice, systems and bag engines, and raises weave output for the card engine. Because pressure rises on the same clock, a long mission means stronger specialists as well as a heavier world, so reaching round 5 is worth doing rather than only worth surviving.

Each specialist starts with one core. Donating gives two shared Power and permanently forfeits its personal upgrade for this mission. Keeping it gives a sixth die, four-effect card combos, a hazard replaced by a double-output jackpot, or a fifth placement marker. The extra die/marker and bag modification apply immediately as well as on future refreshes. Private ambitions describe this temptation rather than rewarding betrayal; there is no campaign XP system in this slice.

All shared resources have universal uses. Power fuels projects. Knowledge can substitute for an investigative engine action. One Materiel can substitute for a one-point recovery. One Influence can substitute for one-point assistance. These alternatives neither occupy an Operator module nor prime it; the preview distinguishes their cost from personal components.

## Cooperation And Time

There is no active-player lock. Any connected specialist may inspect, select, act, publish information, request assistance, or hold during the common action phase. The server serializes commitments and revalidates costs against the latest state.

Assistance consumes the assisting engine's actual components, adds that output to the recipient's next effect, and clears the request. Movement and further assistance preserve a received bonus. For example, the Wayfinder can retain Exploit Opening until the Vanguard restores the relay, then spend that card to amplify a primed Operator contribution. The Operator can later spend its last marker to support the Vanguard's remaining dice.

Hold preserves capability without advancing the round or blocking later action. Finish requires a consequence confirmation, marks the player finished, and disallows more spending for that round. Finished players may still publish readings and request assistance. All four finishing triggers the world response and refreshes the engines if the mission survives.

## Acceptance Evidence

`tests/e2e/playable.spec.ts` completes the mission entirely through visible controls in solo-table mode, demonstrates upgrades and loss, and checks all four consoles at desktop/mobile widths. It also checks rendered canvas pixels, horizontal overflow, action-label fit, and modal focus containment.

`tests/e2e/multiplayer.spec.ts` completes a shared victory using four independent browser contexts with different engines and private readings. Separate SDK clients verify actual network snapshots, unauthorized seat switching, reserved-seat rejoining, forged commands, initial four-player gating, and simultaneous attempts to consume the same two Power.

`packages/rules/src/mission.test.ts` covers deterministic seeds, immutable invalid commands, private-state allowlisting, action economy, combinations, whole-surge commitment, compounding bag burnout, per-round engine growth, occupied modules, shared-resource alternatives, upgrades, hold/finish, escalating loss, and cooperative victory. Regression cases cover the reviewer-discovered two-engine opening and its Influence-funded variation.

Automated runs establish functionality, not human enjoyment or final balance. The next acceptance activity is a four-person playtest assessing whether everyone understands their engine, contributes willingly, and finds the personal-versus-team decision tempting.
