import { z } from "zod";
import {
  hexDistance,
  hexKey,
  hexLine,
  hexesWithin,
  type Hex,
} from "@rifts/shared";

/**
 * Greyhaven's undercroft. Chambers are joined by passages of deliberately
 * different widths: the main hall carries anything, while the side passages
 * only admit a standard or small unit. A large unit therefore has fewer
 * routes, which is the point of measuring units in hexes rather than cells.
 */
const chambers: { centre: Hex; radius: number }[] = [
  { centre: { q: 0, r: 0 }, radius: 7 },
  { centre: { q: 17, r: -6 }, radius: 5 },
  { centre: { q: -17, r: 10 }, radius: 4 },
  { centre: { q: -8, r: -12 }, radius: 4 },
  // Junctions carry no objective. They exist so the halls bend, so there is
  // somewhere to be caught in the open, and so the map is crossed rather than
  // simply traversed.
  { centre: { q: 9, r: -3 }, radius: 3 },
  { centre: { q: -9, r: 4 }, radius: 3 },
  { centre: { q: -4, r: -6 }, radius: 3 },
];

/** `width` is the clearance either side of the centre line, in hexes. */
const passages: { from: Hex; to: Hex; width: number }[] = [
  // Main hall to the breach, by way of a junction. Wide enough for anything.
  { from: { q: 0, r: 0 }, to: { q: 9, r: -3 }, width: 2 },
  { from: { q: 9, r: -3 }, to: { q: 17, r: -6 }, width: 2 },
  // The gate is the mission's only fight, so the weapons platform has to be
  // able to reach it.
  { from: { q: 0, r: 0 }, to: { q: -9, r: 4 }, width: 2 },
  { from: { q: -9, r: 4 }, to: { q: -17, r: 10 }, width: 2 },
  // The archive keeps its narrow approach: a standard unit fits, a large one
  // does not, so size still decides routes.
  { from: { q: 0, r: 0 }, to: { q: -4, r: -6 }, width: 1 },
  { from: { q: -4, r: -6 }, to: { q: -8, r: -12 }, width: 1 },
];

export const siteHexes = {
  relay: { q: 0, r: 0 },
  rift: { q: 17, r: -6 },
  gate: { q: -17, r: 10 },
  archive: { q: -8, r: -12 },
} as const;

/**
 * The opposition, placed rather than abstract. Behaviour is deliberately
 * readable: a patrol that can reach someone hurts them, and otherwise walks
 * toward the nearest specialist. Players should be able to reason about it the
 * way they reason about a board game, not guess at it.
 */
export const enemyPlacements = [
  {
    id: "patrol-lead",
    name: "Armoured leader",
    hex: { q: -15, r: 9 },
    strength: 2,
    speed: 3,
  },
  {
    id: "patrol-flank",
    name: "Outrider",
    hex: { q: -18, r: 12 },
    strength: 1,
    speed: 5,
  },
] as const;

/**
 * The things on the map you actually act on. An objective is no longer a room
 * you stand in: it is a piece of apparatus you have to be beside. Several per
 * site means a team spreads out across a chamber instead of stacking on one
 * hex, and it gives a bigger map something to be big around.
 */
export const siteObjects = [
  {
    id: "relay-north",
    site: "relay",
    name: "North conduit",
    hex: { q: 3, r: -3 },
  },
  {
    id: "relay-west",
    site: "relay",
    name: "West conduit",
    hex: { q: -3, r: 0 },
  },
  {
    id: "relay-south",
    site: "relay",
    name: "South conduit",
    hex: { q: 0, r: 3 },
  },
  {
    id: "rift-anchor",
    site: "rift",
    name: "Breach anchor",
    hex: { q: 17, r: -6 },
  },
  { id: "rift-spar", site: "rift", name: "Torn spar", hex: { q: 19, r: -8 } },
  {
    id: "gate-barricade",
    site: "gate",
    name: "Barricade",
    hex: { q: -17, r: 10 },
  },
  {
    id: "gate-culvert",
    site: "gate",
    name: "West culvert",
    hex: { q: -19, r: 12 },
  },
  {
    id: "archive-hatch",
    site: "archive",
    name: "Storage hatch",
    hex: { q: -8, r: -12 },
  },
  {
    id: "archive-stack",
    site: "archive",
    name: "Collapsed stack",
    hex: { q: -6, r: -13 },
  },
] as const;

function buildOpenHexes(): string[] {
  const open = new Set<string>();
  for (const chamber of chambers)
    for (const hex of hexesWithin(chamber.centre, chamber.radius))
      open.add(hexKey(hex));
  for (const passage of passages)
    for (const step of hexLine(passage.from, passage.to))
      for (const hex of hexesWithin(step, passage.width)) open.add(hexKey(hex));
  return [...open].sort();
}

const hexSchema = z.strictObject({
  q: z.number().int(),
  r: z.number().int(),
});

export const missionMapSchema = z
  .strictObject({
    /** Every passable hex, as "q,r". Anything absent is solid rock. */
    open: z.array(z.string().regex(/^-?\d+,-?\d+$/)).min(1),
    sites: z.strictObject({
      gate: hexSchema,
      relay: hexSchema,
      archive: hexSchema,
      rift: hexSchema,
    }),
    /** Placed opposition. Strength is how much Engage output removes it. */
    enemies: z
      .array(
        z.strictObject({
          id: z.string().min(1),
          name: z.string().min(1),
          hex: hexSchema,
          strength: z.number().int().positive(),
          speed: z.number().int().positive(),
        }),
      )
      .min(1),
    /** Apparatus you must be adjacent to in order to act on it. */
    objects: z
      .array(
        z.strictObject({
          id: z.string().min(1),
          site: z.enum(["gate", "relay", "archive", "rift"]),
          name: z.string().min(1),
          hex: hexSchema,
        }),
      )
      .min(1),
    /** Where each engine family's unit stands at deployment. */
    deploy: z.strictObject({
      dice: hexSchema,
      cards: hexSchema,
      bag: hexSchema,
      systems: hexSchema,
    }),
    /** Hexes bought per point of engine output. Sets the map's scale. */
    hexesPerEffect: z.number().int().positive(),
    /** How far a site's area extends from its hex. */
    siteRadius: z.literal(3),
    /** Footprint radius by unit scale; a standard piece spans seven hexes. */
    sizes: z.strictObject({
      small: z.literal(0),
      standard: z.literal(1),
      large: z.literal(2),
    }),
  })
  .superRefine((map, context) => {
    const open = new Set(map.open);
    // Deployment must be legal: every unit fits, none overlap, all start at
    // the relay. Checking it here keeps the arithmetic out of the rules.
    const sizes: Record<string, number> = {
      dice: map.sizes.large,
      cards: map.sizes.standard,
      bag: map.sizes.standard,
      systems: map.sizes.standard,
    };
    const placed: { family: string; hex: Hex; size: number }[] = [];
    for (const [family, hex] of Object.entries(map.deploy)) {
      const size = sizes[family]!;
      if (!hexesWithin(hex, size).every((cell) => open.has(hexKey(cell))))
        context.addIssue({
          code: "custom",
          path: ["deploy", family],
          message: `${family} does not fit at its deployment hex.`,
        });
      const beside = map.objects.some(
        (object) =>
          object.site === "relay" && hexDistance(hex, object.hex) <= size + 1,
      );
      if (!beside)
        context.addIssue({
          code: "custom",
          path: ["deploy", family],
          message: `${family} does not deploy beside a relay conduit.`,
        });
      for (const other of placed)
        if (hexDistance(hex, other.hex) <= size + other.size)
          context.addIssue({
            code: "custom",
            path: ["deploy", family],
            message: `${family} overlaps ${other.family} at deployment.`,
          });
      placed.push({ family, hex, size });
    }
    for (const [name, hex] of Object.entries(map.sites)) {
      if (!open.has(hexKey(hex)))
        context.addIssue({
          code: "custom",
          path: ["sites", name],
          message: `Site ${name} is not on an open hex.`,
        });
    }
    // Every site must be reachable on foot by at least a standard unit.
    const anchors = new Set(
      map.open.filter((key) => {
        const [q, r] = key.split(",").map(Number);
        return hexesWithin({ q: q!, r: r! }, map.sizes.standard).every((cell) =>
          open.has(hexKey(cell)),
        );
      }),
    );
    for (const enemy of map.enemies)
      if (!open.has(hexKey(enemy.hex)))
        context.addIssue({
          code: "custom",
          path: ["enemies", enemy.id],
          message: `${enemy.id} is not on an open hex.`,
        });
    for (const object of map.objects) {
      if (!open.has(hexKey(object.hex))) {
        context.addIssue({
          code: "custom",
          path: ["objects", object.id],
          message: `${object.id} is not on an open hex.`,
        });
        continue;
      }
      const beside = hexesWithin(object.hex, 1 + map.sizes.standard).some(
        (cell) =>
          hexesWithin(cell, map.sizes.standard).every((part) =>
            open.has(hexKey(part)),
          ),
      );
      if (!beside)
        context.addIssue({
          code: "custom",
          path: ["objects", object.id],
          message: `Nothing can stand beside ${object.id}.`,
        });
    }
    for (const site of Object.keys(map.sites))
      if (!map.objects.some((object) => object.site === site))
        context.addIssue({
          code: "custom",
          path: ["objects"],
          message: `Site ${site} has nothing to act on.`,
        });
    const start = hexKey(map.sites.relay);
    if (!anchors.has(start)) {
      context.addIssue({
        code: "custom",
        message: "A standard unit cannot stand on the relay.",
      });
      return;
    }
    const seen = new Set([start]);
    const queue = [map.sites.relay];
    while (queue.length) {
      const here = queue.shift()!;
      for (const next of hexesWithin(here, 1)) {
        const key = hexKey(next);
        if (anchors.has(key) && !seen.has(key)) {
          seen.add(key);
          queue.push(next);
        }
      }
    }
    for (const [name, hex] of Object.entries(map.sites))
      if (!seen.has(hexKey(hex)))
        context.addIssue({
          code: "custom",
          path: ["sites", name],
          message: `Site ${name} is unreachable by a standard unit.`,
        });
  });

export type MissionMapDefinition = z.infer<typeof missionMapSchema>;

export const missionMap: MissionMapDefinition = missionMapSchema.parse({
  open: buildOpenHexes(),
  sites: siteHexes,
  objects: siteObjects,
  enemies: enemyPlacements,
  deploy: {
    dice: { q: 3, r: -1 },
    cards: { q: -3, r: 1 },
    bag: { q: -2, r: 4 },
    systems: { q: 1, r: 4 },
  },
  hexesPerEffect: 14,
  siteRadius: 3,
  sizes: { small: 0, standard: 1, large: 2 },
});

export const mapBounds = missionMap.open.reduce(
  (acc, key) => {
    const [q, r] = key.split(",").map(Number);
    return {
      minQ: Math.min(acc.minQ, q!),
      maxQ: Math.max(acc.maxQ, q!),
      minR: Math.min(acc.minR, r!),
      maxR: Math.max(acc.maxR, r!),
    };
  },
  { minQ: 0, maxQ: 0, minR: 0, maxR: 0 },
);

/** Distance in hexes between two named sites, for authoring sanity checks. */
export const siteDistance = (
  a: keyof typeof siteHexes,
  b: keyof typeof siteHexes,
) => hexDistance(siteHexes[a], siteHexes[b]);
