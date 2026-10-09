import { z } from "zod";

export const uuidSchema = z.uuid();

const eventAuthSchema = z
  .object({
    accountUUID: uuidSchema,
    staffUUID: uuidSchema,
  })
  .strict();

const jobEventArgsSchema = z
  .object({
    jobUUID: uuidSchema,
  })
  .strict();

export const serviceM8JobEventSchema = z
  .object({
    eventVersion: z.literal("1.0"),
    eventName: z.string().transform((value) => value.toLowerCase()).pipe(z.literal("rg_office_assistant")),
    auth: eventAuthSchema,
    eventArgs: jobEventArgsSchema,
    iat: z.number().int().optional(),
    exp: z.number().int().optional(),
    nbf: z.number().int().optional(),
    jti: z.string().min(1).max(256).optional(),
    iss: z.string().min(1).max(512).optional(),
    aud: z.union([z.string(), z.array(z.string())]).optional(),
  })
  .strict();

export type ServiceM8JobEvent = z.infer<typeof serviceM8JobEventSchema>;
