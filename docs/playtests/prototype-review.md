# Prototype Review Record

## Review Method

A separate critical-review agent reviewed the source and reproduced rules exploits in memory. The primary agent implemented fixes, ran unit and browser/network tests, and inspected desktop/mobile screenshots. The reviewer explicitly did not certify the browser suite; the recorded command results are the primary agent's evidence.

Parallel rules and server implementation agents contributed initial files before hitting a usage quota. Their partial work was integrated, inspected, corrected, and verified by the primary agent. The critical reviewer was subsequently available for repeated read-only passes.

## Findings And Fixes

| Finding                                                              | Fix / Evidence                                                                                                                                                                            |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Donated Power had no recurring mission use                           | Every rift contribution consumes Power. A core funds two such actions or the relay.                                                                                                       |
| Banking each token removed Scout risk                                | Banking now ends the expedition; secured tokens remain usable across subsequent actions.                                                                                                  |
| Free clues bypassed the relay                                        | Timing removes risk; the relay independently doubles output.                                                                                                                              |
| Rejoining could take someone else's seat                             | Persistent pre-generated ownership key, server-side seat claims, and wire integration tests.                                                                                              |
| Identical team seeds revealed hidden draws                           | Cryptographic team seeds; reproducible seed restricted to intentional solo practice.                                                                                                      |
| Renewable recovery allowed endless farming                           | Escalating pressure and a six-round deadline.                                                                                                                                             |
| Offline players were labelled available and blocked rounds           | Explicit presence, four-player start gating, reserved seats, and absent-seat forfeiture.                                                                                                  |
| Two-engine burst overwhelmed the mission                             | Goal tuned to 24, blind work costs five instability, and Techno-Wizard priming reduced to +1. Exact reviewed Influence sequence is tested. No class-specific victory lock was introduced. |
| Dropping an already-selected marker deselected it and spent Materiel | Drop is idempotent for selected markers; shared-resource and engine costs remain separate.                                                                                                |
| Techno-Wizard could start with a hidden self-assistance target       | Recipient is derived to always be another specialist.                                                                                                                                     |
| A hidden room code blocked solo deployment                           | Room codes are submitted only for cooperative rooms.                                                                                                                                      |
| First-snapshot failure could orphan seat ownership                   | Ownership key exists in persistent browser storage before connecting.                                                                                                                     |
| Tiny mobile labels overflowed action slots                           | Touch-sized icon controls, accessible command names, separate effect preview, and screenshot/overflow checks.                                                                             |
| Rendering rebuilt static board marks on every frame                  | Geometry changes only when the view or selection changes; a separate restrained pulse animates the breach. Reduced-motion mode limits redraw frequency.                                   |

The final read-only pass found no additional concrete blocking security, UX, or runtime defects. This does not prove optimal balance or that all players must act in every possible winning strategy.

## Comparison Pass

These are design comparisons against the user's requested qualities, not claims of parity with finished commercial games or reports of new hands-on sessions.

| Reference                                                               | Quality Under Review                             | Prototype Response / Remaining Gap                                                                                                                                                                |
| ----------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Root Digital](https://www.direwolfdigital.com/root/)                   | Different engines remain one coherent game       | Four persistent color/icon identities; the same board, resources, projects, and commitment vocabulary. Human testing must confirm that each identity is understood.                               |
| Gloomhaven Digital                                                      | Cooperative planning and shared situation        | No fixed active player; public requests, held capability, visible world-response forecast, private readings. No campaign or extensive tactical status system is attempted.                        |
| [Wingspan Digital](https://monstercouch.com/press/sheet.php?p=wingspan) | Physical component clarity and restrained motion | Pipped dice, cards, round tokens, and placement markers; modest selected-state lift and breach animation. Placeholder board art is intentionally limited.                                         |
| [Slay the Spire](https://www.megacrit.com/press-kits/slay-the-spire/)   | Readable cards and known consequences            | Card text states single/combo output, selection remains reversible, and the target/cost/effect preview precedes commitment. Text was enlarged after screenshot review.                            |
| [Dicey Dungeons](https://wiki.diceydungeons.com/doku.php?id=equipment)  | Dice as spendable physical allocations           | Pips and values remain visible; threshold rejection occurs before payment; click and drag both select a real die. Sound and richer rolling animation are deferred.                                |
| [Into the Breach](https://www.subsetgames.com/itb.html)                 | Threat intent and tactical cause/effect          | Exact next instability, gate threat, relay status, unsafe-work penalty, and selected-location consequences are visible. This is a four-location mission rather than a grid-combat implementation. |

## Human Playtest Still Needed

Run a table with four people unfamiliar with the code, without giving them the automated winning sequence. Record whether they can explain their own costs, another player's assistance, the difference between timing and shielding, and why they kept or donated their core. Ask each player which engine they would choose again and why.

Watch specifically for quarterbacking, players finishing prematurely, ignoring the patrol, and one player feeling irrelevant while others combine effects. Tune costs and scenario pressure from those observations. Automated success is necessary but does not establish that the prototype is fun or that its current numbers are final.
