import { EventEmitter } from "node:events";
import type { JobsEvent, JobsEventPayloads } from "@centoire/contracts";

// In-process today; swapping this for a real broker (Redis pub/sub, RabbitMQ,
// NATS) when notification-service becomes its own process is the only change
// needed — emitters/subscribers keep the same emit/on calls and payload shapes.
export const eventBus = new EventEmitter();

type CoreEvent =
  | "user.followed"
  | "post.upvoted"
  | "comment.upvoted"
  | "comment.created"
  | "comment.replied"
  | "comment.mentioned"
  | "post.approved"
  | "post.rejected";

export type DomainEvent = CoreEvent | JobsEvent;

interface CoreEventPayloads {
  "user.followed": { followerId: string; followeeId: string };
  "post.upvoted": { actorId: string; recipientId: string; postId: string };
  "comment.upvoted": { actorId: string; recipientId: string; commentId: string; postId: string };
  "comment.created": { actorId: string; recipientId: string; postId: string; commentId: string };
  "comment.replied": { actorId: string; recipientId: string; postId: string; commentId: string };
  "comment.mentioned": { actorId: string; recipientId: string; postId: string; commentId: string };
  "post.approved": { postId: string; recipientId: string };
  "post.rejected": { postId: string; recipientId: string };
}

export type DomainEventPayloads = CoreEventPayloads & JobsEventPayloads;

export function emitDomainEvent<T extends DomainEvent>(event: T, payload: DomainEventPayloads[T]): void {
  eventBus.emit(event, payload);
}

export function onDomainEvent<T extends DomainEvent>(
  event: T,
  handler: (payload: DomainEventPayloads[T]) => void,
): void {
  eventBus.on(event, handler);
}
