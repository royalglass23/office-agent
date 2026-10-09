import { describe, expect, it, vi } from "vitest";
import { requireVendorAccount } from "@/lib/servicem8/client";
import type { ServiceM8Client } from "@/lib/servicem8/client";

const expected = "5e32b1f1-bb9f-457a-a67c-44dd7ff8ac1b";

describe("interactive OAuth account binding", () => {
  it("accepts the single Vendor matching the signed account", async () => {
    const client = { getVendor: vi.fn(async () => [{ uuid: expected }]) } as unknown as ServiceM8Client;
    await expect(requireVendorAccount(client, expected)).resolves.toBeUndefined();
  });

  it("rejects a Vendor UUID mismatch", async () => {
    const client = {
      getVendor: vi.fn(async () => [{ uuid: "9d914a06-221e-4013-8b4d-2735272710eb" }]),
    } as unknown as ServiceM8Client;
    await expect(requireVendorAccount(client, expected)).rejects.toMatchObject({ status: 403 });
  });

  it("rejects zero or multiple Vendor identities", async () => {
    const client = { getVendor: vi.fn(async () => []) } as unknown as ServiceM8Client;
    await expect(requireVendorAccount(client, expected)).rejects.toMatchObject({ status: 403 });
  });
});
