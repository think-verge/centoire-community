import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "../../components/Button";
import { Field } from "../../components/Field";
import {
  getGetModerationQueueQueryKey,
  getListPoliciesQueryKey,
  useApprovePost,
  useCreatePolicy,
  useDeletePolicy,
  useGetModerationQueue,
  useListPolicies,
  useRejectPost,
} from "../../lib/api/generated/moderation/moderation";
import type { ModerationPolicy, PostCard } from "../../lib/api/generated/model";
import { CreatePolicyInputAction, CreatePolicyInputType } from "../../lib/api/generated/model";
import { useAuth } from "../../lib/auth-context";
import { hasPermission } from "../../lib/permissions";

type Tab = "queue" | "policies";

export function ModerationPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("queue");

  if (!hasPermission(user?.role, "moderation.review")) {
    return (
      <div className="p-10 text-center">
        <p className="kicker mb-2">Moderation</p>
        <p className="text-ink-soft">This area needs editor or admin access.</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 sm:px-6">
      <div className="mb-6">
        <p className="kicker mb-1">Moderation</p>
        <h1 className="font-display-serif text-3xl font-semibold">Content review</h1>
      </div>

      <div className="flex gap-2 border-b border-line">
        {(["queue", "policies"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            aria-selected={tab === value}
            className={`border-b-2 px-3 pb-2 text-sm font-semibold capitalize transition-colors ${
              tab === value
                ? "border-crimson text-crimson"
                : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {value === "queue" ? "Review queue" : "Policies"}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "queue" && <QueueTab />}
        {tab === "policies" && hasPermission(user?.role, "moderation.manage_policies") && (
          <PoliciesTab />
        )}
        {tab === "policies" && !hasPermission(user?.role, "moderation.manage_policies") && (
          <p className="text-sm text-ink-faint">Policy management requires admin access.</p>
        )}
      </div>
    </div>
  );
}

function QueueTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetModerationQueue();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: getGetModerationQueueQueryKey() });
  }

  const approve = useApprovePost({ mutation: { onSuccess: invalidate } });
  const reject = useRejectPost({
    mutation: {
      onSuccess: () => {
        setRejectingId(null);
        setReason("");
        invalidate();
      },
    },
  });

  if (isLoading) return <p className="text-ink-faint">Loading…</p>;

  const items = data?.items ?? [];

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line p-12 text-center">
        <p className="font-display-serif text-2xl font-semibold">Queue is clear</p>
        <p className="mt-2 text-sm text-ink-soft">No posts waiting for review.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((post) => (
        <QueueItem
          key={post.id}
          post={post}
          rejectingId={rejectingId}
          reason={reason}
          onReason={setReason}
          onApprove={() => approve.mutate({ id: post.id })}
          onRejectOpen={() => {
            setRejectingId(post.id);
            setReason("");
          }}
          onRejectSubmit={() => reject.mutate({ id: post.id, data: { reason } })}
          onRejectCancel={() => setRejectingId(null)}
          approveLoading={approve.isPending}
          rejectLoading={reject.isPending}
        />
      ))}
    </div>
  );
}

interface QueueItemProps {
  post: PostCard;
  rejectingId: string | null;
  reason: string;
  onReason: (v: string) => void;
  onApprove: () => void;
  onRejectOpen: () => void;
  onRejectSubmit: () => void;
  onRejectCancel: () => void;
  approveLoading: boolean;
  rejectLoading: boolean;
}

function QueueItem({
  post,
  rejectingId,
  reason,
  onReason,
  onApprove,
  onRejectOpen,
  onRejectSubmit,
  onRejectCancel,
  approveLoading,
  rejectLoading,
}: QueueItemProps) {
  const isRejecting = rejectingId === post.id;

  return (
    <div className="rounded-xl border border-line bg-paper p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-display-serif text-lg font-semibold leading-snug">{post.title}</p>
          <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{post.excerpt}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
            {post.author && <span>By {post.author.displayName}</span>}
            {post.source && <span>· {post.source.name}</span>}
            {post.tags.length > 0 && (
              <span>· {post.tags.map((t) => t.name).join(", ")}</span>
            )}
            <span>· {post.origin}</span>
          </div>
        </div>
        {!isRejecting && (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              className="!px-3 !py-1.5 text-xs"
              loading={approveLoading}
              onClick={onApprove}
            >
              Approve
            </Button>
            <Button
              variant="ghost"
              className="!px-3 !py-1.5 text-xs !text-crimson"
              onClick={onRejectOpen}
            >
              Reject
            </Button>
          </div>
        )}
      </div>

      {isRejecting && (
        <div className="mt-4 space-y-3">
          <Field
            label="Rejection reason (optional)"
            placeholder="Why is this post being rejected?"
            value={reason}
            onChange={(e) => onReason(e.target.value)}
            maxLength={500}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onRejectCancel} className="text-xs">
              Cancel
            </Button>
            <Button
              variant="ghost"
              className="text-xs !text-crimson"
              loading={rejectLoading}
              onClick={onRejectSubmit}
            >
              Confirm reject
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PoliciesTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useListPolicies();
  const [createOpen, setCreateOpen] = useState(false);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: getListPoliciesQueryKey() });
  }

  const deletePolicy = useDeletePolicy({ mutation: { onSuccess: invalidate } });

  if (isLoading) return <p className="text-ink-faint">Loading…</p>;

  const policies = data?.policies ?? [];

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-soft">
          Policies bypass the review queue automatically. Evaluated in order: user → source → all.
        </p>
        <Button onClick={() => setCreateOpen(true)}>New policy</Button>
      </div>

      <div className="mt-4 space-y-3">
        {policies.map((policy) => (
          <PolicyRow
            key={policy.id}
            policy={policy}
            onDelete={() => deletePolicy.mutate({ id: policy.id })}
            deleteLoading={deletePolicy.isPending}
          />
        ))}
        {!isLoading && policies.length === 0 && (
          <p className="text-sm text-ink-faint">No policies defined.</p>
        )}
      </div>

      {createOpen && <CreatePolicyDialog onClose={() => setCreateOpen(false)} onCreated={invalidate} />}
    </div>
  );
}

function PolicyRow({
  policy,
  onDelete,
  deleteLoading,
}: {
  policy: ModerationPolicy;
  onDelete: () => void;
  deleteLoading: boolean;
}) {
  const actionLabel = policy.action === "auto_approve" ? "Auto-approve" : "Auto-reject";
  const actionColor =
    policy.action === "auto_approve"
      ? "text-gold bg-gold-tint"
      : "text-crimson bg-crimson-tint";

  return (
    <div className="rounded-xl border border-line bg-paper p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${actionColor}`}
            >
              {actionLabel}
            </span>
            <span className="rounded-full bg-cream px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
              {policy.type}
            </span>
            {!policy.active && (
              <span className="rounded-full bg-cream px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                inactive
              </span>
            )}
          </div>
          {policy.reason && (
            <p className="mt-1 text-xs text-ink-soft">{policy.reason}</p>
          )}
          {policy.targetId && (
            <p className="mt-0.5 text-xs text-ink-faint">Target: {policy.targetId}</p>
          )}
          {policy.expiresAt && (
            <p className="mt-0.5 text-xs text-ink-faint">
              Expires {new Date(policy.expiresAt).toLocaleDateString()}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          className="!px-2 !py-1.5 text-xs !text-crimson"
          loading={deleteLoading}
          onClick={onDelete}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}

function CreatePolicyDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [type, setType] = useState<"user" | "source" | "all">("all");
  const [targetId, setTargetId] = useState("");
  const [action, setAction] = useState<"auto_approve" | "auto_reject">("auto_approve");
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const createPolicy = useCreatePolicy({
    mutation: {
      onSuccess: () => {
        onCreated();
        onClose();
      },
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    createPolicy.mutate({
      data: {
        type: CreatePolicyInputType[type],
        action: CreatePolicyInputAction[action],
        targetId: type !== "all" && targetId ? targetId : undefined,
        reason: reason || undefined,
        expiresAt: expiresAt || undefined,
      },
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="New policy"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-line bg-paper p-6 shadow-card-hover"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="kicker mb-1">New policy</p>
        <h2 className="font-display-serif text-2xl font-semibold">Create bypass rule</h2>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Applies to</label>
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value as typeof type);
                setTargetId("");
              }}
              className="w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink focus:border-crimson focus:outline-none"
            >
              <option value="all">All content</option>
              <option value="user">Specific user (by ID)</option>
              <option value="source">Specific source (by ID)</option>
            </select>
          </div>

          {type !== "all" && (
            <Field
              label={type === "user" ? "User ID" : "Source ID"}
              placeholder={type === "user" ? "MongoDB ObjectId of the user" : "MongoDB ObjectId of the source"}
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              required
            />
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Action</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as typeof action)}
              className="w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink focus:border-crimson focus:outline-none"
            >
              <option value="auto_approve">Auto-approve — publish immediately</option>
              <option value="auto_reject">Auto-reject — reject immediately</option>
            </select>
          </div>

          <Field
            label="Reason (optional)"
            placeholder="Why does this policy exist?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
          />

          <Field
            label="Expires at (optional)"
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />

          {createPolicy.error && (
            <p className="text-sm text-crimson">{createPolicy.error.message}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={createPolicy.isPending}>
              Create policy
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
