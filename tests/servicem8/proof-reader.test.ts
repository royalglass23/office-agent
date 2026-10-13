import { describe, expect, it, vi } from "vitest";
import { ServiceM8ProofReader } from "@/lib/servicem8/proof-reader";
import type { ServiceM8Client } from "@/lib/servicem8/client";

const jobUUID = "0686ce69-4a5d-4f73-ad56-827ffaaced2b";
const companyUUID = "123e4567-cb72-4d94-8a1e-d454131257eb";

describe("ServiceM8 proof reader", () => {
  it("maps only the bounded core Job fields", async () => {
    const client = {
      listJobsByNumber: vi.fn(async () => [{
        uuid: jobUUID,
        company_uuid: companyUUID,
        generated_job_id: "R260766",
        job_address: "10 Queen Street",
        status: "Work Order",
        job_description: "Replace front glass",
        work_done_description: "Measured",
        date: "2026-09-01T00:00:00Z",
        billing_address: "must not be mapped",
      }]),
    } as unknown as ServiceM8Client;

    await expect(new ServiceM8ProofReader(client).listJobsByNumber(["R260766"])).resolves.toEqual([{
      uuid: jobUUID,
      companyUUID,
      jobNumber: "R260766",
      address: "10 Queen Street",
      status: "Work Order",
      jobDescription: "Replace front glass",
      workDoneDescription: "Measured",
      createdAt: "2026-09-01T00:00:00Z",
    }]);
  });

  it("excludes inactive notes while preserving the verified pagination cursor", async () => {
    const nextCursor = "8af9e876-4d24-4db1-8c38-e984874872e8";
    const client = {
      listJobNotesPage: vi.fn(async () => ({
        records: [
          {
            uuid: "fdbe8af2-7590-48cc-8341-e5385879ba33",
            related_object: "job",
            related_object_uuid: jobUUID,
            note: "Site measured",
            create_date: "2026-09-02T10:30:00Z",
            active: 1,
          },
          {
            uuid: "95369538-e550-47ee-9f25-fc8945d0e6de",
            related_object: "job",
            related_object_uuid: jobUUID,
            note: "Deleted note",
            create_date: "2026-09-02T11:30:00Z",
            active: 0,
          },
        ],
        nextCursor,
      })),
    } as unknown as ServiceM8Client;

    await expect(new ServiceM8ProofReader(client).readNotesPage(jobUUID, null)).resolves.toEqual({
      notes: [{
        uuid: "fdbe8af2-7590-48cc-8341-e5385879ba33",
        jobUUID,
        text: "Site measured",
        createdAt: "2026-09-02T10:30:00Z",
      }],
      nextCursor,
    });
  });
});
