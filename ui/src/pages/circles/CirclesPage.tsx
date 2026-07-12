import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "../../components/Button";
import { Field } from "../../components/Field";
import {
  getListCirclesQueryKey,
  useCreateCircle,
  useJoinCircle,
  useLeaveCircle,
  useListCircles,
} from "../../lib/api/generated/circles/circles";
import { useListTags } from "../../lib/api/generated/tags/tags";
import type { Circle } from "../../lib/api/generated/model";

export function CirclesPage() {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const { data: circles, isLoading } = useListCircles(query ? { q: query } : undefined);

  return (
    <div className="px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker mb-1">Circles</p>
          <h1 className="font-display-serif text-3xl font-semibold">Find your corner</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Member-run communities for every niche — from Japanese denim to bridal couture.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>Start a circle</Button>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search circles…"
        className="mt-6 w-full max-w-sm rounded-full border border-line bg-paper px-4 py-2 text-sm placeholder:text-ink-faint focus:border-crimson focus:outline-none"
      />

      {isLoading && <p className="mt-8 text-ink-faint">Loading…</p>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(circles ?? []).map((circle) => (
          <CircleCard key={circle.id} circle={circle} />
        ))}
      </div>

      {circles?.length === 0 && (
        <div className="mt-10 rounded-xl border border-dashed border-line p-12 text-center">
          <p className="font-display-serif text-2xl font-semibold">No circles found</p>
          <p className="mt-2 text-sm text-ink-soft">Start the one you're looking for.</p>
        </div>
      )}

      {creating && <CreateCircleDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function CircleCard({ circle }: { circle: Circle }) {
  const queryClient = useQueryClient();
  const [joined, setJoined] = useState(Boolean(circle.viewerRole));
  const [members, setMembers] = useState(circle.memberCount);
  const join = useJoinCircle();
  const leave = useLeaveCircle();
  const isOwner = circle.viewerRole === "owner";

  function toggle() {
    if (joined) {
      setJoined(false);
      setMembers((n) => n - 1);
      leave.mutate(
        { slug: circle.slug },
        { onError: () => void queryClient.invalidateQueries({ queryKey: getListCirclesQueryKey() }) },
      );
    } else {
      setJoined(true);
      setMembers((n) => n + 1);
      join.mutate({ slug: circle.slug });
    }
  }

  return (
    <div className="flex flex-col rounded-xl border border-line bg-paper p-5 shadow-card transition-shadow hover:shadow-card-hover">
      <div className="flex items-start justify-between gap-3">
        <Link to={`/c/${circle.slug}`} className="min-w-0">
          <h2 className="font-display-serif truncate text-xl font-semibold hover:text-crimson-deep">
            {circle.name}
          </h2>
        </Link>
        {!isOwner && (
          <Button variant={joined ? "secondary" : "primary"} onClick={toggle} className="!px-3 !py-1.5 text-xs">
            {joined ? "Joined" : "Join"}
          </Button>
        )}
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm text-ink-soft">{circle.description}</p>
      <div className="mt-auto flex items-center gap-2 pt-3 text-xs text-ink-faint">
        <span>
          {members} member{members === 1 ? "" : "s"}
        </span>
        <span aria-hidden>·</span>
        <span>{circle.postCount} posts</span>
        {circle.tags.slice(0, 2).map((tag) => (
          <span key={tag.id} className="kicker ml-1">
            {tag.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function CreateCircleDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { data: tags } = useListTags();
  const [form, setForm] = useState({ name: "", description: "", rules: "" });
  const [tagIds, setTagIds] = useState<string[]>([]);
  const createCircle = useCreateCircle({
    mutation: {
      onSuccess: (circle) => navigate(`/c/${circle.slug}`),
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    createCircle.mutate({
      data: {
        name: form.name,
        description: form.description,
        rules: form.rules
          .split("\n")
          .map((r) => r.trim())
          .filter(Boolean)
          .slice(0, 10),
        tagIds,
      },
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Start a circle"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-line bg-paper p-6 shadow-card-hover"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="kicker mb-1">New circle</p>
        <h2 className="font-display-serif text-2xl font-semibold">Start a circle</h2>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <Field
            label="Name"
            placeholder="e.g. Bridal Couture"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            minLength={3}
            maxLength={60}
          />
          <Field
            label="One-line description"
            placeholder="What is this circle about?"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
            maxLength={160}
          />
          <div>
            <label htmlFor="rules" className="mb-1.5 block text-sm font-medium">
              Rules <span className="font-normal text-ink-faint">(one per line, optional)</span>
            </label>
            <textarea
              id="rules"
              rows={3}
              value={form.rules}
              onChange={(e) => setForm({ ...form, rules: e.target.value })}
              placeholder={"Credit makers and mills\nNo resale listings"}
              className="w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm placeholder:text-ink-faint focus:border-crimson focus:outline-none"
            />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium">Tags (up to 5)</p>
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
          {createCircle.error && (
            <p className="text-sm text-crimson">{createCircle.error.message}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={createCircle.isPending}>
              Create circle
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
