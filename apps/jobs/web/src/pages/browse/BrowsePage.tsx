import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SearchIcon } from "@centoire/ui";
import { useListJobsInfinite } from "../../lib/api/generated/jobs/jobs";
import {
  ListJobsFunction,
  ListJobsSeniority,
  ListJobsType,
  ListJobsWorkplace,
  type ListJobsParams,
} from "../../lib/api/generated/model";
import { EmptyState, ErrorNotice, ListSkeleton, LoadMore } from "../../components/Feedback";
import { JobCard } from "../../components/JobCard";
import { countryName, prettify } from "../../lib/format";
import { COUNTRIES, isOneOf, useTaxonomyOptions } from "../../lib/options";
import { inputCls } from "../../lib/styles";
import { useDebounced } from "../../lib/useDebounced";
import { useDocumentTitle } from "../../lib/useDocumentTitle";

type FilterKey = "function" | "seniority" | "type" | "workplace" | "country";

function readParams(sp: URLSearchParams): ListJobsParams {
  const params: ListJobsParams = {};
  const q = sp.get("q")?.trim();
  if (q) params.q = q.slice(0, 100);
  const fn = sp.get("function");
  if (fn && isOneOf(Object.values(ListJobsFunction), fn)) params.function = fn;
  const seniority = sp.get("seniority");
  if (seniority && isOneOf(Object.values(ListJobsSeniority), seniority)) params.seniority = seniority;
  const type = sp.get("type");
  if (type && isOneOf(Object.values(ListJobsType), type)) params.type = type;
  const workplace = sp.get("workplace");
  if (workplace && isOneOf(Object.values(ListJobsWorkplace), workplace)) params.workplace = workplace;
  const country = sp.get("country");
  if (country && /^[A-Za-z]{2}$/.test(country)) params.country = country.toUpperCase();
  return params;
}

export function BrowsePage() {
  useDocumentTitle("Find your next role in fashion");
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useMemo(() => readParams(searchParams), [searchParams]);
  const options = useTaxonomyOptions();

  const [text, setText] = useState(params.q ?? "");
  const debouncedText = useDebounced(text, 350);

  const setParam = (key: string, value: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  };

  useEffect(() => {
    if (debouncedText.trim() !== (params.q ?? "")) setParam("q", debouncedText.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedText]);

  const jobs = useListJobsInfinite(params, {
    query: {
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (last) => last.nextCursor ?? undefined,
    },
  });
  const items = jobs.data?.pages.flatMap((p) => p.items) ?? [];
  const activeFilters = (["function", "seniority", "type", "workplace", "country"] as FilterKey[]).filter((k) => params[k]);
  const filtering = activeFilters.length > 0 || Boolean(params.q);

  const clearAll = () => {
    setText("");
    setSearchParams({}, { replace: true });
  };

  const selects: { key: FilterKey; label: string; options: readonly string[]; format?: (v: string) => string }[] = [
    { key: "function", label: "Function", options: options.functions },
    { key: "seniority", label: "Seniority", options: options.seniorities },
    { key: "type", label: "Employment type", options: options.employmentTypes },
    { key: "workplace", label: "Workplace", options: options.workplaces },
    { key: "country", label: "Country", options: COUNTRIES, format: countryName },
  ];

  return (
    <div>
      <section className="bg-[var(--color-sand-warm)] px-4 py-10 sm:px-8 sm:py-14">
        <div className="mx-auto max-w-[1100px]">
          <p className="kicker" style={{ color: "var(--color-coral)" }}>Centoire Jobs</p>
          <h1 className="font-editorial mt-2 text-[34px] font-bold leading-tight text-[var(--color-charcoal)] sm:text-[48px]">
            Find your next role in <em className="text-[var(--color-coral)]">fashion</em>
          </h1>
          <p className="mt-2 max-w-xl font-ui text-[15px] text-[var(--color-stone)]">
            Design, pattern making, merchandising, sourcing and more, at brands and studios across the industry.
          </p>
          <form role="search" onSubmit={(e) => e.preventDefault()} className="relative mt-6 max-w-2xl">
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[var(--color-taupe)]" />
            <input
              type="search"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={100}
              aria-label="Search jobs"
              placeholder="Search by title, skill or company"
              className={`${inputCls} rounded-full py-3.5 pl-12 pr-5 shadow-[0_4px_16px_rgba(0,0,0,0.06)]`}
            />
          </form>
        </div>
      </section>

      <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-8">
        <div className="flex flex-wrap items-end gap-3">
          {selects.map((s) => (
            <label key={s.key} className="min-w-[8.5rem] flex-1 sm:flex-none">
              <span className="mb-1 block font-ui text-[10px] font-bold uppercase tracking-wider text-[var(--color-stone)]">{s.label}</span>
              <select value={params[s.key] ?? ""} onChange={(e) => setParam(s.key, e.target.value)} className={`${inputCls} rounded-full py-2 text-[13px]`}>
                <option value="">Any</option>
                {s.options.map((o) => (
                  <option key={o} value={o}>
                    {(s.format ?? prettify)(o)}
                  </option>
                ))}
              </select>
            </label>
          ))}
          {filtering && (
            <button type="button" onClick={clearAll} className="pb-2 font-ui text-[12px] font-bold uppercase tracking-wider text-[var(--color-coral)]">
              Clear all
            </button>
          )}
        </div>

        <h2 className="mb-4 mt-8 font-ui text-[12px] font-bold uppercase tracking-wider text-[var(--color-stone)]">
          {params.q ? `Results for “${params.q}”` : "Latest roles"}
        </h2>

        {jobs.isLoading && <ListSkeleton count={5} />}
        {jobs.isError && <ErrorNotice error={jobs.error} />}
        {jobs.isSuccess && items.length === 0 && (
          <EmptyState
            title={filtering ? "No roles match those filters" : "No roles posted yet"}
            body={filtering ? "Try removing a filter or searching for something broader." : "New openings are added every week. Check back soon."}
          />
        )}
        <div className="space-y-3">
          {items.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
        <LoadMore hasMore={Boolean(jobs.hasNextPage)} loading={jobs.isFetchingNextPage} onClick={() => void jobs.fetchNextPage()} />
      </div>
    </div>
  );
}
