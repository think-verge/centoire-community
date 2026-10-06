import { describe, expect, it } from "vitest";
import type { IApplication, ICompany, IJob } from "../models/index.js";
import { serializeApplication, serializeJob } from "../services/serializers.js";

const oid = (s: string) => ({ toString: () => s });
const company = { _id: oid("c1"), slug: "atelier", name: "Atelier", verified: true, createdAt: new Date(0), segment: "luxury", openJobCount: 1 } as unknown as ICompany;

function job(overrides: Partial<IJob> = {}): IJob {
  return {
    _id: oid("j1"),
    slug: "pattern-maker",
    title: "Pattern Maker",
    description: "desc",
    function: "pattern_making",
    seniority: "senior",
    employmentType: "full_time",
    workplace: "onsite",
    skills: [],
    applyMode: "internal",
    screeningQuestions: [],
    status: "published",
    rejectionReason: "too vague",
    applicationCount: 0,
    createdAt: new Date(0),
    salary: { min: 50000, max: 60000, currency: "EUR", period: "year", visible: false },
    ...overrides,
  } as unknown as IJob;
}

const anon = { saved: false, applied: false, canManage: false };

describe("serializeJob", () => {
  it("hides a salary marked not-visible and the rejection reason from the public", () => {
    const view = serializeJob(job(), company, anon);
    expect(view.salary).toBeNull();
    expect(view.rejectionReason).toBeNull();
  });

  it("shows both to the hiring team", () => {
    const view = serializeJob(job(), company, { ...anon, canManage: true });
    expect(view.salary).toEqual({ min: 50000, max: 60000, currency: "EUR", period: "year" });
    expect(view.rejectionReason).toBe("too vague");
  });

  it("shows a visible salary to everyone", () => {
    const view = serializeJob(job({ salary: { min: 1, max: 2, visible: true } as IJob["salary"] }), company, anon);
    expect(view.salary?.min).toBe(1);
  });
});

describe("serializeApplication", () => {
  const app = {
    _id: oid("a1"),
    status: "shortlisted",
    answers: [],
    statusHistory: [{ status: "submitted", at: new Date(0), by: "u" }],
    recruiterNotes: "internal only",
    createdAt: new Date(0),
  } as unknown as IApplication;

  it("never exposes recruiter notes to the applicant", () => {
    expect(serializeApplication(app, job(), company, { applicant: null, forHiringTeam: false }).recruiterNotes).toBeNull();
    expect(serializeApplication(app, job(), company, { applicant: null, forHiringTeam: true }).recruiterNotes).toBe("internal only");
  });
});
