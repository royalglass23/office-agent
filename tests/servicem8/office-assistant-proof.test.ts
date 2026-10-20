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

  it("creates a grounded draft for the selected Job without sending anything", async () => {
    const proofReader = reader();
    const draft = vi.fn(async () => ({ candidateId: "site-measure", factId: "none" }));
    const proof = createOfficeAssistantProof({
      reader: proofReader,
      summarizer: { summarize: vi.fn() },
      drafter: { draft },
      now: () => new Date("2026-10-13T00:00:00Z"),
    });

    const result = await proof.draftEmail("R260766", "Follow up after the site measure");
    expect(result.job).toEqual({ jobNumber: "R260766", address: "10 Queen Street, Auckland", customerName: "Example Customer" });
    expect(result.draft.subject).toBe("10 Queen Street, Auckland (R260766) – Site measure follow-up");
    expect(result.draft.body).toContain("Could you please confirm the next step for the site measure?");
    expect(result.draft.body).not.toContain("Site measure completed.");
    expect(result.draft.citations).toEqual(["job:record", "company:record"]);
    expect(result.coverage.excluded).toContain("email");
    expect(draft).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: "note:1", text: "Site measure completed." })]),
      "Follow up after the site measure", "customer", "standard", expect.any(Array), expect.any(Array),
    );
    expect(proofReader.getJob).toHaveBeenCalledWith(jobOne.uuid);
  });

  it("uses the Job number when an address is absent and addresses internal staff", async () => {
    const noAddress = { ...jobOne, address: "" };
    const proof = createOfficeAssistantProof({
      reader: reader({ listJobsByNumber: vi.fn(async () => [noAddress]), getJob: vi.fn(async () => noAddress) }),
      summarizer: { summarize: vi.fn() },
      drafter: { draft: async () => ({ candidateId: "next-step", factId: "none" }) },
    });
    const result = await proof.draftEmail("R260766", "Confirm the next step", "internal");
    expect(result.draft.subject).toBe("R260766 – Next steps");
    expect(result.draft.body).toContain("Hi team,");
    expect(result.sources).toEqual(expect.arrayContaining([expect.objectContaining({ id: "job:record" })]));
  });

  it("includes a verified status when recommending a customer progress update", async () => {
    const proof = createOfficeAssistantProof({
      reader: reader(), summarizer: { summarize: vi.fn() },
      drafter: { draft: async () => ({ candidateId: "customer-update", factId: "none" }) },
    });
    const result = await proof.draftEmail("R260766", "Give the customer a progress update", "customer");
    expect(result.draft.body).toContain("The Job is recorded as Work Order.");
    expect(result.draft.body).toContain("Could you please let us know if you have any questions about this Job?");
    expect(result.draft.body).not.toContain("Could you please give the customer");
    expect(result.draft.citations).toEqual(["job:record", "company:record"]);
  });

  it("asks for a question-only goal when no verified progress fact is available", async () => {
    const blankStatus = { ...jobOne, status: "" };
    const draft = vi.fn();
    const proof = createOfficeAssistantProof({
      reader: reader({ listJobsByNumber: vi.fn(async () => [blankStatus]), getJob: vi.fn(async () => blankStatus) }),
      summarizer: { summarize: vi.fn() },
      drafter: { draft },
    });
    await expect(proof.draftEmail("R260766", "Give the customer a progress update"))
      .rejects.toThrow("do not support a progress update");
    expect(draft).not.toHaveBeenCalled();
  });

  it("offers a safe photo request that achieves the staff goal", async () => {
    const proof = createOfficeAssistantProof({
      reader: reader(), summarizer: { summarize: vi.fn() },
      drafter: { draft: async () => ({ candidateId: "condition-photos", factId: "none" }) },
    });
    const result = await proof.draftEmail("R260766", "Ask the customer to send photos of the broken window");
    expect(result.draft.body).toContain("Could you please send photos showing the current condition of the window?");
    expect(result.draft.body).not.toContain("broken window");
  });

  it("seeks clarification when a specific goal has no supported request", async () => {
    const draft = vi.fn();
    const proof = createOfficeAssistantProof({
      reader: reader(), summarizer: { summarize: vi.fn() }, drafter: { draft },
    });
    await expect(proof.draftEmail("R260766", "Ask the customer about the warranty"))
      .rejects.toThrow("Which should this email ask about?");
    expect(draft).not.toHaveBeenCalled();
  });

  it("keeps unverified BC approval as a question", async () => {
    const proof = createOfficeAssistantProof({
      reader: reader(), summarizer: { summarize: vi.fn() },
      drafter: { draft: async () => ({ candidateId: "bc-programming", factId: "none" }) },
    });
    const result = await proof.draftEmail("R260766", "Ask whether programming can proceed since BC has been approved");
    expect(result.draft.body).toContain("whether BC approval has been received");
    expect(result.draft.body).not.toContain("BC has been approved");
  });

  it("does not offer a completed site-measure fact when a later note conflicts", async () => {
    let offeredFacts: unknown;
    const proof = createOfficeAssistantProof({
      reader: reader({ readNotesPage: vi.fn(async () => ({ notes: [
        { uuid: "fdbe8af2-7590-48cc-8341-e5385879ba33", jobUUID: jobOne.uuid,
          text: "Site measure completed.", createdAt: "2026-09-02T10:30:00Z" },
        { uuid: "cb713735-8707-4c57-adbe-019b549c126b", jobUUID: jobOne.uuid,
          text: "Measurement postponed.", createdAt: "2026-09-03T10:30:00Z" },
      ], nextCursor: null })) }),
      summarizer: { summarize: vi.fn() },
      drafter: { draft: async (...args: unknown[]) => {
        offeredFacts = args[5];
        return { candidateId: "site-measure", factId: "none" };
      } },
    });
    const result = await proof.draftEmail("R260766", "Follow up after the site measure");
    expect(JSON.stringify(offeredFacts)).not.toContain("site-measure-complete");
    expect(result.draft.body).not.toContain("site measure is complete");
  });

  it("stops before reading Job evidence when a requested customer question is too vague", async () => {
    const proofReader = reader();
    const drafter = vi.fn();
    const proof = createOfficeAssistantProof({
      reader: proofReader, summarizer: { summarize: vi.fn() }, drafter: { draft: drafter },
    });
    await expect(proof.draftEmail("R260766", "Update the customer and ask about timing", "customer"))
      .rejects.toThrow("State the specific question");
    expect(proofReader.listJobsByNumber).not.toHaveBeenCalled();
    expect(drafter).not.toHaveBeenCalled();
  });

  it("redacts credentials in the staff purpose before requesting an email draft", async () => {
    const draft = vi.fn(async () => ({ candidateId: "bc-status", factId: "none" }));
    const proof = createOfficeAssistantProof({
      reader: reader(),
      summarizer: { summarize: vi.fn() },
      drafter: { draft },
    });

    await proof.draftEmail("R260766", "Ask about BC approval using api_key=secret123");

    expect(draft).toHaveBeenCalledWith(
      expect.any(Array), "Ask about BC approval using api_key=[secret redacted]", "customer", "standard",
      expect.any(Array), expect.any(Array),
    );
  });

  it("redacts private details from evidence sent to the model", async () => {
    let sentEvidence: readonly ProofEvidence[] = [];
    const proof = createOfficeAssistantProof({
      reader: reader({ readNotesPage: vi.fn(async () => ({
        notes: [{ uuid: "fdbe8af2-7590-48cc-8341-e5385879ba33", jobUUID: jobOne.uuid,
          text: "Call 021 123 4567 on 2026-10-20; api_key=secret123", createdAt: "2026-09-02T10:30:00Z" }],
        nextCursor: null,
      })) }),
      summarizer: { summarize: vi.fn() },
      drafter: { draft: async (evidence) => {
        sentEvidence = evidence;
        return { candidateId: "bc-status", factId: "none" };
      } },
    });
    await proof.draftEmail("R260766", "Ask about BC approval");
    const sent = JSON.stringify(sentEvidence);
    expect(sent).toContain("2026-10-20");
    expect(sent).toContain("[phone redacted]");
    expect(sent).toContain("api_key=[secret redacted]");
    expect(sent).not.toContain("021 123 4567");
    expect(sent).not.toContain("secret123");
  });

  it("rejects legacy citation-only model output", async () => {
    const proof = createOfficeAssistantProof({
      reader: reader(),
      summarizer: { summarize: vi.fn() },
      drafter: {
        draft: async () => ({ citations: ["email:not-read"] }) as unknown as { candidateId: string; factId: string },
      },
    });

    await expect(proof.draftEmail("R260766", "Give the customer an update")).rejects.toThrow(
      "Email suggestion is invalid",
    );
  });

  it("rejects an invented price even when the model cites authorised evidence", async () => {
    const proof = createOfficeAssistantProof({
      reader: reader(),
      summarizer: { summarize: vi.fn() },
      drafter: {
        draft: async () => ({
          subjectReason: "Price confirmed at $500",
          body: "The customer agreed to pay $500 tomorrow.",
          citations: ["job:record"],
        }) as unknown as { candidateId: string; factId: string },
      },
    });

    await expect(proof.draftEmail("R260766", "Give the customer a progress update"))
      .rejects.toThrow("Email suggestion is invalid");
  });

  it("uses a grounded AI email recommendation instead of the fixed template", async () => {
    const draft = vi.fn(async () => ({ candidateId: "proposed-day", factId: "none" }));
    const proof = createOfficeAssistantProof({
      reader: reader(),
      summarizer: { summarize: vi.fn() },
      drafter: { draft },
    });

    const result = await proof.draftEmail("R260766", "Update the customer and ask whether Friday works for installation", "customer", "warmer");

    expect(draft).toHaveBeenCalledWith(expect.any(Array), expect.any(String), "customer", "warmer", expect.arrayContaining([
      { id: "proposed-day", subjectReason: "Installation timing", question: "Would Friday suit you for installation?" },
    ]), expect.any(Array));
    expect(result.draft.subject).toBe("10 Queen Street, Auckland (R260766) – Installation timing");
    expect(result.draft.body).toContain("Would Friday suit you for installation?");
    expect(result.draft.body).toContain("I hope you're well.");
    expect(result.draft.body).toContain("The Job is recorded as Work Order.");
    expect(result.draft.citations).toEqual(["job:record", "company:record"]);
  });

  it.each([
    ["builder", "Coordinate site access with the builder", "builder-site", "Could you please confirm site timing and access requirements?"],
    ["supplier", "Coordinate material delivery with the supplier", "supplier-materials", "Could you please confirm material availability and expected delivery timing?"],
    ["customer", "Follow up with the customer about the quote", "quote", "Could you please confirm the current quote position and any next steps?"],
  ] as const)("recommends a bounded %s email for %s", async (recipient, purpose, candidateId, question) => {
    const proof = createOfficeAssistantProof({
      reader: reader(),
      summarizer: { summarize: vi.fn() },
      drafter: { draft: async () => ({ candidateId, factId: "none" }) },
    });
    const result = await proof.draftEmail("R260766", purpose, recipient);
    expect(result.draft.body).toContain(question);
    expect(result.draft.subject).toContain("10 Queen Street, Auckland (R260766)");
  });

  it("does not offer a candidate that repeats unverified causal claims from the goal", async () => {
    let offeredCandidates: unknown;
    const draft = vi.fn(async (...args: unknown[]) => {
      offeredCandidates = args[4];
      return { candidateId: "bc-programming", factId: "none" };
    });
    const proof = createOfficeAssistantProof({
      reader: reader(),
      summarizer: { summarize: vi.fn() },
      drafter: { draft },
    });
    const result = await proof.draftEmail("R260766", "Ask whether programming can proceed since BC has been approved");
    expect(JSON.stringify(offeredCandidates)).not.toContain("has been approved");
    expect(JSON.stringify(offeredCandidates)).not.toContain("booked");
    expect(result.draft.body).toContain("whether BC approval has been received");
    expect(result.draft.body).not.toContain("BC has been approved");
  });

  it("uses only server-verified facts for a progress line", async () => {
    const proof = createOfficeAssistantProof({
      reader: reader(),
      summarizer: { summarize: vi.fn() },
      drafter: { draft: async () => ({ candidateId: "site-measure", factId: "job-status" }) },
    });
    const result = await proof.draftEmail("R260766", "Follow up on the site measure");
    expect(result.draft.body).toContain("The Job is recorded as Work Order.");
    expect(result.draft.body).not.toContain("site measure is complete");
    expect(result.draft.citations).toContain("job:record");
  });

  it("rejects unknown AI options instead of displaying invented prose", async () => {
    const proof = createOfficeAssistantProof({
      reader: reader(),
      summarizer: { summarize: vi.fn() },
      drafter: { draft: async () => ({ candidateId: "site-visit-yesterday", factId: "none" }) },
    });
    await expect(proof.draftEmail("R260766", "Ask whether BC approval has been received"))
      .rejects.toThrow("Email suggestion is invalid");
  });

  it("rejects a fact option that is not available from this Job's notes", async () => {
    const proof = createOfficeAssistantProof({
      reader: reader({ readNotesPage: vi.fn(async () => ({ notes: [], nextCursor: null })) }),
      summarizer: { summarize: vi.fn() },
      drafter: { draft: async () => ({ candidateId: "customer-update", factId: "site-measure-complete" }) },
    });
    await expect(proof.draftEmail("R260766", "Give the customer a progress update"))
      .rejects.toThrow("Email suggestion is invalid");
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
      drafter: { draft: async () => ({ candidateId: "customer-update", factId: "job-status" }) },
    });

    const result = await proof.draftEmail("R260766", "Give the customer a progress update");

    expect(result.draft.body.length).toBeLessThanOrEqual(5_000);
    expect(result.draft.body).toContain("Kind regards,\nRoyal Glass");
    expect(result.draft.citations).toEqual(["job:record", "company:record"]);
  });

  it("recommends from an exact checked note without drafting an email", async () => {
    const advise = vi.fn(async () => ({
      recipient: "internal" as const,
      evidenceId: "note:1", evidenceQuote: "Site measure completed.",
    }));
    const proof = createOfficeAssistantProof({ reader: reader(), summarizer: { summarize: vi.fn() }, advisor: { advise } });
    const result = await proof.adviseJob("R260766", "What should we do next?");
    expect(advise).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: "note:1" })]), "What should we do next?");
    expect(result.recommendation.source.id).toBe("note:1");
    expect(result.recommendation.quote).toBe("Site measure completed.");
    expect(result.recommendation.nextAction).toBe("Confirm the current site measure status with the office team before deciding the next step.");
    expect(result.draft).toBeNull();
    expect(result.coverage.excluded).toContain("email");
  });

  it("accepts the evidence selection without unused model-written prose", async () => {
    const proof = createOfficeAssistantProof({ reader: reader(), summarizer: { summarize: vi.fn() }, advisor: {
      advise: async () => ({ recipient: "internal", evidenceId: "note:1", evidenceQuote: "Site measure completed." }),
    } });
    const result = await proof.adviseJob("R260766");
    expect(result.recommendation.nextAction).toContain("site measure status");
  });

  it("prepares a question-only draft when staff explicitly ask for email", async () => {
    const proof = createOfficeAssistantProof({ reader: reader(), summarizer: { summarize: vi.fn() }, advisor: {
      advise: async () => ({ recipient: "internal", evidenceId: "note:1", evidenceQuote: "Site measure completed." }),
    } });
    const result = await proof.adviseJob("R260766", "Draft an email about the next step", true);
    expect(result.draft?.subject).toBe("10 Queen Street, Auckland (R260766) – Job follow-up");
    expect(result.draft?.body).toContain("Could you please confirm the current site measure status for Job R260766?");
    expect(result.draft?.body).not.toContain("Site measure completed.");
    expect(result.draft?.citations).toEqual(["job:record", "note:1"]);
  });

  it("rejects a model recommendation when its quoted note text does not match", async () => {
    const proof = createOfficeAssistantProof({ reader: reader(), summarizer: { summarize: vi.fn() }, advisor: {
      advise: async () => ({ recipient: "customer", evidenceId: "note:1", evidenceQuote: "Customer paid in full." }),
    } });
    await expect(proof.adviseJob("R260766")).rejects.toThrow("not supported by the checked notes");
  });

  it("writes a cautious question from an exact note excerpt", async () => {
    const proof = createOfficeAssistantProof({ reader: reader(), summarizer: { summarize: vi.fn() }, advisor: {
      advise: async () => ({ recipient: "customer", evidenceId: "note:1", evidenceQuote: "Site measure completed." }),
    } });
    const result = await proof.adviseJob("R260766", "Draft an email to the customer", true);
    expect(result.recommendation.nextAction).toBe("Confirm the current site measure status with the customer before deciding the next step.");
    expect(result.draft?.body).not.toMatch(/password|deposit/);
    expect(result.draft?.body).toContain("Could you please confirm the current site measure status for Job R260766?");
  });

  it("uses the staff's explicit recipient over a conflicting model contact", async () => {
    const proof = createOfficeAssistantProof({ reader: reader(), summarizer: { summarize: vi.fn() }, advisor: {
      advise: async () => ({ recipient: "internal", evidenceId: "note:1", evidenceQuote: "Site measure completed." }),
    } });
    const result = await proof.adviseJob("R260766", "Draft an email to the customer", true);
    expect(result.recommendation.suggestedContact).toBe("customer");
    expect(result.recommendation.nextAction).toContain("the customer");
  });

  it("uses the addressed contact rather than a contact mentioned in the topic", async () => {
    const proof = createOfficeAssistantProof({ reader: reader(), summarizer: { summarize: vi.fn() }, advisor: {
      advise: async () => ({ recipient: "builder", evidenceId: "note:1", evidenceQuote: "Site measure completed." }),
    } });
    const result = await proof.adviseJob("R260766", "Draft an email to the builder about the customer's measurements", true);
    expect(result.recommendation.suggestedContact).toBe("builder");
    expect(result.draft?.body).toContain("site measure status");
  });

  it("does not ask AI for a next action when no Job notes are available", async () => {
    const advise = vi.fn();
    const proof = createOfficeAssistantProof({ reader: reader({ readNotesPage: vi.fn(async () => ({ notes: [], nextCursor: null })) }),
      summarizer: { summarize: vi.fn() }, advisor: { advise } });
    await expect(proof.adviseJob("R260766")).rejects.toThrow("No Job notes were available");
    expect(advise).not.toHaveBeenCalled();
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
