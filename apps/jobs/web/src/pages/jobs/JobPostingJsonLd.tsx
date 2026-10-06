import { useEffect } from "react";
import type { Job } from "../../lib/api/generated/model";
import { countryName } from "../../lib/format";

const EMPLOYMENT: Record<string, string> = {
  full_time: "FULL_TIME",
  part_time: "PART_TIME",
  contract: "CONTRACTOR",
  freelance: "CONTRACTOR",
  internship: "INTERN",
};
const UNIT: Record<string, string> = { year: "YEAR", month: "MONTH", hour: "HOUR" };

export function buildJobPostingJsonLd(job: Job): Record<string, unknown> {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description,
    datePosted: job.publishedAt ?? job.createdAt,
    employmentType: EMPLOYMENT[job.employmentType] ?? "OTHER",
    hiringOrganization: {
      "@type": "Organization",
      name: job.company.name,
      ...(job.company.logoUrl ? { logo: job.company.logoUrl } : {}),
      sameAs: `${window.location.origin}/companies/${job.company.slug}`,
    },
    directApply: job.applyMode === "internal",
  };
  if (job.expiresAt) data.validThrough = job.expiresAt;
  if (job.workplace === "remote") data.jobLocationType = "TELECOMMUTE";
  if (job.location && (job.location.city || job.location.countryCode)) {
    data.jobLocation = {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        ...(job.location.city ? { addressLocality: job.location.city } : {}),
        ...(job.location.countryCode ? { addressCountry: job.location.countryCode } : {}),
      },
    };
  } else if (job.workplace === "remote") {
    data.applicantLocationRequirements = { "@type": "Country", name: job.location?.countryCode ? countryName(job.location.countryCode) : "Worldwide" };
  }
  const s = job.salary;
  if (s && s.currency && (s.min != null || s.max != null) && s.period && UNIT[s.period]) {
    data.baseSalary = {
      "@type": "MonetaryAmount",
      currency: s.currency,
      value: {
        "@type": "QuantitativeValue",
        ...(s.min != null ? { minValue: s.min } : {}),
        ...(s.max != null ? { maxValue: s.max } : {}),
        unitText: UNIT[s.period],
      },
    };
  }
  if (job.skills.length) data.skills = job.skills.join(", ");
  return data;
}

/** Adds a JobPosting JSON-LD script while mounted (published jobs only). */
export function useJobPostingJsonLd(job: Job | undefined): void {
  useEffect(() => {
    if (!job || job.status !== "published") return;
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(buildJobPostingJsonLd(job));
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, [job]);
}
