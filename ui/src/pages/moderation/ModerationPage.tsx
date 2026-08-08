import { useState, type FormEvent, type KeyboardEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "../../components/Button";
import { Field } from "../../components/Field";
import { PostDrawer } from "../../components/PostDrawer";
import { ActiveFilterPills } from "../../components/filter/ActiveFilterPills";
import { ServerFilterBar } from "../../components/filter/ServerFilterBar";
import { useServerFilter } from "../../components/filter/useServerFilter";
import type { FilterFieldDef } from "../../components/filter/types";
import {
  approvePost,
  deletePolicy,
  getGetModerationQueueQueryKey,
  getListPoliciesQueryKey,
  rejectPost,
  updatePolicy,
  useApprovePost,
  useCreatePolicy,
  useDeletePolicy,
  useGetModerationQueue,
  useListPolicies,
  useRejectPost,
  useUpdatePolicy,
} from "../../lib/api/generated/moderation/moderation";
import type {
  CreatePolicyInputConditionsItem,
  ModerationPolicy,
  PostCard,
} from "../../lib/api/generated/model";
import {
  CreatePolicyInputAction,
  CreatePolicyInputLogic,
} from "../../lib/api/generated/model";
import { listSources } from "../../lib/api/generated/admin/admin";
import { listTags } from "../../lib/api/generated/tags/tags";
import { useAuth } from "../../lib/auth-context";
import { hasPermission } from "../../lib/permissions";

const QUEUE_FILTER_CONFIG: FilterFieldDef[] = [
  {
    key: "status",
    label: "Status",
    type: "single",
    options: [
      { value: "pending_review", label: "Pending Review" },
      { value: "rejected", label: "Rejected / Blocked" },
      { value: "all", label: "All" },
    ],
  },
  {
    key: "origin",
    label: "Origin",
    type: "single",
    options: [
      { value: "native", label: "User posts" },
      { value: "aggregated", label: "Source posts" },
    ],
  },
  {
    key: "source",
    label: "Source",
    type: "multi",
    loadOptions: async () => {
      const res = await listSources();
      return res.map((s) => ({ value: s.id, label: s.name }));
    },
  },
  {
    key: "tag",
    label: "Tag",
    type: "multi",
    loadOptions: async () => {
      const res = await listTags();
      return (res ?? []).map((t) => ({ value: t.slug, label: t.name }));
    },
  },
  {
    key: "author",
    label: "Author (email)",
    type: "text",
    placeholder: "e.g. ds680@snu.edu.in",
  },
];

type Tab = "queue" | "policies";

// ─── Condition-builder metadata ───────────────────────────────────────────────

type ConditionKey = CreatePolicyInputConditionsItem["key"];
type ConditionOperator = CreatePolicyInputConditionsItem["operator"];

type KeyMeta = {
  label: string;
  group: "Identity" | "Content (AI)";
  operators: ConditionOperator[];
  valueType: "text" | "select" | "chips" | "number" | "none";
  options?: string[];
  placeholder?: string;
};

const KEY_META: Record<ConditionKey, KeyMeta> = {
  author: {
    label: "Author (email)",
    group: "Identity",
    operators: ["equals", "not_equals"],
    valueType: "text",
    placeholder: "Email address",
  },
  author_role: {
    label: "Author role",
    group: "Identity",
    operators: ["equals", "not_equals", "any_of", "not_any_of"],
    valueType: "chips",
    options: ["member", "creator", "editor", "admin"],
  },
  source: {
    label: "Source (source ID)",
    group: "Identity",
    operators: ["equals", "not_equals"],
    valueType: "text",
    placeholder: "MongoDB ObjectId of source",
  },
  origin: {
    label: "Origin",
    group: "Identity",
    operators: ["equals", "not_equals"],
    valueType: "select",
    options: ["native", "aggregated"],
  },
  ai_category: {
    label: "AI category",
    group: "Content (AI)",
    operators: ["equals", "not_equals", "any_of", "not_any_of"],
    valueType: "chips",
    options: ["news", "opinion", "listicle", "tutorial", "announcement", "comparison"],
  },
  ai_tags: {
    label: "AI tags",
    group: "Content (AI)",
    operators: ["any_of", "not_any_of"],
    valueType: "chips",
    placeholder: "Type a tag and press Enter",
  },
  ai_quality_score: {
    label: "AI quality score (0–1)",
    group: "Content (AI)",
    operators: ["greater_than", "less_than"],
    valueType: "number",
    placeholder: "0.5",
  },
  ai_is_spam: {
    label: "Is spam",
    group: "Content (AI)",
    operators: ["equals"],
    valueType: "none",
  },
  clickbait: {
    label: "Clickbait detected",
    group: "Content (AI)",
    operators: ["equals"],
    valueType: "none",
  },
};

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: "=",
  not_equals: "≠",
  any_of: "∈ any of",
  not_any_of: "∉ not any of",
  greater_than: ">",
  less_than: "<",
};

// ─── ModerationPage ──────────────────────────────────────────────────────────

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

// ─── Queue tab ────────────────────────────────────────────────────────────────

function QueueTab() {
  const queryClient = useQueryClient();
  const { activeFilters, filterCount } = useServerFilter(QUEUE_FILTER_CONFIG);
  const { data, isLoading } = useGetModerationQueue({
    status: activeFilters.status?.[0] as "pending_review" | "rejected" | "all" | undefined,
    origin: activeFilters.origin?.[0] as "native" | "aggregated" | undefined,
    source: activeFilters.source?.[0],
    tag: activeFilters.tag?.[0],
    author: activeFilters.author?.[0],
  });
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkReason, setBulkReason] = useState("");
  const [drawerSlug, setDrawerSlug] = useState<string | null>(null);
  const [drawerPostId, setDrawerPostId] = useState<string | null>(null);

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

  const items = data?.items ?? [];
  const allIds = items.map((p) => p.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allIds));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function bulkApprove() {
    setBulkLoading(true);
    await Promise.allSettled([...selected].map((id) => approvePost(id)));
    setBulkLoading(false);
    setSelected(new Set());
    invalidate();
  }

  async function bulkReject() {
    setBulkLoading(true);
    await Promise.allSettled(
      [...selected].map((id) => rejectPost(id, { reason: bulkReason || "Bulk rejected" })),
    );
    setBulkLoading(false);
    setSelected(new Set());
    setBulkRejectOpen(false);
    setBulkReason("");
    invalidate();
  }

  function openDrawer(postId: string, slug: string) {
    setDrawerPostId(postId);
    setDrawerSlug(slug);
  }

  function closeDrawer() {
    setDrawerSlug(null);
    setDrawerPostId(null);
  }

  function drawerApprove() {
    if (!drawerPostId) return;
    approve.mutate({ id: drawerPostId }, { onSuccess: closeDrawer });
  }

  function drawerReject(r: string) {
    if (!drawerPostId) return;
    reject.mutate({ id: drawerPostId, data: { reason: r || "Rejected by moderator" } }, {
      onSuccess: closeDrawer,
    });
  }

  if (isLoading) return <p className="text-ink-faint">Loading…</p>;

  if (items.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex justify-end">
          <ServerFilterBar config={QUEUE_FILTER_CONFIG} />
        </div>
        {filterCount > 0 && <ActiveFilterPills config={QUEUE_FILTER_CONFIG} />}
        <div className="rounded-xl border border-dashed border-line p-12 text-center">
          <p className="font-display-serif text-2xl font-semibold">
            {filterCount > 0 ? "No posts match" : "Queue is clear"}
          </p>
          <p className="mt-2 text-sm text-ink-soft">
            {filterCount > 0
              ? "No posts match the current filters."
              : "No posts waiting for review."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-3">
      {/* Bulk action bar */}
      <div className="flex items-center gap-3 rounded-lg border border-line bg-paper px-4 py-2.5">
        <input
          type="checkbox"
          checked={allSelected}
          ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
          onChange={toggleAll}
          className="h-4 w-4 accent-crimson cursor-pointer"
          aria-label="Select all"
        />
        {someSelected ? (
          <>
            <span className="text-sm text-ink-soft">{selected.size} selected</span>
            <div className="ml-auto flex items-center gap-2">
              {bulkRejectOpen ? (
                <>
                  <input
                    type="text"
                    placeholder="Rejection reason (optional)"
                    value={bulkReason}
                    onChange={(e) => setBulkReason(e.target.value)}
                    className="w-56 rounded border border-line px-2.5 py-1 text-sm text-ink placeholder-ink-faint focus:border-crimson focus:outline-none"
                    autoFocus
                  />
                  <Button
                    variant="ghost"
                    className="!px-3 !py-1.5 text-xs !text-crimson"
                    loading={bulkLoading}
                    onClick={bulkReject}
                  >
                    Confirm reject {selected.size}
                  </Button>
                  <Button
                    variant="ghost"
                    className="!px-3 !py-1.5 text-xs"
                    onClick={() => setBulkRejectOpen(false)}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    className="!px-3 !py-1.5 text-xs"
                    loading={bulkLoading}
                    onClick={bulkApprove}
                  >
                    Approve {selected.size}
                  </Button>
                  <Button
                    variant="ghost"
                    className="!px-3 !py-1.5 text-xs !text-crimson"
                    onClick={() => setBulkRejectOpen(true)}
                  >
                    Reject {selected.size}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    className="text-xs text-ink-faint hover:text-ink"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>
          </>
        ) : (
          <>
            <span className="text-sm text-ink-faint">Select items for bulk actions</span>
            <div className="ml-auto">
              <ServerFilterBar config={QUEUE_FILTER_CONFIG} />
            </div>
          </>
        )}
      </div>

      {/* Active filter pills */}
      {filterCount > 0 && <ActiveFilterPills config={QUEUE_FILTER_CONFIG} />}

      {/* Items */}
      {items.map((post) => (
        <QueueItem
          key={post.id}
          post={post}
          selected={selected.has(post.id)}
          onToggleSelect={() => toggleOne(post.id)}
          onOpenDrawer={() => openDrawer(post.id, post.slug)}
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

    {drawerSlug && (
      <PostDrawer
        slug={drawerSlug}
        onClose={closeDrawer}
        syncUrl={false}
        headerActions={
          <ModerationDrawerActions
            onApprove={drawerApprove}
            onReject={drawerReject}
            approveLoading={approve.isPending}
            rejectLoading={reject.isPending}
          />
        }
      />
    )}
    </>
  );
}

interface QueueItemProps {
  post: PostCard;
  selected: boolean;
  onToggleSelect: () => void;
  onOpenDrawer: () => void;
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
  selected,
  onToggleSelect,
  onOpenDrawer,
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
    <div className={`rounded-xl border bg-paper transition-colors ${selected ? "border-crimson/40 bg-crimson/[0.02]" : "border-line"}`}>
      {/* Clickable card body */}
      <button
        type="button"
        onClick={onOpenDrawer}
        className="w-full p-5 text-left hover:bg-cream/50 rounded-xl transition-colors"
      >
        <div className="flex flex-wrap items-start gap-3">
          <div
            role="presentation"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelect}
              className="mt-1 h-4 w-4 accent-crimson cursor-pointer"
              aria-label={`Select ${post.title}`}
            />
          </div>
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
            <div
              role="presentation"
              className="flex items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
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
      </button>

      {isRejecting && (
        <div className="border-t border-line px-5 pb-5 pt-4 space-y-3">
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

// ─── Moderation drawer header actions ────────────────────────────────────────

function ModerationDrawerActions({
  onApprove,
  onReject,
  approveLoading,
  rejectLoading,
}: {
  onApprove: () => void;
  onReject: (reason: string) => void;
  approveLoading: boolean;
  rejectLoading: boolean;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  if (rejecting) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Reason (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          autoFocus
          className="w-44 rounded-lg border border-line px-2.5 py-1.5 text-xs text-ink placeholder-ink-faint focus:border-crimson focus:outline-none"
        />
        <button
          type="button"
          onClick={() => { onReject(reason); setRejecting(false); setReason(""); }}
          disabled={rejectLoading}
          className="rounded-lg bg-crimson px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {rejectLoading ? "…" : "Confirm reject"}
        </button>
        <button
          type="button"
          onClick={() => { setRejecting(false); setReason(""); }}
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:text-ink"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={onApprove}
        disabled={approveLoading}
        className="rounded-lg border border-line bg-paper px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-ink-soft hover:text-ink disabled:opacity-50"
      >
        {approveLoading ? "…" : "Approve ✓"}
      </button>
      <button
        type="button"
        onClick={() => setRejecting(true)}
        className="rounded-lg border border-crimson/30 bg-crimson/5 px-3 py-1.5 text-xs font-semibold text-crimson hover:bg-crimson/10"
      >
        Reject
      </button>
    </>
  );
}

// ─── Policies tab ─────────────────────────────────────────────────────────────

function PoliciesTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useListPolicies();
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: getListPoliciesQueryKey() });
  }

  const deletePolicyMutation = useDeletePolicy({ mutation: { onSuccess: invalidate } });
  const updatePolicyMutation = useUpdatePolicy({ mutation: { onSuccess: invalidate } });

  if (isLoading) return <p className="text-ink-faint">Loading…</p>;

  const policies = data?.policies ?? [];
  const allIds = policies.map((p) => p.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allIds));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function bulkDelete() {
    setBulkLoading(true);
    await Promise.allSettled([...selected].map((id) => deletePolicy(id)));
    setBulkLoading(false);
    setSelected(new Set());
    invalidate();
  }

  async function bulkSetActive(active: boolean) {
    setBulkLoading(true);
    await Promise.allSettled([...selected].map((id) => updatePolicy(id, { active })));
    setBulkLoading(false);
    setSelected(new Set());
    invalidate();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-soft">
          Policies bypass the review queue. Evaluated by priority (highest first); first match wins.
          Content conditions fire after AI processes the post.
        </p>
        <Button onClick={() => setCreateOpen(true)}>New policy</Button>
      </div>

      <div className="mt-4 space-y-3">
        {/* Bulk action bar */}
        {policies.length > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-line bg-paper px-4 py-2.5">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
              onChange={toggleAll}
              className="h-4 w-4 accent-crimson cursor-pointer"
              aria-label="Select all"
            />
            {someSelected ? (
              <>
                <span className="text-sm text-ink-soft">{selected.size} selected</span>
                <div className="ml-auto flex items-center gap-2">
                  <Button
                    variant="secondary"
                    className="!px-3 !py-1.5 text-xs"
                    loading={bulkLoading}
                    onClick={() => bulkSetActive(true)}
                  >
                    Enable {selected.size}
                  </Button>
                  <Button
                    variant="ghost"
                    className="!px-3 !py-1.5 text-xs"
                    loading={bulkLoading}
                    onClick={() => bulkSetActive(false)}
                  >
                    Disable {selected.size}
                  </Button>
                  <Button
                    variant="ghost"
                    className="!px-3 !py-1.5 text-xs !text-crimson"
                    loading={bulkLoading}
                    onClick={bulkDelete}
                  >
                    Delete {selected.size}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    className="text-xs text-ink-faint hover:text-ink"
                  >
                    Clear
                  </button>
                </div>
              </>
            ) : (
              <span className="text-sm text-ink-faint">Select policies for bulk actions</span>
            )}
          </div>
        )}

        {policies.map((policy) => (
          <PolicyRow
            key={policy.id}
            policy={policy}
            selected={selected.has(policy.id)}
            onToggleSelect={() => toggleOne(policy.id)}
            onDelete={() => deletePolicyMutation.mutate({ id: policy.id })}
            onToggleActive={() =>
              updatePolicyMutation.mutate({ id: policy.id, data: { active: !policy.active } })
            }
            deleteLoading={deletePolicyMutation.isPending}
          />
        ))}
        {policies.length === 0 && (
          <p className="text-sm text-ink-faint">No policies defined.</p>
        )}
      </div>

      {createOpen && (
        <PolicyFormDialog onClose={() => setCreateOpen(false)} onCreated={invalidate} />
      )}
    </div>
  );
}

// ─── PolicyRow ────────────────────────────────────────────────────────────────

function PolicyRow({
  policy,
  selected,
  onToggleSelect,
  onDelete,
  onToggleActive,
  deleteLoading,
}: {
  policy: ModerationPolicy;
  selected: boolean;
  onToggleSelect: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  deleteLoading: boolean;
}) {
  const actionColor =
    policy.action === "auto_approve"
      ? "text-gold bg-gold-tint"
      : "text-crimson bg-crimson-tint";
  const actionLabel = policy.action === "auto_approve" ? "Auto-approve" : "Auto-reject";

  return (
    <div className={`rounded-xl border bg-paper p-4 transition-colors ${selected ? "border-crimson/40 bg-crimson/[0.02]" : "border-line"} ${!policy.active ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="mt-0.5 h-4 w-4 flex-shrink-0 accent-crimson cursor-pointer"
          aria-label={`Select ${policy.name}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${actionColor}`}
            >
              {actionLabel}
            </span>
            <span className="font-semibold text-sm text-ink">{policy.name}</span>
            {policy.priority !== 0 && (
              <span className="rounded-full bg-cream px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                priority {policy.priority}
              </span>
            )}
            {!policy.active && (
              <span className="rounded-full bg-cream px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                inactive
              </span>
            )}
          </div>

          {policy.conditions.length === 0 ? (
            <p className="mt-1.5 text-xs text-ink-soft">Matches all posts (catch-all)</p>
          ) : (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {policy.conditions.map((c, i) => (
                <>
                  {i > 0 && (
                    <span key={`logic-${i}`} className="text-[10px] font-bold uppercase text-ink-faint">
                      {policy.logic}
                    </span>
                  )}
                  <ConditionChip key={i} condition={c} />
                </>
              ))}
            </div>
          )}

          {policy.reason && (
            <p className="mt-1 text-xs text-ink-faint">{policy.reason}</p>
          )}
          {policy.expiresAt && (
            <p className="mt-0.5 text-xs text-ink-faint">
              Expires {new Date(policy.expiresAt).toLocaleDateString()}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleActive}
            className="text-xs text-ink-soft hover:text-ink"
          >
            {policy.active ? "Disable" : "Enable"}
          </button>
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
    </div>
  );
}

function ConditionChip({ condition }: { condition: CreatePolicyInputConditionsItem }) {
  const keyLabel = KEY_META[condition.key]?.label ?? condition.key;
  const opLabel = OPERATOR_LABELS[condition.operator] ?? condition.operator;
  const valLabel =
    condition.values.length === 0
      ? "true"
      : condition.values.map(String).join(", ");

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-cream px-2 py-0.5 text-[11px] text-ink-soft">
      <span className="font-medium text-ink">{keyLabel}</span>
      <span>{opLabel}</span>
      <span className="font-medium text-ink">{valLabel}</span>
    </span>
  );
}

// ─── PolicyFormDialog ─────────────────────────────────────────────────────────

type DraftCondition = {
  key: ConditionKey;
  operator: ConditionOperator;
  values: string[];
  chipInput: string; // chip input buffer
};

function defaultCondition(): DraftCondition {
  return { key: "author_role", operator: "equals", values: [], chipInput: "" };
}

function PolicyFormDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [logic, setLogic] = useState<"and" | "or">("and");
  const [action, setAction] = useState<"auto_approve" | "auto_reject">("auto_approve");
  const [priority, setPriority] = useState("0");
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [conditions, setConditions] = useState<DraftCondition[]>([]);

  const createPolicy = useCreatePolicy({
    mutation: {
      onSuccess: () => {
        onCreated();
        onClose();
      },
    },
  });

  function addCondition() {
    setConditions((prev) => [...prev, defaultCondition()]);
  }

  function removeCondition(idx: number) {
    setConditions((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateCondition(idx: number, patch: Partial<DraftCondition>) {
    setConditions((prev) =>
      prev.map((c, i) => {
        if (i !== idx) return c;
        const next = { ...c, ...patch };
        // Reset values when key changes
        if (patch.key && patch.key !== c.key) {
          const meta = KEY_META[patch.key];
          next.operator = meta.operators[0];
          next.values = [];
          next.chipInput = "";
        }
        // Reset values when operator changes
        if (patch.operator && patch.operator !== c.operator) {
          next.values = [];
          next.chipInput = "";
        }
        return next;
      }),
    );
  }

  function handleChipKeyDown(idx: number, e: KeyboardEvent<HTMLInputElement>) {
    const c = conditions[idx];
    if ((e.key === "Enter" || e.key === ",") && c.chipInput.trim()) {
      e.preventDefault();
      const tag = c.chipInput.trim().toLowerCase().replace(/\s+/g, "-");
      if (!c.values.includes(tag)) {
        updateCondition(idx, { values: [...c.values, tag], chipInput: "" });
      } else {
        updateCondition(idx, { chipInput: "" });
      }
    } else if (e.key === "Backspace" && !c.chipInput && c.values.length > 0) {
      updateCondition(idx, { values: c.values.slice(0, -1) });
    }
  }

  function toggleChipValue(idx: number, val: string) {
    const c = conditions[idx];
    const next = c.values.includes(val)
      ? c.values.filter((v) => v !== val)
      : [...c.values, val];
    updateCondition(idx, { values: next });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const builtConditions: CreatePolicyInputConditionsItem[] = conditions.map((c) => {
      const meta = KEY_META[c.key];
      let values: (string | number | boolean)[] = c.values;
      if (meta.valueType === "none") {
        values = [true];
      } else if (meta.valueType === "number") {
        values = c.values.map(Number);
      }
      return { key: c.key, operator: c.operator, values };
    });

    createPolicy.mutate({
      data: {
        name,
        logic: CreatePolicyInputLogic[logic],
        action: CreatePolicyInputAction[action],
        priority: parseInt(priority, 10) || 0,
        conditions: builtConditions,
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
        className="w-full max-w-xl rounded-xl border border-line bg-paper p-6 shadow-card-hover overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="kicker mb-1">New policy</p>
        <h2 className="font-display-serif text-2xl font-semibold">Create bypass rule</h2>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Name + Priority row */}
          <div className="flex gap-3">
            <div className="flex-1">
              <Field
                label="Policy name"
                placeholder="e.g. Trusted creator — fashion content"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={100}
              />
            </div>
            <div className="w-24">
              <Field
                label="Priority"
                type="number"
                placeholder="0"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              />
            </div>
          </div>

          {/* Action */}
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

          {/* Conditions */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-ink">
                Conditions
                <span className="ml-1 text-xs font-normal text-ink-soft">
                  (empty = catch-all)
                </span>
              </label>
              {conditions.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-ink-soft">Match:</span>
                  {(["and", "or"] as const).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLogic(l)}
                      className={`rounded px-2 py-0.5 text-xs font-semibold uppercase transition-colors ${
                        logic === l
                          ? "bg-crimson text-white"
                          : "bg-cream text-ink-soft hover:text-ink"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              {conditions.map((c, idx) => (
                <ConditionRow
                  key={idx}
                  condition={c}
                  onChange={(patch) => updateCondition(idx, patch)}
                  onRemove={() => removeCondition(idx)}
                  onChipKeyDown={(e) => handleChipKeyDown(idx, e)}
                  onToggleChip={(val) => toggleChipValue(idx, val)}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={addCondition}
              className="mt-2 text-sm font-semibold text-crimson hover:underline"
            >
              + Add condition
            </button>
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

// ─── ConditionRow ─────────────────────────────────────────────────────────────

function ConditionRow({
  condition,
  onChange,
  onRemove,
  onChipKeyDown,
  onToggleChip,
}: {
  condition: DraftCondition;
  onChange: (patch: Partial<DraftCondition>) => void;
  onRemove: () => void;
  onChipKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onToggleChip: (val: string) => void;
}) {
  const meta = KEY_META[condition.key];
  const identityKeys = Object.entries(KEY_META)
    .filter(([, m]) => m.group === "Identity")
    .map(([k]) => k as ConditionKey);
  const contentKeys = Object.entries(KEY_META)
    .filter(([, m]) => m.group === "Content (AI)")
    .map(([k]) => k as ConditionKey);

  return (
    <div className="rounded-lg border border-line bg-white p-3 space-y-2">
      <div className="flex items-start gap-2">
        {/* Key selector */}
        <select
          value={condition.key}
          onChange={(e) => onChange({ key: e.target.value as ConditionKey })}
          className="min-w-0 flex-1 rounded border border-line bg-white px-2.5 py-1.5 text-sm text-ink focus:border-crimson focus:outline-none"
        >
          <optgroup label="Identity">
            {identityKeys.map((k) => (
              <option key={k} value={k}>
                {KEY_META[k].label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Content (AI)">
            {contentKeys.map((k) => (
              <option key={k} value={k}>
                {KEY_META[k].label}
              </option>
            ))}
          </optgroup>
        </select>

        {/* Operator selector */}
        <select
          value={condition.operator}
          onChange={(e) => onChange({ operator: e.target.value as ConditionOperator })}
          className="w-36 rounded border border-line bg-white px-2.5 py-1.5 text-sm text-ink focus:border-crimson focus:outline-none"
        >
          {meta.operators.map((op) => (
            <option key={op} value={op}>
              {OPERATOR_LABELS[op]}
            </option>
          ))}
        </select>

        {/* Remove */}
        <button
          type="button"
          onClick={onRemove}
          className="mt-1 text-ink-faint hover:text-crimson text-lg leading-none"
          aria-label="Remove condition"
        >
          ×
        </button>
      </div>

      {/* Value input — polymorphic by valueType */}
      {meta.valueType === "text" && (
        <input
          type="text"
          placeholder={meta.placeholder}
          value={condition.values[0] ?? ""}
          onChange={(e) => onChange({ values: e.target.value ? [e.target.value] : [] })}
          className="w-full rounded border border-line bg-white px-2.5 py-1.5 text-sm text-ink placeholder-ink-faint focus:border-crimson focus:outline-none"
        />
      )}

      {meta.valueType === "select" && meta.options && (
        <select
          value={condition.values[0] ?? ""}
          onChange={(e) => onChange({ values: e.target.value ? [e.target.value] : [] })}
          className="w-full rounded border border-line bg-white px-2.5 py-1.5 text-sm text-ink focus:border-crimson focus:outline-none"
        >
          <option value="">Select…</option>
          {meta.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )}

      {meta.valueType === "chips" && (
        <div>
          {/* Fixed option chips (if options defined) */}
          {meta.options && (
            <div className="mb-1.5 flex flex-wrap gap-1.5">
              {meta.options.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => onToggleChip(o)}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                    condition.values.includes(o)
                      ? "bg-crimson text-white"
                      : "bg-cream text-ink-soft hover:text-ink"
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          )}
          {/* Free-text chip input (for ai_tags and any key without options) */}
          {!meta.options && (
            <div className="flex flex-wrap gap-1.5 rounded border border-line bg-white p-1.5 focus-within:border-crimson">
              {condition.values.map((v) => (
                <span
                  key={v}
                  className="flex items-center gap-1 rounded-full bg-cream px-2 py-0.5 text-xs text-ink"
                >
                  {v}
                  <button
                    type="button"
                    onClick={() => onChange({ values: condition.values.filter((x) => x !== v) })}
                    className="text-ink-faint hover:text-crimson leading-none"
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                type="text"
                placeholder={meta.placeholder ?? "Type and press Enter"}
                value={condition.chipInput}
                onChange={(e) => onChange({ chipInput: e.target.value })}
                onKeyDown={onChipKeyDown}
                className="min-w-[120px] flex-1 bg-transparent px-1 py-0.5 text-sm text-ink placeholder-ink-faint focus:outline-none"
              />
            </div>
          )}
          {/* Show selected values as removable tags when using fixed options but also allow custom */}
          {meta.options && condition.values.filter((v) => !meta.options!.includes(v)).length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {condition.values
                .filter((v) => !meta.options!.includes(v))
                .map((v) => (
                  <span
                    key={v}
                    className="flex items-center gap-1 rounded-full bg-crimson/10 px-2 py-0.5 text-xs text-crimson"
                  >
                    {v}
                    <button
                      type="button"
                      onClick={() => onChange({ values: condition.values.filter((x) => x !== v) })}
                      className="leading-none"
                    >
                      ×
                    </button>
                  </span>
                ))}
            </div>
          )}
        </div>
      )}

      {meta.valueType === "number" && (
        <input
          type="number"
          min={0}
          max={1}
          step={0.05}
          placeholder={meta.placeholder ?? "0.5"}
          value={condition.values[0] ?? ""}
          onChange={(e) => onChange({ values: e.target.value ? [e.target.value] : [] })}
          className="w-full rounded border border-line bg-white px-2.5 py-1.5 text-sm text-ink placeholder-ink-faint focus:border-crimson focus:outline-none"
        />
      )}

      {meta.valueType === "none" && (
        <p className="text-xs text-ink-faint">No value needed — this condition checks if the flag is true.</p>
      )}
    </div>
  );
}
