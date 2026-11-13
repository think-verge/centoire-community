import { useState, useMemo, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { PostCard } from "../../components/PostCard";
import { PostDrawer } from "../../components/PostDrawer";
import { customInstance } from "../../lib/api/http";
import {
  getListBookmarkFoldersQueryKey,
  useCreateBookmarkFolder,
  useDeleteBookmarkFolder,
  useListBookmarkFolders,
  useListBookmarks,
} from "../../lib/api/generated/engagement/engagement";
import { BookmarkIcon, SearchIcon, ChevronDownIcon } from "../../components/nav/icons";

type FilterTab = "all" | "posts" | "circles" | "creators" | "jobs";
type SortOption = "recent" | "title" | "popular";

export function BookmarksPage() {
  const queryClient = useQueryClient();

  // Navigation & view states
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [visibleCount, setVisibleCount] = useState(12);

  // Modals and popovers
  const [newCollectionModalOpen, setNewCollectionModalOpen] = useState(false);
  const [collectionsDropdownOpen, setCollectionsDropdownOpen] = useState(false);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);

  // New collection modal form states
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionDesc, setNewCollectionDesc] = useState("");
  const [newCollectionPrivate, setNewCollectionPrivate] = useState(true);
  const [modalSearch, setModalSearch] = useState("");
  const [modalSelectedIds, setModalSelectedIds] = useState<Set<string>>(new Set());
  const [isSubmittingCollection, setIsSubmittingCollection] = useState(false);

  // References for dropdown click-outside
  const collectionsDropdownRef = useRef<HTMLDivElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        collectionsDropdownRef.current &&
        !collectionsDropdownRef.current.contains(e.target as Node)
      ) {
        setCollectionsDropdownOpen(false);
      }
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target as Node)) {
        setSortDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch folders and bookmarks
  const { data: folderData } = useListBookmarkFolders();
  const { data: rawBookmarks, isLoading: isLoadingBookmarks } = useListBookmarks(
    activeFolderId ? { folderId: activeFolderId } : undefined,
  );
  // Also fetch all bookmarks for thumbnail lookups and new collection modal picker
  const { data: allBookmarksRaw } = useListBookmarks(undefined);

  const folders = folderData?.folders ?? [];
  const activeFolder = useMemo(
    () => (activeFolderId ? folders.find((f) => f.id === activeFolderId) ?? null : null),
    [activeFolderId, folders],
  );

  const allBookmarks = allBookmarksRaw ?? [];
  const bookmarks = rawBookmarks ?? [];

  // Folder cover image lookup: use the cover image of the first post bookmarked in each folder
  const folderCovers = useMemo(() => {
    const map = new Map<string, string>();
    for (const post of allBookmarks) {
      // In Centoire, if post has a folderId or matches
      if (post.coverImageUrl) {
        // As a fallback / heuristic, match any available post
        if (!map.has("default")) map.set("default", post.coverImageUrl);
      }
    }
    return map;
  }, [allBookmarks]);

  // Refresh queries helper
  function refreshAll() {
    void queryClient.invalidateQueries({ queryKey: getListBookmarkFoldersQueryKey() });
    void queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/bookmarks"),
    });
  }

  // Folder mutations
  const createFolder = useCreateBookmarkFolder();
  const deleteFolder = useDeleteBookmarkFolder({
    mutation: {
      onSuccess: () => {
        setActiveFolderId(null);
        refreshAll();
      },
    },
  });

  // Handle creating new collection with items
  async function handleCreateCollection(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const trimmed = newCollectionName.trim();
    if (!trimmed || isSubmittingCollection) return;

    setIsSubmittingCollection(true);
    try {
      const created = await createFolder.mutateAsync({ data: { name: trimmed } });
      const newFolderId = created.id;

      // Assign selected items to this folder if any were picked
      if (modalSelectedIds.size > 0 && newFolderId) {
        const promises = Array.from(modalSelectedIds).map((postId) =>
          customInstance({
            url: `/posts/${postId}/bookmark`,
            method: "POST",
            data: { folderId: newFolderId },
          }),
        );
        await Promise.allSettled(promises);
      }

      // Reset modal state
      setNewCollectionName("");
      setNewCollectionDesc("");
      setModalSelectedIds(new Set());
      setModalSearch("");
      setNewCollectionModalOpen(false);

      // Refresh data and navigate into the newly created collection
      refreshAll();
      if (newFolderId) {
        setActiveFolderId(newFolderId);
      }
    } catch {
      // Ignore or let user retry
    } finally {
      setIsSubmittingCollection(false);
    }
  }

  // Filter & Search bookmarks
  const filteredBookmarks = useMemo(() => {
    let list = [...bookmarks];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((p) => {
        const title = (p.title ?? "").toLowerCase();
        const excerpt = (p.excerpt ?? "").toLowerCase();
        const author = (p.author?.displayName ?? "").toLowerCase();
        const source = (p.source?.name ?? "").toLowerCase();
        const tags = (p.hashtags ?? []).map((t) => t.toLowerCase()).join(" ");
        return (
          title.includes(q) ||
          excerpt.includes(q) ||
          author.includes(q) ||
          source.includes(q) ||
          tags.includes(q)
        );
      });
    }

    // Tab filter
    if (activeTab === "posts") {
      // In MVP all saved items are posts
      list = list.filter((p) => !p.source?.name?.toLowerCase().includes("circle"));
    } else if (activeTab === "circles" || activeTab === "creators" || activeTab === "jobs") {
      // Empty mock categories matching Figma pill counts
      list = [];
    }

    // Sort order
    if (sortBy === "title") {
      list.sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));
    } else if (sortBy === "popular") {
      list.sort((a, b) => (b.upvoteCount ?? 0) - (a.upvoteCount ?? 0));
    } else {
      // recent: default API order
    }

    return list;
  }, [bookmarks, searchQuery, activeTab, sortBy]);

  // Modal selectable bookmarks filtered by modalSearch
  const modalBookmarksList = useMemo(() => {
    if (!modalSearch.trim()) return allBookmarks;
    const q = modalSearch.toLowerCase().trim();
    return allBookmarks.filter((p) => {
      const title = (p.title ?? "").toLowerCase();
      const author = (p.author?.displayName ?? "").toLowerCase();
      return title.includes(q) || author.includes(q);
    });
  }, [allBookmarks, modalSearch]);

  const totalBookmarksCount = allBookmarks.length;

  return (
    <div className="w-full min-h-[calc(100vh-3.5rem)] bg-[#FBF9F6]">
      {/* 940px Framed Workspace matching Figma Bookmark library (node 1637-3951) */}
      <div className="mx-auto w-full max-w-[940px] border-x border-[#111111]/10 bg-white/40 px-4 py-7 sm:px-6 min-h-[calc(100vh-3.5rem)] flex flex-col justify-between">
        <div>
          {/* ── HEADER SECTION ────────────────────────────────────────────── */}
          {!activeFolder ? (
            <div className="mb-7 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h1 className="font-editorial text-[32px] sm:text-[36px] font-bold text-[#111111] leading-tight tracking-tight">
                  Bookmarks
                </h1>
                <p className="mt-1 font-ui text-sm text-[#111111]/70">
                  Your saved stories, posts, and opportunities. All in one place.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setModalSelectedIds(new Set());
                  setNewCollectionModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 self-start rounded-full bg-[#E4572E] px-4 py-2 font-ui text-xs font-semibold text-white shadow-xs hover:bg-[#d04b24] transition-all cursor-pointer shrink-0"
              >
                <span className="text-sm leading-none">+</span>
                <span>New collection</span>
              </button>
            </div>
          ) : (
            <div className="mb-7">
              {/* Collection Detail Breadcrumbs & Header */}
              <button
                type="button"
                onClick={() => {
                  setActiveFolderId(null);
                  setSearchQuery("");
                }}
                className="mb-3 flex items-center gap-1.5 font-ui text-xs font-medium text-[#737373] hover:text-[#111111] transition-colors cursor-pointer"
              >
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
                <span>Back to all bookmarks</span>
              </button>

              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <h1 className="font-editorial text-[32px] font-bold text-[#111111] leading-tight">
                    {activeFolder.name}
                  </h1>
                  <p className="mt-1 font-ui text-sm text-[#737373]">
                    {activeFolder.count} saved posts · Your personal edit
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Delete collection "${activeFolder.name}"? Saved posts will remain in All Bookmarks.`)) {
                        deleteFolder.mutate({ id: activeFolder.id });
                      }
                    }}
                    disabled={deleteFolder.isPending}
                    className="flex items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white px-3.5 py-1.5 font-ui text-xs font-medium text-[#737373] hover:border-red-300 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                  >
                    <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Delete collection</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── "YOUR COLLECTIONS" HORIZONTAL STRIP (Shown on main view) ─── */}
          {!activeFolder && (
            <div className="mb-7">
              <p className="mb-3 font-ui text-[11px] font-bold uppercase tracking-wider text-[#111111]/60">
                YOUR COLLECTIONS
              </p>

              <div className="flex items-center gap-3.5 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4 sm:-mx-6 sm:px-6">
                {/* Default "All Bookmarks" card */}
                <div
                  onClick={() => setActiveFolderId(null)}
                  className="group relative flex min-w-[210px] max-w-[250px] flex-1 items-center gap-3 rounded-2xl border border-[#E5E5E5] bg-white p-3 shadow-2xs hover:border-[#111111]/30 hover:shadow-xs transition-all cursor-pointer shrink-0"
                >
                  <div className="size-14 rounded-xl bg-[#F2EDE4] shrink-0 border border-black/5 flex items-center justify-center text-[#E4572E]">
                    <BookmarkIcon className="size-6 text-[#E4572E]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-ui text-[14px] font-semibold text-[#111111] group-hover:text-[#E4572E] transition-colors">
                      All saved
                    </p>
                    <p className="mt-0.5 font-ui text-xs text-[#737373]">
                      {totalBookmarksCount} saved
                    </p>
                  </div>
                </div>

                {/* Individual Collection Cards */}
                {folders.map((folder) => {
                  const cover = folderCovers.get("default");
                  return (
                    <div
                      key={folder.id}
                      onClick={() => setActiveFolderId(folder.id)}
                      className="group relative flex min-w-[210px] max-w-[250px] flex-1 items-center gap-3 rounded-2xl border border-[#E5E5E5] bg-white p-3 shadow-2xs hover:border-[#111111]/30 hover:shadow-xs transition-all cursor-pointer shrink-0"
                    >
                      {cover ? (
                        <img
                          src={cover}
                          alt={folder.name}
                          className="size-14 rounded-xl object-cover bg-[#F2EDE4] shrink-0 border border-black/5"
                        />
                      ) : (
                        <div className="size-14 rounded-xl bg-[#F2EDE4] shrink-0 border border-black/5 flex items-center justify-center text-[#111111]/50 group-hover:text-[#E4572E] transition-colors">
                          <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-ui text-[14px] font-semibold text-[#111111] group-hover:text-[#E4572E] transition-colors">
                          {folder.name}
                        </p>
                        <p className="mt-0.5 font-ui text-xs text-[#737373]">
                          {folder.count} saved
                        </p>
                      </div>

                      {/* Quick delete button */}
                      <button
                        type="button"
                        aria-label={`Delete collection ${folder.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Delete collection "${folder.name}"?`)) {
                            deleteFolder.mutate({ id: folder.id });
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 absolute top-2 right-2 size-5 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-[#737373] hover:text-[#111111] text-xs transition-opacity"
                        title="Delete folder"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}

                {/* "+ New collection" quick trigger button card */}
                <button
                  type="button"
                  onClick={() => {
                    setModalSelectedIds(new Set());
                    setNewCollectionModalOpen(true);
                  }}
                  className="flex items-center gap-2.5 min-w-[170px] rounded-2xl border border-dashed border-[#C4C4C4] bg-white/50 p-3 hover:border-[#E4572E] hover:bg-white text-[#737373] hover:text-[#E4572E] text-xs font-ui font-semibold transition-all shrink-0 cursor-pointer"
                >
                  <span className="flex size-7 items-center justify-center rounded-full bg-black/5 font-bold text-sm">
                    +
                  </span>
                  <span>New collection</span>
                </button>
              </div>
            </div>
          )}

          {/* ── PILL TABS & DROPDOWN ROW ─────────────────────────────────── */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            {/* Pill tabs */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`font-ui text-xs font-semibold px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                  activeTab === "all"
                    ? "bg-[#111111] text-white shadow-xs"
                    : "border border-[#E5E5E5] bg-white text-[#111111]/70 hover:border-[#111111]/30"
                }`}
              >
                ALL {bookmarks.length}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("posts")}
                className={`font-ui text-xs font-semibold px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                  activeTab === "posts"
                    ? "bg-[#111111] text-white shadow-xs"
                    : "border border-[#E5E5E5] bg-white text-[#111111]/70 hover:border-[#111111]/30"
                }`}
              >
                POSTS {bookmarks.length}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("circles")}
                className={`font-ui text-xs font-semibold px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                  activeTab === "circles"
                    ? "bg-[#111111] text-white shadow-xs"
                    : "border border-[#E5E5E5] bg-white text-[#111111]/70 hover:border-[#111111]/30"
                }`}
              >
                CIRCLES 0
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("creators")}
                className={`font-ui text-xs font-semibold px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                  activeTab === "creators"
                    ? "bg-[#111111] text-white shadow-xs"
                    : "border border-[#E5E5E5] bg-white text-[#111111]/70 hover:border-[#111111]/30"
                }`}
              >
                CREATORS 0
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("jobs")}
                className={`font-ui text-xs font-semibold px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                  activeTab === "jobs"
                    ? "bg-[#111111] text-white shadow-xs"
                    : "border border-[#E5E5E5] bg-white text-[#111111]/70 hover:border-[#111111]/30"
                }`}
              >
                JOBS 0
              </button>
            </div>

            {/* Right side dropdown (Collections selector or Sort selector) */}
            {!activeFolder ? (
              <div className="relative" ref={collectionsDropdownRef}>
                <button
                  type="button"
                  onClick={() => setCollectionsDropdownOpen((o) => !o)}
                  className="flex items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white px-3.5 py-1.5 font-ui text-xs font-semibold text-[#111111] hover:border-[#111111]/30 shadow-2xs transition-all cursor-pointer"
                >
                  <span className="uppercase tracking-wide">ALL COLLECTIONS</span>
                  <ChevronDownIcon className="size-3 text-[#737373]" />
                </button>

                {collectionsDropdownOpen && (
                  <div className="absolute right-0 top-full z-40 mt-1 w-52 rounded-2xl border border-[#E5E5E5] bg-white py-1.5 shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveFolderId(null);
                        setCollectionsDropdownOpen(false);
                      }}
                      className="flex w-full items-center justify-between px-4 py-2 font-ui text-xs font-semibold text-[#111111] hover:bg-black/5 cursor-pointer text-left"
                    >
                      <span>All bookmarks</span>
                      <span className="text-[#737373] font-normal">{totalBookmarksCount}</span>
                    </button>

                    {folders.length > 0 && <div className="my-1 border-t border-[#E5E5E5]" />}

                    {folders.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          setActiveFolderId(f.id);
                          setCollectionsDropdownOpen(false);
                        }}
                        className="flex w-full items-center justify-between px-4 py-2 font-ui text-xs text-[#111111] hover:bg-black/5 cursor-pointer text-left"
                      >
                        <span className="truncate">{f.name}</span>
                        <span className="text-[#737373] ml-2 font-mono text-[11px]">{f.count}</span>
                      </button>
                    ))}

                    <div className="my-1 border-t border-[#E5E5E5]" />

                    <button
                      type="button"
                      onClick={() => {
                        setCollectionsDropdownOpen(false);
                        setNewCollectionModalOpen(true);
                      }}
                      className="block w-full px-4 py-2 text-left font-ui text-xs font-semibold text-[#E4572E] hover:bg-[#E4572E]/5 cursor-pointer"
                    >
                      + New collection
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative" ref={sortDropdownRef}>
                <button
                  type="button"
                  onClick={() => setSortDropdownOpen((o) => !o)}
                  className="flex items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white px-3.5 py-1.5 font-ui text-xs font-semibold text-[#111111] hover:border-[#111111]/30 shadow-2xs transition-all cursor-pointer"
                >
                  <span className="uppercase tracking-wide">
                    {sortBy === "recent"
                      ? "RECENTLY SAVED"
                      : sortBy === "title"
                      ? "TITLE (A-Z)"
                      : "MOST UPVOTED"}
                  </span>
                  <ChevronDownIcon className="size-3 text-[#737373]" />
                </button>

                {sortDropdownOpen && (
                  <div className="absolute right-0 top-full z-40 mt-1 w-44 rounded-2xl border border-[#E5E5E5] bg-white py-1.5 shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setSortBy("recent");
                        setSortDropdownOpen(false);
                      }}
                      className={`block w-full px-4 py-2 text-left font-ui text-xs cursor-pointer ${
                        sortBy === "recent" ? "font-semibold text-[#E4572E]" : "text-[#111111] hover:bg-black/5"
                      }`}
                    >
                      Recently saved
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSortBy("title");
                        setSortDropdownOpen(false);
                      }}
                      className={`block w-full px-4 py-2 text-left font-ui text-xs cursor-pointer ${
                        sortBy === "title" ? "font-semibold text-[#E4572E]" : "text-[#111111] hover:bg-black/5"
                      }`}
                    >
                      Title (A–Z)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSortBy("popular");
                        setSortDropdownOpen(false);
                      }}
                      className={`block w-full px-4 py-2 text-left font-ui text-xs cursor-pointer ${
                        sortBy === "popular" ? "font-semibold text-[#E4572E]" : "text-[#111111] hover:bg-black/5"
                      }`}
                    >
                      Most upvoted
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── SEARCH BAR ──────────────────────────────────────────────── */}
          <div className="relative mb-6">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[#737373]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeFolder
                  ? `Search in ${activeFolder.name}...`
                  : "Search your bookmarks..."
              }
              className="w-full rounded-full border border-[#E5E5E5] bg-white pl-11 pr-10 py-2.5 font-ui text-sm text-[#111111] placeholder:text-[#737373] shadow-2xs focus:border-[#E4572E] focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 size-5 rounded-full bg-black/5 flex items-center justify-center text-xs text-[#737373] hover:text-[#111111]"
              >
                ×
              </button>
            )}
          </div>

          {/* ── SECTION KICKER ──────────────────────────────────────────── */}
          <div className="mb-3 flex items-center justify-between">
            <p className="font-ui text-xs font-bold uppercase tracking-wider text-[#111111]">
              {searchQuery.trim()
                ? `RESULTS FOR "${searchQuery}" (${filteredBookmarks.length})`
                : "SOURCES"}
            </p>
            {!searchQuery.trim() && (
              <button
                type="button"
                onClick={() => {
                  setActiveFolderId(null);
                  setActiveTab("all");
                }}
                className="font-ui text-xs font-medium text-[#737373] hover:text-[#111111] transition-colors cursor-pointer"
              >
                View all
              </button>
            )}
          </div>

          {/* ── 3-COLUMN POST CARDS GRID ─────────────────────────────────── */}
          {isLoadingBookmarks ? (
            <div
              className="grid gap-6 px-3 -mx-3 py-3 -my-3"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-2xl bg-black/5 h-80" />
              ))}
            </div>
          ) : filteredBookmarks.length > 0 ? (
            <div
              className="grid gap-6 px-3 -mx-3 py-3 -my-3"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}
            >
              {filteredBookmarks.slice(0, visibleCount).map((post, idx) => (
                <PostCard
                  key={post.id}
                  post={post}
                  position={idx}
                  onOpenPost={(p) => setSelectedSlug(p.slug)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#E5E5E5] bg-white p-12 text-center my-6">
              <div className="mx-auto size-12 rounded-full bg-[#E4572E]/10 flex items-center justify-center text-[#E4572E] mb-3">
                <BookmarkIcon className="size-6 text-[#E4572E]" />
              </div>
              <p className="font-editorial text-2xl font-bold text-[#111111]">
                {searchQuery.trim() ? "No matching bookmarks" : "Nothing saved yet"}
              </p>
              <p className="mx-auto mt-2 max-w-md font-ui text-sm text-[#737373]">
                {searchQuery.trim()
                  ? "Try searching for a different topic, author, or keyword."
                  : activeFolder
                  ? `No posts have been added to "${activeFolder.name}" yet. Save stories from your feed or add them using + New collection.`
                  : "Tap the bookmark icon on any post in your feed to save it here for later reading."}
              </p>
              {searchQuery.trim() ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="mt-5 inline-flex items-center rounded-full bg-[#111111] px-4 py-2 font-ui text-xs font-semibold text-white hover:bg-black/80 transition-all cursor-pointer"
                >
                  Clear search
                </button>
              ) : (
                <Link
                  to="/feed"
                  className="mt-5 inline-flex items-center rounded-full bg-[#E4572E] px-5 py-2 font-ui text-xs font-semibold text-white hover:bg-[#d04b24] transition-all"
                >
                  Explore Feed
                </Link>
              )}
            </div>
          )}
        </div>

        {/* ── PAGINATION & FOOTER SECTION (Screenshot 9) ────────────────── */}
        {filteredBookmarks.length > 0 && (
          <div className="mt-12 pt-8 border-t border-[#E5E5E5]/70 flex flex-col items-center gap-4 text-center">
            <p className="font-ui text-xs text-[#737373]">
              Showing {Math.min(visibleCount, filteredBookmarks.length)} of{" "}
              {filteredBookmarks.length} bookmarks
            </p>

            {visibleCount < filteredBookmarks.length && (
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + 12)}
                className="flex items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white px-5 py-2 font-ui text-xs font-semibold text-[#111111] hover:border-[#111111]/30 hover:bg-[#F8F8F8] transition-all shadow-2xs cursor-pointer"
              >
                <span>Load more bookmarks</span>
                <ChevronDownIcon className="size-3 text-[#737373]" />
              </button>
            )}

            <p className="mt-2 font-ui text-xs text-[#737373]/80 italic">
              Only you can see your saved posts.
            </p>

            <div className="mt-1 flex items-center gap-4 font-ui text-[11px] font-medium text-[#8c8882]">
              <Link to="/discover" className="hover:text-[#111111] transition-colors">
                ABOUT
              </Link>
              <span>·</span>
              <Link to="/support" className="hover:text-[#111111] transition-colors">
                CONTACT
              </Link>
              <span>·</span>
              <a href="#privacy" className="hover:text-[#111111] transition-colors">
                PRIVACY
              </a>
            </div>
          </div>
        )}
      </div>

      {/* ── "NEW COLLECTION" MODAL (Screenshot 10 View B) ──────────────── */}
      {newCollectionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-xl rounded-3xl border border-[#E5E5E5] bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="border-b border-[#E5E5E5] p-6 pb-4">
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  onClick={() => setNewCollectionModalOpen(false)}
                  className="flex items-center gap-1 font-ui text-xs font-medium text-[#737373] hover:text-[#111111] transition-colors cursor-pointer"
                >
                  <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                  <span>Back to Bookmarks</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewCollectionModalOpen(false)}
                  className="size-7 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-sm font-bold text-[#737373] hover:text-[#111111] transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <h2 className="font-editorial text-2xl font-bold text-[#111111]">
                New collection
              </h2>
              <p className="mt-0.5 font-ui text-xs text-[#737373]">
                A place for the stories, posts, and opportunities that inspire you.
              </p>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateCollection} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* COLLECTION DETAILS */}
              <div>
                <p className="mb-3 font-ui text-[11px] font-bold uppercase tracking-wider text-[#111111]/70">
                  COLLECTION DETAILS
                </p>

                <div className="space-y-3.5">
                  <div>
                    <label className="block font-ui text-xs font-semibold text-[#111111] mb-1">
                      Collection name <span className="text-[#E4572E]">*</span>
                    </label>
                    <input
                      autoFocus
                      required
                      maxLength={40}
                      value={newCollectionName}
                      onChange={(e) => setNewCollectionName(e.target.value)}
                      placeholder="e.g. Modern wardrobe, Runway inspiration..."
                      className="w-full rounded-xl border border-[#E5E5E5] bg-white px-3.5 py-2 font-ui text-sm text-[#111111] focus:border-[#E4572E] focus:outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block font-ui text-xs font-semibold text-[#111111] mb-1">
                      Description <span className="text-[#737373] font-normal">(optional)</span>
                    </label>
                    <textarea
                      rows={2}
                      value={newCollectionDesc}
                      onChange={(e) => setNewCollectionDesc(e.target.value)}
                      placeholder="Fresh perspectives on minimalist fashion and timeless silhouettes."
                      className="w-full rounded-xl border border-[#E5E5E5] bg-white px-3.5 py-2 font-ui text-sm text-[#111111] focus:border-[#E4572E] focus:outline-none transition-colors resize-none"
                    />
                  </div>

                  <label className="flex items-center gap-2.5 font-ui text-xs text-[#111111] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={newCollectionPrivate}
                      onChange={(e) => setNewCollectionPrivate(e.target.checked)}
                      className="size-4 rounded text-[#E4572E] focus:ring-[#E4572E] border-[#E5E5E5]"
                    />
                    <span>Private collection. Only you can view this.</span>
                  </label>
                </div>
              </div>

              {/* ADD SAVED ITEMS */}
              <div>
                <p className="font-ui text-[11px] font-bold uppercase tracking-wider text-[#111111]/70 mb-1">
                  ADD SAVED ITEMS
                </p>
                <p className="font-ui text-xs text-[#737373] mb-3">
                  Choose items to add to this collection (optional)
                </p>

                {/* Modal Search */}
                <div className="relative mb-3">
                  <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 text-[#737373]" />
                  <input
                    type="search"
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    placeholder="Search your bookmarks..."
                    className="w-full rounded-xl border border-[#E5E5E5] bg-white pl-9 pr-3 py-1.5 font-ui text-xs text-[#111111] placeholder:text-[#737373] focus:border-[#E4572E] focus:outline-none"
                  />
                </div>

                {/* Selectable Items List */}
                <div className="max-h-56 overflow-y-auto rounded-2xl border border-[#E5E5E5] bg-white divide-y divide-[#E5E5E5]">
                  {modalBookmarksList.length > 0 ? (
                    modalBookmarksList.map((post) => {
                      const isSelected = modalSelectedIds.has(post.id);
                      return (
                        <div
                          key={post.id}
                          onClick={() => {
                            setModalSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(post.id)) next.delete(post.id);
                              else next.add(post.id);
                              return next;
                            });
                          }}
                          className={`flex items-center gap-3 p-3 transition-colors cursor-pointer select-none ${
                            isSelected ? "bg-[#E4572E]/5" : "hover:bg-black/5"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            className="size-4 rounded text-[#E4572E] focus:ring-[#E4572E] border-[#E5E5E5] pointer-events-none"
                          />

                          {post.coverImageUrl ? (
                            <img
                              src={post.coverImageUrl}
                              alt=""
                              className="size-11 rounded-lg object-cover bg-black/5 shrink-0"
                            />
                          ) : (
                            <div className="size-11 rounded-lg bg-[#F2EDE4] flex items-center justify-center shrink-0 text-xs font-bold text-[#E4572E]">
                              {post.title?.charAt(0) ?? "C"}
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <p className="truncate font-ui text-xs font-semibold text-[#111111]">
                              {post.title}
                            </p>
                            <p className="truncate font-ui text-[11px] text-[#737373] mt-0.5">
                              {post.source?.name ?? post.author?.displayName ?? "Centoire"} · {post.readTimeMinutes ?? 3} min read
                            </p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-6 text-center font-ui text-xs text-[#737373]">
                      No saved items found.
                    </div>
                  )}
                </div>
              </div>
            </form>

            {/* Modal Footer */}
            <div className="border-t border-[#E5E5E5] bg-[#FAF8F5] p-4 sm:px-6 flex items-center justify-between">
              <span className="font-ui text-xs font-medium text-[#737373]">
                {modalSelectedIds.size} {modalSelectedIds.size === 1 ? "item" : "items"} selected
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setNewCollectionModalOpen(false)}
                  className="rounded-full px-4 py-2 font-ui text-xs font-medium text-[#737373] hover:text-[#111111] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!newCollectionName.trim() || isSubmittingCollection}
                  onClick={() => void handleCreateCollection()}
                  className="rounded-full bg-[#E4572E] px-5 py-2 font-ui text-xs font-semibold text-white shadow-xs hover:bg-[#d04b24] transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingCollection ? "Creating..." : "Create collection"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── POST DETAIL DRAWER (Same as FeedPage) ───────────────────────── */}
      {selectedSlug && (
        <PostDrawer slug={selectedSlug} onClose={() => setSelectedSlug(null)} />
      )}
    </div>
  );
}
