import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MasonryFeed } from "../../components/MasonryFeed";
import { Button } from "../../components/Button";
import {
  getListBookmarkFoldersQueryKey,
  useCreateBookmarkFolder,
  useDeleteBookmarkFolder,
  useListBookmarkFolders,
  useListBookmarks,
} from "../../lib/api/generated/engagement/engagement";

export function BookmarksPage() {
  const [folderId, setFolderId] = useState<string | undefined>(undefined);
  const [newFolderName, setNewFolderName] = useState("");
  const [addingFolder, setAddingFolder] = useState(false);
  const queryClient = useQueryClient();

  const { data: folderData } = useListBookmarkFolders();
  const { data: bookmarks, isLoading } = useListBookmarks(
    folderId ? { folderId } : undefined,
  );

  function refreshFolders() {
    void queryClient.invalidateQueries({ queryKey: getListBookmarkFoldersQueryKey() });
  }

  const createFolder = useCreateBookmarkFolder({
    mutation: {
      onSuccess: () => {
        setNewFolderName("");
        setAddingFolder(false);
        refreshFolders();
      },
    },
  });
  const deleteFolder = useDeleteBookmarkFolder({
    mutation: {
      onSuccess: () => {
        setFolderId(undefined);
        refreshFolders();
      },
    },
  });

  return (
    <div className="px-4 py-8 sm:px-6">
      <p className="kicker mb-1">Bookmarks</p>
      <h1 className="font-display-serif text-3xl font-semibold">Your reading list</h1>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <FolderChip
          label={`All saved`}
          active={!folderId}
          onClick={() => setFolderId(undefined)}
        />
        {(folderData?.folders ?? []).map((folder) => (
          <span key={folder.id} className="group relative">
            <FolderChip
              label={`${folder.name} (${folder.count})`}
              active={folderId === folder.id}
              onClick={() => setFolderId(folder.id)}
            />
            <button
              type="button"
              aria-label={`Delete folder ${folder.name}`}
              onClick={() => deleteFolder.mutate({ id: folder.id })}
              className="absolute -right-1.5 -top-1.5 hidden size-4 items-center justify-center rounded-full bg-ink text-[10px] text-ink-inverse group-hover:flex"
            >
              ×
            </button>
          </span>
        ))}
        {addingFolder ? (
          <form
            className="flex items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (newFolderName.trim()) {
                createFolder.mutate({ data: { name: newFolderName.trim() } });
              }
            }}
          >
            <input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              maxLength={40}
              placeholder="Folder name"
              className="w-36 rounded-full border border-line bg-white px-3 py-1 text-xs focus:border-crimson focus:outline-none"
            />
            <Button type="submit" loading={createFolder.isPending} className="!px-3 !py-1 text-xs">
              Add
            </Button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAddingFolder(true)}
            className="rounded-full border border-dashed border-line px-3 py-1 text-xs font-medium text-ink-faint hover:border-ink-soft hover:text-ink-soft"
          >
            + New folder
          </button>
        )}
      </div>

      <div className="mt-6">
        <MasonryFeed
          posts={bookmarks ?? []}
          isLoading={isLoading}
          hasNextPage={false}
          isFetchingNextPage={false}
          fetchNextPage={() => undefined}
          emptyState={
            <div className="rounded-xl border border-dashed border-line p-12 text-center">
              <p className="font-display-serif text-2xl font-semibold">Nothing saved yet</p>
              <p className="mt-2 text-sm text-ink-soft">
                Tap the bookmark on any post to build your reading list.
              </p>
            </div>
          }
        />
      </div>
    </div>
  );
}

function FolderChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-gold bg-gold-tint text-gold"
          : "border-line bg-paper text-ink-soft hover:border-ink-soft"
      }`}
    >
      {label}
    </button>
  );
}
