import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/Button";
import { Field } from "../../components/Field";
import {
  useGetOnboardingSuggestions,
} from "../../lib/api/generated/onboarding/onboarding";
import { useListTags } from "../../lib/api/generated/tags/tags";
import {
  useCompleteOnboarding,
  useFollowUser,
  useSetInterests,
  useUnfollowUser,
  useUpdateMe,
} from "../../lib/api/generated/users/users";
import { useJoinCircle, useLeaveCircle } from "../../lib/api/generated/circles/circles";
import type { Tag } from "../../lib/api/generated/model";
import { useAuth } from "../../lib/auth-context";

const CATEGORY_LABELS: Record<Tag["category"], string> = {
  style: "Style",
  craft: "Craft",
  business: "Business",
  culture: "Culture",
};

const STEPS = ["Interests", "People & circles", "Your profile"] as const;

export function OnboardingPage() {
  const [step, setStep] = useState(0);

  return (
    <main className="min-h-screen bg-cream px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <header className="mb-10 text-center">
          <span className="font-display-serif text-2xl font-bold">Centoire</span>
          <ol className="mt-6 flex items-center justify-center gap-2 text-xs">
            {STEPS.map((label, i) => (
              <li key={label} className="flex items-center gap-2">
                {i > 0 && <span className="h-px w-8 bg-line" aria-hidden />}
                <span
                  className={
                    i === step
                      ? "kicker"
                      : i < step
                        ? "font-semibold uppercase tracking-[0.14em] text-gold"
                        : "font-semibold uppercase tracking-[0.14em] text-ink-faint"
                  }
                >
                  {label}
                </span>
              </li>
            ))}
          </ol>
        </header>
        {step === 0 && <InterestsStep onDone={() => setStep(1)} />}
        {step === 1 && <FollowStep onDone={() => setStep(2)} onBack={() => setStep(0)} />}
        {step === 2 && <ProfileStep onBack={() => setStep(1)} />}
      </div>
    </main>
  );
}

function InterestsStep({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const { data: tags } = useListTags();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(user?.interests.map((t) => t.id) ?? []),
  );
  const setInterests = useSetInterests({
    mutation: { onSuccess: onDone },
  });

  const grouped = useMemo(() => {
    const groups = new Map<Tag["category"], Tag[]>();
    for (const tag of tags ?? []) {
      const list = groups.get(tag.category) ?? [];
      list.push(tag);
      groups.set(tag.category, list);
    }
    return groups;
  }, [tags]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <section>
      <h1 className="font-display-serif text-center text-3xl font-semibold">
        What corners of fashion are yours?
      </h1>
      <p className="mt-2 text-center text-sm text-ink-soft">
        Pick at least 3 — they seed your For You feed from day one.
      </p>
      <div className="mt-8 space-y-8">
        {[...grouped.entries()].map(([category, categoryTags]) => (
          <div key={category}>
            <p className="kicker mb-3">{CATEGORY_LABELS[category]}</p>
            <div className="flex flex-wrap gap-2">
              {categoryTags.map((tag) => {
                const active = selected.has(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggle(tag.id)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "border-crimson bg-crimson text-ink-inverse"
                        : "border-line bg-paper text-ink hover:border-ink-soft"
                    }`}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-10 flex items-center justify-between">
        <p className="text-sm text-ink-soft">
          {selected.size} selected{selected.size < 3 && ` — pick ${3 - selected.size} more`}
        </p>
        <Button
          disabled={selected.size < 3}
          loading={setInterests.isPending}
          onClick={() => setInterests.mutate({ data: { tagIds: [...selected] } })}
        >
          Continue
        </Button>
      </div>
    </section>
  );
}

function FollowStep({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const { data, refetch } = useGetOnboardingSuggestions();
  const follow = useFollowUser({ mutation: { onSuccess: () => refetch() } });
  const unfollow = useUnfollowUser({ mutation: { onSuccess: () => refetch() } });
  const join = useJoinCircle({ mutation: { onSuccess: () => refetch() } });
  const leave = useLeaveCircle({ mutation: { onSuccess: () => refetch() } });

  const followedIds = new Set(data?.followedCreatorIds ?? []);
  const joinedIds = new Set(data?.joinedCircleIds ?? []);
  const totalFollows = followedIds.size + joinedIds.size;

  return (
    <section>
      <h1 className="font-display-serif text-center text-3xl font-semibold">
        Build your front row
      </h1>
      <p className="mt-2 text-center text-sm text-ink-soft">
        Follow at least 3 creators or circles so your feed is never empty.
      </p>

      {(data?.circles.length ?? 0) > 0 && (
        <div className="mt-8">
          <p className="kicker mb-3">Circles</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {data!.circles.map((circle) => {
              const joined = joinedIds.has(circle.id);
              return (
                <div
                  key={circle.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-line bg-paper p-4"
                >
                  <div>
                    <p className="font-display-serif text-lg font-semibold">{circle.name}</p>
                    <p className="mt-0.5 text-sm text-ink-soft">{circle.description}</p>
                    <p className="mt-1 text-xs text-ink-faint">
                      {circle.memberCount} member{circle.memberCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <Button
                    variant={joined ? "secondary" : "primary"}
                    onClick={() =>
                      joined
                        ? leave.mutate({ slug: circle.slug })
                        : join.mutate({ slug: circle.slug })
                    }
                  >
                    {joined ? "Joined" : "Join"}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(data?.creators.length ?? 0) > 0 && (
        <div className="mt-8">
          <p className="kicker mb-3">Creators</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {data!.creators.map((creator) => {
              const following = followedIds.has(creator.id);
              return (
                <div
                  key={creator.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-paper p-4"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={creator.displayName} url={creator.avatarUrl} />
                    <div>
                      <p className="font-semibold">{creator.displayName}</p>
                      {creator.handle && (
                        <p className="text-xs text-ink-faint">@{creator.handle}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant={following ? "secondary" : "primary"}
                    onClick={() =>
                      following
                        ? unfollow.mutate({ id: creator.id })
                        : follow.mutate({ id: creator.id })
                    }
                  >
                    {following ? "Following" : "Follow"}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-10 flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <div className="flex items-center gap-4">
          <p className="text-sm text-ink-soft">
            {totalFollows} followed{totalFollows < 3 && ` — ${3 - totalFollows} to go`}
          </p>
          <Button disabled={totalFollows < 3} onClick={onDone}>
            Continue
          </Button>
        </div>
      </div>
    </section>
  );
}

function ProfileStep({ onBack }: { onBack: () => void }) {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [handle, setHandle] = useState(user?.handle ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const updateMe = useUpdateMe();
  const complete = useCompleteOnboarding({
    mutation: {
      onSuccess: async () => {
        await refresh();
        navigate("/feed", { replace: true });
      },
    },
  });

  async function finish() {
    await updateMe.mutateAsync({ data: { handle, bio: bio || undefined } });
    complete.mutate();
  }

  const error = updateMe.error ?? complete.error;

  return (
    <section className="mx-auto max-w-md">
      <h1 className="font-display-serif text-center text-3xl font-semibold">
        Sign your work
      </h1>
      <p className="mt-2 text-center text-sm text-ink-soft">
        Your handle is how the community knows you.
      </p>
      <div className="mt-8 space-y-4">
        <Field
          label="Handle"
          placeholder="e.g. atelier_mira"
          value={handle}
          onChange={(e) => setHandle(e.target.value.toLowerCase())}
          required
          pattern="[a-z0-9_]{3,24}"
          title="3-24 characters: lowercase letters, numbers, underscores"
        />
        <div>
          <label htmlFor="bio" className="mb-1.5 block text-sm font-medium text-ink">
            One-line bio <span className="font-normal text-ink-faint">(optional)</span>
          </label>
          <textarea
            id="bio"
            rows={2}
            maxLength={160}
            placeholder="Knitwear designer in Antwerp. Deadstock only."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-crimson focus:outline-none"
          />
        </div>
        {error && <p className="text-sm text-crimson">{error.message}</p>}
      </div>
      <div className="mt-10 flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button
          disabled={!/^[a-z0-9_]{3,24}$/.test(handle)}
          loading={updateMe.isPending || complete.isPending}
          onClick={finish}
        >
          Enter Centoire
        </Button>
      </div>
    </section>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    return <img src={url} alt="" className="size-10 rounded-full object-cover" />;
  }
  return (
    <span className="flex size-10 items-center justify-center rounded-full bg-gold-tint font-display-serif text-lg font-semibold text-gold">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
