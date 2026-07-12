import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "../../components/Button";
import { Field } from "../../components/Field";
import {
  getListSourcesQueryKey,
  useCreateSource,
  useDeleteSource,
  useFetchSourceNow,
  useListSources,
  useUpdateSource,
} from "../../lib/api/generated/admin/admin";
import { useListTags } from "../../lib/api/generated/tags/tags";
import type { Source } from "../../lib/api/generated/model";
import { useAuth } from "../../lib/auth-context";

export function AdminSourcesPage() {
  const { user } = useAuth();
  const { data: sources, isLoading } = useListSources();
  const [adding, setAdding] = useState(false);

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
        <Button onClick={() => setAdding(true)}>Add source</Button>
      </div>

      {isLoading && <p className="mt-8 text-ink-faint">Loading…</p>}

      <div className="mt-6 space-y-3">
        {(sources ?? []).map((source) => (
          <SourceRow key={source.id} source={source} />
        ))}
      </div>

      {adding && <AddSourceDialog onClose={() => setAdding(false)} />}
    </div>
  );
}

function SourceRow({ source }: { source: Source }) {
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

function AddSourceDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: tags } = useListTags();
  const [form, setForm] = useState({ name: "", siteUrl: "", feedUrl: "" });
  const [tagIds, setTagIds] = useState<string[]>([]);
  const createSource = useCreateSource({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getListSourcesQueryKey() });
        onClose();
      },
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    createSource.mutate({ data: { ...form, tagIds } });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Add source"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-line bg-paper p-6 shadow-card-hover"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="kicker mb-1">New source</p>
        <h2 className="font-display-serif text-2xl font-semibold">Add an RSS source</h2>
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
          {createSource.error && (
            <p className="text-sm text-crimson">{createSource.error.message}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={createSource.isPending}>
              Add source
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
