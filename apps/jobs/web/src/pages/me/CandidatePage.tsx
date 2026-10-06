import { Link, useParams } from "react-router-dom";
import { useGetCandidate } from "../../lib/api/generated/candidates/candidates";
import { Avatar } from "../../components/Avatar";
import { EmptyState, ErrorNotice, Spinner } from "../../components/Feedback";
import { formatDate, httpStatus, prettify } from "../../lib/format";
import { card, h2, pageWrap, pillMeta } from "../../lib/styles";
import { useDocumentTitle } from "../../lib/useDocumentTitle";

export function CandidatePage() {
  const { handle = "" } = useParams();
  const { data: profile, isLoading, error } = useGetCandidate(handle);
  useDocumentTitle(profile?.user?.displayName ?? "Candidate");

  if (isLoading) return <Spinner />;
  if (error || !profile) {
    const status = httpStatus(error);
    return (
      <div className={`${pageWrap} max-w-[700px]`}>
        {status === 403 ? (
          <EmptyState title="This profile is not visible" body="The candidate has chosen not to share their profile with you." />
        ) : status === 404 ? (
          <EmptyState title="Candidate not found" />
        ) : (
          <ErrorNotice error={error} />
        )}
      </div>
    );
  }
  const name = profile.user?.displayName ?? handle;

  return (
    <div className={`${pageWrap} max-w-[800px] space-y-6`}>
      <header className={`${card} flex items-center gap-5 p-6`}>
        <Avatar name={name} url={profile.user?.avatarUrl} size={72} />
        <div className="min-w-0 flex-1">
          <h1 className="font-editorial text-[28px] font-bold text-[var(--color-charcoal)]">{name}</h1>
          {profile.headline && <p className="font-ui text-[14px] text-[var(--color-stone)]">{profile.headline}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            {profile.location && <span className={pillMeta}>{profile.location}</span>}
            {profile.openToWork && <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 font-ui text-[12px] font-semibold text-emerald-800">Open to work</span>}
          </div>
        </div>
      </header>

      {profile.skills.length > 0 && (
        <section className={`${card} p-6`}>
          <h2 className={h2}>Skills</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {profile.skills.map((s) => (
              <li key={s} className="rounded-full bg-[var(--color-blush)]/60 px-3 py-1 font-ui text-[12px] font-semibold">
                {s}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(profile.desiredFunctions.length > 0 || profile.workplacePrefs.length > 0 || profile.desiredLocations.length > 0) && (
        <section className={`${card} p-6`}>
          <h2 className={h2}>Looking for</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {[...profile.desiredFunctions.map(prettify), ...profile.workplacePrefs.map(prettify), ...profile.desiredLocations].map((t) => (
              <span key={t} className={pillMeta}>
                {t}
              </span>
            ))}
          </div>
        </section>
      )}

      {profile.experience.length > 0 && (
        <section className={`${card} p-6`}>
          <h2 className={h2}>Experience</h2>
          <ul className="mt-4 space-y-5">
            {profile.experience.map((x, i) => (
              <li key={i}>
                <p className="font-ui text-[14px] font-semibold text-[var(--color-charcoal)]">{x.title}</p>
                <p className="font-ui text-[13px] text-[var(--color-stone)]">
                  {x.companyName} · {x.start ? formatDate(`${x.start}-01`) : ""} – {x.end ? formatDate(`${x.end}-01`) : "Present"}
                </p>
                {x.description && <p className="mt-1 whitespace-pre-wrap font-ui text-[13px] text-[var(--color-charcoal)]">{x.description}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {profile.education.length > 0 && (
        <section className={`${card} p-6`}>
          <h2 className={h2}>Education</h2>
          <ul className="mt-4 space-y-3">
            {profile.education.map((x, i) => (
              <li key={i}>
                <p className="font-ui text-[14px] font-semibold text-[var(--color-charcoal)]">{x.school}</p>
                <p className="font-ui text-[13px] text-[var(--color-stone)]">{[x.degree, x.start && x.end ? `${x.start.slice(0, 4)}–${x.end.slice(0, 4)}` : null].filter(Boolean).join(" · ")}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(profile.portfolioUrl || profile.links.length > 0) && (
        <section className={`${card} p-6`}>
          <h2 className={h2}>Portfolio and links</h2>
          <ul className="mt-3 space-y-1">
            {[...(profile.portfolioUrl ? [profile.portfolioUrl] : []), ...profile.links].map((l) => (
              <li key={l}>
                <a href={l} target="_blank" rel="noopener noreferrer nofollow" className="break-all font-ui text-[13px] text-[var(--color-coral)] hover:underline">
                  {l}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-center font-ui text-[12px] text-[var(--color-taupe)]">
        <Link to="/" className="hover:underline">
          Back to jobs
        </Link>
      </p>
    </div>
  );
}
