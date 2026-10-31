/**
 * "Read post" link for an external article. Goes through the backend click-tracking
 * redirect (GET /api/v1/r/:id) so clicks are counted; never link straight to externalUrl.
 */
export function readPostUrl(postId: string): string {
  return `${import.meta.env.VITE_API_BASE_URL ?? ""}/api/v1/r/${postId}`;
}
