import { useGetHealth } from "../../lib/api/generated/health/health";

export function HealthPage() {
  const { data, isLoading, error } = useGetHealth();

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream">
      <div className="max-w-md rounded-xl border border-line bg-paper p-10 text-center shadow-card">
        <p className="kicker mb-3">Scaffold check</p>
        <h1 className="font-display-serif text-4xl font-semibold">Centoire</h1>
        <p className="mt-4 text-ink-soft">
          {isLoading && "Checking API…"}
          {error && `API unreachable: ${error.message}`}
          {data && `API ${data.status} — up ${data.uptimeSeconds}s`}
        </p>
      </div>
    </main>
  );
}
