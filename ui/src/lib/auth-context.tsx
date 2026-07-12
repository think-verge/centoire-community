import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, type ReactNode } from "react";
import { getGetAuthMeQueryKey, useGetAuthMe } from "./api/generated/auth/auth";
import type { CurrentUser } from "./api/generated/model";

interface AuthContextValue {
  user: CurrentUser | null;
  isLoading: boolean;
  refresh: () => Promise<unknown>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  refresh: async () => undefined,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetAuthMe({
    query: {
      retry: false,
      staleTime: 60_000,
    },
  });

  const value: AuthContextValue = {
    user: data ?? null,
    isLoading,
    refresh: () => queryClient.invalidateQueries({ queryKey: getGetAuthMeQueryKey() }),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
