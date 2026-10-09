import { describe, expect, it } from "vitest";
import { renderJobContext } from "@/lib/servicem8/render-context-html";

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
