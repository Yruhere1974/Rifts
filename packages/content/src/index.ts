import { z } from "zod";
export * from "./mission.js";
export * from "./specialists.js";
export * from "./map.js";

export const scenarioSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  playerCount: z.literal(4),
  sharedResources: z.array(
    z.enum(["materiel", "power", "knowledge", "influence"]),
  ),
  universalVerbs: z.array(
    z.enum([
      "MOVE",
      "ENGAGE",
      "INVESTIGATE",
      "ASSIST",
      "CONTRIBUTE",
      "ACQUIRE",
      "RECOVER",
    ]),
  ),
});

export type ScenarioDefinition = z.infer<typeof scenarioSchema>;

export const prototypeScenario: ScenarioDefinition = {
  id: "prototype-001",
  name: "Dimensional Stabilizer",
  playerCount: 4,
  sharedResources: ["materiel", "power", "knowledge", "influence"],
  universalVerbs: [
    "MOVE",
    "ENGAGE",
    "INVESTIGATE",
    "ASSIST",
    "CONTRIBUTE",
    "ACQUIRE",
    "RECOVER",
  ],
};
