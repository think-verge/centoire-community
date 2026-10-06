import { useGetTaxonomy } from "./api/generated/meta/meta";
import {
  CandidateProfileInputVisibility,
  CompanyAllOfSegment,
  CompanyAllOfSizeRange,
  JobEmploymentType,
  JobFunction,
  JobSalaryPeriod,
  JobSeniority,
  JobWorkplace,
} from "./api/generated/model";

function pick<T extends string>(all: readonly T[], server: string[] | undefined): T[] {
  return server && server.length ? all.filter((v) => server.includes(v)) : [...all];
}

export const VISIBILITIES = Object.values(CandidateProfileInputVisibility);

export const VISIBILITY_HELP: Record<string, string> = {
  public: "Anyone with the link can see your profile, and it can be found by employers.",
  recruiters: "Only people who hire on Centoire Jobs can see your profile.",
  private: "Only you can see your profile. Employers still see what you submit with an application.",
};

/** Filter/option lists from the taxonomy endpoint, falling back to the generated enums while loading. */
export function useTaxonomyOptions() {
  const { data } = useGetTaxonomy();
  return {
    functions: pick(Object.values(JobFunction), data?.functions),
    seniorities: pick(Object.values(JobSeniority), data?.seniorities),
    employmentTypes: pick(Object.values(JobEmploymentType), data?.employmentTypes),
    workplaces: pick(Object.values(JobWorkplace), data?.workplaces),
    segments: pick(Object.values(CompanyAllOfSegment), data?.companySegments),
    sizes: pick(Object.values(CompanyAllOfSizeRange), data?.companySizes),
    salaryPeriods: pick(Object.values(JobSalaryPeriod), data?.salaryPeriods),
  };
}

export const COUNTRIES = [
  "US", "GB", "FR", "IT", "ES", "DE", "NL", "BE", "SE", "DK", "PT", "CH", "IN", "CN", "HK", "JP", "KR",
  "SG", "AE", "TR", "BD", "VN", "LK", "AU", "CA", "BR", "MX", "ZA", "MA",
] as const;

export const CURRENCIES = ["USD", "EUR", "GBP", "INR", "CHF", "AED", "SGD", "CAD", "AUD", "JPY", "CNY"] as const;

export function isOneOf<T extends string>(values: readonly T[], v: string): v is T {
  return (values as readonly string[]).includes(v);
}
