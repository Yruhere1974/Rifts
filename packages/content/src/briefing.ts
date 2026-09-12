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

/**
 * What the team was sent in to do. Four objectives, and only one of them is
 * scored: the other three are the difference between closing the breach
 * cheaply and not closing it at all.
 *
 * Each objective names the briefing marker that claims to locate it, so the
 * brief and the map are one object rather than two panels. That tie is what
 * makes the brief honest about its own uncertainty: an objective is only as
 * findable as the mark pointing at it, and a mark can be wrong.
 */
export const missionObjectiveSchema = z.strictObject({
  id: z.string().min(1),
  title: z.string().min(1),
  detail: z.string().min(1),
  /** The briefing marker that claims to say where this is. */
  marker: z.string().min(1),
  /**
   * Which public signal says whether this objective is met. Authored rather
   * than matched on id, so the rules package reads a measure it understands
   * and a new objective stays a content edit.
   */
  measure: z.enum(["progress", "shield", "frequency", "threat"]),
  /** Whether the mission is won or lost on this one. Exactly one is. */
  scored: z.boolean(),
});

export type MissionObjective = z.infer<typeof missionObjectiveSchema>;

export const missionObjectivesSchema = z
  .array(missionObjectiveSchema)
  .min(1)
  .superRefine((objectives, context) => {
    const marks = new Set(briefingMarkers.map((marker) => marker.id));
    const seen = new Set<string>();
    for (const [index, objective] of objectives.entries()) {
      if (seen.has(objective.id))
        context.addIssue({
          code: "custom",
          path: [index, "id"],
          message: `Duplicate objective id ${objective.id}.`,
        });
      seen.add(objective.id);
      // An objective nobody can be pointed at is an objective the master map
      // cannot carry, which is the whole reason the tie exists.
      if (!marks.has(objective.marker))
        context.addIssue({
          code: "custom",
          path: [index, "marker"],
          message: `Objective ${objective.id} names no briefing marker.`,
        });
    }
    const measures = objectives.map((objective) => objective.measure);
    if (new Set(measures).size !== measures.length)
      context.addIssue({
        code: "custom",
        path: [],
        message: "Two objectives share one measure, so one cannot be read.",
      });
    const scored = objectives.filter((objective) => objective.scored);
    if (scored.length !== 1)
      context.addIssue({
        code: "custom",
        path: [],
        message: `Exactly one objective is scored; found ${scored.length}.`,
      });
  });

export const missionObjectives: MissionObjective[] =
  missionObjectivesSchema.parse([
    {
      id: "close-the-breach",
      title: "Close the breach",
      detail:
        "Contribute 24 stabilization at the breach before the sixth round ends. Each contribution costs 1 Power.",
      marker: "brief-breach",
      measure: "progress",
      scored: true,
    },
    {
      id: "restore-the-relay",
      title: "Restore the relay",
      detail:
        "An engine commitment and 2 shared Power drop the breach shield. Every stabilization after that counts double.",
      marker: "brief-relay",
      measure: "shield",
      scored: false,
    },
    {
      id: "decode-the-timing",
      title: "Decode the timing",
      detail:
        "Investigate the archive, or share two readings of the breach. Until somebody does, every contribution adds 5 instability.",
      marker: "brief-archive",
      measure: "frequency",
      scored: false,
    },
    {
      id: "clear-the-west-gate",
      title: "Clear the west gate",
      detail:
        "The patrol adds instability at every world response until it is engaged.",
      marker: "brief-patrol",
      measure: "threat",
      scored: false,
    },
  ]);
