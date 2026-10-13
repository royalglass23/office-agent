import { describe, expect, it, vi } from "vitest";
import {
  APPROVED_PROOF_JOB_NUMBERS,
  createOfficeAssistantProof,
  type ProofReader,
} from "@/lib/servicem8/office-assistant-proof";

const jobOne = {
  uuid: "0686ce69-4a5d-4f73-ad56-827ffaaced2b",
  companyUUID: "123e4567-cb72-4d94-8a1e-d454131257eb",
  jobNumber: "R260766",
  address: "10 Queen Street, Auckland",
  status: "Work Order",
  jobDescription: "Replace the front door glass.",
  workDoneDescription: "",
  createdAt: "2026-09-01T00:00:00Z",
};

function reader(overrides: Partial<ProofReader> = {}): ProofReader {
  return {
    listJobsByNumber: vi.fn(async () => [
      jobOne,
      { ...jobOne, uuid: "8af9e876-4d24-4db1-8c38-e984874872e8", jobNumber: "NOT-APPROVED" },
      { ...jobOne, uuid: "b96f6cde-f9ff-452c-bb0d-e3e81f93cb8e", jobNumber: "R260680", address: "10 Queen Road" },
    ]),
    getJob: vi.fn(async () => jobOne),
    getCompany: vi.fn(async () => ({ uuid: jobOne.companyUUID, name: "Example Customer" })),
    readNotesPage: vi.fn(async () => ({
      notes: [{
        uuid: "fdbe8af2-7590-48cc-8341-e5385879ba33",
        jobUUID: jobOne.uuid,
        text: "Site measure completed.",
        createdAt: "2026-09-02T10:30:00Z",
      }],
      nextCursor: null,
    })),
    ...overrides,
  };
}

describe("bounded Office Assistant proof", () => {
  it("searches natural address text only across the five approved Job numbers", async () => {
    const proofReader = reader();
    const proof = createOfficeAssistantProof({ reader: proofReader, summarizer: { summarize: vi.fn() } });

    await expect(proof.searchJobs("10 queen")).resolves.toEqual([
      expect.objectContaining({ jobNumber: "R260766" }),
      expect.objectContaining({ jobNumber: "R260680" }),
    ]);
    expect(proofReader.listJobsByNumber).toHaveBeenCalledWith(APPROVED_PROOF_JOB_NUMBERS);
  });

  it("rejects a Job outside the allowlist before reading ServiceM8 or calling OpenAI", async () => {
    const proofReader = reader();
    const summarize = vi.fn();
    const proof = createOfficeAssistantProof({ reader: proofReader, summarizer: { summarize } });

    await expect(proof.answerWhatHappened("R999999")).rejects.toThrow("Job is not approved for this proof");
    expect(proofReader.getJob).not.toHaveBeenCalled();
    expect(proofReader.getCompany).not.toHaveBeenCalled();
    expect(proofReader.readNotesPage).not.toHaveBeenCalled();
    expect(summarize).not.toHaveBeenCalled();
  });

  it("reauthorises the selected parent Job before reading customer and notes", async () => {
    const order: string[] = [];
    const proofReader = reader({
      getJob: vi.fn(async () => { order.push("job"); return jobOne; }),
      getCompany: vi.fn(async () => { order.push("company"); return { uuid: jobOne.companyUUID, name: "Example Customer" }; }),
      readNotesPage: vi.fn(async () => {
        order.push("notes");
        return {
          notes: [{
            uuid: "fdbe8af2-7590-48cc-8341-e5385879ba33",
            jobUUID: jobOne.uuid,
            text: "Site measure completed.",
            createdAt: "2026-09-02T10:30:00Z",
          }],
          nextCursor: null,
        };
      }),
    });
    const proof = createOfficeAssistantProof({
      reader: proofReader,
      summarizer: {
        summarize: async () => ({
          summary: { citations: ["note:1"] },
        }),
      },
      now: () => new Date("2026-10-13T00:00:00Z"),
    });

    const answer = await proof.answerWhatHappened("R260766");
    expect(order).toEqual(["job", "company", "notes"]);
    expect(answer.coverage).toEqual({
      included: ["core Job/customer fields", "Job diary notes"],
      excluded: ["email", "SMS", "forms", "attachments", "schedule activity"],
      noteCount: 1,
      truncated: false,
      snapshotAt: "2026-10-13T00:00:00.000Z",
    });
    expect(answer.timeline).toEqual([
      { at: "2026-09-01T00:00:00.000Z", text: expect.stringContaining("Job number: R260766"), citations: ["job:record"] },
      { at: "2026-09-02T10:30:00.000Z", text: "Site measure completed.", citations: ["note:1"] },
    ]);
  });

  it("rejects model claims that cite evidence outside the authorised snapshot", async () => {
    const proof = createOfficeAssistantProof({
      reader: reader(),
      summarizer: {
        summarize: async () => ({
          summary: { citations: ["notes:not-read"] },
        }),
      },
    });

    await expect(proof.answerWhatHappened("R260766")).rejects.toThrow("Proof answer has an unsupported citation");
  });

  it("never displays model-authored claims even when they cite authorised evidence", async () => {
    const proof = createOfficeAssistantProof({
      reader: reader(),
      summarizer: { summarize: async () => ({
        summary: { text: "The frameless shower was installed.", citations: ["note:1"] },
      }) as { summary: { citations: string[] } } },
    });

    const answer = await proof.answerWhatHappened("R260766");
    expect(answer.summary.text).toBe(
      "Job R260766 at 10 Queen Street, Auckland is recorded as Work Order. Key diary evidence: Site measure completed.",
    );
    expect(answer.summary.text).not.toContain("shower");
  });

  it.each([
    "Call the customer next.",
    "Hi Carla, here is the email draft.",
  ])("does not display model-authored action or draft text: %s", async (modelText) => {
    const proof = createOfficeAssistantProof({
      reader: reader(),
      summarizer: { summarize: async () => ({
        summary: { text: modelText, citations: ["note:1"] },
      }) as { summary: { citations: string[] } } },
    });

    const answer = await proof.answerWhatHappened("R260766");
    expect(answer.summary.text).not.toContain(modelText);
    expect(answer.summary.text).toContain("Site measure completed.");
  });

  it("redacts structured credentials before sending evidence to the summarizer", async () => {
    const summarize = vi.fn(async () => ({
      summary: { citations: ["note:1"] },
    }));
    const proof = createOfficeAssistantProof({
      reader: reader({
        readNotesPage: vi.fn(async () => ({
          notes: [{
            uuid: "fdbe8af2-7590-48cc-8341-e5385879ba33",
            jobUUID: jobOne.uuid,
            text: "password=hunter2 Bearer abcdefghijklmnop sk-abcdefghijklmnop refresh_token=secret123",
            createdAt: "2026-09-02T10:30:00Z",
          }],
          nextCursor: null,
        })),
      }),
      summarizer: { summarize },
    });

    await proof.answerWhatHappened("R260766");
    const submitted = JSON.stringify((summarize.mock.calls as unknown[][])[0][0]);
    expect(submitted).not.toContain("hunter2");
    expect(submitted).not.toContain("abcdefghijklmnop");
    expect(submitted).not.toContain("secret123");
    expect(submitted).toContain("secret redacted");
  });

  it("redacts quoted and JSON-shaped credentials before sending evidence to the summarizer", async () => {
    const summarize = vi.fn(async () => ({
      summary: { citations: ["note:1"] },
    }));
    const proof = createOfficeAssistantProof({
      reader: reader({
        readNotesPage: vi.fn(async () => ({
          notes: [{
            uuid: "fdbe8af2-7590-48cc-8341-e5385879ba33",
            jobUUID: jobOne.uuid,
            text: 'password="correct horse battery staple" {"client_secret":"secret123"}',
            createdAt: "2026-09-02T10:30:00Z",
          }],
          nextCursor: null,
        })),
      }),
      summarizer: { summarize },
    });

    await proof.answerWhatHappened("R260766");
    const submitted = JSON.stringify((summarize.mock.calls as unknown[][])[0][0]);
    expect(submitted).not.toContain("correct horse battery staple");
    expect(submitted).not.toContain("secret123");
    expect(submitted.match(/secret redacted/g)).toHaveLength(2);
  });
});
