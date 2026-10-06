import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { BellIcon } from "@centoire/ui";
import { http } from "../lib/api/http";
import { CORE_URL } from "../lib/env";
import { errorMessage, timeAgo } from "../lib/format";
import { Avatar } from "./Avatar";

interface NotificationActor {
  displayName: string;
  avatarUrl: string | null;
  handle?: string | null;
}
interface NotificationItem {
  id: string;
  type: string;
  message: string | null;
  link: string | null;
  app: "core" | "jobs";
  actor: NotificationActor | null;
  targetPost: { slug?: string; title?: string } | null;
  readAt: string | null;
  createdAt: string;
}
interface NotificationPage {
  items: NotificationItem[];
  nextCursor: string | null;
}

const COUNT_KEY = ["notifications", "unread-count"] as const;
const LIST_KEY = ["notifications", "list"] as const;

function describe(n: NotificationItem): string {
  if (n.message) return n.message;
  const who = n.actor?.displayName ?? "Someone";
  const verb = n.type.replace(/_/g, " ");
  return `${who}: ${verb}`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const count = useQuery({
    queryKey: COUNT_KEY,
    queryFn: async () => (await http.get<{ count: number }>("/notifications/unread-count")).data.count,
    refetchInterval: 30_000,
    retry: false,
  });
  const list = useQuery({
    queryKey: LIST_KEY,
    queryFn: async () => (await http.get<NotificationPage>("/notifications")).data,
    enabled: open,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: COUNT_KEY });
    void queryClient.invalidateQueries({ queryKey: LIST_KEY });
  };
  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await http.patch(`/notifications/${id}/read`);
    },
    onSettled: refresh,
  });
  const markAll = useMutation({
    mutationFn: async () => {
      await http.patch("/notifications/read-all");
    },
    onSettled: refresh,
  });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openItem = (n: NotificationItem) => {
    if (!n.readAt) markRead.mutate(n.id);
    setOpen(false);
    let target = n.link;
    if (!target && n.app === "core" && n.targetPost?.slug) target = `${CORE_URL}/p/${n.targetPost.slug}`;
    if (!target) return;
    try {
      const url = new URL(target, window.location.href);
      if (url.origin === window.location.origin) navigate(`${url.pathname}${url.search}${url.hash}`);
      else window.open(url.toString(), "_blank", "noopener");
    } catch {
      /* ignore malformed links */
    }
  };

  const unread = count.data ?? 0;
  const items = list.data?.items ?? [];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-haspopup="true"
        aria-expanded={open}
        className="relative rounded-full p-2 text-[var(--color-stone)] hover:bg-[var(--color-sand)] hover:text-[var(--color-charcoal)]"
      >
        <BellIcon className="size-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-[var(--color-coral)] px-1 font-ui text-[10px] font-bold leading-4 text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-x-3 top-16 z-40 rounded-2xl border border-[#EAEAEA] bg-white shadow-[0_8px_32px_rgba(0,0,0,0.14)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96">
          <div className="flex items-center justify-between border-b border-[var(--color-hairline)] px-4 py-3">
            <h2 className="font-ui text-[12px] font-bold uppercase tracking-wider text-[var(--color-charcoal)]">Notifications</h2>
            <button
              type="button"
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending || unread === 0}
              className="font-ui text-[12px] font-semibold text-[var(--color-coral)] disabled:opacity-40"
            >
              Mark all read
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {list.isLoading && <p className="px-4 py-8 text-center font-ui text-[13px] text-[var(--color-stone)]">Loading…</p>}
            {list.isError && <p role="alert" className="px-4 py-8 text-center font-ui text-[13px] text-red-600">{errorMessage(list.error)}</p>}
            {list.isSuccess && items.length === 0 && (
              <p className="px-4 py-10 text-center font-ui text-[13px] text-[var(--color-stone)]">You are all caught up.</p>
            )}
            <ul>
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openItem(n)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-[var(--color-sand)] ${n.readAt ? "" : "bg-[var(--color-sand-warm)]"}`}
                  >
                    <Avatar name={n.actor?.displayName ?? "Centoire"} url={n.actor?.avatarUrl} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-ui text-[13px] text-[var(--color-charcoal)]">{describe(n)}</span>
                      <span className="mt-0.5 block font-ui text-[11px] text-[var(--color-taupe)]">{timeAgo(n.createdAt)}</span>
                    </span>
                    {!n.readAt && <span aria-label="Unread" className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--color-coral)]" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
