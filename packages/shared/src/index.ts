export * from "./hex.js";
export type Brand<TValue, TBrand extends string> = TValue & {
  readonly __brand: TBrand;
};

export type PlayerId = Brand<string, "PlayerId">;
export type LocationId = Brand<string, "LocationId">;
export type EntityId = Brand<string, "EntityId">;
export type ProjectId = Brand<string, "ProjectId">;
export type EventId = Brand<string, "EventId">;

export type ResourceName = "materiel" | "power" | "knowledge" | "influence";

export type ResourcePool = Record<ResourceName, number>;

export const emptyResourcePool = (): ResourcePool => ({
  materiel: 0,
  power: 0,
  knowledge: 0,
  influence: 0,
});

export type EngineFamily = "dice" | "cards" | "bag" | "systems";
