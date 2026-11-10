import { Mark, mergeAttributes } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  createPost,
  getPost,
  updatePost,
  usePublishPost,
} from "../../lib/api/generated/posts/posts";
import { uploadImage } from "../../lib/api/generated/uploads/uploads";
import { useListCircles } from "../../lib/api/generated/circles/circles";
import { useSearchHashtags } from "../../lib/api/generated/hashtags/hashtags";
import type { PostDetail } from "../../lib/api/generated/model";
import { useAuth } from "../../lib/auth-context";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { cleanHashtag, toHashtag } from "../../lib/hashtag";

const UnderlineExtension = Mark.create({
  name: "underline",
  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },
  parseHTML() {
    return [
      { tag: "u" },
      {
        style: "text-decoration",
        consuming: false,
        getAttrs: (style) => ((style as string).includes("underline") ? {} : false),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["u", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },
  addCommands() {
    return {
      toggleUnderline:
        () =>
        ({ commands }: { commands: { toggleMark: (name: string) => boolean } }) => {
          return commands.toggleMark(this.name);
        },
    };
  },
  addKeyboardShortcuts() {
    return {
      "Mod-u": () => this.editor.commands.toggleMark(this.name),
      "Mod-U": () => this.editor.commands.toggleMark(this.name),
    };
  },
});

interface MediaItem {
  id: string;
  name: string;
  url: string;
  sizeStr: string;
  type: "image" | "video";
  isCover: boolean;
  durationStr?: string;
}

function getVideoDuration(file: File): Promise<string> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      const sec = Math.round(video.duration);
      const mins = Math.floor(sec / 60);
      const remSec = sec % 60;
      resolve(`${mins}:${remSec < 10 ? "0" : ""}${remSec}`);
    };
    video.onerror = () => resolve("0:18");
    video.src = URL.createObjectURL(file);
  });
}

interface DraftMeta {
  mediaList?: MediaItem[];
  bannerImageUrl?: string | null;
  allowComments?: boolean;
  shareToProfile?: boolean;
}

const FALLBACK_SUGGESTED_TAG_NAMES = [
  "Paris Fashion",
  "Paris Fashion Week",
  "Street Style",
  "Accessories",
  "Runway Trends",
  "Knitwear",
];

function formatTagCount(count: number | undefined | null): string {
  if (!count) return "0";
  if (count >= 1000000) return `${(count / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${count}`;
}

export function ComposePage() {
  const { id: routeId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [postId, setPostId] = useState<string | null>(routeId ?? null);
  const [title, setTitle] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [circleId, setCircleId] = useState<string>(searchParams.get("circle") ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [allowComments, setAllowComments] = useState(true);
  const [shareToProfile, setShareToProfile] = useState(true);
  const [tagSearchText, setTagSearchText] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftSavedToast, setDraftSavedToast] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const { data: circles } = useListCircles();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const lastLoadedRouteIdRef = useRef<string | null>(null);

  // Hashtag search queries (queries top hashtags by default when query is empty)
  const debouncedTagQuery = useDebouncedValue(cleanHashtag(tagSearchText), 150);
  const { data: tagSearchResults } = useSearchHashtags({
    q: debouncedTagQuery || undefined,
    limit: 6,
  });

  const suggestedTagsList = useMemo(() => {
    if (tagSearchResults && tagSearchResults.length > 0) {
      return tagSearchResults.map((t) => ({
        name: t.name,
        count: formatTagCount(t.postCount),
      }));
    }
    return FALLBACK_SUGGESTED_TAG_NAMES.map((name) => ({
      name,
      count: "0",
    }));
  }, [tagSearchResults]);

  // Option A: IN THE FEED reflects the selected Box 2 gallery cover; falls back to Box 1 banner
  const feedThumbnailUrl = useMemo(() => {
    const galleryCover = mediaList.find((m) => m.isCover)?.url || mediaList[0]?.url;
    return galleryCover || coverImageUrl || null;
  }, [mediaList, coverImageUrl]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      UnderlineExtension,
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Link.configure({ openOnClick: false }),
      Placeholder.configure({
        placeholder:
          "Paris always reminds me that great style is in the details. This season, it's less about loud statements and more about pieces with personality: soft knitwear, sculptural bags and a little unexpected colour…",
      }),
    ],
    editorProps: {
      attributes: {
        class:
          "prose-editorial min-h-60 sm:min-h-72 focus:outline-none text-[16px] leading-relaxed text-[#17171D] font-ui p-4 sm:p-5",
      },
    },
    onUpdate: () => {
      setIsDirty(true);
      scheduleSave();
    },
  });

  // Calculate word count
  const wordCount = useMemo(() => {
    if (!editor) return 0;
    const text = editor.getText().trim();
    return text ? text.split(/\s+/).filter(Boolean).length : 0;
  }, [editor?.getText()]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load existing post/draft when editing or switching routes
  useEffect(() => {
    if (!editor) return;

    if (!routeId) {
      if (lastLoadedRouteIdRef.current !== null) {
        lastLoadedRouteIdRef.current = null;
        setPostId(null);
        setTitle("");
        setHashtags([]);
        setCircleId("");
        setCoverImageUrl(null);
        setMediaList([]);
        setAllowComments(true);
        setShareToProfile(true);
        editor.commands.clearContent();
        setIsDirty(false);
        setSaveState("idle");
      }
      return;
    }

    if (lastLoadedRouteIdRef.current === routeId) return;

    getPost(routeId)
      .then((post: PostDetail) => {
        lastLoadedRouteIdRef.current = routeId;
        setPostId(post.id);
        setTitle(post.title || "");
        setHashtags(post.hashtags || []);
        setCircleId(post.circle?.id ?? "");

        const contentObj = post.content as (Record<string, unknown> & { meta?: DraftMeta }) | null;
        const meta = contentObj?.meta;

        if (meta) {
          if (Array.isArray(meta.mediaList)) {
            setMediaList(meta.mediaList);
          } else {
            setMediaList([]);
          }
          setCoverImageUrl(meta.bannerImageUrl ?? post.coverImageUrl ?? null);
          if (typeof meta.allowComments === "boolean") setAllowComments(meta.allowComments);
          if (typeof meta.shareToProfile === "boolean") setShareToProfile(meta.shareToProfile);
        } else {
          setCoverImageUrl(post.coverImageUrl ?? null);
          setMediaList([]);
        }

        if (post.content) {
          editor.commands.setContent(post.content);
        }
        setIsDirty(false);
        setSaveState("saved");
      })
      .catch((err: unknown) => {
        const errObj = err as { status?: number; message?: string } | undefined;
        const isNotFound = errObj?.status === 404 || errObj?.message?.includes("not found");
        if (isNotFound) {
          setPostId(null);
          setError(null);
          navigate("/compose", { replace: true });
        } else {
          setError(errObj?.message || "Failed to load draft");
        }
      });
  }, [routeId, editor, navigate]);

  const persist = useCallback(
    async (currentTitle: string) => {
      if (!editor) return null;
      const effectiveTitle = currentTitle.trim() || (title.trim() ? title.trim() : "Untitled draft");
      setSaveState("saving");
      try {
        const activeCover = mediaList.find((m) => m.isCover)?.url || coverImageUrl || null;
        const editorJson = editor.getJSON() as Record<string, unknown>;
        const body = {
          title: effectiveTitle,
          content: {
            ...editorJson,
            meta: {
              mediaList,
              bannerImageUrl: coverImageUrl,
              allowComments,
              shareToProfile,
            },
          },
          hashtags,
          circleId: circleId || null,
          coverImageUrl: activeCover,
        };
        let id = postId;
        if (id) {
          try {
            await updatePost(id, body);
          } catch (updateErr: unknown) {
            const errObj = updateErr as { message?: string } | undefined;
            if (errObj?.message?.includes("not found")) {
              const created = await createPost({ ...body, status: "draft" });
              id = created.id;
              setPostId(id);
              lastLoadedRouteIdRef.current = id;
              window.history.replaceState(null, "", `/compose/${id}`);
            } else {
              throw updateErr;
            }
          }
        } else {
          const created = await createPost({ ...body, status: "draft" });
          id = created.id;
          setPostId(id);
          lastLoadedRouteIdRef.current = id;
          window.history.replaceState(null, "", `/compose/${id}`);
        }
        setSaveState("saved");
        setIsDirty(false);
        setError(null);
        return id;
      } catch (err) {
        setSaveState("error");
        setError((err as Error).message);
        return null;
      }
    },
    [editor, postId, hashtags, circleId, coverImageUrl, mediaList, allowComments, shareToProfile, title],
  );

  const persistRef = useRef(persist);
  persistRef.current = persist;
  const titleRef = useRef(title);
  titleRef.current = title;
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving");
    saveTimer.current = setTimeout(() => {
      if (!isDirtyRef.current) return;
      void persistRef.current(titleRef.current);
    }, 1500);
  }, []);

  useEffect(() => {
    if (isDirty) scheduleSave();
  }, [title, hashtags, circleId, coverImageUrl, mediaList, isDirty, scheduleSave]);

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

  async function handleSaveDraft() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setIsSavingDraft(true);
    try {
      const effectiveTitle = title.trim() || "Untitled draft";
      if (!title.trim()) setTitle(effectiveTitle);
      const id = await persist(effectiveTitle);
      if (id) {
        setDraftSavedToast(true);
        setTimeout(() => setDraftSavedToast(false), 3000);
      }
    } catch (err: unknown) {
      const errObj = err as { message?: string } | undefined;
      setError(errObj?.message || "Failed to save draft");
    } finally {
      setIsSavingDraft(false);
    }
  }

  async function handleCoverUpload(file: File) {
    try {
      setIsDirty(true);
      const result = await uploadImage({ file });
      setCoverImageUrl(result.url);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleMediaUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setIsDirty(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        let durationStr: string | undefined;
        if (file.type.startsWith("video")) {
          try {
            durationStr = await getVideoDuration(file);
          } catch {
            durationStr = "0:18";
          }
        }
        const result = await uploadImage({ file });
        setMediaList((prev) => {
          const hasCover = prev.some((m) => m.isCover);
          return [
            ...prev,
            {
              id: Math.random().toString(36).slice(2),
              name: file.name,
              url: result.url,
              sizeStr: `${file.type.startsWith("video") ? "Video" : "Image"} · ${(file.size / (1024 * 1024)).toFixed(1)} MB`,
              type: file.type.startsWith("video") ? "video" : "image",
              isCover: !hasCover && prev.length === 0,
              durationStr,
            },
          ];
        });
      } catch (err) {
        setError((err as Error).message);
      }
    }
  }

  function handleSetCover(item: MediaItem) {
    setIsDirty(true);
    setMediaList((prev) =>
      prev.map((m) => ({
        ...m,
        isCover: m.id === item.id,
      })),
    );
  }

  function handleRemoveMedia(id: string) {
    setIsDirty(true);
    setMediaList((prev) => {
      const remaining = prev.filter((m) => m.id !== id);
      const removed = prev.find((m) => m.id === id);
      if (removed?.isCover && remaining.length > 0) {
        return remaining.map((m, idx) => ({ ...m, isCover: idx === 0 }));
      }
      return remaining;
    });
  }

  async function handleInlineImage() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || !editor) return;
      try {
        setIsDirty(true);
        const result = await uploadImage({ file });
        editor.chain().focus().setImage({ src: result.url }).run();
      } catch (err) {
        setError((err as Error).message);
      }
    };
    input.click();
  }

  function addHashtag(name: string) {
    const cleaned = toHashtag(name);
    if (!cleaned || hashtags.includes(cleaned) || hashtags.length >= 5) return;
    setIsDirty(true);
    setHashtags([...hashtags, cleaned]);
    setTagSearchText("");
  }

  function removeHashtag(name: string) {
    setIsDirty(true);
    setHashtags(hashtags.filter((h) => h !== name));
  }

  if (!user?.emailVerified) {
    return (
      <div className="mx-auto max-w-2xl p-10 text-center font-ui bg-[#EFEFEF] min-h-[calc(100vh-3.5rem)]">
        <p className="kicker mb-2">Compose</p>
        <h1 className="font-editorial text-3xl font-semibold text-[#111111]">
          Verify your email first
        </h1>
        <p className="mt-3 text-gray-600">
          Publishing needs a verified address — check your inbox or resend the link from the
          verification page.
        </p>
        <button
          type="button"
          className="mt-6 rounded-none bg-[#E4572E] px-6 py-2.5 text-sm font-semibold text-white shadow-none hover:bg-[#d44820] transition-colors"
          onClick={() => navigate("/verify-email")}
        >
          Go to verification
        </button>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#EFEFEF] font-ui flex flex-row items-start justify-between">
      {/* ============================================================== */}
      {/* MIDDLE: Create post workspace area (Figma: Fill 940px, p-6, gap-6) */}
      {/* Styled on top of bg-[#EFEFEF] with feed page spacing           */}
      {/* ============================================================== */}
      <div className="flex-1 min-w-0 py-6 px-3 sm:px-6">
        <div className="w-full max-w-[940px] mx-auto flex flex-col gap-4">
          {/* Header Row: Title & Autosave status (matching exact Figma typography & layout) */}
          <div className="flex flex-wrap items-center justify-between gap-3 -mb-1">
            <div className="space-y-0.5">
              {/* Figma: Playfair Display, 500 (Medium), 36px, Line-height 120%, #111111 */}
              <h1 className="font-editorial text-[36px] font-medium leading-[1.2] text-[#111111] tracking-[0%]">
                Create a post
              </h1>
              {/* Figma: Plus Jakarta Sans, 400 (Regular), 14px, Line-height 165%, #111111 60% */}
              <p className="font-ui text-[14px] font-normal leading-[1.65] text-[#111111]/60 tracking-[0%]">
                Your perspective belongs here. Share a story, a look or a conversation.
              </p>
            </div>

            {/* Autosave status (Figma: Hug 125px x 18px, Gap 6px, # cloud-check + label) */}
            <div className="flex items-center gap-1.5 text-[12px] font-ui transition-colors">
              {saveState === "saving" ? (
                <div className="flex items-center gap-1.5 text-amber-600 font-medium">
                  <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                  <span>Saving…</span>
                </div>
              ) : saveState === "error" ? (
                <div className="flex items-center gap-1.5 text-rose-600 font-medium">
                  <span className="size-2 rounded-full bg-rose-500" />
                  <span>Save failed</span>
                </div>
              ) : saveState === "saved" ? (
                <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                  <svg
                    className="size-4 text-emerald-600"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path
                      d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <polyline
                      points="9 13 11.5 15.5 15.5 11.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>All changes saved</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-[#111111]/40">
                  <svg
                    className="size-4 text-[#111111]/40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path
                      d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <polyline
                      points="9 13 11.5 15.5 15.5 11.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>All changes saved</span>
                </div>
              )}
            </div>
          </div>

          {/* ============================================================== */}
          {/* BOX 1: Post content (Figma Frame: Fill 892px x Hug 930.9px)    */}
          {/* Sharp edges: border 1px #111111 10%, padding 24px, gap 20px    */}
          {/* ============================================================== */}
          <div className="w-full bg-white border border-[#111111]/10 p-6 space-y-5 rounded-none shadow-none">
            {/* Add a cover image section (Figma: Upload area Hug 76px, p-4, bg #EFEFEF) */}
            {coverImageUrl ? (
              <div className="group relative overflow-hidden border border-[#111111]/10 bg-gray-50 rounded-none">
                <img
                  src={coverImageUrl}
                  alt="Cover preview"
                  className="max-h-[360px] w-full object-cover transition-transform duration-300 group-hover:scale-[1.01]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-4">
                  <span className="bg-black/75 px-3 py-1 text-xs font-semibold text-white rounded-full">
                    Cover Image
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      className="bg-white/95 px-3.5 py-1.5 text-xs font-semibold text-gray-800 hover:bg-white transition-colors rounded-full"
                    >
                      Change cover
                    </button>
                    <button
                      type="button"
                      onClick={() => setCoverImageUrl(null)}
                      className="bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 transition-colors rounded-full"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                onClick={() => coverInputRef.current?.click()}
                className="cursor-pointer min-h-[76px] px-4 py-3.5 border border-dashed border-[#111111]/15 bg-[#EFEFEF] flex items-center justify-between gap-4 transition-colors hover:border-[#111111]/30 rounded-none"
              >
                <div className="flex items-center gap-3.5">
                  {/* Upload button with rounded edges */}
                  <div className="size-10 rounded-full bg-white border border-[#111111]/10 flex items-center justify-center text-gray-600 shrink-0 shadow-xs">
                    <svg
                      className="size-4 text-[#111111]/80"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path
                        d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <polyline
                        points="17 8 12 3 7 8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <line
                        x1="12"
                        y1="3"
                        x2="12"
                        y2="15"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#111111] leading-tight">
                      Add a cover image
                    </h3>
                    <p className="text-xs text-[#111111]/60 mt-0.5 leading-tight">
                      Upload a cover image to make your post stand out.
                    </p>
                  </div>
                </div>
                {/* Browse files button with rounded edges */}
                <button
                  type="button"
                  className="shrink-0 rounded-full border border-[#111111]/20 bg-white px-5 py-2 text-xs font-semibold text-[#111111] hover:bg-gray-50 transition-colors shadow-xs"
                >
                  Browse files
                </button>
              </div>
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

            {/* POST TITLE Header & Character Counter */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs text-[#111111]/50 font-semibold tracking-wider uppercase">
                <span className="text-[#111111]">POST TITLE</span>
                <span className={title.length > 100 ? "text-amber-600" : ""}>
                  {title.length}/120
                </span>
              </div>
              {/* Post title in pure Black (#000000) */}
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setIsDirty(true);
                  setTitle(e.target.value);
                }}
                placeholder="A fresh perspective on Paris street style"
                maxLength={120}
                className="font-editorial w-full bg-transparent text-2xl sm:text-3xl font-medium text-[#000000] placeholder:text-[#111111]/30 focus:outline-none py-1 border-b border-transparent focus:border-[#111111]/10 rounded-none"
              />
            </div>

            {/* Body Editor Box (Figma Frame: Fill 844px x Hug 698.9px, border 1px #111111 10%) */}
            {/* Upper part matching page bg (#EFEFEF), white lower content, bottom meta bar */}
            <div className="w-full border border-[#111111]/10 bg-white rounded-none overflow-hidden">
              {/* Upper part (Toolbar): bg-[#EFEFEF] matching page background */}
              {editor && (
                <div className="bg-[#EFEFEF] border-b border-[#111111]/10 px-3.5 py-2">
                  <FigmaEditorToolbar editor={editor} onImageClick={handleInlineImage} />
                </div>
              )}

              {/* Editor Content Area */}
              <div className="min-h-[220px] bg-white">
                <EditorContent editor={editor} />
              </div>

              {/* Editor Bottom Meta: Mention prompt & Word Counter */}
              <div className="flex items-center justify-between text-xs text-[#111111]/50 px-4 py-2.5 border-t border-[#111111]/10 bg-white">
                <span className="hover:text-gray-700 cursor-pointer transition-colors">
                  Mention someone with @
                </span>
                <span>{wordCount} words</span>
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* BOX 2: Media upload (Figma Frame: Fill 892px x Hug 431px)      */}
          {/* Sharp edges: border 1px #111111 10%, padding 24px, gap 16px    */}
          {/* ============================================================== */}
          <div className="w-full bg-white border border-[#111111]/10 p-6 space-y-4 rounded-none shadow-none">
            <div className="flex items-center justify-between">
              {/* Figma: Playfair Display, 500 (Medium), 22px, Line-height 100%, #111111 */}
              <h2 className="font-editorial text-[22px] font-medium leading-none text-[#111111]">
                Images & video
              </h2>
              <span className="text-xs text-[#111111]/50 font-medium">
                {mediaList.length}/10 files
              </span>
            </div>

            {/* Drop Zone (Figma Upload area: Hug 76px, p-4, bg #EFEFEF, rounded browse button) */}
            <div
              onClick={() => mediaInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void handleMediaUpload(e.dataTransfer.files);
              }}
              className="cursor-pointer min-h-[76px] px-4 py-3.5 border border-dashed border-[#111111]/15 bg-[#EFEFEF] flex items-center justify-between gap-4 transition-colors hover:border-[#111111]/30 rounded-none"
            >
              <div className="flex items-center gap-3.5 text-left">
                <div className="size-10 rounded-full bg-white border border-[#111111]/10 flex items-center justify-center text-gray-500 shrink-0 shadow-xs">
                  <svg
                    className="size-4 text-[#111111]/80"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#111111] leading-tight">
                    Drop your images or video here
                  </p>
                  <p className="text-xs text-[#111111]/60 mt-0.5 leading-tight">
                    JPG, PNG, WEBP or MP4 • Up to 100 MB per file
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-full border border-[#111111]/20 bg-white px-5 py-2 text-xs font-semibold text-[#111111] hover:bg-gray-50 transition-colors shadow-xs"
              >
                Browse files
              </button>
            </div>
            <input
              ref={mediaInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
              className="hidden"
              onChange={(e) => {
                void handleMediaUpload(e.target.files);
                e.target.value = "";
              }}
            />

            {/* Uploaded files container (Figma: Flow Horizontal, Width Fill 844px, Height Hug 213px, Gap 16px) */}
            {mediaList.length > 0 && (
              <div className="pt-1 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 w-full">
                  {mediaList.map((item) => (
                    <div
                      key={item.id}
                      className="group relative w-full flex flex-col gap-2 rounded-none"
                    >
                      {/* Media preview: Fill width (270.67px in 3 cols), Height 142px, Radius 8px */}
                      <div className="relative h-[142px] w-full overflow-hidden rounded-[8px] bg-gray-100 border border-[#111111]/10">
                        {item.type === "video" ? (
                          <video
                            src={item.url}
                            className="h-full w-full object-cover"
                            controls={false}
                            muted
                            playsInline
                            preload="metadata"
                          />
                        ) : (
                          <img
                            src={item.url}
                            alt={item.name}
                            className="h-full w-full object-cover"
                          />
                        )}

                        {/* Remove button: white circle with black X, top-right */}
                        <button
                          type="button"
                          onClick={() => handleRemoveMedia(item.id)}
                          aria-label={`Remove ${item.name}`}
                          className="absolute right-2 top-2 size-6 rounded-full bg-white text-black shadow-xs flex items-center justify-center text-xs font-bold hover:bg-gray-100 transition-all z-10 cursor-pointer"
                        >
                          ✕
                        </button>

                        {/* Video duration badge: translucent black pill, bottom-left */}
                        {item.type === "video" && (
                          <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-xs">
                            <span className="text-[9px]">▷</span>
                            <span>{item.durationStr || "0:18"}</span>
                          </span>
                        )}
                      </div>

                      {/* File information */}
                      <div className="space-y-1">
                        {/* Row 1: Grip icon + File name */}
                        <div className="flex items-center gap-1.5 min-w-0">
                          <svg
                            className="size-3 text-[#111111]/40 shrink-0 cursor-grab"
                            viewBox="0 0 16 16"
                            fill="currentColor"
                          >
                            <circle cx="5" cy="3" r="1.5" />
                            <circle cx="11" cy="3" r="1.5" />
                            <circle cx="5" cy="8" r="1.5" />
                            <circle cx="11" cy="8" r="1.5" />
                            <circle cx="5" cy="13" r="1.5" />
                            <circle cx="11" cy="13" r="1.5" />
                          </svg>
                          <span className="text-[13px] font-medium text-[#111111] truncate">
                            {item.name}
                          </span>
                        </div>

                        {/* Row 2: File type and size */}
                        <p className="text-[11px] text-[#111111]/50 pl-4">{item.sizeStr}</p>

                        {/* Row 3: Media controls */}
                        <div className="flex items-center justify-between pt-0.5 pl-4 text-[12px]">
                          <button
                            type="button"
                            onClick={() =>
                              editor?.chain().focus().setImage({ src: item.url }).run()
                            }
                            className="text-[#111111] hover:underline font-medium cursor-pointer"
                          >
                            {item.type === "video" ? "Edit video" : "Crop / edit"}
                          </button>
                          {item.isCover ? (
                            <span className="text-[#111111]/40 font-medium">Cover image</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSetCover(item)}
                              className="text-[#E4572E] hover:underline font-medium cursor-pointer"
                            >
                              Set as cover
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Drag hint with 6-dot grip icon */}
                <div className="flex items-center gap-2 pt-1 text-[12px] text-[#111111]/60">
                  <svg
                    className="size-3 text-[#111111]/40 shrink-0"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                  >
                    <circle cx="5" cy="3" r="1.5" />
                    <circle cx="11" cy="3" r="1.5" />
                    <circle cx="5" cy="8" r="1.5" />
                    <circle cx="11" cy="8" r="1.5" />
                    <circle cx="5" cy="13" r="1.5" />
                    <circle cx="11" cy="13" r="1.5" />
                  </svg>
                  <span>Drag to reorder · The cover image appears in the community feed.</span>
                </div>
              </div>
            )}
          </div>

          {/* ============================================================== */}
          {/* BOX 3: Publishing actions (Figma Frame: Fill 892px x Hug 82px) */}
          {/* Sharp edges: border 1px #111111 10%, padding 20px, gap 24px    */}
          {/* ============================================================== */}
          <div className="w-full bg-white border border-[#111111]/10 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-none shadow-none">
            <div>
              <p className="text-xs sm:text-sm font-semibold text-[#111111]">
                Make it yours. Keep it kind.
              </p>
              <p className="text-[11px] sm:text-xs text-[#111111]/60 mt-0.5">
                By publishing, you agree to Centoire&apos;s community guidelines.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isSavingDraft}
                className={`h-[42px] rounded-full border px-5 sm:px-6 text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 shadow-xs ${
                  draftSavedToast
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-[#111111]/20 bg-white text-[#111111] hover:bg-gray-50"
                }`}
              >
                {isSavingDraft ? (
                  <>
                    <svg className="size-3.5 animate-spin text-[#111111]" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Saving…</span>
                  </>
                ) : draftSavedToast ? (
                  <>
                    <svg className="size-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>Draft saved!</span>
                  </>
                ) : (
                  "Save draft"
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowPreviewModal(true)}
                className="h-[42px] rounded-full border border-[#111111]/20 bg-white px-5 sm:px-6 text-xs sm:text-sm font-semibold text-[#111111] hover:bg-gray-50 flex items-center gap-2 transition-colors shadow-xs"
              >
                <svg
                  className="size-4 text-[#111111]/70"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
                </svg>
                Preview
              </button>
              <button
                type="button"
                onClick={handlePublish}
                disabled={!title.trim() || hashtags.length < 1 || publishMutation.isPending}
                title={hashtags.length < 1 ? "Add at least one tag to publish" : undefined}
                className="h-[42px] rounded-full bg-[#E4572E] px-6 sm:px-7 text-xs sm:text-sm font-semibold text-white hover:bg-[#d44820] disabled:opacity-50 flex items-center gap-2 transition-all shadow-xs"
              >
                <svg
                  className="size-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                >
                  <line x1="7" y1="17" x2="17" y2="7" />
                  <polyline points="7 7 17 7 17 17" />
                </svg>
                {publishMutation.isPending ? "Publishing…" : "Publish post"}
              </button>
            </div>
          </div>
          {error && !error.toLowerCase().includes("not found") && (
            <p className="text-xs text-rose-600 font-medium">{error}</p>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* RIGHT: fashion-sidebar (Exact feed page right sidebar styling) */}
      {/* Sticky top-14, 280px width, border-l border-[#D4D4D4], bg-white */}
      {/* ============================================================== */}
      <aside className="sticky top-14 hidden xl:flex h-[calc(100vh-3.5rem)] w-[280px] shrink-0 flex-col gap-5 overflow-y-auto border-l border-[#D4D4D4] bg-white p-5 rounded-none">
        {/* SECTION 1: TAGS */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs font-semibold text-[#111111] tracking-wider uppercase">
            <span>TAGS</span>
            <span className="text-[#111111]/50 font-normal">{hashtags.length}/5</span>
          </div>
          <p className="text-xs text-[#111111]/60 leading-normal font-ui">
            Help your post find its people. Add up to 5 relevant tags.
          </p>

          {/* Selected Tag Chips (Figma: Hug 116px x 27px, Radius 999px, px-2.5 py-1.5, Text #111111 60%) */}
          {hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {hashtags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex h-[27px] items-center gap-1.5 rounded-full border border-[#111111]/10 bg-[#111111]/5 px-2.5 py-1.5 text-xs font-medium text-[#111111]/60 leading-none"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => removeHashtag(tag)}
                    aria-label={`Remove tag ${tag}`}
                    className="text-[#111111]/60 hover:text-[#111111] transition-colors flex items-center justify-center text-[10px]"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Tag Search Input (Figma: Fill 240px x Fixed 42px, Radius 8px, px-3, Gap 8px) */}
          {hashtags.length < 5 && (
            <div className="relative w-full">
              <div className="flex h-[42px] w-full items-center gap-2 rounded-[8px] border border-[#111111]/15 bg-white px-3 text-xs focus-within:border-[#E4572E] transition-colors">
                <svg
                  className="size-4 text-[#111111]/50 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  value={tagSearchText}
                  onChange={(e) => setTagSearchText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && tagSearchText.trim()) {
                      e.preventDefault();
                      addHashtag(tagSearchText);
                    }
                  }}
                  placeholder="Paris"
                  className="w-full bg-transparent text-[#111111] placeholder:text-[#111111]/40 focus:outline-none text-xs font-normal"
                />
                {tagSearchText && (
                  <button
                    type="button"
                    onClick={() => setTagSearchText("")}
                    className="text-[#111111]/40 hover:text-[#111111] text-xs ml-1"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          )}

          {/* SUGGESTED TAGS (Real database counts, coral + vector) */}
          <div className="pt-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#111111]/50 mb-2 font-ui">
              SUGGESTED TAGS
            </p>
            <div className="space-y-1">
              {suggestedTagsList
                .filter((item) => {
                  const tagKey = toHashtag(item.name);
                  return Boolean(tagKey && !hashtags.includes(tagKey));
                })
                .slice(0, 4)
                .map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between py-1 text-xs hover:bg-[#F5F5F5] px-1 transition-colors"
                  >
                    <span className="font-normal text-[#111111]"># {item.name}</span>
                    <button
                      type="button"
                      onClick={() => addHashtag(item.name)}
                      className="flex items-center gap-1.5 text-xs text-[#111111]/50 hover:text-[#E4572E] transition-colors"
                    >
                      <span>{item.count}</span>
                      <svg
                        className="size-3 text-[#E4572E]"
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <line x1="6" y1="1" x2="6" y2="11" strokeLinecap="round" />
                        <line x1="1" y1="6" x2="11" y2="6" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* 1. Horizontal line between suggested tags section and post settings */}
        <div className="w-full border-t border-[#D4D4D4] my-1" />

        {/* SECTION 2: POST SETTINGS */}
        <div className="flex flex-col gap-4">
          <h3 className="font-ui text-[11px] font-semibold uppercase tracking-wider text-[#111111]/50">
            POST SETTINGS
          </h3>

          {/* Who can see this post? (Figma: Audience selector Fill 240px x Fixed 42px, Radius 8px, Border #111111 20%) */}
          <div className="space-y-1.5">
            <label htmlFor="post-visibility" className="text-xs font-medium text-[#111111] block font-ui">
              Who can see this post?
            </label>
            <div className="relative h-[42px] w-full">
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#111111]/70">
                <svg
                  className="size-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>
              <select
                id="post-visibility"
                value={circleId}
                onChange={(e) => setCircleId(e.target.value)}
                className="h-[42px] w-full appearance-none rounded-[8px] border border-[#111111]/20 bg-white pl-9 pr-8 text-xs font-medium text-[#111111] focus:border-[#E4572E] focus:outline-none transition-colors cursor-pointer"
              >
                <option value="">Everyone</option>
                {(circles ?? [])
                  .filter((c) => c.viewerRole)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      Circle: {c.name}
                    </option>
                  ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#111111]/60">
                <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* 2. Horizontal line between who can see this post and allow comments */}
          <div className="w-full border-t border-[#D4D4D4] my-1" />

          {/* Toggle: Allow comments */}
          <div className="flex items-center justify-between pt-0.5">
            <div>
              <p className="text-xs font-semibold text-[#111111]">Allow comments</p>
              <p className="text-[11px] text-[#111111]/60">Let the community join the conversation</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={allowComments}
              aria-label="Allow comments"
              onClick={() => setAllowComments(!allowComments)}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center transition-colors rounded-full ${
                allowComments ? "bg-[#E4572E]" : "bg-gray-200"
              }`}
            >
              <span
                className={`inline-block size-3.5 transform rounded-full bg-white shadow-xs transition-transform ${
                  allowComments ? "translate-x-[18px]" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Toggle: Share to my profile */}
          <div className="flex items-center justify-between pt-0.5">
            <div>
              <p className="text-xs font-semibold text-[#111111]">Share to my profile</p>
              <p className="text-[11px] text-[#111111]/60">Show this post on your public profile</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={shareToProfile}
              aria-label="Share to my profile"
              onClick={() => setShareToProfile(!shareToProfile)}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center transition-colors rounded-full ${
                shareToProfile ? "bg-[#E4572E]" : "bg-gray-200"
              }`}
            >
              <span
                className={`inline-block size-3.5 transform rounded-full bg-white shadow-xs transition-transform ${
                  shareToProfile ? "translate-x-[18px]" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>

        {/* 3. Horizontal line between Share to my profile and in the feed */}
        <div className="w-full border-t border-[#D4D4D4] my-1" />

        {/* SECTION 3: IN THE FEED */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs font-semibold text-[#111111]/50 tracking-wider uppercase">
            <span>IN THE FEED</span>
            <button
              type="button"
              onClick={() => setShowPreviewModal(true)}
              className="text-xs text-[#737373] hover:text-[#111111] transition-colors capitalize font-medium"
            >
              Preview
            </button>
          </div>

          {/* Figma Post preview card: Radius 16px, Width 240px, Height Hug 232px, Border 1px #111111 10%, bg-white */}
          <div
            onClick={() => setShowPreviewModal(true)}
            className="w-full rounded-[16px] border border-[#111111]/10 bg-white overflow-hidden shadow-none cursor-pointer group hover:border-[#111111]/30 transition-colors"
            title="Click to preview post"
          >
            <div className="h-[135px] w-full overflow-hidden bg-[#F5F5F5] flex items-center justify-center relative">
              {feedThumbnailUrl ? (
                <>
                  <img
                    src={feedThumbnailUrl}
                    alt="Feed preview"
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-[11px] font-semibold text-white bg-black/60 px-3 py-1 rounded-full backdrop-blur-sm">
                      Click to preview
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center gap-1 text-[#A3A3A3] group-hover:text-[#737373] transition-colors">
                  <svg
                    className="size-5 text-[#A3A3A3] group-hover:text-[#737373] transition-colors"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  <span className="text-xs font-medium">Cover photo</span>
                </div>
              )}
            </div>
            <div className="p-3.5 space-y-2">
              <h4 className="font-editorial text-[14px] font-medium leading-[1.3] text-[#111111] line-clamp-2">
                {title || "A fresh perspective on Paris street style"}
              </h4>
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <span className="size-5 rounded-full bg-[#E4572E] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                    {user?.handle ? user.handle.charAt(0).toUpperCase() : "P"}
                  </span>
                  <div className="flex items-center gap-1 text-[11px] text-[#111111]/60">
                    <svg
                      className="size-3 text-[#111111]/60"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span>1 min</span>
                  </div>
                </div>
                <svg
                  className="size-4 text-[#111111]/40 hover:text-[#111111] cursor-pointer transition-colors"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path
                    d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Full Preview Modal Overlay */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto bg-white p-6 sm:p-8 rounded-none border border-[#111111]/20 shadow-2xl">
            <button
              type="button"
              onClick={() => setShowPreviewModal(false)}
              className="absolute right-4 top-4 size-8 bg-[#F5F5F5] hover:bg-gray-200 flex items-center justify-center text-gray-600 text-sm font-semibold transition-colors rounded-none"
            >
              ✕
            </button>
            <div className="space-y-4">
              <span className="bg-[#E4572E]/10 px-3 py-1 text-xs font-semibold text-[#E4572E] rounded-none">
                Post Preview
              </span>
              <h2 className="font-editorial text-2xl sm:text-3xl font-bold text-[#111111]">
                {title || "Untitled Post"}
              </h2>
              {coverImageUrl && (
                <img
                  src={coverImageUrl}
                  alt="Cover"
                  className="max-h-80 w-full object-cover rounded-none border border-[#111111]/10"
                />
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                {hashtags.map((h) => (
                  <span
                    key={h}
                    className="bg-[#F5F5F5] px-3 py-1 text-xs font-medium text-gray-700 rounded-none border border-gray-200"
                  >
                    #{h}
                  </span>
                ))}
              </div>
              <div
                className="prose-editorial pt-4 text-gray-800 leading-relaxed font-ui"
                dangerouslySetInnerHTML={{ __html: editor?.getHTML() || "<p>No content yet.</p>" }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Editorial Toolbar matching Figma Dev Mode styling:
 * Paragraph dropdown (page bg #EFEFEF, no border), Bold, Italic, Underline, Link, Bullet list, Numbered list, Quote, Image.
 */
function FigmaEditorToolbar({
  editor,
  onImageClick,
}: {
  editor: ReturnType<typeof useEditor>;
  onImageClick: () => void;
}) {
  if (!editor) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 text-[#111111] text-xs font-medium">
      {/* Block Type Dropdown (matches page bg #EFEFEF, no border) */}
      <div className="relative inline-flex items-center">
        <select
          value={
            editor.isActive("heading", { level: 1 })
              ? "h1"
              : editor.isActive("heading", { level: 2 })
                ? "h2"
                : editor.isActive("heading", { level: 3 })
                  ? "h3"
                  : "p"
          }
          onChange={(e) => {
            const val = e.target.value;
            if (val === "p") editor.chain().focus().setParagraph().run();
            else if (val === "h1") editor.chain().focus().toggleHeading({ level: 1 }).run();
            else if (val === "h2") editor.chain().focus().toggleHeading({ level: 2 }).run();
            else if (val === "h3") editor.chain().focus().toggleHeading({ level: 3 }).run();
          }}
          className="appearance-none bg-[#EFEFEF] border-0 border-none text-xs sm:text-sm font-medium text-[#111111] pr-5 pl-1 py-1 focus:outline-none cursor-pointer"
        >
          <option value="p">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>
        <svg
          className="pointer-events-none absolute right-1 size-3 text-[#111111]/60"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </div>

      <span className="w-px h-4 bg-[#111111]/20 mx-1.5" />

      {/* Bold */}
      <button
        type="button"
        title="Bold"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`size-7 flex items-center justify-center font-bold text-xs transition-colors rounded-none ${
          editor.isActive("bold")
            ? "bg-[#E4572E] text-white"
            : "hover:bg-black/5 text-[#111111]"
        }`}
      >
        B
      </button>

      {/* Italic */}
      <button
        type="button"
        title="Italic"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`size-7 flex items-center justify-center italic font-serif text-sm transition-colors rounded-none ${
          editor.isActive("italic")
            ? "bg-[#E4572E] text-white"
            : "hover:bg-black/5 text-[#111111]"
        }`}
      >
        I
      </button>

      {/* Underline (matching Figma U with underline) */}
      <button
        type="button"
        title="Underline"
        onClick={() => editor.chain().focus().toggleMark("underline").run()}
        className={`size-7 flex items-center justify-center text-xs transition-colors rounded-none ${
          editor.isActive("underline")
            ? "bg-[#E4572E] text-white"
            : "hover:bg-black/5 text-[#111111]"
        }`}
      >
        <span className="underline font-semibold text-xs">U</span>
      </button>

      {/* Link */}
      <button
        type="button"
        title="Link"
        onClick={() => {
          const currentUrl = editor.getAttributes("link").href as string | undefined;
          const url = window.prompt("URL", currentUrl);
          if (url === null) return;
          if (url === "") {
            editor.chain().focus().unsetLink().run();
          } else {
            editor.chain().focus().setLink({ href: url }).run();
          }
        }}
        className={`size-7 flex items-center justify-center text-xs transition-colors rounded-none ${
          editor.isActive("link")
            ? "bg-[#E4572E] text-white"
            : "hover:bg-black/5 text-[#111111]"
        }`}
      >
        <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      </button>

      {/* Bullet List */}
      <button
        type="button"
        title="Bullet list"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`size-7 flex items-center justify-center text-xs transition-colors rounded-none ${
          editor.isActive("bulletList")
            ? "bg-[#E4572E] text-white"
            : "hover:bg-black/5 text-[#111111]"
        }`}
      >
        <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="9" y1="6" x2="20" y2="6" strokeLinecap="round" />
          <line x1="9" y1="12" x2="20" y2="12" strokeLinecap="round" />
          <line x1="9" y1="18" x2="20" y2="18" strokeLinecap="round" />
          <circle cx="4" cy="6" r="1.5" fill="currentColor" />
          <circle cx="4" cy="12" r="1.5" fill="currentColor" />
          <circle cx="4" cy="18" r="1.5" fill="currentColor" />
        </svg>
      </button>

      {/* Ordered List */}
      <button
        type="button"
        title="Numbered list"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`size-7 flex items-center justify-center text-xs transition-colors rounded-none ${
          editor.isActive("orderedList")
            ? "bg-[#E4572E] text-white"
            : "hover:bg-black/5 text-[#111111]"
        }`}
      >
        <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="10" y1="6" x2="20" y2="6" strokeLinecap="round" />
          <line x1="10" y1="12" x2="20" y2="12" strokeLinecap="round" />
          <line x1="10" y1="18" x2="20" y2="18" strokeLinecap="round" />
          <path d="M4 6h1v4" strokeLinecap="round" />
          <path d="M4 10h2" strokeLinecap="round" />
          <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" strokeLinecap="round" />
        </svg>
      </button>

      {/* Blockquote */}
      <button
        type="button"
        title="Quote"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={`size-7 flex items-center justify-center text-xs transition-colors rounded-none ${
          editor.isActive("blockquote")
            ? "bg-[#E4572E] text-white"
            : "hover:bg-black/5 text-[#111111]"
        }`}
      >
        <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
        </svg>
      </button>

      {/* Insert Image */}
      <button
        type="button"
        title="Insert image"
        onClick={onImageClick}
        className="size-7 hover:bg-black/5 text-[#111111] flex items-center justify-center transition-colors rounded-none"
      >
        <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      </button>
    </div>
  );
}
