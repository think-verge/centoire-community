import { useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { buildTrail } from "../../lib/breadcrumbs";
import { SetterContext, TrailContext, type BreadcrumbsApi, type Registered } from "./context";

export function BreadcrumbsProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [registered, setRegistered] = useState<Registered | null>(null);

  const api = useMemo<BreadcrumbsApi>(() => ({ set: setRegistered }), []);
  const trail = useMemo(
    () => buildTrail(pathname, registered?.path === pathname ? registered : null),
    [pathname, registered],
  );

  return (
    <SetterContext.Provider value={api}>
      <TrailContext.Provider value={trail}>{children}</TrailContext.Provider>
    </SetterContext.Provider>
  );
}
