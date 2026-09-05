import { describe, expect, it } from "vitest";
import type { LocationId, PlayerId, ProjectId } from "@rifts/shared";
import { createInitialGameState, reduceGameEvent } from "./state.js";

const playerId = "player-1" as PlayerId;
const startLocation = "location-start" as LocationId;
const targetLocation = "location-target" as LocationId;
const projectId = "project-sensors" as ProjectId;

describe("reduceGameEvent", () => {
  it("moves a player through the universal event contract", () => {
    const state = {
      ...createInitialGameState(),
      players: {
        [playerId]: {
          id: playerId,
          name: "Dice Specialist",
          locationId: startLocation,
          health: 10,
        },
      },
    };

    const next = reduceGameEvent(state, {
      type: "MOVE",
      actorId: playerId,
      destinationId: targetLocation,
    });

    expect(next.players[playerId]?.locationId).toBe(targetLocation);
  });

  it("adds universal team resources without knowing which engine created them", () => {
    const state = createInitialGameState();

    const next = reduceGameEvent(state, {
      type: "ACQUIRE",
      actorId: playerId,
      resources: {
        knowledge: 2,
        materiel: 1,
      },
    });

    expect(next.teamResources).toEqual({
      materiel: 1,
      power: 0,
      knowledge: 2,
      influence: 0,
    });
  });

  it("caps project progress at the required amount", () => {
    const state = {
      ...createInitialGameState(),
      projects: {
        [projectId]: {
          id: projectId,
          name: "Long-Range Surveillance Network",
          requiredProgress: 4,
          progress: 3,
        },
      },
    };

    const next = reduceGameEvent(state, {
      type: "CONTRIBUTE",
      actorId: playerId,
      projectId,
      progress: 3,
    });

    expect(next.projects[projectId]?.progress).toBe(4);
  });
});
