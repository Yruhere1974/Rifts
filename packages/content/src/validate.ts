import {
  prototypeScenario,
  scenarioSchema,
  playableMission,
  playableMissionSchema,
  specialists,
  specialistsSchema,
  briefingMarkers,
  briefingMarkersSchema,
  missionObjectives,
  missionObjectivesSchema,
  leyDeck,
  leyDeckSchema,
} from "./index.js";

const result = scenarioSchema.safeParse(prototypeScenario);

if (!result.success) {
  console.error(result.error.issues);
  process.exit(1);
}

console.log(`Validated scenario: ${result.data.id}`);
playableMissionSchema.parse(playableMission);
console.log(`Validated playable mission: ${playableMission.id}`);
specialistsSchema.parse(specialists);
console.log(
  `Validated specialists: ${specialists.map((s) => `${s.className} (${s.family})`).join(", ")}`,
);
leyDeckSchema.parse(leyDeck);
console.log(
  `Validated ley deck: ${leyDeck.length} cards (${[
    "channel",
    "spell",
    "reaction",
  ]
    .map((kind) => `${leyDeck.filter((c) => c === kind).length} ${kind}`)
    .join(", ")})`,
);
missionObjectivesSchema.parse(missionObjectives);
console.log(
  `Validated objectives: ${missionObjectives.map((o) => o.title).join(", ")}`,
);
briefingMarkersSchema.parse(briefingMarkers);
console.log(
  `Validated briefing markers: ${briefingMarkers.length}, of which ${briefingMarkers.filter((m) => m.canLie).length} can be wrong`,
);
