import type { INotification } from "./model.js";

// Same wire shape the monolith served, so the orval client is unaffected.
export function serialize(n: INotification) {
  return {
    id: n._id.toString(),
    type: n.type,
    actor: n.actor
      ? {
          id: n.actor.id,
          handle: n.actor.handle ?? null,
          displayName: n.actor.displayName ?? "",
          avatarUrl: n.actor.avatarUrl ?? null,
        }
      : null,
    targetPost: n.targetPost
      ? { id: n.targetPost.id, slug: n.targetPost.slug ?? "", title: n.targetPost.title ?? "" }
      : null,
    targetCircle: n.targetCircle
      ? {
          id: n.targetCircle.id,
          slug: n.targetCircle.slug ?? "",
          name: n.targetCircle.name ?? "",
          avatarUrl: n.targetCircle.avatarUrl ?? null,
        }
      : null,
    targetInviteToken: n.targetInviteToken ?? null,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  };
}
