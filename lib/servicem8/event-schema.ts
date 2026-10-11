import { z } from "zod";

export const uuidSchema = z.uuid();

const eventAuthSchema = z
  .object({
    accountUUID: uuidSchema,
    staffUUID: uuidSchema,
  })
  .strict();

const eventClaimsSchema = {
  eventVersion: z.literal("1.0"),
  auth: eventAuthSchema,
  iat: z.number().int().optional(),
  exp: z.number().int().optional(),
  nbf: z.number().int().optional(),
  jti: z.string().min(1).max(256).optional(),
  iss: z.string().min(1).max(512).optional(),
  aud: z.union([z.string(), z.array(z.string())]).optional(),
};

const jobEventArgsSchema = z
  .object({
    jobUUID: uuidSchema,
  })
  .strict();

export const serviceM8JobEventSchema = z
  .object({
    ...eventClaimsSchema,
    eventName: z.string().transform((value) => value.toLowerCase()).pipe(z.literal("rg_office_assistant")),
    eventArgs: jobEventArgsSchema,
  })
  .strict();

export const serviceM8MenuEventSchema = z
  .object({
    ...eventClaimsSchema,
    eventName: z.string().transform((value) => value.toLowerCase()).pipe(z.literal("rg_office_assistant_menu")),
    // Menu arguments are undocumented. Fail closed on anything except the empty shape until a live launch proves it.
    eventArgs: z.object({}).strict(),
  })
  .strict();

export const serviceM8EventSchema = z.union([serviceM8JobEventSchema, serviceM8MenuEventSchema]);

export type ServiceM8JobEvent = z.infer<typeof serviceM8JobEventSchema>;
export type ServiceM8MenuEvent = z.infer<typeof serviceM8MenuEventSchema>;
export type ServiceM8Event = z.infer<typeof serviceM8EventSchema>;
