import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import {
  renderConversationDraftPrompt,
  renderConversationAssistant,
  renderJobContext,
  renderJobMatches,
  renderJobAdvice,
  renderEmailDraft,
  renderMenuAssistant,
  renderProofAnswer,
  renderProofAssistant,
} from "@/lib/servicem8/render-context-html";

describe("renderMenuAssistant", () => {
  it("loads the signed staff name after the opening page is rendered", async () => {
    const html = renderConversationAssistant(
      null,
      new URL("https://office.example.test/assistant"),
      "signed-session-token",
      "signed-greeting-token",
    );
    const script = html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)?.[1];
    expect(script).toBeDefined();
    const greeting = { textContent: "Opening RG Office Assistant…" };
    const fetcher = vi.fn(async (_url: string, _request: { body: URLSearchParams }) => ({
      ok: true,
      json: async () => ({ first: "May" }),
    }));
    runInNewContext(script!, {
      document: {
        getElementById: () => greeting,
        addEventListener: () => undefined,
      },
      fetch: fetcher,
      URLSearchParams,
    });
    await vi.waitFor(() => expect(greeting.textContent).toBe("Hi, May—what can I help with?"));
    expect(fetcher).toHaveBeenCalledWith("https://office.example.test/assistant/staff", expect.objectContaining({
      method: "POST",
      credentials: "omit",
    }));
    const request = fetcher.mock.calls[0][1];
    expect(request.body.toString()).toBe("session=signed-greeting-token");
  });

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
    expect(html).toContain("connect-src https://office.example.test");
    expect(html).toContain('name="session" value="signed-session-token"');
    expect(html).toContain('name="query"');
    expect(html).not.toContain("accountUUID");
    expect(html).not.toContain("staffUUID");
  });

  it("submits without a browser POST history entry and blocks a second submission", async () => {
    const html = renderProofAssistant(
      "May",
      new URL("https://office.example.test/assistant"),
      "signed-session-token",
    );
    const script = html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)?.[1];
    expect(script).toBeDefined();

    let submitHandler: ((event: { target: unknown; preventDefault: () => void }) => Promise<void>) | undefined;
    const button = { disabled: false, textContent: "What happened?", dataset: { pendingLabel: "Checking…" } };
    class HTMLFormElement {
      action = "https://office.example.test/assistant";
      method = "post";
      dataset = { submitted: "false" };
      querySelectorAll() { return [button]; }
    }
    const form = new HTMLFormElement();
    const document = { addEventListener: (_type: string, handler: typeof submitHandler) => { submitHandler = handler; }, documentElement: { innerHTML: "" } };
    const fetcher = vi.fn(async () => ({ text: async () => "<html>Next conversation</html>" }));
    const DOMParser = class { parseFromString() { return { documentElement: { innerHTML: "<head></head><body>Next conversation</body>" } }; } };
    runInNewContext(script!, { document, fetch: fetcher, FormData: class { constructor() {} }, URL, URLSearchParams, DOMParser, HTMLFormElement, location: { origin: "https://office.example.test" } });

    const firstSubmission = { target: form, preventDefault: vi.fn() };
    const pending = submitHandler!(firstSubmission);
    expect(firstSubmission.preventDefault).toHaveBeenCalledOnce();
    expect(button).toMatchObject({ disabled: true, textContent: "Checking…" });

    const secondSubmission = { target: form, preventDefault: vi.fn() };
    submitHandler!(secondSubmission);
    expect(secondSubmission.preventDefault).toHaveBeenCalledOnce();
    await pending;
    expect(fetcher).toHaveBeenCalledWith("https://office.example.test/assistant", expect.objectContaining({ method: "POST" }));
    expect(document.documentElement.innerHTML).toContain("Next conversation");
  });

  it("submits the first ServiceM8 iframe form without leaving a POST history entry", async () => {
    const html = renderProofAssistant("May", new URL("https://office.example.test/assistant"), "signed-session-token");
    const script = html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)?.[1];
    let handler: ((event: { target: unknown; preventDefault: () => void }) => Promise<void>) | undefined;
    class HTMLFormElement {
      action = "https://office.example.test/assistant";
      method = "post";
      dataset = { submitted: "false" };
      querySelectorAll() { return [{ disabled: false, textContent: "Send", dataset: {} }]; }
    }
    const fetcher = vi.fn(async () => ({ text: async () => "<html>Next conversation</html>" }));
    runInNewContext(script!, {
      document: { addEventListener: (_type: string, callback: typeof handler) => { handler = callback; }, documentElement: { innerHTML: "" } },
      HTMLFormElement, URL, URLSearchParams, FormData: class { constructor() {} },
      DOMParser: class { parseFromString() { return { documentElement: { innerHTML: "<body>Next conversation</body>" } }; } },
      location: { origin: "https://app.servicem8.com" }, fetch: fetcher,
    });
    const event = { target: new HTMLFormElement(), preventDefault: vi.fn() };
    await handler!(event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith("https://office.example.test/assistant", expect.objectContaining({ method: "POST", credentials: "omit" }));
  });
});

describe("proof result rendering", () => {
  it("escapes conversational staff text before rendering a draft prompt", () => {
    const html = renderConversationDraftPrompt(
      '<script>alert("message")</script> Draft an email for R260766',
      "R260766",
      new URL("https://office.example.test/assistant"),
      "signed-session-token",
    );

    expect(html).toContain('&lt;script&gt;alert(&quot;message&quot;)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert("message")</script>');
    expect(html).toContain("Nothing is sent");
  });

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
    expect(html).toContain('name="jobAdvice" value="recommend"');
    expect(html).toContain('name="jobAdvice" value="email"');
    expect(html).not.toContain('name="emailRecipient"');
    expect(html).toContain('value="R260766"');
    expect(html).toContain("Suggest next step and draft email");
    expect(html).toContain("Nothing is sent");
  });

  it("renders an escaped review-only email draft with no send action", () => {
    const html = renderEmailDraft({
      job: { jobNumber: "R260766", address: "10 Queen Street", customerName: "Example" },
      purpose: "Follow up on the measure",
      recipient: "builder",
      draft: {
        subject: "<script>alert('subject')</script>",
        body: "Hi Example,\n<script>alert('body')</script>",
        citations: ["job:record", "note:1"],
      },
      sources: [{ id: "note:1", at: "2026-10-13T00:00:00.000Z", text: "Measure <pending>" }],
      coverage: {
        included: ["core Job/customer fields", "Job diary notes"],
        excluded: ["email", "SMS", "forms", "attachments", "schedule activity"],
        noteCount: 1,
        truncated: false,
        snapshotAt: "2026-10-13T00:00:00.000Z",
      },
    }, new URL("https://office.example.test/assistant"), "signed-session-token");

    expect(html).toContain("Email draft — R260766");
    expect(html).toContain("Draft only — nothing was sent");
    expect(html).toContain("&lt;script&gt;alert(&#39;subject&#39;)&lt;/script&gt;");
    expect(html).toContain("&lt;script&gt;alert(&#39;body&#39;)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert('body')</script>");
    expect(html).not.toContain("Send email");
    expect(html).toContain('id="draftSubject"');
    expect(html).toContain('id="draftBody"');
    expect(html).toContain('name="emailRevision"');
    expect(html).toContain("Revise draft");
    expect(html).toContain('name="emailRecipient" value="builder"');
    expect(html).toContain("Measure &lt;pending&gt;");
    expect(html).toContain("Not checked: email, SMS, forms, attachments, schedule activity");
    expect(html).toContain('name="message"');
    expect(html).toContain("Ask another question");
  });

  it("shows a sourced next action and adds an editable draft only when requested", () => {
    const result = {
      job: { jobNumber: "R260766", address: "10 Queen Street", customerName: "Example" },
      recommendation: { nextAction: "Confirm <site> timing.", suggestedContact: "builder",
        source: { id: "note:1", at: "2026-10-13T00:00:00.000Z", text: "Site <pending>" }, quote: "Site <pending>" },
      draft: null as null | { subject: string; body: string; citations: string[] },
      coverage: { included: ["core Job/customer fields", "Job diary notes"], excluded: ["email", "SMS", "attachments"], noteCount: 1, truncated: false, snapshotAt: "2026-10-13T00:00:00.000Z" },
    };
    const actionUrl = new URL("https://office.example.test/assistant");
    const recommendation = renderJobAdvice(result, actionUrl, "session-token");
    expect(recommendation).toContain("Confirm &lt;site&gt; timing.");
    expect(recommendation).toContain("Site &lt;pending&gt;");
    expect(recommendation).not.toContain("<site>");
    expect(recommendation).not.toContain("Review-only email draft");
    expect(recommendation).toContain("Not checked: email, SMS, attachments");

    const withEmail = renderJobAdvice({ ...result, draft: { subject: "Job follow-up", body: "Could you confirm timing?", citations: ["note:1"] } }, actionUrl, "session-token");
    expect(withEmail).toContain("Review-only email draft");
    expect(withEmail).toContain('id="draftBody"');
    expect(withEmail).toContain("Suggested contact: builder");
    expect(withEmail).not.toContain("Send email");
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
