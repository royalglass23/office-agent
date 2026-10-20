import { describe, expect, it } from "vitest";
import { readPublicHtml } from "@/lib/company-check/public-html";

describe("public source fetch boundary", () => {
  it.each([
    "http://example.com/project",
    "https://localhost/project",
    "https://127.0.0.1/project",
    "https://user:pass@example.com/project",
    "https://example.com:8443/project",
    "https://internal.local/project",
    "https://[::1]/project",
  ])("refuses unsafe source URL %s", async url => {
    await expect(readPublicHtml(url)).resolves.toBeNull();
  });
});
