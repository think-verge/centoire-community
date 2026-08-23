import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { BellIcon } from "./nav/icons";
import { AvatarBubble } from "./AppShell";
import {
  getGetUnreadNotificationCountQueryKey,
  getListNotificationsInfiniteQueryKey,
  useGetUnreadNotificationCount,
  useListNotificationsInfinite,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
} from "../lib/api/generated/notifications/notifications";
import type { Notification } from "../lib/api/generated/model";

const POLL_INTERVAL_MS = 30_000;

const TYPE_LABEL: Record<Notification["type"], string> = {
  "user.followed": "followed you",
  "post.upvoted": "upvoted your post",
  "comment.upvoted": "upvoted your comment",
  "comment.created": "commented on your post",
  "comment.replied": "replied to your comment",
  "comment.mentioned": "mentioned you in a comment",
  "post.approved": "Your post was approved",
  "post.rejected": "Your post was rejected",
};

interface NotificationBellProps {
  active: boolean;
  onToggle: () => void;
  onClose: () => void;
}

export function NotificationBell({ active, onToggle, onClose }: NotificationBellProps) {
  const queryClient = useQueryClient();

  // First use of refetchInterval in this codebase — a cheap poll for the badge count is
  // the standard, scales-fine substitute for push here; see plan notes on why not WebSockets.
  const { data: unread } = useGetUnreadNotificationCount({
    query: { refetchInterval: POLL_INTERVAL_MS },
  });

  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useListNotificationsInfinite(
    undefined,
    {
      query: {
        enabled: active,
        initialPageParam: undefined,
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      },
    },
  );
  const notifications = data?.pages.flatMap((page) => page.items) ?? [];

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: getGetUnreadNotificationCountQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getListNotificationsInfiniteQueryKey() });
  }

  const markRead = useMarkNotificationRead({ mutation: { onSuccess: invalidate } });
  const markAllRead = useMarkAllNotificationsRead({ mutation: { onSuccess: invalidate } });

  const unreadCount = unread?.count ?? 0;

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Notifications"
        onClick={onToggle}
        className="relative block rounded-full p-2 text-ink-soft hover:bg-paper hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson"
      >
        <BellIcon className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-crimson px-1 text-[10px] font-bold text-ink-inverse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {active && (
        <div
          className="absolute right-0 mt-2 w-96 max-w-[90vw] rounded-xl border border-line bg-paper shadow-card-hover"
          onMouseLeave={onClose}
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="font-semibold text-ink">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="text-xs font-medium text-crimson hover:underline disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {isLoading && <p className="p-6 text-center text-sm text-ink-faint">Loading…</p>}
            {!isLoading && notifications.length === 0 && (
              <p className="p-6 text-center text-sm text-ink-faint">You're all caught up.</p>
            )}
            {notifications.map((n) => (
              <NotificationRow key={n.id} notification={n} onOpen={onClose} onMarkRead={() => markRead.mutate({ id: n.id })} />
            ))}
            {hasNextPage && (
              <button
                type="button"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="w-full py-3 text-center text-xs font-medium text-ink-soft hover:text-ink disabled:opacity-50"
              >
                {isFetchingNextPage ? "Loading…" : "Load more"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationRow({
  notification,
  onOpen,
  onMarkRead,
}: {
  notification: Notification;
  onOpen: () => void;
  onMarkRead: () => void;
}) {
  const unread = !notification.readAt;
  const label = TYPE_LABEL[notification.type];
  const linkTo = notification.targetPost ? `/p/${notification.targetPost.slug}` : "#";

  function handleClick() {
    if (unread) onMarkRead();
    onOpen();
  }

  return (
    <Link
      to={linkTo}
      onClick={handleClick}
      className={`flex items-start gap-3 border-b border-line px-4 py-3 text-sm last:border-b-0 hover:bg-cream ${
        unread ? "bg-crimson-tint/40" : ""
      }`}
    >
      {notification.actor ? (
        <AvatarBubble
          name={notification.actor.displayName}
          url={notification.actor.avatarUrl}
          size="size-8"
        />
      ) : (
        <span className="flex size-8 items-center justify-center rounded-full bg-gold-tint text-gold">✓</span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-ink">
          {notification.actor && <span className="font-semibold">{notification.actor.displayName} </span>}
          {label}
          {notification.targetPost && (
            <span className="text-ink-soft"> — “{notification.targetPost.title}”</span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-ink-faint">
          {new Date(notification.createdAt).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      </div>
      {unread && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-crimson" aria-hidden />}
    </Link>
  );
}
