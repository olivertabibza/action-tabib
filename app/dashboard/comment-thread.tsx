"use client";

import { useRef, useState } from "react";
import { Loader2, MessageSquare, Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FeedAction } from "./feed-action";

const MAX_COMMENT_LENGTH = 1000;

type Comment = {
  id: string;
  parent_id: string | null;
  author_id: string;
  body: string;
  created_at: string;
  author: { display_name: string | null } | null;
};

/** Compact relative timestamp for comment rows ("now", "5m", "3h", "6d"). */
function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/**
 * The post card's action bar plus the inline comment well for one feed event.
 * The Comment action is the only live one this phase; the static
 * Congratulate / Endorse / Share actions render around it via the
 * actionsBefore / actionsAfter slots so the bar lays out as equal targets.
 * Comments stay lazy — nothing is fetched until the well is opened.
 * Reads/writes go through the browser Supabase client with local-state
 * updates; RLS scopes every query to events the viewer can see (see
 * supabase/comments.sql). Threading is one level deep: only top-level
 * comments offer a Reply button, mirroring the DB constraint.
 */
export function CommentThread({
  eventId,
  currentUserId,
  actionsBefore,
  actionsAfter,
}: {
  eventId: string;
  currentUserId: string;
  actionsBefore?: React.ReactNode;
  actionsAfter?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(
    null
  );
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const supabase = createClient();

  const commentSelect =
    "id, parent_id, author_id, body, created_at, author:profiles!activity_comments_author_id_fkey(display_name)";

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (loaded) return;

    setLoading(true);
    const { data, error: loadError } = await supabase
      .from("activity_comments")
      .select(commentSelect)
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });

    if (loadError) {
      console.error("[comments] load failed:", loadError);
      setError("Couldn't load comments. Please try again.");
    } else {
      const rows = (data ?? []).map((c) => ({
        ...c,
        author: c.author as unknown as Comment["author"],
      })) as Comment[];
      setComments(rows);
      setLoaded(true);
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const trimmed = body.trim();
    if (!trimmed) {
      setError("Write a comment first.");
      return;
    }

    setBusy(true);
    const { data, error: insertError } = await supabase
      .from("activity_comments")
      .insert({
        event_id: eventId,
        author_id: currentUserId,
        parent_id: replyTo?.id ?? null,
        body: trimmed,
      })
      .select(commentSelect)
      .single();

    if (insertError || !data) {
      console.error("[comments] insert failed:", insertError);
      setError("Posting your comment failed. Please try again.");
      setBusy(false);
      return;
    }

    const row = {
      ...data,
      author: data.author as unknown as Comment["author"],
    } as Comment;
    setComments((prev) => [...prev, row]);
    setBody("");
    setReplyTo(null);
    setBusy(false);
  }

  async function handleDelete(comment: Comment) {
    const replyIds = comment.parent_id
      ? []
      : comments.filter((c) => c.parent_id === comment.id).map((c) => c.id);
    const message =
      replyIds.length > 0
        ? `Delete this comment and its ${replyIds.length} ${
            replyIds.length === 1 ? "reply" : "replies"
          }?`
        : "Delete this comment?";
    if (!window.confirm(message)) return;

    setError(null);
    setDeletingId(comment.id);

    // The DB cascades replies when a top-level comment goes; mirror that here.
    const { error: deleteError } = await supabase
      .from("activity_comments")
      .delete()
      .eq("id", comment.id);

    if (deleteError) {
      console.error("[comments] delete failed:", deleteError);
      setError("Removing the comment failed. Please try again.");
      setDeletingId(null);
      return;
    }

    const removed = new Set([comment.id, ...replyIds]);
    setComments((prev) => prev.filter((c) => !removed.has(c.id)));
    if (replyTo && removed.has(replyTo.id)) setReplyTo(null);
    setDeletingId(null);
  }

  function startReply(comment: Comment) {
    setReplyTo({
      id: comment.id,
      name: comment.author?.display_name || "a creator",
    });
    composerRef.current?.focus();
  }

  const topLevel = comments.filter((c) => c.parent_id === null);
  const repliesFor = (parentId: string) =>
    comments.filter((c) => c.parent_id === parentId);

  return (
    <div className="border-t border-border-hairline">
      <div className="flex items-stretch gap-1 px-2.5 py-1.5">
        {actionsBefore}
        <FeedAction interactive onClick={toggle} aria-expanded={open}>
          <MessageSquare className="size-[17px]" strokeWidth={1.5} />
          Comment
        </FeedAction>
        {actionsAfter}
      </div>

      {open && (
        <div className="border-t border-border-hairline bg-surface-sunken px-4 py-3.5">
          {loading ? (
            <Loader2 className="size-4 animate-spin text-text-tertiary" />
          ) : (
            <>
              {topLevel.length > 0 && (
                <ul className="flex flex-col gap-3">
                  {topLevel.map((comment) => (
                    <li key={comment.id}>
                      <CommentRow
                        comment={comment}
                        currentUserId={currentUserId}
                        deletingId={deletingId}
                        onDelete={handleDelete}
                        onReply={startReply}
                      />
                      {repliesFor(comment.id).length > 0 && (
                        <ul className="mt-2 flex flex-col gap-2 border-l border-border pl-3 sm:ml-11 sm:pl-4">
                          {repliesFor(comment.id).map((reply) => (
                            <li key={reply.id}>
                              <CommentRow
                                comment={reply}
                                currentUserId={currentUserId}
                                deletingId={deletingId}
                                onDelete={handleDelete}
                              />
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <form
                onSubmit={handleSubmit}
                className={topLevel.length > 0 ? "mt-3 flex flex-col gap-2" : "flex flex-col gap-2"}
              >
                {replyTo && (
                  <p className="text-xs text-text-tertiary">
                    Replying to{" "}
                    <span className="text-text-primary">{replyTo.name}</span> —{" "}
                    <button
                      type="button"
                      className="text-accent hover:underline"
                      onClick={() => setReplyTo(null)}
                    >
                      cancel
                    </button>
                  </p>
                )}
                <Textarea
                  ref={composerRef}
                  rows={2}
                  maxLength={MAX_COMMENT_LENGTH}
                  className="rounded-card-nested border-border-hairline bg-surface text-[14.5px]"
                  placeholder={replyTo ? "Write a reply…" : "Write a comment…"}
                  aria-label={replyTo ? "Reply" : "Comment"}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  disabled={busy}
                />
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    size="sm"
                    className="rounded-full font-semibold"
                    disabled={busy}
                  >
                    {busy && <Loader2 className="size-3.5 animate-spin" />}
                    {busy ? "Posting…" : replyTo ? "Reply" : "Comment"}
                  </Button>
                </div>
              </form>
            </>
          )}

          {error && (
            <p
              role="alert"
              className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function CommentRow({
  comment,
  currentUserId,
  deletingId,
  onDelete,
  onReply,
}: {
  comment: Comment;
  currentUserId: string;
  deletingId: string | null;
  onDelete: (comment: Comment) => void;
  onReply?: (comment: Comment) => void;
}) {
  const name = comment.author?.display_name || "A creator";
  return (
    <div className="flex gap-2.5">
      <Avatar
        name={name}
        className="size-9 bg-avatar-fill text-xs text-text-secondary"
      />
      <div className="min-w-0 flex-1">
        <div className="rounded-card-nested bg-surface px-3.5 py-2.5">
          <p className="text-[15px] font-semibold text-text-primary">{name}</p>
          <p className="whitespace-pre-wrap text-[14.5px] leading-[1.55] text-text-secondary">
            {comment.body}
          </p>
        </div>
        <div className="mt-1 flex items-center gap-3 px-1 text-xs font-medium text-text-tertiary">
          {onReply && (
            <button
              type="button"
              className="transition-colors hover:text-accent"
              onClick={() => onReply(comment)}
            >
              Reply
            </button>
          )}
          <span>{timeAgo(comment.created_at)}</span>
        </div>
      </div>
      {comment.author_id === currentUserId && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={() => onDelete(comment)}
          disabled={deletingId === comment.id}
          aria-label="Delete comment"
        >
          {deletingId === comment.id ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Trash2 className="size-3.5" />
          )}
        </Button>
      )}
    </div>
  );
}
