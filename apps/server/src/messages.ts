import { z } from "zod";

export const clientMessageSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("ready"),
  }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;
