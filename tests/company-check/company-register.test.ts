import { describe, expect, it } from "vitest";
import { exactEntityMatch, parseNzbnDetail, parseNzbnSearch } from "@/lib/company-check/company-register";

const record = {
  entityName: "CALDER STEWART CONSTRUCTION LIMITED",
  entityType: { id: "LTD", name: "NZ Limited Company" },
  entityStatus: { id: 50, name: "Registered" },
  nzbn: "9429041501047", sourceRegisterUniqueId: "5502444",
};

describe("official NZBN entity identity", () => {
  it("keeps a trading name distinct from a legal company and filters other entities", () => {
    const candidates = parseNzbnSearch({ items: [record, { ...record, entityType: { id: "TRUST" } }] });
    expect(candidates).toHaveLength(1);
    expect(candidates[0].nzbn).toBe("9429041501047");
    expect(exactEntityMatch("Calder Stewart", candidates[0].legalName)).toBe(false);
    expect(exactEntityMatch("Calder Stewart Construction Limited", candidates[0].legalName)).toBe(true);
  });

  it("rejects a detail response with another company number or NZBN", () => {
    const expected = parseNzbnSearch({ items: [record] })[0];
    expect(parseNzbnDetail(record, expected)?.registerStatus).toBe("Registered");
    expect(parseNzbnDetail({ ...record, sourceRegisterUniqueId: "9999999" }, expected)).toBeNull();
    expect(parseNzbnDetail({ ...record, nzbn: "9429041501048" }, expected)).toBeNull();
  });
});
