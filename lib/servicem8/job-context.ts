import { z } from "zod";
import { uuidSchema } from "./event-schema";
import type { ServiceM8Client } from "./client";

const jobSchema = z
  .object({
    uuid: uuidSchema,
    company_uuid: uuidSchema,
    generated_job_id: z.string().max(100).optional().default(""),
    status: z.string().max(100).optional().default(""),
  })
  .passthrough();

const companySchema = z
  .object({
    uuid: uuidSchema,
    name: z.string().max(500).optional().default(""),
  })
  .passthrough();

export type PhaseZeroJobContext = {
  jobUUID: string;
  jobNumber: string;
  jobStatus: string;
  companyUUID: string;
  companyName: string;
};

export async function loadPhaseZeroJobContext(client: ServiceM8Client, requestedJobUUID: string) {
  const job = jobSchema.parse(await client.getJob(requestedJobUUID));
  if (job.uuid !== requestedJobUUID) throw new Error("ServiceM8 returned a different Job");

  // The parent Job must be authorised before any child/client context is requested.
  const company = companySchema.parse(await client.getCompany(job.company_uuid));
  if (company.uuid !== job.company_uuid) throw new Error("ServiceM8 returned a different Company");

  return {
    jobUUID: job.uuid,
    jobNumber: job.generated_job_id,
    jobStatus: job.status,
    companyUUID: company.uuid,
    companyName: company.name,
  } satisfies PhaseZeroJobContext;
}
