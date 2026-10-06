import { describe, expect, it } from "vitest";
import { JobInputSchema } from "../schemas/jobs.js";
import { getTaxonomy } from "../services/taxonomyService.js";
import { JOB_FUNCTIONS, SENIORITIES } from "../taxonomy.js";

describe("taxonomy", () => {
  it("exposes every enum the UI filters on", () => {
    const t = getTaxonomy();
    expect(t.functions).toEqual([...JOB_FUNCTIONS]);
    expect(t.seniorities).toEqual([...SENIORITIES]);
    for (const key of ["employmentTypes", "workplaces", "companySegments", "companySizes", "salaryPeriods"] as const) {
      expect(t[key].length).toBeGreaterThan(0);
    }
  });

  it("only advertises values the API will accept", () => {
    const t = getTaxonomy();
    const base = {
      title: "Role title",
      description: "A long enough description for this role to pass validation.",
      function: t.functions[0],
      seniority: t.seniorities[0],
      employmentType: t.employmentTypes[0],
      workplace: t.workplaces[0],
    };
    expect(() => JobInputSchema.parse(base)).not.toThrow();
    for (const fn of t.functions) expect(() => JobInputSchema.parse({ ...base, function: fn })).not.toThrow();
  });
});
