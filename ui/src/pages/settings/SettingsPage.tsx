import { useRef, useState, type FormEvent } from "react";
import { AvatarBubble } from "../../components/AppShell";
import { Button } from "../../components/Button";
import { Field } from "../../components/Field";
import { useListTags } from "../../lib/api/generated/tags/tags";
import { useSetInterests, useUpdateMe } from "../../lib/api/generated/users/users";
import { uploadImage } from "../../lib/api/generated/uploads/uploads";
import { useAuth } from "../../lib/auth-context";

export function SettingsPage() {
  const { user, refresh } = useAuth();

  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <p className="kicker mb-1">Settings</p>
      <h1 className="font-display-serif text-3xl font-semibold">Account settings</h1>
      <div className="mt-8 space-y-10">
        <ProfileSection key={user.id} onSaved={refresh} />
        <InterestsSection onSaved={refresh} />
        <AccountSection />
      </div>
    </div>
  );
}

function ProfileSection({ onSaved }: { onSaved: () => Promise<unknown> }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    displayName: user?.displayName ?? "",
    handle: user?.handle ?? "",
    bio: user?.bio ?? "",
  });
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const updateMe = useUpdateMe({
    mutation: {
      onSuccess: async () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        await onSaved();
      },
    },
  });

  async function handleAvatar(file: File) {
    const result = await uploadImage({ file });
    setAvatarUrl(result.url);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    updateMe.mutate({
      data: {
        displayName: form.displayName,
        handle: form.handle || undefined,
        bio: form.bio,
        avatarUrl: avatarUrl ?? undefined,
      },
    });
  }

  return (
    <section>
      <h2 className="kicker mb-4">Profile</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-4">
          <AvatarBubble name={form.displayName || "?"} url={avatarUrl} size="size-16 text-2xl" />
          <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
            Change avatar
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleAvatar(file);
            }}
          />
        </div>
        <Field
          label="Display name"
          value={form.displayName}
          onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          required
          maxLength={60}
        />
        <Field
          label="Handle"
          value={form.handle}
          onChange={(e) => setForm({ ...form, handle: e.target.value.toLowerCase() })}
          pattern="[a-z0-9_]{3,24}"
          title="3-24 characters: lowercase letters, numbers, underscores"
        />
        <div>
          <label htmlFor="bio" className="mb-1.5 block text-sm font-medium">
            Bio
          </label>
          <textarea
            id="bio"
            rows={2}
            maxLength={160}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            className="w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm focus:border-crimson focus:outline-none"
          />
        </div>
        {updateMe.error && <p className="text-sm text-crimson">{updateMe.error.message}</p>}
        <div className="flex items-center gap-3">
          <Button type="submit" loading={updateMe.isPending}>
            Save profile
          </Button>
          {saved && <span className="text-sm text-gold">Saved</span>}
        </div>
      </form>
    </section>
  );
}

function InterestsSection({ onSaved }: { onSaved: () => Promise<unknown> }) {
  const { user } = useAuth();
  const { data: tags } = useListTags();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(user?.interests.map((t) => t.id) ?? []),
  );
  const [saved, setSaved] = useState(false);
  const setInterests = useSetInterests({
    mutation: {
      onSuccess: async () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        await onSaved();
      },
    },
  });

  return (
    <section>
      <h2 className="kicker mb-1">Interests & feed tuning</h2>
      <p className="mb-4 text-sm text-ink-soft">
        These tags drive your For You ranking. Keep at least 3.
      </p>
      <div className="flex flex-wrap gap-2">
        {(tags ?? []).map((tag) => {
          const active = selected.has(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              aria-pressed={active}
              onClick={() =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (next.has(tag.id)) next.delete(tag.id);
                  else next.add(tag.id);
                  return next;
                })
              }
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "border-crimson bg-crimson text-ink-inverse"
                  : "border-line bg-paper text-ink-soft hover:border-ink-soft"
              }`}
            >
              {tag.name}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button
          disabled={selected.size < 3}
          loading={setInterests.isPending}
          onClick={() => setInterests.mutate({ data: { tagIds: [...selected] } })}
        >
          Save interests
        </Button>
        {selected.size < 3 && (
          <span className="text-sm text-ink-faint">Pick at least 3</span>
        )}
        {saved && <span className="text-sm text-gold">Saved</span>}
      </div>
    </section>
  );
}

function AccountSection() {
  const { user } = useAuth();
  return (
    <section>
      <h2 className="kicker mb-4">Account</h2>
      <div className="space-y-2 rounded-xl border border-line bg-paper p-4 text-sm">
        <p>
          <span className="text-ink-soft">Email:</span> {user?.email}{" "}
          {user?.emailVerified ? (
            <span className="text-gold">verified</span>
          ) : (
            <span className="text-crimson">unverified</span>
          )}
        </p>
        <p className="text-ink-soft">
          Password changes go through{" "}
          <a href="/forgot-password" className="font-semibold text-crimson">
            the reset flow
          </a>
          .
        </p>
      </div>
    </section>
  );
}
