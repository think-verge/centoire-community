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
  useUpdateSource,
} from "../../lib/api/generated/admin/admin";
import { useListTags } from "../../lib/api/generated/tags/tags";
import type { Source } from "../../lib/api/generated/model";
import { useAuth } from "../../lib/auth-context";
import { CATEGORY_LABELS, CATEGORY_SUBCATEGORIES, POST_CATEGORIES, type PostCategoryValue } from "../../lib/categoryTaxonomy";

export function AdminSourcesPage() {
  const { user } = useAuth();
  const { data: sources, isLoading } = useListSources();
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
            RSS feeds the ingestion worker pulls into the aggregated feed every 30 minutes.
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

  const fetchNow = useFetchSourceNow({
    mutation: {
      onSuccess: (result) => {
        setStats(
          result.error
            ? `Fetch failed: ${result.error}`
            : `${result.imported} imported, ${result.skippedDuplicates} duplicates of ${result.itemsSeen} seen`,
        );
        refresh();
      },
    },
  });
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
            {!source.active && (
              <span className="rounded-full bg-cream px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                paused
              </span>
            )}
          </div>
          <p className="truncate text-xs text-ink-faint">{source.feedUrl}</p>
          <p className="mt-0.5 text-xs text-ink-soft">
            {source.category ? CATEGORY_LABELS[source.category] : "No category"}
            {source.subcategory && ` · ${source.subcategory}`}
            {" — "}
            {source.tags.map((t) => t.name).join(", ") || "No tags"}
            {source.lastFetchedAt &&
              ` · last fetched ${new Date(source.lastFetchedAt).toLocaleString()}`}
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
      {source.lastStatus === "error" && source.lastError && (
        <p className="mt-2 text-xs text-crimson">{source.lastError}</p>
      )}
    </div>
  );
}

function SourceFormDialog({ source, onClose }: { source?: Source; onClose: () => void }) {
  const isEdit = Boolean(source);
  const queryClient = useQueryClient();
  const { data: tags } = useListTags();
  const [form, setForm] = useState({
    name: source?.name ?? "",
    siteUrl: source?.siteUrl ?? "",
    feedUrl: source?.feedUrl ?? "",
  });
  const [tagIds, setTagIds] = useState<string[]>(source?.tags.map((t) => t.id) ?? []);
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
      ...form,
      tagIds,
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
          {isEdit ? "Edit RSS source" : "Add an RSS source"}
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
            label="Feed URL"
            type="url"
            placeholder="https://…/rss"
            value={form.feedUrl}
            onChange={(e) => setForm({ ...form, feedUrl: e.target.value })}
            required
          />
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
            <p className="mb-1.5 text-sm font-medium">Tags applied to imports</p>
            <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
              {(tags ?? []).map((tag) => {
                const active = tagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    aria-pressed={active}
                    disabled={!active && tagIds.length >= 5}
                    onClick={() =>
                      setTagIds((prev) =>
                        active ? prev.filter((id) => id !== tag.id) : [...prev, tag.id],
                      )
                    }
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium disabled:opacity-40 ${
                      active
                        ? "border-crimson bg-crimson text-ink-inverse"
                        : "border-line bg-white text-ink-soft hover:border-ink-soft"
                    }`}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
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
