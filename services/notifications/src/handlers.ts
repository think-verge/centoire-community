import type { Bus } from "@centoire/bahamut";
import type { DomainEventPayloads } from "@centoire/contracts";
import { deleteForUser, notify } from "./service.js";

type EventBus = Bus<DomainEventPayloads>;

// Durable consumers: events published while this service is down are replayed on restart.
// A handler that throws is nak'ed and redelivered, so notify() failures are never silently lost.
export async function subscribeToEvents(bus: EventBus): Promise<void> {
  await bus.on("user.followed", ({ followerId, followeeId, actor }) =>
    notify({ recipientId: followeeId, actorId: followerId, actor, type: "user.followed" }),
  );
  await bus.on("post.upvoted", ({ actorId, recipientId, postId, actor, post }) =>
    notify({ recipientId, actorId, actor, type: "post.upvoted", targetPostId: postId, targetPost: post }),
  );
  await bus.on("comment.upvoted", ({ actorId, recipientId, commentId, postId, actor, post }) =>
    notify({
      recipientId,
      actorId,
      actor,
      type: "comment.upvoted",
      targetCommentId: commentId,
      targetPostId: postId,
      targetPost: post,
    }),
  );
  for (const type of ["comment.created", "comment.replied", "comment.mentioned"] as const) {
    await bus.on(type, ({ actorId, recipientId, postId, commentId, actor, post }) =>
      notify({ recipientId, actorId, actor, type, targetPostId: postId, targetCommentId: commentId, targetPost: post }),
    );
  }
  for (const type of ["post.approved", "post.rejected"] as const) {
    await bus.on(type, ({ postId, recipientId, post }) =>
      notify({ recipientId, type, targetPostId: postId, targetPost: post }),
    );
  }
  await bus.on("circle.invite", ({ actorId, recipientId, circleId, inviteToken, actor, circle }) =>
    notify({
      recipientId,
      actorId,
      actor,
      type: "circle.invite",
      targetCircleId: circleId,
      targetCircle: circle,
      targetInviteToken: inviteToken,
    }),
  );
  await bus.on("user.deleted", ({ userId }) => deleteForUser(userId));
}
