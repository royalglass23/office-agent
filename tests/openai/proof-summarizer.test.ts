import { describe, expect, it, vi } from "vitest";
import { createOpenAIProofSummarizer, OpenAIProofError } from "@/lib/openai/proof-summarizer";

const evidence = [
  { id: "job:record", at: "2026-09-01T00:00:00.000Z", text: "Job number: R260766\nStatus: Work Order" },
  { id: "note:1", at: "2026-09-02T10:30:00.000Z", text: "Site measure completed." },
];

describe("OpenAI proof summarizer", () => {
  it("requests a non-stored strict structured answer from the configured model", async () => {
    const output = {
      summary: { citations: ["note:1"] },
    };
    const fetcher = vi.fn(async () => Response.json({
      status: "completed",
      output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(output) }] }],
    })) as unknown as typeof fetch;
    const summarizer = createOpenAIProofSummarizer({ apiKey: "test-key", model: "gpt-test", fetcher });

    await expect(summarizer.summarize(evidence)).resolves.toEqual(output);
    const [url, init] = (fetcher as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toBe("https://api.openai.com/v1/responses");
    expect(new Headers((init as RequestInit).headers).get("authorization")).toBe("Bearer test-key");
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body).toMatchObject({
      model: "gpt-test",
      store: false,
      text: { format: { type: "json_schema", name: "job_history_proof", strict: true } },
    });
    expect(body.text.format.schema.properties.summary.required).toEqual(["citations"]);
    expect(body.text.format.schema.properties.summary.properties).not.toHaveProperty("text");
    expect(JSON.stringify(body)).toContain("note:1");
    expect(JSON.stringify(body)).not.toContain("123e4567");
  });

  it("fails without exposing an OpenAI response body", async () => {
    const fetcher = vi.fn(async () => new Response("private provider detail", { status: 429 })) as unknown as typeof fetch;
    const summarizer = createOpenAIProofSummarizer({ apiKey: "test-key", model: "gpt-test", fetcher });

    const error = await summarizer.summarize(evidence).catch((caught) => caught);
    expect(error).toBeInstanceOf(OpenAIProofError);
    expect(error).toMatchObject({ status: 429 });
    expect(String(error)).not.toContain("private provider detail");
  });

  it("rejects malformed model output", async () => {
    const fetcher = vi.fn(async () => Response.json({
      status: "completed",
      output: [{ type: "message", content: [{ type: "output_text", text: "{}" }] }],
    })) as unknown as typeof fetch;
    const summarizer = createOpenAIProofSummarizer({ apiKey: "test-key", model: "gpt-test", fetcher });

    await expect(summarizer.summarize(evidence)).rejects.toBeInstanceOf(OpenAIProofError);
  });

  it("rejects model-authored prose instead of accepting it as observed fact", async () => {
    const fetcher = vi.fn(async () => Response.json({
      status: "completed",
      output: [{
        type: "message",
        content: [{
          type: "output_text",
          text: JSON.stringify({ summary: { text: "Call the customer next.", citations: ["note:1"] } }),
        }],
      }],
    })) as unknown as typeof fetch;
    const summarizer = createOpenAIProofSummarizer({ apiKey: "test-key", model: "gpt-test", fetcher });

    await expect(summarizer.summarize(evidence)).rejects.toBeInstanceOf(OpenAIProofError);
  });
});
