import { describe, expect, it, vi } from "vitest";
import { createOpenAIJobAdvisor, OpenAIJobAdviceError } from "@/lib/openai/job-advisor";

const evidence = [
  { id: "job:record", at: "2026-10-13T00:00:00.000Z", text: "Job number: R260766\nStatus: Work Order" },
  { id: "note:1", at: "2026-10-14T00:00:00.000Z", text: "Site measure postponed." },
];
const advice = {
  nextAction: "Confirm the current site measure position.",
  recipient: "internal",
  question: "Could you please confirm the current site measure position?",
  evidenceId: "note:1",
  evidenceQuote: "Site measure postponed.",
};

describe("OpenAI Job advisor", () => {
  it("requests non-stored structured advice from selected Job evidence", async () => {
    const fetcher = vi.fn(async () => Response.json({ status: "completed", output: [
      { type: "message", content: [{ type: "output_text", text: JSON.stringify(advice) }] },
    ] })) as unknown as typeof fetch;
    const advisor = createOpenAIJobAdvisor({ apiKey: "test-key", model: "gpt-test", fetcher });
    await expect(advisor.advise(evidence, "What should we do next?")).resolves.toEqual(advice);
    const [, init] = (fetcher as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body).toMatchObject({ model: "gpt-test", store: false,
      text: { format: { type: "json_schema", strict: true, name: "job_next_step" } } });
    expect(body.text.format.schema.properties.evidenceId.enum).toEqual(["note:1"]);
    expect(body.text.format.schema.properties.recipient.enum).toEqual(["customer", "builder", "supplier", "internal"]);
    expect(JSON.parse(body.input)).toMatchObject({ staffRequest: "What should we do next?", evidence });
  });

  it("rejects an invented evidence ID", async () => {
    const fetcher = vi.fn(async () => Response.json({ status: "completed", output: [
      { type: "message", content: [{ type: "output_text", text: JSON.stringify({ ...advice, evidenceId: "note:999" }) }] },
    ] })) as unknown as typeof fetch;
    const advisor = createOpenAIJobAdvisor({ apiKey: "test-key", model: "gpt-test", fetcher });
    await expect(advisor.advise(evidence, "What next?")).rejects.toBeInstanceOf(OpenAIJobAdviceError);
  });
});
