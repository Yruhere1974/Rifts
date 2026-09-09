# Prototype Class Lineup

## Status

This fixes the four classes the prototype is built around and which engine family each one uses. It refines, and in one place corrects, the generic "Possible Character Fits" lists in the concept document. The concept document remains authoritative for the engine families themselves, the universal interaction contract, and the design constitution.

Implementation state is recorded per class below. Agreeing a mapping is not the same as having built it.

## The Lineup

| Engine family     | Family name | Class           | Why the class fits the engine                                                                                              |
| ----------------- | ----------- | --------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Dice allocation   | Vanguard    | Glitter Boy     | Operating a giant weapons platform: allocate power between movement, bracing, targeting, defence and the Boom Gun.         |
| Card weaving      | Wayfinder   | Ley Line Walker | Combining ley energy, shape and amplification into sequences rather than playing single attacks.                           |
| Push your luck    | Pathfinder  | Juicer          | A body pushed past safe limits. One more attack, one more move, mounting risk. Almost a literal reading of the mechanic.   |
| Systems placement | Artificer   | Techno-Wizard   | Building magical machinery: placing components that interact through adjacency and ports, assembling a machine over turns. |

Three layers are deliberately distinct:

1. **Engine family** (`dice`, `cards`, `bag`, `systems`) is the mechanical identity and the only thing the rules package knows about.
2. **Family name** (Vanguard, Wayfinder, Pathfinder, Artificer) is a setting-neutral label for that way of playing.
3. **Class** (Glitter Boy, Ley Line Walker, Juicer, Techno-Wizard) is authored content and carries the setting.

The IP note in the concept document requires that a commercial release either license Palladium Rifts or convert to an original setting. Keeping layers 1 and 2 free of setting names is what makes that conversion a content change rather than a rewrite.

## The Design Argument

The four classes do not merely have different abilities. Each asks its player a different question:

- **Glitter Boy:** how do I allocate my resources?
- **Ley Line Walker:** what can I combine?
- **Juicer:** how far dare I push this?
- **Techno-Wizard:** what can I build?

That is substantially more interesting than four classes sharing one engine with different card text. Dice allocation also solves a specific problem with the Glitter Boy: it is enormously powerful, so it needs constraints other than reduced damage. Committing dice to brace, target and fire means sacrificing mobility or defence, which feels like operating the machine rather than playing "the tank".

## A Fifth Class

If a Cyber-Knight is added later it should bring a fifth play pattern rather than be forced into one of these four. The constitution allows several classes per family, but the prototype's value comes from the engines being genuinely different, so a new class that adds no new way of thinking adds little.

## Correction To The Concept Document

The concept document lists the Juicer under Engine 1: Dice Allocation. That placement is superseded. The Juicer belongs to the bag / push-your-luck engine, and `packages/rules/src/mission.ts` now implements that engine around the Juicer fantasy: a surge that is pushed one token at a time, hazards that return to the bag so the odds only worsen, and a burnout cost that compounds within a round. The dice engine's character fits gain the Glitter Boy instead.

## Implementation State

| Class           | Mechanics implemented                                                                                                                                                                                                   | Outstanding                                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Juicer          | Yes. Per-action surge, compounding burnout, hazards that never leave the bag, growth by added jackpots, composition (one kind pays its own size again, all three safe kinds double), and tokens held past the refill.   | None mechanically. Never played by a person.                                                                   |
| Glitter Boy     | Yes. Dice allocated across six platform systems, each firing with everything in it. Calibration doubles a matched system and adds the length of a run of three or more. Held dice keep their faces into the next round. | Never played by a person. Defence exists only as Shield, and patrols have no facing to brace against.          |
| Ley Line Walker | Yes. Chains alternate Channel and Resonance for as long as the hand sustains them, Exploit Opening is a wildcard, and length pays 1, 3, 6, 10. Cards can be held past the deal.                                         | Never played by a person. A weave of four pays 10 against mission constants tuned when the ceiling was 3.      |
| Techno-Wizard   | Yes. Placements in a fixed module row, +1 for each built neighbour, priming, and modules held past the rebuild so a machine accumulates across rounds.                                                                  | Never played by a person. Ports as a concept distinct from row adjacency are not built, and may not be needed. |
