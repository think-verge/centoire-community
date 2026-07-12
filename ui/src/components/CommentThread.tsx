import { useState } from "react";
import { Link } from "react-router-dom";
import {
  getListCommentsQueryKey,
  useCreateComment,
  useDeleteComment,
  useListComments,
  useUnvoteComment,
  useVoteComment,
} from "../lib/api/generated/engagement/engagement";
import type { Comment } from "../lib/api/generated/model";
import { useAuth } from "../lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { AvatarBubble } from "./AppShell";
import { Button } from "./Button";
import { StitchIcon } from "./PostCard";

export function CommentThread({ postId }: { postId: string }) {
  const { user } = useAuth();
  const { data: comments, isLoading } = useListComments(postId);
  const queryClient = useQueryClient();

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey(postId) });
  }

  return (
    <section aria-label="Comments">
      <h2 className="font-display-serif text-xl font-semibold">
        Discussion{comments?.length ? ` (${countAll(comments)})` : ""}
      </h2>
      {user?.emailVerified ? (
        <Composer postId={postId} onPosted={refresh} />
      ) : (
        <p className="mt-4 rounded-lg border border-line bg-paper p-4 text-sm text-ink-soft">
          {user ? (
            <>
              <Link to="/verify-email" className="font-semibold text-crimson">
                Verify your email
              </Link>{" "}
              to join the discussion.
            </>
          ) : (
            <>
              <Link to="/login" className="font-semibold text-crimson">
                Log in
              </Link>{" "}
              to join the discussion.
            </>
          )}
        </p>
      )}
      {isLoading && <p className="mt-4 text-sm text-ink-faint">Loading comments…</p>}
      <div className="mt-6 space-y-5">
        {(comments ?? []).map((comment) => (
          <CommentNode key={comment.id} comment={comment} postId={postId} onChange={refresh} />
        ))}
      </div>
      {comments?.length === 0 && (
        <p className="mt-4 text-sm text-ink-faint">
          No comments yet — start the conversation.
        </p>
      )}
    </section>
  );
}

function countAll(comments: Comment[]): number {
  return comments.reduce(
    (sum, c) => sum + (c.status === "active" ? 1 : 0) + countAll((c.replies as Comment[]) ?? []),
    0,
  );
}

function Composer({
  postId,
  parentId,
  onPosted,
  autoFocus,
}: {
  postId: string;
  parentId?: string;
  onPosted: () => void;
  autoFocus?: boolean;
}) {
  const [content, setContent] = useState("");
  const createComment = useCreateComment({
    mutation: {
      onSuccess: () => {
        setContent("");
        onPosted();
      },
    },
  });

  return (
    <form
      className="mt-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (content.trim()) {
          createComment.mutate({ id: postId, data: { content: content.trim(), parentId } });
        }
      }}
    >
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={parentId ? 2 : 3}
        maxLength={2000}
        autoFocus={autoFocus}
        placeholder={parentId ? "Write a reply…" : "Share your take…"}
        className="w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm placeholder:text-ink-faint focus:border-crimson focus:outline-none"
      />
      {createComment.error && (
        <p className="mt-1 text-sm text-crimson">{createComment.error.message}</p>
      )}
      <div className="mt-2 flex justify-end">
        <Button type="submit" loading={createComment.isPending} disabled={!content.trim()}>
          {parentId ? "Reply" : "Comment"}
        </Button>
      </div>
    </form>
  );
}

function CommentNode({
  comment,
  postId,
  onChange,
}: {
  comment: Comment;
  postId: string;
  onChange: () => void;
}) {
  const { user } = useAuth();
  const [replying, setReplying] = useState(false);
  const [voted, setVoted] = useState(comment.viewerVoted);
  const [upvotes, setUpvotes] = useState(comment.upvoteCount);
  const voteComment = useVoteComment();
  const unvoteComment = useUnvoteComment();
  const deleteComment = useDeleteComment({ mutation: { onSuccess: onChange } });

  const deleted = comment.status === "deleted";
  const isOwn = user && comment.author && user.id === comment.author.id;

  function toggleVote() {
    if (!user?.emailVerified) return;
    if (voted) {
      setVoted(false);
      setUpvotes((n) => n - 1);
      unvoteComment.mutate({ id: comment.id });
    } else {
      setVoted(true);
      setUpvotes((n) => n + 1);
      voteComment.mutate({ id: comment.id, data: { value: 1 } });
    }
  }

  return (
    <div className={comment.depth > 0 ? "border-l-2 border-line pl-4" : ""}>
      <div className="flex items-start gap-2.5">
        {deleted ? (
          <span className="flex size-7 items-center justify-center rounded-full bg-cream text-xs text-ink-faint">
            —
          </span>
        ) : (
          <AvatarBubble
            name={comment.author?.displayName ?? "?"}
            url={comment.author?.avatarUrl ?? null}
            size="size-7"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 text-xs">
            {deleted ? (
              <span className="italic text-ink-faint">[deleted]</span>
            ) : (
              <>
                <Link
                  to={comment.author?.handle ? `/u/${comment.author.handle}` : "#"}
                  className="font-semibold text-ink hover:underline"
                >
                  {comment.author?.displayName}
                </Link>
                {(comment.author?.reputation ?? 0) > 0 && (
                  <span className="font-medium text-gold">{comment.author?.reputation}</span>
                )}
                <span className="text-ink-faint">{timeAgo(comment.createdAt)}</span>
              </>
            )}
          </div>
          {!deleted && (
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{comment.content}</p>
          )}
          {!deleted && (
            <div className="mt-1.5 flex items-center gap-4 text-xs text-ink-soft">
              <button
                type="button"
                aria-pressed={voted}
                onClick={toggleVote}
                className={`flex items-center gap-1 ${voted ? "font-semibold text-crimson" : "hover:text-crimson"}`}
              >
                <StitchIcon className="size-3.5" />
                {upvotes}
              </button>
              {user?.emailVerified && comment.depth < 2 && (
                <button
                  type="button"
                  onClick={() => setReplying((r) => !r)}
                  className="hover:text-ink"
                >
                  Reply
                </button>
              )}
              {isOwn && (
                <button
                  type="button"
                  onClick={() => deleteComment.mutate({ id: comment.id })}
                  className="hover:text-crimson"
                >
                  Delete
                </button>
              )}
            </div>
          )}
          {replying && (
            <Composer
              postId={postId}
              parentId={comment.id}
              autoFocus
              onPosted={() => {
                setReplying(false);
                onChange();
              }}
            />
          )}
        </div>
      </div>
      {(comment.replies as Comment[])?.length > 0 && (
        <div className="mt-4 space-y-4">
          {(comment.replies as Comment[]).map((reply) => (
            <CommentNode key={reply.id} comment={reply} postId={postId} onChange={onChange} />
          ))}
        </div>
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
