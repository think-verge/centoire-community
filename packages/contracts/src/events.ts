// Single source of truth for every domain event on the bus (NATS subject: events.<name>).
// Notification-bound events carry a denormalized snapshot so the notifications
// service never reads another service's collections.

export interface UserSnapshot {
  id: string;
  displayName: string;
  handle?: string;
  avatarUrl?: string;
}

export interface PostSnapshot {
  id: string;
  slug?: string;
  title?: string;
}

export interface CommentSnapshot {
  id: string;
  excerpt?: string;
}

export interface CircleSnapshot {
  id: string;
  slug?: string;
  name?: string;
  avatarUrl?: string;
}

interface NotificationEventBase {
  actorId: string;
  recipientId: string;
  actor?: UserSnapshot;
}

export interface DomainEventPayloads {
  "user.deleted": { userId: string };
  "user.followed": { followerId: string; followeeId: string; actor?: UserSnapshot };
  "post.upvoted": NotificationEventBase & { postId: string; post?: PostSnapshot };
  "comment.upvoted": NotificationEventBase & {
    commentId: string;
    postId: string;
    post?: PostSnapshot;
    comment?: CommentSnapshot;
  };
  "comment.created": NotificationEventBase & {
    postId: string;
    commentId: string;
    post?: PostSnapshot;
    comment?: CommentSnapshot;
  };
  "comment.replied": NotificationEventBase & {
    postId: string;
    commentId: string;
    post?: PostSnapshot;
    comment?: CommentSnapshot;
  };
  "comment.mentioned": NotificationEventBase & {
    postId: string;
    commentId: string;
    post?: PostSnapshot;
    comment?: CommentSnapshot;
  };
  "post.approved": { postId: string; recipientId: string; post?: PostSnapshot };
  "post.rejected": { postId: string; recipientId: string; post?: PostSnapshot };
  "circle.invite": NotificationEventBase & {
    circleId: string;
    inviteToken: string;
    circle?: CircleSnapshot;
  };
}

export type DomainEvent = keyof DomainEventPayloads;

export const EVENT_STREAM = "CENTOIRE_EVENTS";
export const EVENT_SUBJECT_PREFIX = "events.";
export const GATEWAY_SERVICES_SUBJECT = "gateway.services";
