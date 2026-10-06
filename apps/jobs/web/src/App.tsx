import { Link, Route, Routes, useLocation } from "react-router-dom";
import { AppFrame, HomeIcon } from "@centoire/ui";
import { hasPermission } from "@centoire/contracts";
import { useSession } from "@centoire/web-platform";
import { MobileNav } from "./components/MobileNav";
import { NotificationBell } from "./components/NotificationBell";
import { RequireAuth, RequirePermission } from "./components/RequireAuth";
import { UserMenu } from "./components/UserMenu";
import { useListMyCompanies } from "./lib/api/generated/companies/companies";
import { CORE_URL } from "./lib/env";
import { buildNav } from "./lib/nav";
import { BrowsePage } from "./pages/browse/BrowsePage";
import { JobDetailPage } from "./pages/jobs/JobDetailPage";
import { CompanyPage } from "./pages/companies/CompanyPage";
import { SavedPage } from "./pages/me/SavedPage";
import { MyApplicationsPage } from "./pages/me/MyApplicationsPage";
import { MyApplicationPage } from "./pages/me/MyApplicationPage";
import { ProfilePage } from "./pages/me/ProfilePage";
import { CandidatePage } from "./pages/me/CandidatePage";
import { EmployerDashboardPage } from "./pages/employer/EmployerDashboardPage";
import { CompanyNewPage } from "./pages/employer/CompanyNewPage";
import { CompanySettingsPage } from "./pages/employer/CompanySettingsPage";
import { JobFormPage } from "./pages/employer/JobFormPage";
import { ApplicantsPage } from "./pages/employer/ApplicantsPage";
import { ApplicantDetailPage } from "./pages/employer/ApplicantDetailPage";
import { ReviewQueuePage } from "./pages/admin/ReviewQueuePage";
import { AdminCompaniesPage } from "./pages/admin/AdminCompaniesPage";

function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="font-editorial text-[34px] font-bold italic text-[var(--color-charcoal)]">Page not found</h1>
      <p className="mt-2 font-ui text-[14px] text-[var(--color-stone)]">That page does not exist.</p>
      <Link to="/" className="mt-5 inline-block font-ui text-[13px] font-bold uppercase tracking-wider text-[var(--color-coral)]">
        Browse jobs
      </Link>
    </div>
  );
}

export default function App() {
  const { user } = useSession();
  const { pathname } = useLocation();
  const companies = useListMyCompanies({ query: { enabled: Boolean(user) } });

  const moderator = Boolean(user && hasPermission(user.role, "jobs.moderate"));
  const companyAdmin = Boolean(user && hasPermission(user.role, "company.verify"));
  const employer = Boolean(user && (user.role === "admin" || user.role === "editor" || (companies.data?.length ?? 0) > 0));

  const nav = buildNav({ employer, moderator, companyAdmin });

  return (
    <AppFrame
      appName="Jobs"
      homeHref="/"
      nav={nav.map((n) => ({ ...n, active: n.match(pathname) }))}
      topbarRight={
        <>
          <a href={CORE_URL} className="hidden items-center gap-1 px-2 font-ui text-[12px] font-bold uppercase tracking-wider text-[var(--color-stone)] hover:text-[var(--color-charcoal)] lg:flex">
            <HomeIcon className="size-4" /> Centoire
          </a>
          {user && <NotificationBell />}
          <UserMenu />
        </>
      }
      renderLink={({ href, className, children }) => (
        <Link to={href} className={className}>
          {children}
        </Link>
      )}
    >
      <div className="pb-20 md:pb-0">
        <Routes>
          <Route path="/" element={<BrowsePage />} />
          <Route path="/jobs/:id/:slug?" element={<JobDetailPage />} />
          <Route path="/companies/:slug" element={<CompanyPage />} />
          <Route path="/candidates/:handle" element={<CandidatePage />} />
          <Route path="/me/saved" element={<RequireAuth><SavedPage /></RequireAuth>} />
          <Route path="/me/applications" element={<RequireAuth><MyApplicationsPage /></RequireAuth>} />
          <Route path="/me/applications/:id" element={<RequireAuth><MyApplicationPage /></RequireAuth>} />
          <Route path="/me/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
          <Route path="/employer" element={<RequireAuth><EmployerDashboardPage /></RequireAuth>} />
          <Route path="/employer/companies/new" element={<RequireAuth><CompanyNewPage /></RequireAuth>} />
          <Route path="/employer/companies/:slug/settings" element={<RequireAuth><CompanySettingsPage /></RequireAuth>} />
          <Route path="/employer/jobs/new" element={<RequireAuth><JobFormPage /></RequireAuth>} />
          <Route path="/employer/jobs/:id/edit" element={<RequireAuth><JobFormPage /></RequireAuth>} />
          <Route path="/employer/jobs/:id/applicants" element={<RequireAuth><ApplicantsPage /></RequireAuth>} />
          <Route path="/employer/applications/:id" element={<RequireAuth><ApplicantDetailPage /></RequireAuth>} />
          <Route path="/admin/review" element={<RequireAuth><RequirePermission allowed={moderator}><ReviewQueuePage /></RequirePermission></RequireAuth>} />
          <Route path="/admin/companies" element={<RequireAuth><RequirePermission allowed={companyAdmin}><AdminCompaniesPage /></RequirePermission></RequireAuth>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
      <MobileNav items={nav} pathname={pathname} />
    </AppFrame>
  );
}
