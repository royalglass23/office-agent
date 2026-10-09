import { describe, expect, it, vi } from "vitest";
import { loadPhaseZeroJobContext } from "@/lib/servicem8/job-context";
import type { ServiceM8Client } from "@/lib/servicem8/client";

const jobUUID = "0686ce69-4a5d-4f73-ad56-827ffaaced2b";
const companyUUID = "123e4567-cb72-4d94-8a1e-d454131257eb";

describe("loadPhaseZeroJobContext", () => {
  it("reads the Company only after the parent Job is authorised", async () => {
    const order: string[] = [];
    const client = {
      getJob: vi.fn(async () => {
        order.push("job");
        return { uuid: jobUUID, company_uuid: companyUUID, generated_job_id: "Q123", status: "Quote" };
      }),
      getCompany: vi.fn(async () => {
        order.push("company");
        return { uuid: companyUUID, name: "Example <Client>" };
      }),
    } as unknown as ServiceM8Client;
    const context = await loadPhaseZeroJobContext(client, jobUUID);
    expect(order).toEqual(["job", "company"]);
    expect(context.jobNumber).toBe("Q123");
  });

  it("does not request Company data when the Job read is denied", async () => {
    const getCompany = vi.fn();
    const client = {
      getJob: vi.fn(async () => { throw new Error("denied"); }),
      getCompany,
    } as unknown as ServiceM8Client;
    await expect(loadPhaseZeroJobContext(client, jobUUID)).rejects.toThrow("denied");
    expect(getCompany).not.toHaveBeenCalled();
  });
});
