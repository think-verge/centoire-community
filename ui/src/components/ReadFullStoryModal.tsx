import { useGetPostFullContent } from "../lib/api/generated/posts/posts";

interface ReadFullStoryModalProps {
  slug: string;
  title: string;
  externalUrl: string;
  onClose: () => void;
}

export function ReadFullStoryModal({ slug, title, externalUrl, onClose }: ReadFullStoryModalProps) {
  const { data, isLoading, error } = useGetPostFullContent(slug);
  const fallbackHostname = new URL(externalUrl).hostname.replace(/^www\./, "");
  const source = data?.source || fallbackHostname;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-line bg-paper p-6 shadow-card-hover overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="kicker mb-1">{source}</p>
            <h2 className="font-display-serif text-xl font-semibold leading-tight">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-xl leading-none text-ink-faint hover:text-ink"
          >
            ×
          </button>
        </div>

        <div className="mt-5">
          {isLoading ? (
            <div className="space-y-3">
              <div className="h-4 w-full animate-pulse rounded bg-cream" />
              <div className="h-4 w-11/12 animate-pulse rounded bg-cream" />
              <div className="h-4 w-4/5 animate-pulse rounded bg-cream" />
            </div>
          ) : error || !data?.contentHtml ? (
            <div className="rounded-xl border border-line bg-cream/40 p-6 text-center">
              <p className="text-ink-soft">We couldn't load the full article in-app.</p>
              <a
                href={externalUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block rounded-lg bg-crimson px-4 py-2 text-sm font-semibold text-ink-inverse hover:bg-crimson-deep"
              >
                Open original article ↗
              </a>
            </div>
          ) : (
            <>
              <div
                className="prose-editorial text-[17px] leading-relaxed"
                dangerouslySetInnerHTML={{ __html: data.contentHtml }}
              />
              <a
                href={externalUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-block text-sm font-semibold text-crimson hover:underline"
              >
                View original on {source} ↗
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
