import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AvatarBubble } from "../../components/AppShell";
import { PostCard } from "../../components/PostCard";
import { useSearch } from "../../lib/api/generated/search/search";

const TYPES = ["all", "posts", "people", "circles", "tags"] as const;
type SearchType = (typeof TYPES)[number];

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const type = (params.get("type") as SearchType) ?? "all";
  const [input, setInput] = useState(q);

  useEffect(() => {
    setInput(q);
  }, [q]);

  const { data, isLoading } = useSearch(
    { q, type },
    { query: { enabled: q.trim().length > 0 } },
  );

  function submit(nextQ: string, nextType: SearchType = type) {
    const next = new URLSearchParams();
    if (nextQ.trim()) next.set("q", nextQ.trim());
    if (nextType !== "all") next.set("type", nextType);
    setParams(next, { replace: true });
  }

  const hasResults =
    data &&
    (data.posts.length > 0 ||
      data.people.length > 0 ||
      data.circles.length > 0 ||
      data.tags.length > 0);

  return (
    <div className="px-4 py-8 sm:px-6">
      <p className="kicker mb-1">Search</p>
      <h1 className="font-display-serif text-3xl font-semibold">Search Centoire</h1>

      <form
        className="mt-5 flex max-w-xl gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
      >
        <input
          type="search"
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Posts, people, circles, tags…"
          className="w-full rounded-full border border-line bg-paper px-5 py-2.5 text-sm placeholder:text-ink-faint focus:border-crimson focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-full bg-crimson px-5 py-2.5 text-sm font-semibold text-ink-inverse hover:bg-crimson-deep"
        >
          Search
        </button>
      </form>

      {q && (
        <div className="mt-4 flex gap-2">
          {TYPES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => submit(q, value)}
              aria-pressed={type === value}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize transition-colors ${
                type === value
                  ? "bg-ink text-ink-inverse"
                  : "border border-line bg-paper text-ink-soft hover:border-ink-soft"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      )}

      {isLoading && <p className="mt-8 text-ink-faint">Searching…</p>}

      {q && data && !hasResults && (
        <div className="mt-10 rounded-xl border border-dashed border-line p-12 text-center">
          <p className="font-display-serif text-2xl font-semibold">No results for “{q}”</p>
          <p className="mt-2 text-sm text-ink-soft">Try a different term or browse Discover.</p>
        </div>
      )}

      {data && hasResults && (
        <div className="mt-8 space-y-10">
          {data.people.length > 0 && (
            <section>
              <p className="kicker mb-3">People</p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {data.people.map((person) => (
                  <Link
                    key={person.id}
                    to={person.handle ? `/u/${person.handle}` : "#"}
                    className="flex items-center gap-3 rounded-xl border border-line bg-paper p-4 hover:shadow-card-hover"
                  >
                    <AvatarBubble name={person.displayName} url={person.avatarUrl} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{person.displayName}</p>
                      <p className="text-xs text-ink-faint">
                        {person.handle && `@${person.handle} · `}
                        <span className="text-gold">{person.reputation}</span>
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {data.circles.length > 0 && (
            <section>
              <p className="kicker mb-3">Circles</p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {data.circles.map((circle) => (
                  <Link
                    key={circle.id}
                    to={`/c/${circle.slug}`}
                    className="rounded-xl border border-line bg-paper p-4 hover:shadow-card-hover"
                  >
                    <p className="font-display-serif text-lg font-semibold">{circle.name}</p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-ink-soft">
                      {circle.description}
                    </p>
                    <p className="mt-1.5 text-xs text-ink-faint">{circle.memberCount} members</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {data.tags.length > 0 && (
            <section>
              <p className="kicker mb-3">Tags</p>
              <div className="flex flex-wrap gap-2">
                {data.tags.map((tag) => (
                  <Link
                    key={tag.id}
                    to={`/t/${tag.slug}`}
                    className="rounded-full border border-line bg-paper px-4 py-2 text-sm font-medium hover:border-crimson hover:text-crimson"
                  >
                    {tag.name}
                    <span className="ml-1.5 text-xs text-ink-faint">{tag.postCount}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {data.posts.length > 0 && (
            <section>
              <p className="kicker mb-3">Posts</p>
              <div className="columns-1 gap-4 sm:columns-2 xl:columns-3">
                {data.posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
