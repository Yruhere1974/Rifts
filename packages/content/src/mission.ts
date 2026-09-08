import { z } from "zod";

export const playableMissionSchema = z
  .strictObject({
    id: z.string().min(1),
    name: z.string().min(1),
    objective: z.string().min(1),
    requiredProgress: z.literal(24),
    instabilityLimit: z.literal(12),
    roundLimit: z.literal(6),
    locations: z
      .array(
        z.strictObject({
          id: z.enum(["gate", "relay", "archive", "rift"]),
          name: z.string(),
          description: z.string(),
        }),
      )
      .length(4),
    characters: z
      .array(
        z.strictObject({
          seat: z.enum(["soldier", "mage", "scout", "operator"]),
          name: z.string(),
          engine: z.string(),
          upgrade: z.string(),
        }),
      )
      .length(4),
    actions: z
      .array(
        z.strictObject({
          id: z.enum([
            "move",
            "engage",
            "investigate",
            "contribute",
            "acquire",
            "assist",
            "recover",
          ]),
          name: z.string(),
          description: z.string(),
        }),
      )
      .length(7),
  })
  .superRefine((mission, context) => {
    for (const [key, ids] of [
      ["locations", mission.locations.map((x) => x.id)],
      ["characters", mission.characters.map((x) => x.seat)],
      ["actions", mission.actions.map((x) => x.id)],
    ] as const) {
      if (new Set(ids).size !== ids.length)
        context.addIssue({
          code: "custom",
          path: [key],
          message: "IDs must be unique.",
        });
    }
  });
export type PlayableMissionDefinition = z.infer<typeof playableMissionSchema>;
export const playableMission = playableMissionSchema.parse({
  id: "relay-breach",
  name: "Dimensional Stabilizer",
  objective: "Seal the rift before instability reaches 12.",
  requiredProgress: 24,
  instabilityLimit: 12,
  roundLimit: 6,
  locations: [
    {
      id: "gate",
      name: "Perimeter Gate",
      description:
        "An active patrol adds 1 instability at each world response. Engage it here.",
    },
    {
      id: "relay",
      name: "Reactor Relay",
      description:
        "Spend an engine action and 2 shared power to disable the shield.",
    },
    {
      id: "archive",
      name: "Signal Archive",
      description:
        "Investigate to decode the safe frequency. Spend 1 knowledge instead of engine pieces.",
    },
    {
      id: "rift",
      name: "Dimensional Rift",
      description:
        "Contribute 24 progress before round 6 ends. Each contribution costs 1 Power. Restored relay doubles output. Unknown timing adds 5 instability; two shared readings or investigation reveal safe timing.",
    },
  ],
  characters: [
    {
      seat: "soldier",
      name: "Soldier",
      engine:
        "Allocate five dice, gaining another at rounds 3 and 5. Engage needs 4+, assist 3+. A 4+ die produces 2 effect; any die moves.",
      upgrade: "An extra die immediately and every round.",
    },
    {
      seat: "mage",
      name: "Mage",
      engine:
        "Spend any card for 1 effect, or Channel + Resonance for 3. The hand grows by a Channel at round 3 and a Resonance at round 5. Exploit Opening assists for 2 after the shield is suppressed.",
      upgrade: "Channel + Resonance produces 4 effect permanently.",
    },
    {
      seat: "scout",
      name: "Scout",
      engine:
        "Push a bag of eight tokens for a surge. A hazard loses the whole surge, adds escalating instability, and returns to the bag; safe tokens leave it. An action spends the entire surge. Rounds 3 and 5 add a double-value jackpot without removing either hazard.",
      upgrade:
        "Replace one hazard with a double-output jackpot now and in every future bag.",
    },
    {
      seat: "operator",
      name: "Operator",
      engine:
        "Place four markers in distinct action modules, gaining another at rounds 3 and 5. Recover primes the next effect placement for +1 effect.",
      upgrade: "An extra placement marker immediately and every round.",
    },
  ],
  actions: [
    {
      id: "move",
      name: "Move",
      description: "Spend capability to reach any other location.",
    },
    {
      id: "engage",
      name: "Engage",
      description: "Remove patrol threat at the gate.",
    },
    {
      id: "investigate",
      name: "Investigate",
      description:
        "Decode safe timing at archive or rift; engine pieces also generate knowledge.",
    },
    {
      id: "contribute",
      name: "Contribute",
      description:
        "Disable the shield at relay or advance the main objective at rift.",
    },
    {
      id: "acquire",
      name: "Acquire",
      description: "Generate any one shared resource at your current location.",
    },
    {
      id: "assist",
      name: "Assist",
      description:
        "Commit engine output as an ally's next-effect bonus, or spend 1 Influence for +1. Movement and assistance preserve received bonuses.",
    },
    {
      id: "recover",
      name: "Recover",
      description:
        "Reduce instability with engine output or spend 1 Materiel for -1. An Operator marker also primes the next effect placement.",
    },
  ],
});
