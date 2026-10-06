import { useListSavedJobs } from "../../lib/api/generated/jobs/jobs";
import { EmptyState, ErrorNotice, ListSkeleton } from "../../components/Feedback";
import { JobCard } from "../../components/JobCard";
import { h1, muted, pageWrap } from "../../lib/styles";
import { useDocumentTitle } from "../../lib/useDocumentTitle";

export function SavedPage() {
  useDocumentTitle("Saved jobs");
  const { data, isLoading, error } = useListSavedJobs();
  return (
    <div className={pageWrap}>
      <h1 className={h1}>Saved jobs</h1>
      <p className={`${muted} mb-6 mt-1`}>Roles you bookmarked to come back to.</p>
      {isLoading && <ListSkeleton />}
      <ErrorNotice error={error} />
      {data && data.length === 0 && <EmptyState title="Nothing saved yet" body="Tap the bookmark on any job to keep it here." action={{ to: "/", label: "Browse jobs" }} />}
      <div className="space-y-3">
        {data?.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>
    </div>
  );
}
