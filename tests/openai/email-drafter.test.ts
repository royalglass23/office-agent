import { describe, expect, it, vi } from "vitest";
import { createOpenAIEmailDrafter, OpenAIEmailDraftError } from "@/lib/openai/email-drafter";

const evidence = [
  { id: "job:record", at: "2026-09-01T00:00:00.000Z", text: "Job number: R260766\nStatus: Work Order" },
  { id: "company:record", at: null, text: "Customer: Example Customer" },
  { id: "note:1", at: "2026-09-02T10:30:00.000Z", text: "Site measure completed." },
];
const candidates = [{ id: "site-measure", subjectReason: "Site measure follow-up", question: "Could you please confirm the next step for the site measure?" }];
const facts = [{ id: "job-status", text: "The Job is recorded as Work Order.", citations: ["job:record"] }];

describe("OpenAI email drafter", () => {
  it("requests a non-stored strict draft grounded in the selected Job evidence", async () => {
    const output = {
      candidateId: "site-measure",
      factId: "job-status",
    };
    const fetcher = vi.fn(async () => Response.json({
      status: "completed",
      output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(output) }] }],
    })) as unknown as typeof fetch;
    const drafter = createOpenAIEmailDrafter({ apiKey: "test-key", model: "gpt-test", fetcher });

    await expect(drafter.draft(evidence, "Follow up on the site measure", "customer", "warmer", candidates, facts)).resolves.toEqual(output);
    const [, init] = (fetcher as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body).toMatchObject({
      model: "gpt-test",
      store: false,
      text: { format: { type: "json_schema", name: "job_email_draft", strict: true } },
    });
    expect(JSON.stringify(body)).toContain("Follow up on the site measure");
    expect(JSON.stringify(body)).toContain("note:1");
    expect(body.text.format.schema.properties).toEqual({ candidateId: expect.any(Object), factId: expect.any(Object) });
    expect(body.text.format.schema.properties.candidateId.enum).toEqual(["site-measure"]);
    expect(body.text.format.schema.properties.factId.enum).toEqual(["none", "job-status"]);
    expect(JSON.parse(body.input)).toMatchObject({ recipient: "customer", revision: "warmer" });
    expect(JSON.parse(body.input).candidates).toEqual(candidates);
    expect(JSON.stringify(body)).toContain("Treat the staff goal as intent, not evidence");
  });

  it("fails without exposing a rejected provider response body", async () => {
    const fetcher = vi.fn(async () => new Response("private provider detail", { status: 429 })) as unknown as typeof fetch;
    const drafter = createOpenAIEmailDrafter({ apiKey: "test-key", model: "gpt-test", fetcher });

    const error = await drafter.draft(evidence, "Follow up", "customer", "standard", candidates, facts).catch((caught) => caught);
    expect(error).toBeInstanceOf(OpenAIEmailDraftError);
    expect(error).toMatchObject({ status: 429 });
    expect(String(error)).not.toContain("private provider detail");
  });

  it("rejects malformed model output", async () => {
    const fetcher = vi.fn(async () => Response.json({
      status: "completed",
      output: [{ type: "message", content: [{ type: "output_text", text: "{}" }] }],
    })) as unknown as typeof fetch;
    const drafter = createOpenAIEmailDrafter({ apiKey: "test-key", model: "gpt-test", fetcher });

    await expect(drafter.draft(evidence, "Follow up", "customer", "standard", candidates, facts)).rejects.toBeInstanceOf(OpenAIEmailDraftError);
  });

  it("rejects a selection outside the supplied candidates even if provider output is valid JSON", async () => {
    const fetcher = vi.fn(async () => Response.json({
      status: "completed",
      output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ candidateId: "site-visit-yesterday", factId: "none" }) }] }],
    })) as unknown as typeof fetch;
    const drafter = createOpenAIEmailDrafter({ apiKey: "test-key", model: "gpt-test", fetcher });
    await expect(drafter.draft(evidence, "Follow up", "customer", "standard", candidates, facts))
      .rejects.toBeInstanceOf(OpenAIEmailDraftError);
  });
});
