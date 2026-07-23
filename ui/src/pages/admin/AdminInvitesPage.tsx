import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { Button } from "../../components/Button";
import { Field } from "../../components/Field";
import {
  getListInvitesQueryKey,
  useCreateInvite,
  useListInvites,
  useRevokeInvite,
} from "../../lib/api/generated/admin/admin";
import { customInstance } from "../../lib/api/http";
import type { Invite } from "../../lib/api/generated/model";
import { useAuth } from "../../lib/auth-context";
import { hasPermission } from "../../lib/permissions";

const ROLE_LABELS: Record<string, string> = {
  creator: "Creator",
  editor: "Editor",
  admin: "Admin",
};

export function AdminInvitesPage() {
  const { user } = useAuth();
  const { data, isLoading } = useListInvites();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);

  if (!hasPermission(user?.role, "user.invite")) {
    return (
      <div className="p-10 text-center">
        <p className="kicker mb-2">Admin</p>
        <p className="text-ink-soft">This area needs invite permissions.</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker mb-1">Admin</p>
          <h1 className="font-display-serif text-3xl font-semibold">Invites & roles</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Invite new members with elevated roles, or promote existing members.
          </p>
          <p className="mt-0.5 text-xs text-ink-faint">
            Role changes take effect on the user's next login.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setPromoteOpen(true)}>
            Promote member
          </Button>
          <Button onClick={() => setInviteOpen(true)}>Send invite</Button>
        </div>
      </div>

      {isLoading && <p className="mt-8 text-ink-faint">Loading…</p>}

      <div className="mt-6 space-y-3">
        {(data?.invites ?? []).map((invite) => (
          <InviteRow key={invite.id} invite={invite} />
        ))}
        {!isLoading && (data?.invites ?? []).length === 0 && (
          <p className="text-sm text-ink-faint">No invites sent yet.</p>
        )}
      </div>

      {inviteOpen && <InviteDialog onClose={() => setInviteOpen(false)} />}
      {promoteOpen && <PromoteDialog onClose={() => setPromoteOpen(false)} />}
    </div>
  );
}

function InviteRow({ invite }: { invite: Invite }) {
  const queryClient = useQueryClient();
  const revoke = useRevokeInvite({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListInvitesQueryKey() }),
    },
  });

  const statusColor =
    invite.status === "accepted"
      ? "text-gold bg-gold-tint"
      : invite.status === "revoked"
        ? "text-ink-faint bg-cream"
        : "text-crimson bg-crimson-tint";

  return (
    <div className="rounded-xl border border-line bg-paper p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold">{invite.email}</p>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusColor}`}
            >
              {invite.status}
            </span>
            <span className="rounded-full bg-cream px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
              {ROLE_LABELS[invite.role] ?? invite.role}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-ink-faint">
            Expires {new Date(invite.expiresAt).toLocaleDateString()}
            {invite.acceptedAt && ` · Accepted ${new Date(invite.acceptedAt).toLocaleDateString()}`}
          </p>
        </div>
        {invite.status === "pending" && (
          <Button
            variant="ghost"
            className="!px-2 !py-1.5 text-xs !text-crimson"
            loading={revoke.isPending}
            onClick={() => revoke.mutate({ id: invite.id })}
          >
            Revoke
          </Button>
        )}
      </div>
    </div>
  );
}

function InviteDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");

  const createInvite = useCreateInvite({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getListInvitesQueryKey() });
        onClose();
      },
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    createInvite.mutate({ data: { email, role: "creator" } });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Send invite"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-line bg-paper p-6 shadow-card-hover"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="kicker mb-1">New invite</p>
        <h2 className="font-display-serif text-2xl font-semibold">Invite a creator</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Creator posts rank higher in feeds and show a "Must Read" badge.
        </p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <Field
            label="Email"
            type="email"
            placeholder="person@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {createInvite.error && (
            <p className="text-sm text-crimson">{createInvite.error.message}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={createInvite.isPending}>
              Send invite
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PromoteDialog({ onClose }: { onClose: () => void }) {
  const [handle, setHandle] = useState("");
  const [role, setRole] = useState<"creator" | "editor" | "admin">("creator");
  const [success, setSuccess] = useState<string | null>(null);

  const promote = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      return customInstance<void>({
        url: `/users/${userId}/role`,
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        data: { role: newRole },
      });
    },
  });

  const lookupUser = useMutation({
    mutationFn: async (handleStr: string) => {
      return customInstance<{ id: string; displayName: string }>({
        url: `/users/${handleStr}`,
        method: "GET",
      });
    },
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const userData = await lookupUser.mutateAsync(handle.replace("@", ""));
    await promote.mutateAsync({ userId: userData.id, newRole: role });
    setSuccess(`${userData.displayName} is now ${ROLE_LABELS[role] ?? role}. They must log out and back in for the change to take effect.`);
  }

  const error = lookupUser.error ?? promote.error;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Promote member"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-line bg-paper p-6 shadow-card-hover"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="kicker mb-1">Role change</p>
        <h2 className="font-display-serif text-2xl font-semibold">Promote a member</h2>
        {success ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-ink-soft">{success}</p>
            <div className="flex justify-end">
              <Button onClick={onClose}>Done</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <Field
              label="Handle"
              placeholder="@atelier_mira"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              required
            />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">New role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as typeof role)}
                className="w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink focus:border-crimson focus:outline-none"
              >
                <option value="creator">Creator — can publish & bypass queue</option>
                <option value="editor">Editor — can moderate content & policies</option>
                <option value="admin">Admin — full access</option>
              </select>
            </div>
            {error && <p className="text-sm text-crimson">{(error as Error).message}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                loading={lookupUser.isPending || promote.isPending}
              >
                Promote
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
