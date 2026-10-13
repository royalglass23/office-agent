import { z } from "zod";
import type { ProofReader } from "./office-assistant-proof";
import type { ServiceM8Client } from "./client";
import { uuidSchema } from "./event-schema";

const rawJobSchema = z.object({
  uuid: uuidSchema,
  company_uuid: uuidSchema,
  generated_job_id: z.string().max(100),
  job_address: z.string().max(500).optional().default(""),
  status: z.string().max(100).optional().default(""),
  job_description: z.string().max(20_000).optional().default(""),
  work_done_description: z.string().max(20_000).optional().default(""),
  date: z.string().max(100).optional().default(""),
  edit_date: z.string().max(100).optional().default(""),
}).passthrough();

const rawCompanySchema = z.object({
  uuid: uuidSchema,
  name: z.string().max(500).optional().default(""),
}).passthrough();

const rawNoteSchema = z.object({
  uuid: uuidSchema,
  related_object: z.string().transform((value) => value.toLowerCase()).pipe(z.literal("job")),
  related_object_uuid: uuidSchema,
  note: z.string(),
  create_date: z.string().max(100),
  active: z.union([z.literal(0), z.literal(1)]).optional().default(1),
}).passthrough();

function mapJob(value: unknown) {
  const job = rawJobSchema.parse(value);
  return {
    uuid: job.uuid,
    companyUUID: job.company_uuid,
    jobNumber: job.generated_job_id,
    address: job.job_address,
    status: job.status,
    jobDescription: job.job_description,
    workDoneDescription: job.work_done_description,
    createdAt: job.date || job.edit_date,
  };
}

export class ServiceM8ProofReader implements ProofReader {
  constructor(private readonly client: ServiceM8Client) {}

  async listJobsByNumber(jobNumbers: readonly string[]) {
    return (await this.client.listJobsByNumber(jobNumbers)).map(mapJob);
  }

  async getJob(jobUUID: string) {
    return mapJob(await this.client.getJob(jobUUID));
  }

  async getCompany(companyUUID: string) {
    const company = rawCompanySchema.parse(await this.client.getCompany(companyUUID));
    return { uuid: company.uuid, name: company.name };
  }

  async readNotesPage(jobUUID: string, cursor: string | null) {
    const page = await this.client.listJobNotesPage(jobUUID, cursor);
    const notes = page.records
      .map((record) => rawNoteSchema.parse(record))
      .filter((note) => note.active === 1)
      .map((note) => ({
        uuid: note.uuid,
        jobUUID: note.related_object_uuid,
        text: note.note,
        createdAt: note.create_date,
      }));
    return { notes, nextCursor: page.nextCursor };
  }
}
