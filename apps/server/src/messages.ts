import { z } from "zod";
import type { MissionCommand } from "@rifts/rules";

export const seatSchema = z.enum(["dice", "cards", "bag", "systems"]);
export const joinOptionsSchema = z.object({
  mode: z.enum(["practice", "team"]),
  seat: seatSchema,
  clientKey: z.string().uuid(),
  /** A "table" client is a shared screen: no seat, no commands, public view only. */
  role: z.enum(["player", "table"]).default("player"),
});

const target = z.string().min(1).max(128);
const hexKey = z.string().regex(/^-?\d+,-?\d+$/);
export const commandSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("act"),
    action: z.enum([
      "move",
      "engage",
      "investigate",
      "contribute",
      "acquire",
      "assist",
      "recover",
    ]),
    target,
    pieces: z
      .array(target)
      .max(32)
      .refine((pieces) => new Set(pieces).size === pieces.length),
    // Systems only: which socket on the frame the placement builds into.
    socket: z.number().int().min(0).max(31).optional(),
  }),
  z.strictObject({ type: z.literal("draw") }),
  z.strictObject({ type: z.literal("keep"), piece: target }),
  z.strictObject({
    type: z.literal("allocate"),
    die: target,
    facet: z
      .enum([
        "mobility",
        "bracing",
        "targeting",
        "boom",
        "stabilizer",
        "shield",
        "locked",
      ])
      .nullable(),
  }),
  z.strictObject({
    type: z.literal("share"),
    target: z.enum(["gate", "relay", "archive", "rift"]).optional(),
  }),
  z.strictObject({ type: z.literal("request"), target }),
  z.strictObject({
    type: z.literal("annotate"),
    label: z.string().min(1).max(60),
    hexes: z.array(hexKey).min(1).max(12),
  }),
  z.strictObject({ type: z.literal("erase"), mark: target }),
  z.strictObject({ type: z.literal("hold") }),
  z.strictObject({ type: z.literal("ready") }),
  z.strictObject({ type: z.literal("upgrade") }),
  z.strictObject({ type: z.literal("donate") }),
]) satisfies z.ZodType<MissionCommand>;

const token = z.string().regex(/^[a-f0-9]{64}$/);
export const commandMessageSchema = z.strictObject({
  token,
  command: commandSchema,
});
export const seatMessageSchema = z.strictObject({ token, seat: seatSchema });
/**
 * Pointing is not a rules command. A ping leaves nothing to reconcile, so the
 * room relays it and the mission never hears about it.
 */
export const pingMessageSchema = z.strictObject({ token, hex: hexKey });
