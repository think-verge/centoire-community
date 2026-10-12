import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "../../components/Button";
import { Field } from "../../components/Field";
import {
  getListSourcesQueryKey,
  useBackfillPostCategories,
  useCreateSource,
  useDeleteSource,
  useFetchSourceNow,
  useListSources,
  useRediscoverSource,
  useUpdateSource,
} from "../../lib/api/generated/admin/admin";
import { HashtagInput } from "../../components/HashtagInput";
import type { ScrapeEnqueueResult, Source } from "../../lib/api/generated/model";
import { useAuth } from "../../lib/auth-context";
import { CATEGORY_LABELS, CATEGORY_SUBCATEGORIES, POST_CATEGORIES, type PostCategoryValue } from "../../lib/categoryTaxonomy";

export function AdminSourcesPage() {
  const { user } = useAuth();
  const { data: sources, isLoading } = useListSources({
    query: {
      // Discovery and scrapes run on the scraper VM: keep the list fresh while any source is mid-discovery.
      refetchInterval: (query) => (query.state.data?.some((s) => s.spec.status === "discovering") ? 4000 : false),
    },
  });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Source | null>(null);
  const [backfillMessage, setBackfillMessage] = useState<string | null>(null);
  const backfillCategories = useBackfillPostCategories({
    mutation: {
      onSuccess: (result) => setBackfillMessage(`${result.updated} of ${result.scanned} uncategorized posts tagged`),
    },
  });

  if (user?.role !== "admin") {
    return (
      <div className="p-10 text-center">
        <p className="kicker mb-2">Admin</p>
        <p className="text-ink-soft">This area needs admin access.</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker mb-1">Admin</p>
          <h1 className="font-display-serif text-3xl font-semibold">Content sources</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Sites the scraper agent reads into the aggregated feed. New sources are discovered automatically; paid sources use a login stored on the scraper VM.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            loading={backfillCategories.isPending}
            onClick={() => backfillCategories.mutate()}
          >
            Backfill categories
          </Button>
          <Button onClick={() => setAdding(true)}>Add source</Button>
        </div>
      </div>
      {backfillMessage && <p className="mt-2 text-sm text-ink-soft">{backfillMessage}</p>}

      {isLoading && <p className="mt-8 text-ink-faint">Loading…</p>}

      <div className="mt-6 space-y-3">
        {(sources ?? []).map((source) => (
          <SourceRow key={source.id} source={source} onEdit={() => setEditing(source)} />
        ))}
      </div>

      {adding && <SourceFormDialog onClose={() => setAdding(false)} />}
      {editing && <SourceFormDialog source={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function SourceRow({ source, onEdit }: { source: Source; onEdit: () => void }) {
  const queryClient = useQueryClient();
  const [stats, setStats] = useState<string | null>(null);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: getListSourcesQueryKey() });
  }

  function reportQueued(result: ScrapeEnqueueResult) {
    if (result.stats) {
      setStats(
        result.stats.error
          ? `Fetch failed: ${result.stats.error}`
          : `${result.stats.imported} imported, ${result.stats.skippedDuplicates} duplicates of ${result.stats.itemsSeen} seen`,
      );
    } else if (!result.created) {
      setStats(`A ${result.type} job is already queued or running`);
    } else {
      setStats(result.type === "discover" ? "Discovery queued: the scraper agent will pick it up shortly" : "Scrape queued");
    }
    refresh();
  }
  const fetchNow = useFetchSourceNow({ mutation: { onSuccess: reportQueued } });
  const rediscover = useRediscoverSource({ mutation: { onSuccess: reportQueued } });
  const updateSource = useUpdateSource({ mutation: { onSuccess: refresh } });
  const deleteSource = useDeleteSource({ mutation: { onSuccess: refresh } });

  return (
    <div className="rounded-xl border border-line bg-paper p-4">
      <div className="flex flex-wrap items-center gap-3">
        {source.faviconUrl && (
          <img src={source.faviconUrl} alt="" className="size-8 rounded" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold">{source.name}</p>
            {source.lastStatus === "ok" && (
              <span className="rounded-full bg-gold-tint px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold">
                ok
              </span>
            )}
            {source.lastStatus === "error" && (
              <span
                className="rounded-full bg-crimson-tint px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-crimson"
                title={source.lastError ?? undefined}
              >
                error
              </span>
            )}
            <SpecChip source={source} />
            {!source.active && (
              <span className="rounded-full bg-cream px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                paused
              </span>
            )}
          </div>
          <p className="truncate text-xs text-ink-faint">
            {source.siteUrl}
            {source.requiresLogin && ` · login: ${source.credentialRef ?? "?"}`}
            {` · stores ${source.spec.store === "full" ? "full text (members only)" : "excerpts"}`}
          </p>
          <p className="mt-0.5 text-xs text-ink-soft">
            {source.category ? CATEGORY_LABELS[source.category] : "No category"}
            {source.subcategory && ` · ${source.subcategory}`}
            {" — "}
            {source.hashtags.map((h) => `#${h}`).join(" ") || "No hashtags"}
            {source.lastRun &&
              ` · last run ${new Date(source.lastRun.finishedAt).toLocaleString()}: ${source.lastRun.imported} new, ${source.lastRun.duplicates} duplicates of ${source.lastRun.itemsSeen}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            className="!px-3 !py-1.5 text-xs"
            loading={fetchNow.isPending}
            onClick={() => fetchNow.mutate({ id: source.id })}
          >
            Fetch now
          </Button>
          {source.method === "agent" && (
            <Button
              variant="ghost"
              className="!px-2 !py-1.5 text-xs"
              loading={rediscover.isPending}
              onClick={() => rediscover.mutate({ id: source.id })}
            >
              Re-discover
            </Button>
          )}
          <Button variant="ghost" className="!px-2 !py-1.5 text-xs" onClick={onEdit}>
            Edit
          </Button>
          <Button
            variant="ghost"
            className="!px-2 !py-1.5 text-xs"
            onClick={() => updateSource.mutate({ id: source.id, data: { active: !source.active } })}
          >
            {source.active ? "Pause" : "Resume"}
          </Button>
          <Button
            variant="ghost"
            className="!px-2 !py-1.5 text-xs !text-crimson"
            onClick={() => deleteSource.mutate({ id: source.id })}
          >
            Delete
          </Button>
        </div>
      </div>
      {stats && <p className="mt-2 text-xs font-medium text-ink-soft">{stats}</p>}
      {source.lastRun?.status === "error" && (
        <p className="mt-2 text-xs text-crimson">
          {source.lastRun.errorCode ? `${source.lastRun.errorCode}: ` : ""}
          {source.lastRun.errorMessage}
        </p>
      )}
    </div>
  );
}

const SPEC_CHIPS: Record<Source["spec"]["status"], { label: string; tone: string }> = {
  none: { label: "not discovered", tone: "bg-cream text-ink-faint" },
  discovering: { label: "discovering…", tone: "bg-gold-tint text-gold" },
  ready: { label: "ready", tone: "bg-gold-tint text-gold" },
  needs_rediscovery: { label: "needs re-discovery", tone: "bg-crimson-tint text-crimson" },
  needs_human: { label: "needs a human", tone: "bg-crimson-tint text-crimson" },
};

function SpecChip({ source }: { source: Source }) {
  if (source.method !== "agent") return null;
  const chip = SPEC_CHIPS[source.spec.status];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${chip.tone}`}>
      {chip.label}
    </span>
  );
}

function SourceFormDialog({ source, onClose }: { source?: Source; onClose: () => void }) {
  const isEdit = Boolean(source);
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: source?.name ?? "",
    siteUrl: source?.siteUrl ?? "",
    feedUrl: source?.feedUrl ?? "",
    credentialRef: source?.credentialRef ?? "",
  });
  const [requiresLogin, setRequiresLogin] = useState(source?.requiresLogin ?? false);
  const [store, setStore] = useState<"full" | "excerpt">(source?.spec.store ?? "excerpt");
  const [hashtags, setHashtags] = useState<string[]>(source?.hashtags ?? []);
  const [category, setCategory] = useState<PostCategoryValue | "">(source?.category ?? "");
  const [subcategory, setSubcategory] = useState(source?.subcategory ?? "");

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: getListSourcesQueryKey() });
    onClose();
  }
  const createSource = useCreateSource({ mutation: { onSuccess: refresh } });
  const updateSource = useUpdateSource({ mutation: { onSuccess: refresh } });
  const pending = isEdit ? updateSource : createSource;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const data = {
      name: form.name,
      siteUrl: form.siteUrl,
      feedUrl: form.feedUrl || null,
      requiresLogin,
      credentialRef: requiresLogin ? form.credentialRef : null,
      store,
      hashtags,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      category: (category || null) as any,
      subcategory: category && subcategory ? subcategory : null,
    };
    if (isEdit && source) {
      updateSource.mutate({ id: source.id, data });
    } else {
      createSource.mutate({ data });
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? "Edit source" : "Add source"}
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-line bg-paper p-6 shadow-card-hover"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="kicker mb-1">{isEdit ? "Edit source" : "New source"}</p>
        <h2 className="font-display-serif text-2xl font-semibold">
          {isEdit ? "Edit source" : "Add a source"}
        </h2>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <Field
            label="Name"
            placeholder="e.g. Business of Fashion"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Field
            label="Site URL"
            type="url"
            placeholder="https://www.businessoffashion.com"
            value={form.siteUrl}
            onChange={(e) => setForm({ ...form, siteUrl: e.target.value })}
            required
          />
          <Field
            label="Feed URL (optional)"
            type="url"
            placeholder="https://…/rss — a hint; the agent finds the layout itself"
            value={form.feedUrl}
            onChange={(e) => setForm({ ...form, feedUrl: e.target.value })}
          />
          <div className="space-y-3 rounded-lg border border-line p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-ink">
              <input type="checkbox" checked={requiresLogin} onChange={(e) => setRequiresLogin(e.target.checked)} />
              Articles need a login (paid site)
            </label>
            {requiresLogin && (
              <Field
                label="Credential name"
                placeholder="e.g. bof"
                value={form.credentialRef}
                onChange={(e) => setForm({ ...form, credentialRef: e.target.value.toLowerCase() })}
                required
              />
            )}
            {requiresLogin && (
              <p className="text-xs text-ink-faint">
                Passwords are never entered here: add this name with its username and password to the secrets file on the scraper VM.
              </p>
            )}
            <div>
              <label htmlFor="source-store" className="mb-1.5 block text-sm font-medium text-ink">
                What to keep
              </label>
              <select
                id="source-store"
                value={store}
                onChange={(e) => setStore(e.target.value as "full" | "excerpt")}
                className="w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink focus:border-crimson focus:outline-none"
              >
                <option value="excerpt">Excerpt + link out (default)</option>
                <option value="full">Full text, shown to signed-in members only</option>
              </select>
              <p className="mt-1 text-xs text-ink-faint">Choose full text only if we have the publisher's permission.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="source-category" className="mb-1.5 block text-sm font-medium text-ink">
                Category
              </label>
              <select
                id="source-category"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value as PostCategoryValue | "");
                  setSubcategory("");
                }}
                className="w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink focus:border-crimson focus:outline-none"
              >
                <option value="">No category</option>
                {POST_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-ink-faint">Default for posts imported from this source.</p>
            </div>
            <div>
              <label htmlFor="source-subcategory" className="mb-1.5 block text-sm font-medium text-ink">
                Subcategory
              </label>
              <select
                id="source-subcategory"
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                disabled={!category}
                className="w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink focus:border-crimson focus:outline-none disabled:bg-cream disabled:text-ink-faint"
              >
                <option value="">None</option>
                {category &&
                  CATEGORY_SUBCATEGORIES[category].map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="source-hashtags" className="mb-1.5 block text-sm font-medium">
              Hashtags applied to imports
            </label>
            <HashtagInput id="source-hashtags" value={hashtags} onChange={setHashtags} />
          </div>
          {pending.error && <p className="text-sm text-crimson">{pending.error.message}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={pending.isPending}>
              {isEdit ? "Save changes" : "Add source"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
