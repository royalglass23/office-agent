import { describe, expect, it, vi } from "vitest";
import {
  createOfficeAssistantProof,
  type ProofEvidence,
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
    listJobsPage: vi.fn(async () => ({ jobs: [jobOne], nextCursor: null })),
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
  it("searches natural address text across cursor-paginated Jobs", async () => {
    const nextCursor = "95369538-e550-47ee-9f25-fc8945d0e6de";
    const selectedJob = {
      ...jobOne,
      uuid: "8af9e876-4d24-4db1-8c38-e984874872e8",
      jobNumber: "R999999",
      address: "99 New Street, Auckland",
    };
    const listJobsPage = vi.fn(async (cursor: string | null) => cursor === null
      ? { jobs: [jobOne], nextCursor }
      : { jobs: [selectedJob], nextCursor: null });
    const proofReader = Object.assign(reader(), { listJobsPage });
    const proof = createOfficeAssistantProof({ reader: proofReader, summarizer: { summarize: vi.fn() } });

    await expect(proof.searchJobs("99 new street")).resolves.toEqual([
      expect.objectContaining({ jobNumber: "R999999", address: "99 New Street, Auckland" }),
    ]);
    expect(listJobsPage).toHaveBeenNthCalledWith(1, null);
    expect(listJobsPage).toHaveBeenNthCalledWith(2, nextCursor);
  });

  it("uses one exact filtered lookup for a Job-number search", async () => {
    const proofReader = reader();
    const proof = createOfficeAssistantProof({ reader: proofReader, summarizer: { summarize: vi.fn() } });

    await expect(proof.searchJobs("r260680")).resolves.toEqual([
      expect.objectContaining({ jobNumber: "R260680" }),
    ]);
    expect(proofReader.listJobsByNumber).toHaveBeenCalledWith(["R260680"]);
    expect(proofReader.listJobsPage).not.toHaveBeenCalled();
  });

  it("asks for a more specific reference instead of returning an unbounded match list", async () => {
    const jobs = Array.from({ length: 21 }, (_, index) => ({
      ...jobOne,
      jobNumber: `R${String(300000 + index)}`,
      address: `${index + 1} Example Road, Auckland`,
    }));
    const proof = createOfficeAssistantProof({
      reader: reader({ listJobsPage: vi.fn(async () => ({ jobs, nextCursor: null })) }),
      summarizer: { summarize: vi.fn() },
    });

    await expect(proof.searchJobs("Auckland")).rejects.toThrow("more specific Job reference");
  });

  it("answers for a selected Job outside the former five-Job allowlist", async () => {
    const selectedJob = {
      ...jobOne,
      uuid: "8af9e876-4d24-4db1-8c38-e984874872e8",
      jobNumber: "R999999",
      address: "99 New Street, Auckland",
    };
    const proofReader = reader({
      listJobsByNumber: vi.fn(async () => [selectedJob]),
      getJob: vi.fn(async () => selectedJob),
      readNotesPage: vi.fn(async () => ({ notes: [], nextCursor: null })),
    });
    const summarize = vi.fn(async () => ({ summary: { citations: ["job:record"] } }));
    const proof = createOfficeAssistantProof({ reader: proofReader, summarizer: { summarize } });

    await expect(proof.answerWhatHappened("R999999")).resolves.toMatchObject({
      job: { jobNumber: "R999999", address: "99 New Street, Auckland" },
    });
    expect(proofReader.getJob).toHaveBeenCalledWith(selectedJob.uuid);
    expect(proofReader.getCompany).toHaveBeenCalledWith(selectedJob.companyUUID);
    expect(summarize).toHaveBeenCalledOnce();
  });

  it("creates a grounded draft for a selected Job without sending anything", async () => {
    const proofReader = reader();
    const draft = vi.fn(async () => ({
      citations: ["company:record", "note:1"],
    }));
    const proof = createOfficeAssistantProof({
      reader: proofReader,
      summarizer: { summarize: vi.fn() },
      drafter: { draft },
      now: () => new Date("2026-10-13T00:00:00Z"),
    });

    await expect(proof.draftEmail("R260766", "Follow up after the site measure")).resolves.toEqual({
      job: { jobNumber: "R260766", address: "10 Queen Street, Auckland", customerName: "Example Customer" },
      purpose: "Follow up after the site measure",
      draft: {
        subject: "R260766 – Site measure follow-up",
        body: [
          "Hello,",
          "",
          "I'm writing regarding Job R260766 at 10 Queen Street, Auckland.",
          "",
          "Could you please follow up after the site measure?",
          "",
          "Our records show the site measure is complete.",
          "",
          "Kind regards,",
          "Royal Glass",
        ].join("\n"),
        citations: ["job:record", "company:record", "note:1"],
      },
      coverage: {
        included: ["core Job/customer fields", "Job diary notes"],
        excluded: ["email", "SMS", "forms", "attachments", "schedule activity"],
        noteCount: 1,
        truncated: false,
        snapshotAt: "2026-10-13T00:00:00.000Z",
      },
    });
    expect(draft).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: "note:1", text: "Site measure completed." })]),
      "Follow up after the site measure",
    );
    expect(proofReader.getJob).toHaveBeenCalledWith(jobOne.uuid);
  });

  it("uses and cites a selected diary fact in the draft", async () => {
    const proof = createOfficeAssistantProof({
      reader: reader(),
      summarizer: { summarize: vi.fn() },
      drafter: { draft: async () => ({ citations: ["note:1"] }) },
    });

    const result = await proof.draftEmail("R260766", "Give the customer a progress update");

    expect(result.draft.body).toContain("Our records show the site measure is complete.");
    expect(result.draft.body).not.toContain("Site measure completed.");
    expect(result.draft.citations).toContain("note:1");
  });

  it.each([
    "Site measure completed? Waiting for confirmation.",
    "Site measure completed was entered in error; the visit was postponed.",
  ])("does not turn an uncertain diary note into a completed measure: %s", async (noteText) => {
    const proof = createOfficeAssistantProof({
      reader: reader({ readNotesPage: vi.fn(async () => ({ notes: [{
        uuid: "fdbe8af2-7590-48cc-8341-e5385879ba33", jobUUID: jobOne.uuid,
        text: noteText, createdAt: "2026-09-02T10:30:00Z",
      }], nextCursor: null })) }),
      summarizer: { summarize: vi.fn() },
      drafter: { draft: async () => ({ citations: ["note:1"] }) },
    });

    const result = await proof.draftEmail("R260766", "Give the customer a progress update");

    expect(result.draft.body).not.toContain("site measure is complete");
    expect(result.draft.citations).not.toContain("note:1");
  });

  it("does not assert measure completion when Job diary notes conflict", async () => {
    const proof = createOfficeAssistantProof({
      reader: reader({ readNotesPage: vi.fn(async () => ({ notes: [
        { uuid: "fdbe8af2-7590-48cc-8341-e5385879ba33", jobUUID: jobOne.uuid,
          text: "Site measure completed.", createdAt: "2026-09-02T10:30:00Z" },
        { uuid: "cb713735-8707-4c57-adbe-019b549c126b", jobUUID: jobOne.uuid,
          text: "Site measure pending after recheck.", createdAt: "2026-09-03T10:30:00Z" },
      ], nextCursor: null })) }),
      summarizer: { summarize: vi.fn() },
      drafter: { draft: async () => ({ citations: ["note:1"] }) },
    });

    const result = await proof.draftEmail("R260766", "Give the customer a progress update");

    expect(result.draft.body).not.toContain("site measure is complete");
    expect(result.draft.citations).not.toContain("note:1");
    expect(result.draft.citations).not.toContain("note:2");
  });

  it("writes a customer progress update instead of asking someone else to write one", async () => {
    const proof = createOfficeAssistantProof({
      reader: reader(),
      summarizer: { summarize: vi.fn() },
      drafter: { draft: async () => ({ citations: ["job:record"] }) },
    });

    const result = await proof.draftEmail("R260766", "Give the customer a progress update");

    expect(result.draft.body).toContain("I wanted to share an update on your Job.");
    expect(result.draft.body).toContain("The Job is recorded as Work Order.");
    expect(result.draft.body).not.toContain("Could you please give the customer");
  });

  it("keeps the BC question in a customer progress update", async () => {
    const proof = createOfficeAssistantProof({
      reader: reader({ readNotesPage: vi.fn(async () => ({ notes: [], nextCursor: null })) }),
      summarizer: { summarize: vi.fn() },
      drafter: { draft: async () => ({ citations: ["job:record"] }) },
    });

    const result = await proof.draftEmail(
      "R260766",
      "Give the customer a progress update and ask whether BC approval has been received before programming.",
    );

    expect(result.draft.body).toContain("I wanted to share an update on your Job.");
    expect(result.draft.body).toContain("confirm whether BC approval has been received");
    expect(result.draft.body).not.toContain("following the BC approval");
  });

  it("writes a concise BC programming request without copying notes or addressing a company as a person", async () => {
    const proofReader = reader({
      getCompany: vi.fn(async () => ({ uuid: jobOne.companyUUID, name: "urbanscapes" })),
      readNotesPage: vi.fn(async () => ({ notes: [{
        uuid: "fdbe8af2-7590-48cc-8341-e5385879ba33",
        jobUUID: jobOne.uuid,
        text: "Date: 14/10/2026. BC has been approved. Called Matt at 021 123 4567. Raw internal note wording.",
        createdAt: "2026-10-14T00:00:00Z",
      }], nextCursor: null })),
    });
    const proof = createOfficeAssistantProof({
      reader: proofReader,
      summarizer: { summarize: vi.fn() },
      drafter: { draft: async () => ({ citations: ["note:1"] }) },
    });
    const result = await proof.draftEmail("R260766", "Ask Matt to confirm whether the Job can now be programmed because the BC has been approved.");
    expect(result.draft.subject).toMatch(/R260766.*programming.*BC/i);
    expect(result.draft.subject.length).toBeLessThan(80);
    expect(result.draft.body).toContain("Hello,");
    expect(result.draft.body).toMatch(/please confirm whether.*programmed/i);
    expect(result.draft.body).not.toContain("Hi urbanscapes");
    expect(result.draft.body).not.toContain("Raw internal note wording");
    expect(result.draft.body).not.toContain("[phone redacted]");
    expect(result.draft.citations).toContain("note:1");
    expect(result.coverage.noteCount).toBe(1);
  });

  it("preserves dates while redacting phone numbers in evidence sent for drafting", async () => {
    const draft = vi.fn(async (evidence: readonly ProofEvidence[]) => {
      expect(evidence.length).toBeGreaterThan(0);
      return { citations: ["note:1"] };
    });
    const proof = createOfficeAssistantProof({
      reader: reader({ readNotesPage: vi.fn(async () => ({ notes: [{
        uuid: "fdbe8af2-7590-48cc-8341-e5385879ba33", jobUUID: jobOne.uuid,
        text: "Date: 2026-10-14; approved: 14.10.2026. Phone: 021 123 4567.", createdAt: "2026-10-14T00:00:00Z",
      }], nextCursor: null })) }),
      summarizer: { summarize: vi.fn() }, drafter: { draft },
    });
    await proof.draftEmail("R260766", "Request an update");
    const submitted = draft.mock.calls[0][0].find((item) => item.id === "note:1")?.text;
    expect(submitted).toContain("2026-10-14");
    expect(submitted).toContain("14.10.2026");
    expect(submitted).toContain("[phone redacted]");
    expect(submitted).not.toContain("021 123 4567");
  });

  it("asks for BC status when the selected evidence does not confirm approval", async () => {
    const proof = createOfficeAssistantProof({
      reader: reader({ readNotesPage: vi.fn(async () => ({ notes: [], nextCursor: null })) }),
      summarizer: { summarize: vi.fn() },
      drafter: { draft: async () => ({ citations: ["job:record"] }) },
    });
    const result = await proof.draftEmail("R260766", "Ask whether the Job can be programmed because BC was approved");
    expect(result.draft.subject).toContain("Confirm BC status and programming");
    expect(result.draft.body).toContain("confirm whether BC approval has been received");
    expect(result.draft.body).not.toContain("following the BC approval");
    expect(result.draft.citations).toEqual(["job:record", "company:record"]);
  });

  it("does not claim BC approval when a cited note says approval is pending", async () => {
    const proof = createOfficeAssistantProof({
      reader: reader({ readNotesPage: vi.fn(async () => ({ notes: [{
        uuid: "fdbe8af2-7590-48cc-8341-e5385879ba33", jobUUID: jobOne.uuid,
        text: "BC has not been approved; approval pending.", createdAt: "2026-10-14T00:00:00Z",
      }], nextCursor: null })) }),
      summarizer: { summarize: vi.fn() },
      drafter: { draft: async () => ({ citations: ["note:1"] }) },
    });
    const result = await proof.draftEmail("R260766", "Ask Matt to confirm whether the Job can now be programmed because BC has been approved.");
    expect(result.draft.subject).toContain("Confirm BC status and programming");
    expect(result.draft.body).toContain("confirm whether BC approval has been received");
    expect(result.draft.body).not.toContain("following the BC approval");
  });

  it("does not claim BC approval when selected notes conflict", async () => {
    const proof = createOfficeAssistantProof({
      reader: reader({ readNotesPage: vi.fn(async () => ({ notes: [
        { uuid: "fdbe8af2-7590-48cc-8341-e5385879ba33", jobUUID: jobOne.uuid,
          text: "BC has been approved.", createdAt: "2026-10-13T00:00:00Z" },
        { uuid: "cb713735-8707-4c57-adbe-019b549c126b", jobUUID: jobOne.uuid,
          text: "BC approval pending confirmation.", createdAt: "2026-10-14T00:00:00Z" },
      ], nextCursor: null })) }),
      summarizer: { summarize: vi.fn() },
      drafter: { draft: async () => ({ citations: ["note:1", "note:2"] }) },
    });
    const result = await proof.draftEmail("R260766", "Ask whether the Job can be programmed because BC was approved");
    expect(result.draft.subject).toContain("Confirm BC status and programming");
    expect(result.draft.body).toContain("confirm whether BC approval has been received");
  });

  it("keeps a date beside a phone number while redacting only the phone number", async () => {
    const draft = vi.fn(async (evidence: readonly ProofEvidence[]) => {
      expect(evidence.length).toBeGreaterThan(0);
      return { citations: ["note:1"] };
    });
    const proof = createOfficeAssistantProof({
      reader: reader({ readNotesPage: vi.fn(async () => ({ notes: [{
        uuid: "fdbe8af2-7590-48cc-8341-e5385879ba33", jobUUID: jobOne.uuid,
        text: "Date: 14.10.2026 021 123 4567", createdAt: "2026-10-14T00:00:00Z",
      }], nextCursor: null })) }),
      summarizer: { summarize: vi.fn() }, drafter: { draft },
    });
    await proof.draftEmail("R260766", "Request an update");
    const submitted = draft.mock.calls[0][0].find((item) => item.id === "note:1")?.text;
    expect(submitted).toContain("Date: 14.10.2026");
    expect(submitted).toContain("[phone redacted]");
    expect(submitted).not.toContain("021 123 4567");
  });

  it("summarises a general request in the subject instead of copying its full purpose", async () => {
    const proof = createOfficeAssistantProof({
      reader: reader(), summarizer: { summarize: vi.fn() },
      drafter: { draft: async () => ({ citations: ["job:record"] }) },
    });
    const purpose = "Ask Matt to confirm the installation date because the glass has arrived.";
    const result = await proof.draftEmail("R260766", purpose);
    expect(result.draft.subject).toBe("R260766 – Confirm installation date");
    expect(result.draft.subject).not.toContain("because the glass has arrived");
    expect(result.draft.body).toContain("confirm the installation date");
  });

  it.each([
    ["Request an update", "R260766 – Update request"],
    ["Give the customer a progress update", "R260766 – Progress update"],
  ])("creates a concise subject for %s", async (purpose, expectedSubject) => {
    const proof = createOfficeAssistantProof({
      reader: reader(), summarizer: { summarize: vi.fn() },
      drafter: { draft: async () => ({ citations: ["job:record"] }) },
    });
    const result = await proof.draftEmail("R260766", purpose);
    expect(result.draft.subject).toBe(expectedSubject);
  });

  it("uses a short purpose topic when no subject template matches", async () => {
    const proof = createOfficeAssistantProof({
      reader: reader(), summarizer: { summarize: vi.fn() },
      drafter: { draft: async () => ({ citations: ["job:record"] }) },
    });
    const purpose = "Discuss the revised quote with Matt before arranging a call.";
    const result = await proof.draftEmail("R260766", purpose);
    expect(result.draft.subject).toBe("R260766 – Regarding revised quote");
    expect(result.draft.subject).not.toContain("Matt");
    expect(result.draft.body).toContain("discuss the revised quote with Matt");
  });

  it("keeps the requested action and topic in an unmatched subject", async () => {
    const proof = createOfficeAssistantProof({
      reader: reader(), summarizer: { summarize: vi.fn() },
      drafter: { draft: async () => ({ citations: ["job:record"] }) },
    });
    const purpose = "Reschedule the site visit with Matt before Friday.";
    const result = await proof.draftEmail("R260766", purpose);
    expect(result.draft.subject).toBe("R260766 – Reschedule site visit");
    expect(result.draft.body).toContain("reschedule the site visit with Matt before Friday");
  });

  it.each([
    ["Follow up with Matt about the revised quote.", "R260766 – Revised quote follow-up"],
    ["Resolve scheduling conflict for next week's install.", "R260766 – Resolve scheduling conflict"],
  ])("keeps a concise topic for unmatched purpose %s", async (purpose, expectedSubject) => {
    const proof = createOfficeAssistantProof({
      reader: reader(), summarizer: { summarize: vi.fn() },
      drafter: { draft: async () => ({ citations: ["job:record"] }) },
    });
    const result = await proof.draftEmail("R260766", purpose);
    expect(result.draft.subject).toBe(expectedSubject);
    expect(result.draft.subject).not.toContain(purpose);
  });

  it.each([
    ["Apply for BC approval.", "BC approval"],
    ["Submit plans for council approval.", "council approval"],
    ["Discuss plans for council approval with Matt.", "council approval"],
  ])("retains an essential for-phrase in the subject for %s", async (purpose, topic) => {
    const proof = createOfficeAssistantProof({
      reader: reader(), summarizer: { summarize: vi.fn() },
      drafter: { draft: async () => ({ citations: ["job:record"] }) },
    });
    const result = await proof.draftEmail("R260766", purpose);
    expect(result.draft.subject).toContain(topic);
    expect(result.draft.subject.length).toBeLessThan(80);
  });

  it("redacts credentials in the staff purpose before requesting an email draft", async () => {
    const draft = vi.fn(async () => ({ subject: "Update", body: "Draft body", citations: ["job:record"] }));
    const proof = createOfficeAssistantProof({
      reader: reader(),
      summarizer: { summarize: vi.fn() },
      drafter: { draft },
    });

    await proof.draftEmail("R260766", "Follow up using api_key=secret123");

    expect(draft).toHaveBeenCalledWith(expect.any(Array), "Follow up using api_key=[secret redacted]");
  });

  it("rejects an email draft whose citations are outside the selected Job evidence", async () => {
    const proof = createOfficeAssistantProof({
      reader: reader(),
      summarizer: { summarize: vi.fn() },
      drafter: {
        draft: async () => ({ subject: "Update", body: "An unsupported claim", citations: ["email:not-read"] }),
      },
    });

    await expect(proof.draftEmail("R260766", "Give the customer an update")).rejects.toThrow(
      "Email draft has an unsupported citation",
    );
  });

  it("never displays model-authored facts even when they cite authorised evidence", async () => {
    const proof = createOfficeAssistantProof({
      reader: reader(),
      summarizer: { summarize: vi.fn() },
      drafter: {
        draft: async () => ({
          subject: "Price confirmed at $500",
          body: "The customer agreed to pay $500 tomorrow.",
          citations: ["job:record"],
        }),
      },
    });

    const result = await proof.draftEmail("R260766", "Give the customer a progress update");

    expect(result.draft.subject).not.toContain("$500");
    expect(result.draft.body).not.toContain("$500");
    expect(result.draft.body).not.toContain("agreed to pay");
    expect(result.draft.citations).toEqual(["job:record", "company:record"]);
  });

  it("keeps the server-built email body within the established display limit", async () => {
    const notes = [
      ["fdbe8af2-7590-48cc-8341-e5385879ba33", "A"],
      ["cb713735-8707-4c57-adbe-019b549c126b", "B"],
      ["c8fa065e-0983-4177-a6f0-136aec61030c", "C"],
    ].map(([uuid, value], index) => ({
      uuid,
      jobUUID: jobOne.uuid,
      text: value.repeat(2_000),
      createdAt: `2026-09-0${index + 2}T10:30:00Z`,
    }));
    const proof = createOfficeAssistantProof({
      reader: reader({ readNotesPage: vi.fn(async () => ({ notes, nextCursor: null })) }),
      summarizer: { summarize: vi.fn() },
      drafter: { draft: async () => ({ citations: ["note:1", "note:2", "note:3"] }) },
    });

    const result = await proof.draftEmail("R260766", "Give the customer a progress update");

    expect(result.draft.body.length).toBeLessThanOrEqual(5_000);
    expect(result.draft.body).toContain("Kind regards,\nRoyal Glass");
    expect(result.draft.citations).toEqual(["job:record", "company:record"]);
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
