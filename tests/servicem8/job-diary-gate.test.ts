import { describe, expect, it } from "vitest";
import { isJobDiaryCoverageVerified } from "@/lib/servicem8/job-diary-gate";

describe("Job Diary release gate", () => {
  it("stays closed until the live UI/API audit and per-Job check are verified", () => {
    expect(isJobDiaryCoverageVerified()).toBe(false);
  });
});
