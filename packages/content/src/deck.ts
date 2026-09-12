import { z } from "zod";

/**
 * The ley network the Walker draws from. Authored rather than generated,
 * because the balance between the two link kinds is the engine's difficulty
 * knob: a weave alternates Channel and Resonance, so a hand that comes up
 * lopsided can only weave short, and Exploit Opening is the relief valve.
 *
 * The hand was previously topped up from a fixed list that was sliced before
 * it was shuffled, so a rationed refill was always the same kinds in the same
 * order and a three-card top-up could never contain an Exploit Opening. A
 * deck is what makes a round's draw worth looking at.
 */
export const leyCardSchema = z.enum(["channel", "spell", "reaction"]);
export type LeyCardKind = z.infer<typeof leyCardSchema>;

export const leyDeckSchema = z
  .array(leyCardSchema)
  .min(12)
  .superRefine((deck, context) => {
    const count = (kind: LeyCardKind) =>
      deck.filter((card) => card === kind).length;
    // A weave alternates, so a deck without both halves cannot pay its own
    // chain lengths however it is shuffled.
    for (const kind of ["channel", "spell"] as const)
      if (count(kind) < 4)
        context.addIssue({
          code: "custom",
          path: [],
          message: `The deck holds ${count(kind)} ${kind} cards; a weave needs both halves.`,
        });
    // The wildcard is relief, not the plan. Past about a third it stops
    // mattering which links the draw actually gave you.
    if (count("reaction") * 3 > deck.length)
      context.addIssue({
        code: "custom",
        path: [],
        message: "Exploit Opening is more than a third of the deck.",
      });
  });

/**
 * Twenty-one cards against roughly twenty draws in a six-round mission, so a
 * Walker who weaves hard reaches the reshuffle and a cautious one does not.
 * Balanced between the halves, because the variance should come from the
 * shuffle rather than from a deck that is lopsided before it is cut.
 */
export const leyDeck: LeyCardKind[] = leyDeckSchema.parse([
  ...Array.from({ length: 8 }, () => "channel" as const),
  ...Array.from({ length: 8 }, () => "spell" as const),
  ...Array.from({ length: 5 }, () => "reaction" as const),
]);
