import axios from "axios";
import type { JobLocation, JobSalary } from "./api/generated/model";

const SPECIAL: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  onsite: "On-site",
  pending_review: "In review",
  fast_fashion: "Fast fashion",
  recruiters: "Recruiters only",
};

/** design -> Design, pattern_making -> Pattern making, full_time -> Full-time. */
export function prettify(value: string): string {
  const special = SPECIAL[value];
  if (special) return special;
  const spaced = value.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const PERIOD_LABEL: Record<string, string> = { year: "year", month: "month", hour: "hour", project: "project" };

function money(amount: number, currency: string | null): string {
  if (currency) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
        notation: amount >= 100000 ? "compact" : "standard",
      }).format(amount);
    } catch {
      /* invalid currency code: fall through */
    }
  }
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(amount);
}

export function formatSalary(salary: JobSalary | undefined): string | null {
  if (!salary || (salary.min == null && salary.max == null)) return null;
  const { min, max, currency, period } = salary;
  let range: string;
  if (min != null && max != null) range = min === max ? money(min, currency) : `${money(min, currency)} – ${money(max, currency)}`;
  else if (min != null) range = `From ${money(min, currency)}`;
  else range = `Up to ${money(max as number, currency)}`;
  return period ? `${range} / ${PERIOD_LABEL[period] ?? period}` : range;
}

export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(undefined, { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

export function formatLocation(location: JobLocation | undefined, workplace?: string): string {
  const parts = [location?.city, location?.countryCode ? countryName(location.countryCode) : null].filter(
    (p): p is string => Boolean(p),
  );
  if (parts.length) return parts.join(", ");
  return workplace === "remote" ? "Remote" : "Location not specified";
}

export function timeAgo(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return "";
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === "string") return detail;
    if (!error.response) return "Could not reach the server. Check your connection and try again.";
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

export function httpStatus(error: unknown): number | null {
  return axios.isAxiosError(error) ? (error.response?.status ?? null) : null;
}

/** Trim a string and drop it when empty (API fields reject empty strings for urls). */
export function opt(value: string): string | undefined {
  const v = value.trim();
  return v ? v : undefined;
}

export function jobPath(job: { id: string; slug: string }): string {
  return `/jobs/${job.id}/${job.slug}`;
}
