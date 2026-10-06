import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@centoire/web-platform";
import { http } from "../lib/api/http";
import { CORE_URL } from "../lib/env";
import { SIGNUP_URL, goToLogin } from "../lib/auth";
import { Avatar } from "./Avatar";
import { Btn } from "./Btn";

const itemCls = "block w-full px-4 py-2.5 text-left font-ui text-[13px] text-[var(--color-charcoal)] hover:bg-[var(--color-sand)]";

export function UserMenu() {
  const { user, isLoading } = useSession();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
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

  if (isLoading) return <div className="size-8 animate-pulse rounded-full bg-[#EDE9E4]" aria-hidden />;
  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <a href={SIGNUP_URL} className="hidden px-2 font-ui text-[12px] font-bold uppercase tracking-wider text-[var(--color-stone)] hover:text-[var(--color-charcoal)] sm:block">
          Sign up
        </a>
        <Btn size="sm" onClick={goToLogin}>
          Sign in
        </Btn>
      </div>
    );
  }

  const logout = async () => {
    setBusy(true);
    try {
      await http.post("/auth/logout");
    } finally {
      queryClient.clear();
      window.location.assign(CORE_URL);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full p-1 pr-2 hover:bg-[var(--color-sand)]"
      >
        <Avatar name={user.displayName} url={user.avatarUrl} size={30} />
        <span className="hidden max-w-32 truncate font-ui text-[13px] font-semibold text-[var(--color-charcoal)] sm:block">{user.displayName}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white py-1 shadow-[0_8px_32px_rgba(0,0,0,0.14)]">
          {user.handle && (
            <a role="menuitem" href={`${CORE_URL}/u/${user.handle}`} target="_blank" rel="noopener" className={itemCls}>
              Profile on Centoire
            </a>
          )}
          <a role="menuitem" href={CORE_URL} className={itemCls}>
            Open Centoire
          </a>
          <button role="menuitem" type="button" onClick={logout} disabled={busy} className={`${itemCls} border-t border-[var(--color-hairline)] disabled:opacity-50`}>
            {busy ? "Logging out…" : "Log out"}
          </button>
        </div>
      )}
    </div>
  );
}
