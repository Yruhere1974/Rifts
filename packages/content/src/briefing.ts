import { z } from "zod";
import { hexKey } from "@rifts/shared";
import { missionMap } from "./map.js";

/**
 * What the team believed before it deployed. These are the marks the mission
 * itself puts on the master map, and they are expectations rather than facts.
 *
 * Precision and reliability are separate axes. Precision is authored and
 * visible: it says how tightly planning claimed to know a location, and it is
 * what decides how hard the mark draws. Reliability is whether the mark is
 * true at all, it is chosen per match from `canLie`, and it is never shown.
 * A `known` marker is therefore the most dangerous object on the page.
 */
export const briefingMarkerSchema = z.strictObject({
  id: z.string().min(1),
  label: z.string().min(1),
  hex: z.strictObject({ q: z.number().int(), r: z.number().int() }),
  precision: z.enum(["known", "inferred", "uncertain"]),
  /** Whether this mark is a candidate for being this match's false one. */
  canLie: z.boolean(),
});

export type BriefingMarker = z.infer<typeof briefingMarkerSchema>;

/** How far a mark's claim spreads, by how precise the briefing claimed to be. */
export const briefingRadius: Record<BriefingMarker["precision"], number> = {
  known: 0,
  inferred: 2,
  uncertain: 5,
};

export const briefingMarkersSchema = z
  .array(briefingMarkerSchema)
  .min(1)
  .superRefine((markers, context) => {
    const open = new Set(missionMap.open);
    const seen = new Set<string>();
    for (const [index, marker] of markers.entries()) {
      if (seen.has(marker.id))
        context.addIssue({
          code: "custom",
          path: [index, "id"],
          message: `Duplicate briefing marker id ${marker.id}.`,
        });
      seen.add(marker.id);
      // A mark has to point at ground somebody could stand on, or it can
      // never be walked to and resolved.
      if (!open.has(hexKey(marker.hex)))
        context.addIssue({
          code: "custom",
          path: [index, "hex"],
          message: `Briefing marker ${marker.id} does not sit on open floor.`,
        });
    }
    if (!markers.some((marker) => marker.canLie))
      context.addIssue({
        code: "custom",
        path: [],
        message: "No briefing marker can be wrong, so none can ever be struck.",
      });
  });

/**
 * The relay and the breach are deliberately not lie candidates. The team
 * deploys on the first and the mission is scored on the second, so a false
 * mark on either is unfair rather than dramatic.
 */
export const briefingMarkers: BriefingMarker[] = briefingMarkersSchema.parse([
  {
    id: "brief-relay",
    label: "Relay conduits",
    hex: { q: 0, r: 0 },
    precision: "known",
    canLie: false,
  },
  {
    id: "brief-breach",
    label: "Breach, east chamber",
    hex: { q: 17, r: -6 },
    precision: "inferred",
    canLie: false,
  },
  {
    id: "brief-patrol",
    label: "Patrol holding the west gate",
    hex: { q: -16, r: 10 },
    precision: "inferred",
    canLie: true,
  },
  {
    id: "brief-archive",
    label: "Archive beyond the north junction",
    hex: { q: -8, r: -12 },
    precision: "uncertain",
    canLie: true,
  },
  {
    id: "brief-cache",
    label: "Intact cells in the collapsed stacks",
    hex: { q: -6, r: -13 },
    precision: "known",
    canLie: true,
  },
  {
    id: "brief-spur",
    label: "Second approach to the breach",
    hex: { q: 9, r: -3 },
    precision: "uncertain",
    canLie: true,
  },
]);
