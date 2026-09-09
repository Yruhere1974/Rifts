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
  { centre: { q: 10, r: -3 }, radius: 4 },
  { centre: { q: -12, r: 7 }, radius: 3 },
  { centre: { q: -5, r: -6 }, radius: 3 },
];

/** `width` is the clearance either side of the centre line, in hexes. */
const passages: { from: Hex; to: Hex; width: number }[] = [
  // Main hall: wide enough for a large unit's full footprint.
  { from: { q: 0, r: 0 }, to: { q: 10, r: -3 }, width: 2 },
  // Side passages: a standard unit fits, a large one does not.
  { from: { q: 0, r: 0 }, to: { q: -12, r: 7 }, width: 1 },
  { from: { q: 0, r: 0 }, to: { q: -5, r: -6 }, width: 1 },
];

export const siteHexes = {
  relay: { q: 0, r: 0 },
  rift: { q: 10, r: -3 },
  gate: { q: -12, r: 7 },
  archive: { q: -5, r: -6 },
} as const;

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
      if (hexDistance(hex, map.sites.relay) > size + map.siteRadius)
        context.addIssue({
          code: "custom",
          path: ["deploy", family],
          message: `${family} does not deploy at the relay.`,
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
  deploy: {
    dice: { q: 4, r: -2 },
    cards: { q: -2, r: 0 },
    bag: { q: -1, r: 3 },
    systems: { q: -1, r: -3 },
  },
  hexesPerEffect: 8,
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
