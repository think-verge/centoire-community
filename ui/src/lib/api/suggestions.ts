import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customInstance } from "./http";
import { useAuth } from "../auth-context";

export interface SuggestedCircle {
  id: string;
  name: string;
  slug: string;
  description: string;
  avatarUrl?: string;
  coverImageUrl?: string;
  memberCount: number;
  postCount?: number;
  isPrivate?: boolean;
  score?: number;
  reason: string;
}

export interface SuggestedCreator {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  followerCount: number;
  postCount?: number;
  isEmerging?: boolean;
  score?: number;
  reason: string;
}

export interface SuggestionsResponse<T> {
  items: T[];
  count: number;
}

export async function getSuggestedCircles(limit: number = 10): Promise<SuggestedCircle[]> {
  const res = await customInstance<SuggestionsResponse<SuggestedCircle>>({
    url: `/suggestions/circles?limit=${limit}`,
    method: "GET",
  });
  return res.items || [];
}

export async function getSuggestedCreators(limit: number = 10): Promise<SuggestedCreator[]> {
  const res = await customInstance<SuggestionsResponse<SuggestedCreator>>({
    url: `/suggestions/creators?limit=${limit}`,
    method: "GET",
  });
  return res.items || [];
}

export async function dismissSuggestion(
  targetType: "circle" | "creator",
  targetId: string,
): Promise<{ status: string; dismissedUntil: string }> {
  return customInstance({
    url: "/suggestions/dismiss",
    method: "POST",
    data: { targetType, targetId },
  });
}

export const SUGGESTED_CIRCLES_QUERY_KEY = ["suggestions", "circles"] as const;
export const SUGGESTED_CREATORS_QUERY_KEY = ["suggestions", "creators"] as const;

export function useSuggestedCircles(limit: number = 10) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...SUGGESTED_CIRCLES_QUERY_KEY, limit],
    queryFn: () => getSuggestedCircles(limit),
    enabled: Boolean(user),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSuggestedCreators(limit: number = 10) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...SUGGESTED_CREATORS_QUERY_KEY, limit],
    queryFn: () => getSuggestedCreators(limit),
    enabled: Boolean(user),
    staleTime: 5 * 60 * 1000,
  });
}

export function useDismissSuggestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      targetType,
      targetId,
    }: {
      targetType: "circle" | "creator";
      targetId: string;
    }) => dismissSuggestion(targetType, targetId),
    onSuccess: (_, variables) => {
      if (variables.targetType === "circle") {
        queryClient.setQueriesData(
          { queryKey: SUGGESTED_CIRCLES_QUERY_KEY },
          (old: SuggestedCircle[] | undefined) =>
            old ? old.filter((c) => c.id !== variables.targetId) : [],
        );
      } else {
        queryClient.setQueriesData(
          { queryKey: SUGGESTED_CREATORS_QUERY_KEY },
          (old: SuggestedCreator[] | undefined) =>
            old ? old.filter((u) => u.id !== variables.targetId) : [],
        );
      }
    },
  });
}
