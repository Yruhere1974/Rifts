import { z } from "zod";

/**
 * The mechanical identity. This is the only layer the rules package reasons
 * about, and it deliberately carries no setting.
 */
export const engineFamilies = ["dice", "cards", "bag", "systems"] as const;
export type EngineFamilyId = (typeof engineFamilies)[number];

export const specialistSchema = z.strictObject({
  family: z.enum(engineFamilies),
  /** Setting-neutral label for this way of playing. Survives an IP change. */
  familyName: z.string().min(1),
  engine: z.string().min(1),
  /** The class. Setting-specific and swappable; see docs/product/class-lineup.md. */
  className: z.string().min(1),
  /** Footprint radius: 0 small, 1 standard, 2 large. */
  size: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  /**
   * What field experience grants at each tier. Authored here so the player's
   * advancement panel can show what is still locked ahead of them, and so a
   * later campaign can persist the same shape without a redesign.
   */
  growth: z.array(z.strictObject({ at: z.number().int(), gain: z.string() })),
  flavour: z.string().min(1),
  colour: z.string().regex(/^#[0-9a-f]{6}$/),
  upgrade: z.string().min(1),
});
export type SpecialistDefinition = z.infer<typeof specialistSchema>;

export const specialistsSchema = z
  .array(specialistSchema)
  .length(4)
  .superRefine((entries, context) => {
    const families = entries.map((entry) => entry.family);
    if (new Set(families).size !== families.length)
      context.addIssue({
        code: "custom",
        message: "One class per engine family.",
      });
  });

export const specialists: SpecialistDefinition[] = specialistsSchema.parse([
  {
    family: "dice",
    familyName: "Vanguard",
    engine: "Dice allocation",
    className: "Glitter Boy",
    growth: [
      {
        at: 3,
        gain: "A sixth die and a fourth routing: more of each roll survives to be used.",
      },
      {
        at: 5,
        gain: "A seventh die and a fifth routing. Enough to lock a system on and still crew the rest of the platform.",
      },
    ],
    size: 2,
    flavour:
      "A pre-cataclysm weapons platform worn by one pilot. Every action is a decision about where its power goes.",
    colour: "#e5b65c",
    upgrade:
      "Gain a sixth die immediately and each round. More allocation choices for the rest of the mission.",
  },
  {
    family: "cards",
    familyName: "Wayfinder",
    engine: "Card weaving",
    className: "Ley Line Walker",
    growth: [
      {
        at: 3,
        gain: "A third Channel: enough links for a weave of three, worth 6.",
      },
      {
        at: 5,
        gain: "A third Resonance. Seven cards can carry a weave of four, worth 10.",
      },
    ],
    size: 1,
    flavour:
      "A mage who reads the ley network. Power comes from combining energy, shape and amplification rather than from single spells.",
    colour: "#b09be3",
    upgrade: "Every weave gains +1 effect for the rest of the mission.",
  },
  {
    family: "bag",
    familyName: "Pathfinder",
    engine: "Push your luck",
    className: "Juicer",
    growth: [
      {
        at: 3,
        gain: "A jackpot enters the bag: worth 2, and it never spoils a full spread. Both hazards stay.",
      },
      {
        at: 5,
        gain: "A second jackpot. The deepest pushes pay the most and risk the most.",
      },
    ],
    size: 1,
    flavour:
      "A body chemically driven past its safe limits. Everything is available, at a price that compounds.",
    colour: "#73c4a1",
    upgrade:
      "Replace one hazard with a double-output jackpot in this bag and each future bag.",
  },
  {
    family: "systems",
    familyName: "Artificer",
    engine: "Systems placement",
    className: "Techno-Wizard",
    growth: [
      {
        at: 3,
        gain: "A fifth placement marker: one more module in the run you are wiring together.",
      },
      {
        at: 5,
        gain: "A sixth marker. Modules still take one placement each, so this buys a longer connected machine.",
      },
    ],
    size: 1,
    flavour:
      "An engineer who builds magic into machinery. Components are placed, connected, and made to feed one another.",
    colour: "#6ab7d8",
    upgrade:
      "Gain a fifth placement marker immediately and each round. Occupied modules still limit placements.",
  },
]);

export const specialistFor = (family: EngineFamilyId): SpecialistDefinition => {
  const found = specialists.find((entry) => entry.family === family);
  if (!found) throw new Error(`No specialist for engine family ${family}.`);
  return found;
};
