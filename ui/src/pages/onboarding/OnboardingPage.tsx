import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import logoDark from "../../assets/landing/logo-dark.svg";
import { AvatarBubble } from "../../components/AppShell";
import { CoralButton } from "../../components/auth/CoralButton";
import { CircleRulesModal } from "../../components/CircleRulesModal";
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
import type { Circle } from "../../lib/api/generated/model";
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
    <main className="min-h-screen bg-sand-warm px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <header className="mb-10 flex flex-col items-center gap-6">
          <img src={logoDark} alt="Centoire" className="h-8 w-auto" />
          <ol className="flex w-full max-w-xs items-center gap-2" aria-hidden>
            {STEPS.map((label, i) => (
              <li key={label} className="flex-1">
                <div className={`h-1.5 rounded-full ${i <= step ? "bg-coral" : "bg-hairline"}`} />
              </li>
            ))}
          </ol>
          <p className="font-ui text-xs font-bold uppercase tracking-[0.14em] text-charcoal">
            Step {step + 1} of {STEPS.length} — {STEPS[step]}
          </p>
        </header>
        {step === 0 && <InterestsStep onDone={() => setStep(1)} />}
        {step === 1 && <FollowStep onDone={() => setStep(2)} onBack={() => setStep(0)} />}
        {step === 2 && <ProfileStep onBack={() => setStep(1)} />}
      </div>
    </main>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-ui text-sm font-semibold text-stone hover:text-charcoal"
    >
      Back
    </button>
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
    <section className="rounded-2xl border border-hairline bg-white p-6 sm:p-10">
      <h1 className="font-display-serif text-center text-3xl font-semibold text-charcoal">
        What corners of fashion are yours?
      </h1>
      <p className="mt-2 text-center text-sm text-stone">
        Pick at least 3 — they seed your For You feed from day one.
      </p>
      <div className="mt-8 space-y-8">
        {[...grouped.entries()].map(([category, categoryTags]) => (
          <div key={category}>
            <p className="font-ui mb-3 text-xs font-bold uppercase tracking-[0.14em] text-coral">
              {CATEGORY_LABELS[category]}
            </p>
            <div className="flex flex-wrap gap-2">
              {categoryTags.map((tag) => {
                const active = selected.has(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggle(tag.id)}
                    className={`font-ui rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                      active
                        ? "border-coral bg-coral text-white"
                        : "border-hairline bg-white text-charcoal hover:border-stone"
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
        <p className="text-sm text-stone">
          {selected.size} selected{selected.size < 3 && ` — pick ${3 - selected.size} more`}
        </p>
        <CoralButton
          type="button"
          disabled={selected.size < 3}
          loading={setInterests.isPending}
          onClick={() => setInterests.mutate({ data: { tagIds: [...selected] } })}
        >
          Continue
        </CoralButton>
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
  const [rulesModalCircle, setRulesModalCircle] = useState<Circle | null>(null);

  const followedIds = new Set(data?.followedCreatorIds ?? []);
  const joinedIds = new Set(data?.joinedCircleIds ?? []);
  const totalFollows = followedIds.size + joinedIds.size;

  return (
    <section className="rounded-2xl border border-hairline bg-white p-6 sm:p-10">
      <h1 className="font-display-serif text-center text-3xl font-semibold text-charcoal">
        Build your front row
      </h1>
      <p className="mt-2 text-center text-sm text-stone">
        Follow at least 3 creators or circles so your feed is never empty.
      </p>

      {(data?.circles.length ?? 0) > 0 && (
        <div className="mt-8">
          <p className="font-ui mb-3 text-xs font-bold uppercase tracking-[0.14em] text-coral">
            Circles
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {data!.circles.map((circle) => {
              const joined = joinedIds.has(circle.id);
              return (
                <div
                  key={circle.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-hairline bg-white p-4"
                >
                  <div>
                    <p className="font-display-serif text-lg font-semibold text-charcoal">
                      {circle.name}
                    </p>
                    <p className="mt-0.5 text-sm text-stone">{circle.description}</p>
                    <p className="mt-1 text-xs text-taupe">
                      {circle.memberCount} member{circle.memberCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <ToggleButton
                    active={joined}
                    activeLabel="Joined"
                    inactiveLabel="Join"
                    onClick={() => {
                      if (joined) {
                        leave.mutate({ slug: circle.slug });
                      } else if (circle.rules.length > 0) {
                        setRulesModalCircle(circle);
                      } else {
                        join.mutate({ slug: circle.slug });
                      }
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(data?.creators.length ?? 0) > 0 && (
        <div className="mt-8">
          <p className="font-ui mb-3 text-xs font-bold uppercase tracking-[0.14em] text-coral">
            Creators
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {data!.creators.map((creator) => {
              const following = followedIds.has(creator.id);
              return (
                <div
                  key={creator.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-hairline bg-white p-4"
                >
                  <div className="flex items-center gap-3">
                    <AvatarBubble name={creator.displayName} url={creator.avatarUrl} />
                    <div>
                      <p className="font-semibold text-charcoal">{creator.displayName}</p>
                      {creator.handle && (
                        <p className="text-xs text-taupe">@{creator.handle}</p>
                      )}
                    </div>
                  </div>
                  <ToggleButton
                    active={following}
                    activeLabel="Following"
                    inactiveLabel="Follow"
                    onClick={() =>
                      following
                        ? unfollow.mutate({ id: creator.id })
                        : follow.mutate({ id: creator.id })
                    }
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-10 flex items-center justify-between">
        <BackLink onClick={onBack} />
        <div className="flex items-center gap-4">
          <p className="text-sm text-stone">
            {totalFollows} followed{totalFollows < 3 && ` — ${3 - totalFollows} to go`}
          </p>
          <CoralButton type="button" disabled={totalFollows < 3} onClick={onDone}>
            Continue
          </CoralButton>
        </div>
      </div>

      {rulesModalCircle && (
        <CircleRulesModal
          circle={rulesModalCircle}
          onCancel={() => setRulesModalCircle(null)}
          onAgree={() =>
            join.mutate(
              { slug: rulesModalCircle.slug },
              { onSuccess: () => setRulesModalCircle(null) },
            )
          }
          loading={join.isPending}
        />
      )}
    </section>
  );
}

function ToggleButton({
  active,
  activeLabel,
  inactiveLabel,
  onClick,
}: {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`font-ui shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
        active
          ? "border-hairline bg-white text-stone hover:border-stone"
          : "border-coral bg-coral text-white hover:opacity-90"
      }`}
    >
      {active ? activeLabel : inactiveLabel}
    </button>
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
    <section className="mx-auto max-w-md rounded-2xl border border-hairline bg-white p-6 sm:p-10">
      <h1 className="font-display-serif text-center text-3xl font-semibold text-charcoal">
        Sign your work
      </h1>
      <p className="mt-2 text-center text-sm text-stone">
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
          <label htmlFor="bio" className="mb-1.5 block text-sm font-medium text-charcoal">
            One-line bio <span className="font-normal text-taupe">(optional)</span>
          </label>
          <textarea
            id="bio"
            rows={2}
            maxLength={160}
            placeholder="Knitwear designer in Antwerp. Deadstock only."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full rounded-lg border border-hairline bg-white px-3.5 py-2.5 text-sm text-charcoal placeholder:text-taupe focus:border-coral focus:outline-none"
          />
        </div>
        {error && <p className="text-sm text-crimson">{error.message}</p>}
      </div>
      <div className="mt-10 flex items-center justify-between">
        <BackLink onClick={onBack} />
        <CoralButton
          type="button"
          disabled={!/^[a-z0-9_]{3,24}$/.test(handle)}
          loading={updateMe.isPending || complete.isPending}
          onClick={finish}
        >
          Enter Centoire
        </CoralButton>
      </div>
    </section>
  );
}
