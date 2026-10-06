import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, type ReactNode } from "react";
import type { AxiosInstance } from "axios";

export interface SessionUser {
  id: string;
  email: string;
  handle: string | null;
  displayName: string;
  avatarUrl: string | null;
  role: "member" | "creator" | "editor" | "admin";
  emailVerified: boolean;
}

interface SessionValue {
  user: SessionUser | null;
  isLoading: boolean;
  refresh: () => Promise<unknown>;
}

const SessionContext = createContext<SessionValue>({
  user: null,
  isLoading: true,
  refresh: async () => undefined,
});

const ME_KEY = ["session", "me"];

/** Mini apps get the signed-in user from core's `/auth/me` using the shared session cookie. */
export function SessionProvider({ http, children }: { http: AxiosInstance; children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ME_KEY,
    queryFn: async () => (await http.get<SessionUser>("/auth/me")).data,
    retry: false,
    staleTime: 60_000,
    // Picks up a logout done in another Centoire tab/app when the user comes back to this one.
    refetchOnWindowFocus: true,
  });
  const value: SessionValue = {
    user: data ?? null,
    isLoading,
    refresh: () => queryClient.invalidateQueries({ queryKey: ME_KEY }),
  };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  return useContext(SessionContext);
}
