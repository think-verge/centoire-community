import type { QueryClient } from "@tanstack/react-query";

/** Generated query keys start with the request path (every Jobs API route lives under "/jobs"); invalidate every key touching a prefix. */
export function invalidatePrefixes(queryClient: QueryClient, ...prefixes: string[]): Promise<void> {
  return queryClient.invalidateQueries({
    predicate: (q) => q.queryKey.some((k) => typeof k === "string" && prefixes.some((p) => k.startsWith(p))),
  });
}
