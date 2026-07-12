import { Link } from "react-router-dom";
import { useListMyDrafts } from "../../lib/api/generated/posts/posts";

export function DraftsPage() {
  const { data: drafts, isLoading } = useListMyDrafts();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <p className="kicker mb-2">Your workshop</p>
      <h1 className="font-display-serif text-3xl font-semibold">Drafts</h1>

      {isLoading && <p className="mt-6 text-ink-faint">Loading…</p>}

      {drafts?.length === 0 && (
        <div className="mt-10 rounded-xl border border-dashed border-line p-10 text-center">
          <p className="text-ink-soft">Nothing in progress.</p>
          <Link
            to="/compose"
            className="mt-4 inline-block rounded-lg bg-crimson px-4 py-2 text-sm font-semibold text-ink-inverse hover:bg-crimson-deep"
          >
            Start writing
          </Link>
        </div>
      )}

      <ul className="mt-6 space-y-3">
        {(drafts ?? []).map((draft) => (
          <li key={draft.id}>
            <Link
              to={`/compose/${draft.id}`}
              className="block rounded-xl border border-line bg-paper p-5 transition-shadow hover:shadow-card-hover"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-display-serif truncate text-xl font-semibold">
                    {draft.title || "Untitled"}
                  </h2>
                  {draft.excerpt && (
                    <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{draft.excerpt}</p>
                  )}
                  <p className="mt-2 text-xs text-ink-faint">
                    Edited{" "}
                    {new Date(draft.updatedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                    {draft.circle && ` · ${draft.circle.name}`}
                  </p>
                </div>
                {draft.coverImageUrl && (
                  <img
                    src={draft.coverImageUrl}
                    alt=""
                    className="size-16 shrink-0 rounded-lg object-cover"
                  />
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
