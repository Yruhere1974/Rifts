import { z } from "zod";
import type { MissionCommand } from "@rifts/rules";

export const seatSchema = z.enum(["soldier", "mage", "scout", "operator"]);
export const joinOptionsSchema = z.object({
  mode: z.enum(["practice", "team"]),
  seat: seatSchema,
  clientKey: z.string().uuid(),
});

const target = z.string().min(1).max(128);
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
  }),
  z.strictObject({ type: z.literal("draw") }),
  z.strictObject({ type: z.literal("bank") }),
  z.strictObject({ type: z.literal("share") }),
  z.strictObject({ type: z.literal("request"), target }),
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
