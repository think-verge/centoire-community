import { describe, expect, it } from "vitest";
import {
  ApplicationUpdateSchema,
  CandidateProfileInputSchema,
  CompanyInputSchema,
  JobInputSchema,
  JobListQuerySchema,
} from "../schemas/jobs.js";

const validJob = {
  title: "Senior Pattern Maker",
  description: "Own pattern development for the SS27 womenswear collection end to end.",
  function: "pattern_making",
  seniority: "senior",
  employmentType: "full_time",
  workplace: "hybrid",
};

describe("JobInputSchema", () => {
  it("accepts a minimal job and trims the title", () => {
    expect(JobInputSchema.parse({ ...validJob, title: "  Senior Pattern Maker " }).title).toBe("Senior Pattern Maker");
  });

  it("rejects unknown taxonomy values and short descriptions", () => {
    expect(() => JobInputSchema.parse({ ...validJob, function: "wizardry" })).toThrow();
    expect(() => JobInputSchema.parse({ ...validJob, description: "too short" })).toThrow();
  });

  it("caps screening questions at 5 and skills at 15", () => {
    const q = Array.from({ length: 6 }, (_, i) => ({ prompt: `Question number ${i}` }));
    expect(() => JobInputSchema.parse({ ...validJob, screeningQuestions: q })).toThrow();
    expect(() => JobInputSchema.parse({ ...validJob, skills: Array.from({ length: 16 }, (_, i) => `s${i}`) })).toThrow();
  });

  it("requires valid URLs for external apply links", () => {
    expect(() => JobInputSchema.parse({ ...validJob, applyMode: "external", externalApplyUrl: "not a url" })).toThrow();
  });
});

describe("other inputs", () => {
  it("validates list filters and coerces nothing unexpected", () => {
    expect(JobListQuerySchema.parse({ function: "design", country: "it" }).country).toBe("it");
    expect(() => JobListQuerySchema.parse({ workplace: "moon" })).toThrow();
  });

  it("only allows recruiter-style application status updates", () => {
    expect(ApplicationUpdateSchema.parse({ status: "shortlisted" }).status).toBe("shortlisted");
    expect(() => ApplicationUpdateSchema.parse({ status: "withdrawn" })).toThrow();
    expect(() => ApplicationUpdateSchema.parse({ status: "submitted" })).toThrow();
  });

  it("validates companies and candidate profiles", () => {
    expect(() => CompanyInputSchema.parse({ name: "A" })).toThrow();
    expect(() => CompanyInputSchema.parse({ name: "Atelier", hq: { countryCode: "ITA" } })).toThrow();
    expect(CandidateProfileInputSchema.parse({ visibility: "private", skills: ["CLO3D"] }).visibility).toBe("private");
    expect(() => CandidateProfileInputSchema.parse({ visibility: "everyone" })).toThrow();
  });
});
