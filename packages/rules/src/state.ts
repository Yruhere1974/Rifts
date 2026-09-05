import {
  emptyResourcePool,
  type LocationId,
  type PlayerId,
  type ProjectId,
  type ResourcePool,
} from "@rifts/shared";

export type GamePhase =
  "setup" | "information" | "action" | "consequence" | "complete";

export type PlayerState = {
  id: PlayerId;
  name: string;
  locationId: LocationId;
  health: number;
};

export type ProjectState = {
  id: ProjectId;
  name: string;
  requiredProgress: number;
  progress: number;
};

export type GameState = {
  round: number;
  phase: GamePhase;
  teamResources: ResourcePool;
  players: Record<PlayerId, PlayerState>;
  projects: Record<ProjectId, ProjectState>;
};

export type GameEvent =
  | {
      type: "MOVE";
      actorId: PlayerId;
      destinationId: LocationId;
    }
  | {
      type: "ACQUIRE";
      actorId: PlayerId;
      resources: Partial<ResourcePool>;
    }
  | {
      type: "CONTRIBUTE";
      actorId: PlayerId;
      projectId: ProjectId;
      progress: number;
    };

export const createInitialGameState = (): GameState => ({
  round: 1,
  phase: "setup",
  teamResources: emptyResourcePool(),
  players: {},
  projects: {},
});

export const reduceGameEvent = (
  state: GameState,
  event: GameEvent,
): GameState => {
  switch (event.type) {
    case "MOVE": {
      const actor = state.players[event.actorId];

      if (!actor) {
        return state;
      }

      return {
        ...state,
        players: {
          ...state.players,
          [event.actorId]: {
            ...actor,
            locationId: event.destinationId,
          },
        },
      };
    }

    case "ACQUIRE": {
      return {
        ...state,
        teamResources: {
          materiel:
            state.teamResources.materiel + (event.resources.materiel ?? 0),
          power: state.teamResources.power + (event.resources.power ?? 0),
          knowledge:
            state.teamResources.knowledge + (event.resources.knowledge ?? 0),
          influence:
            state.teamResources.influence + (event.resources.influence ?? 0),
        },
      };
    }

    case "CONTRIBUTE": {
      const project = state.projects[event.projectId];

      if (!project) {
        return state;
      }

      return {
        ...state,
        projects: {
          ...state.projects,
          [event.projectId]: {
            ...project,
            progress: Math.min(
              project.requiredProgress,
              project.progress + event.progress,
            ),
          },
        },
      };
    }
  }
};
