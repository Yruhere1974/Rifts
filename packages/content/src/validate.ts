import { prototypeScenario, scenarioSchema } from "./index.js";

const result = scenarioSchema.safeParse(prototypeScenario);

if (!result.success) {
  console.error(result.error.issues);
  process.exit(1);
}

console.log(`Validated scenario: ${result.data.id}`);
