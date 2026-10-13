import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import {
  renderJobContext,
  renderJobMatches,
  renderMenuAssistant,
  renderProofAnswer,
  renderProofAssistant,
} from "@/lib/servicem8/render-context-html";

describe("renderMenuAssistant", () => {
  it("renders and escapes the resolved staff first name", () => {
    const html = renderMenuAssistant(`<script>alert("name")</script>`);
    expect(html).toContain('Hi, &lt;script&gt;alert(&quot;name&quot;)&lt;/script&gt;—anything I can help with?');
    expect(html).not.toContain('<script>alert("name")</script>');
  });

  it("renders a server-side search form without exposing staff or account identifiers", () => {
    const html = renderProofAssistant(
      "May",
      new URL("https://office.example.test/assistant"),
      "signed-session-token",
    );
    expect(html).toContain('action="https://office.example.test/assistant"');
    expect(html).toContain('name="session" value="signed-session-token"');
    expect(html).toContain('name="query"');
    expect(html).not.toContain("accountUUID");
    expect(html).not.toContain("staffUUID");
  });

  it("prevents a second proof submission while the first request is in flight", () => {
    const html = renderProofAssistant(
      "May",
      new URL("https://office.example.test/assistant"),
      "signed-session-token",
    );
    const script = html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)?.[1];
    expect(script).toBeDefined();

    let submitHandler: ((event: { preventDefault: () => void }) => void) | undefined;
    const button = { disabled: false, textContent: "What happened?" };
    const form = {
      addEventListener: (_type: string, handler: typeof submitHandler) => { submitHandler = handler; },
      querySelectorAll: () => [button],
    };
    const document = { querySelectorAll: () => [form] };
    runInNewContext(script!, { document });

    const firstSubmission = { preventDefault: vi.fn() };
    submitHandler!(firstSubmission);
    expect(firstSubmission.preventDefault).not.toHaveBeenCalled();
    expect(button).toEqual({ disabled: true, textContent: "Checking…" });

    const secondSubmission = { preventDefault: vi.fn() };
    submitHandler!(secondSubmission);
    expect(secondSubmission.preventDefault).toHaveBeenCalledOnce();
  });
});

describe("proof result rendering", () => {
  it("requires explicit selection when several Jobs match", () => {
    const html = renderJobMatches(
      [
        { jobNumber: "R260766", address: "10 Queen Street", status: "Quote" },
        { jobNumber: "R260680", address: "10 Queen Road", status: "Work Order" },
      ],
      new URL("https://office.example.test/assistant"),
      "signed-session-token",
    );
    expect(html).toContain("Choose the Job");
    expect(html).toContain('<input type="hidden" name="jobNumber" value="R260766">');
    expect(html).toContain('<input type="hidden" name="jobNumber" value="R260680">');
    expect(html).not.toContain('<button class="match" type="submit" name="jobNumber"');
  });

  it("escapes model text and discloses the bounded source coverage", () => {
    const html = renderProofAnswer({
      job: { jobNumber: "R260766", address: "10 Queen Street", status: "Work Order", customerName: "Example" },
      summary: { text: "<script>alert(1)</script>", citations: ["note:1"] },
      timeline: [{ at: "2026-09-02T10:30:00.000Z", text: "Measured", citations: ["note:1"] }],
      coverage: {
        included: ["core Job/customer fields", "Job diary notes"],
        excluded: ["email", "SMS", "forms", "attachments", "schedule activity"],
        noteCount: 1,
        truncated: false,
        snapshotAt: "2026-10-13T00:00:00.000Z",
      },
    }, new URL("https://office.example.test/assistant"), "signed-session-token");
    expect(html).toContain("What happened");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("Not checked: email, SMS, forms, attachments, schedule activity");
  });
});

describe("renderJobContext", () => {
  it("escapes untrusted ServiceM8 fields", () => {
    const html = renderJobContext(
      {
        eventVersion: "1.0",
        eventName: "rg_office_assistant",
        auth: {
          accountUUID: "5e32b1f1-bb9f-457a-a67c-44dd7ff8ac1b",
          staffUUID: "9d914a06-221e-4013-8b4d-2735272710eb",
        },
        eventArgs: { jobUUID: "0686ce69-4a5d-4f73-ad56-827ffaaced2b" },
      },
      {
        jobUUID: "0686ce69-4a5d-4f73-ad56-827ffaaced2b",
        jobNumber: "<script>alert(1)</script>",
        jobStatus: "Quote",
        companyUUID: "123e4567-cb72-4d94-8a1e-d454131257eb",
        companyName: `Client "One"`,
      },
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("Client &quot;One&quot;");
  });
});
