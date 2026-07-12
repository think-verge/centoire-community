import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "../../components/Button";
import {
  createPost,
  getPost,
  updatePost,
  usePublishPost,
} from "../../lib/api/generated/posts/posts";
import { uploadImage } from "../../lib/api/generated/uploads/uploads";
import { useListTags } from "../../lib/api/generated/tags/tags";
import { useListCircles } from "../../lib/api/generated/circles/circles";
import type { PostDetail } from "../../lib/api/generated/model";
import { useAuth } from "../../lib/auth-context";

export function ComposePage() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [postId, setPostId] = useState<string | null>(routeId ?? null);
  const [title, setTitle] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [circleId, setCircleId] = useState<string>("");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!routeId);

  const { data: tags } = useListTags();
  const { data: circles } = useListCircles();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({
        placeholder: "Share the technique, the process, the story…",
      }),
    ],
    editorProps: {
      attributes: {
        class:
          "prose-editorial min-h-72 focus:outline-none text-[17px] leading-relaxed",
      },
    },
    onUpdate: () => scheduleSave(),
  });

  // Load existing draft when editing
  useEffect(() => {
    if (!routeId || !editor || loaded) return;
    getPost(routeId)
      .then((post: PostDetail) => {
        setTitle(post.title);
        setTagIds(post.tags.map((t) => t.id));
        setCircleId(post.circle?.id ?? "");
        setCoverImageUrl(post.coverImageUrl);
        if (post.content) editor.commands.setContent(post.content);
        setLoaded(true);
      })
      .catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId, editor]);

  const persist = useCallback(
    async (currentTitle: string) => {
      if (!editor || !currentTitle.trim()) return null;
      setSaveState("saving");
      try {
        const body = {
          title: currentTitle,
          content: editor.getJSON() as Record<string, unknown>,
          tagIds,
          circleId: circleId || null,
          coverImageUrl,
        };
        let id = postId;
        if (id) {
          await updatePost(id, body);
        } else {
          const created = await createPost({ ...body, status: "draft" });
          id = created.id;
          setPostId(id);
          window.history.replaceState(null, "", `/compose/${id}`);
        }
        setSaveState("saved");
        setError(null);
        return id;
      } catch (err) {
        setSaveState("error");
        setError((err as Error).message);
        return null;
      }
    },
    [editor, postId, tagIds, circleId, coverImageUrl],
  );

  const persistRef = useRef(persist);
  persistRef.current = persist;
  const titleRef = useRef(title);
  titleRef.current = title;

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void persistRef.current(titleRef.current);
    }, 2000);
  }, []);

  useEffect(() => {
    scheduleSave();
  }, [title, tagIds, circleId, coverImageUrl, scheduleSave]);

  const publishMutation = usePublishPost({
    mutation: {
      onSuccess: (post) => navigate(`/p/${post.slug}`),
      onError: (err) => setError(err.message),
    },
  });

  async function handlePublish() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const id = await persist(title);
    if (id) publishMutation.mutate({ id });
  }

  async function handleCoverUpload(file: File) {
    try {
      const result = await uploadImage({ file });
      setCoverImageUrl(result.url);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleInlineImage() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || !editor) return;
      try {
        const result = await uploadImage({ file });
        editor.chain().focus().setImage({ src: result.url }).run();
      } catch (err) {
        setError((err as Error).message);
      }
    };
    input.click();
  }

  if (!user?.emailVerified) {
    return (
      <div className="mx-auto max-w-2xl p-10 text-center">
        <p className="kicker mb-2">Compose</p>
        <h1 className="font-display-serif text-3xl font-semibold">Verify your email first</h1>
        <p className="mt-3 text-ink-soft">
          Publishing needs a verified address — check your inbox or resend the link from the
          verification page.
        </p>
        <Button className="mt-6" onClick={() => navigate("/verify-email")}>
          Go to verification
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <p className="kicker">{postId ? "Editing draft" : "New post"}</p>
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-faint" aria-live="polite">
            {saveState === "saving" && "Saving…"}
            {saveState === "saved" && "Draft saved"}
            {saveState === "error" && "Save failed"}
          </span>
          <Button
            onClick={handlePublish}
            loading={publishMutation.isPending}
            disabled={!title.trim()}
          >
            Publish
          </Button>
        </div>
      </div>

      {coverImageUrl ? (
        <div className="group relative mb-6 overflow-hidden rounded-xl border border-line">
          <img src={coverImageUrl} alt="Cover" className="max-h-80 w-full object-cover" />
          <button
            type="button"
            onClick={() => setCoverImageUrl(null)}
            className="absolute right-3 top-3 rounded-lg bg-ink/70 px-3 py-1.5 text-xs font-semibold text-ink-inverse opacity-0 transition-opacity group-hover:opacity-100"
          >
            Remove cover
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => coverInputRef.current?.click()}
          className="mb-6 w-full rounded-xl border border-dashed border-line py-6 text-sm text-ink-faint transition-colors hover:border-ink-soft hover:text-ink-soft"
        >
          + Add a cover image
        </button>
      )}
      <input
        ref={coverInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleCoverUpload(file);
        }}
      />

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        maxLength={200}
        className="font-display-serif w-full bg-transparent text-4xl font-semibold text-ink placeholder:text-ink-faint focus:outline-none"
      />

      {editor && <EditorToolbar editor={editor} onImageClick={handleInlineImage} />}
      <EditorContent editor={editor} />

      <div className="mt-8 space-y-5 border-t border-line pt-6">
        <div>
          <p className="kicker mb-2">Tags (up to 5)</p>
          <div className="flex flex-wrap gap-2">
            {(tags ?? []).map((tag) => {
              const active = tagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  aria-pressed={active}
                  disabled={!active && tagIds.length >= 5}
                  onClick={() =>
                    setTagIds((prev) =>
                      active ? prev.filter((id) => id !== tag.id) : [...prev, tag.id],
                    )
                  }
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
                    active
                      ? "border-crimson bg-crimson text-ink-inverse"
                      : "border-line bg-paper text-ink-soft hover:border-ink-soft"
                  }`}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <p className="kicker mb-2">Post to a circle (optional)</p>
          <select
            value={circleId}
            onChange={(e) => setCircleId(e.target.value)}
            className="w-full max-w-xs rounded-lg border border-line bg-white px-3 py-2 text-sm focus:border-crimson focus:outline-none"
          >
            <option value="">No circle — just my followers & tags</option>
            {(circles ?? [])
              .filter((c) => c.viewerRole)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </div>
        {error && <p className="text-sm text-crimson">{error}</p>}
      </div>
    </div>
  );
}

function EditorToolbar({
  editor,
  onImageClick,
}: {
  editor: Editor;
  onImageClick: () => void;
}) {
  const buttons: Array<{ label: string; active?: boolean; action: () => void; title: string }> = [
    {
      label: "B",
      active: editor.isActive("bold"),
      action: () => editor.chain().focus().toggleBold().run(),
      title: "Bold",
    },
    {
      label: "I",
      active: editor.isActive("italic"),
      action: () => editor.chain().focus().toggleItalic().run(),
      title: "Italic",
    },
    {
      label: "H2",
      active: editor.isActive("heading", { level: 2 }),
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      title: "Heading",
    },
    {
      label: "H3",
      active: editor.isActive("heading", { level: 3 }),
      action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      title: "Subheading",
    },
    {
      label: "“”",
      active: editor.isActive("blockquote"),
      action: () => editor.chain().focus().toggleBlockquote().run(),
      title: "Quote",
    },
    {
      label: "•",
      active: editor.isActive("bulletList"),
      action: () => editor.chain().focus().toggleBulletList().run(),
      title: "Bullet list",
    },
    { label: "🖼", action: onImageClick, title: "Insert image" },
  ];

  return (
    <div className="sticky top-14 z-30 my-4 flex w-fit gap-1 rounded-lg border border-line bg-paper p-1 shadow-card">
      {buttons.map((btn) => (
        <button
          key={btn.title}
          type="button"
          title={btn.title}
          onClick={btn.action}
          className={`rounded px-2.5 py-1 text-sm font-semibold transition-colors ${
            btn.active ? "bg-crimson text-ink-inverse" : "text-ink-soft hover:bg-cream"
          }`}
        >
          {btn.label}
        </button>
      ))}
    </div>
  );
}
