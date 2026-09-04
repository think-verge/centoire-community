import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { AdminSourcesPage } from "./pages/admin/AdminSourcesPage";
import { AdminInvitesPage } from "./pages/admin/AdminInvitesPage";
import { ModerationPage } from "./pages/moderation/ModerationPage";
import { OnboardingGate, ProtectedRoute } from "./components/ProtectedRoute";
import { AuthProvider } from "./lib/auth-context";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage";
import { SignupPage } from "./pages/auth/SignupPage";
import { VerifyEmailPage } from "./pages/auth/VerifyEmailPage";
import { BookmarksPage } from "./pages/bookmarks/BookmarksPage";
import { CategoryPage } from "./pages/feed/CategoryPage";
import { CircleDetailPage } from "./pages/circles/CircleDetailPage";
import { CirclesPage } from "./pages/circles/CirclesPage";
import { ComposePage } from "./pages/compose/ComposePage";
import { DraftsPage } from "./pages/compose/DraftsPage";
import { DiscoverPage } from "./pages/feed/DiscoverPage";
import { FeedPage } from "./pages/feed/FeedPage";
import { FollowingPage } from "./pages/feed/FollowingPage";
import { ComingSoonPage } from "./pages/marketing/ComingSoonPage";
import { OnboardingPage } from "./pages/onboarding/OnboardingPage";
import { PostDetailPage } from "./pages/post/PostDetailPage";
import { ProfilePage } from "./pages/profile/ProfilePage";
import { SearchPage } from "./pages/search/SearchPage";
import { SettingsPage } from "./pages/settings/SettingsPage";
import { TagPage } from "./pages/tags/TagPage";
import { ExclusivePage } from "./pages/exclusive/ExclusivePage";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<ComingSoonPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<OnboardingGate />}>
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route element={<AppShell />}>
              <Route path="/feed" element={<FeedPage />} />
              <Route path="/following" element={<FollowingPage />} />
              <Route path="/discover" element={<DiscoverPage />} />
              <Route path="/category/:category" element={<CategoryPage />} />
              <Route path="/circles" element={<CirclesPage />} />
              <Route path="/bookmarks" element={<BookmarksPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/admin/sources" element={<AdminSourcesPage />} />
              <Route path="/admin/invites" element={<AdminInvitesPage />} />
              <Route path="/moderation" element={<ModerationPage />} />
              <Route path="/compose" element={<ComposePage />} />
              <Route path="/compose/:id" element={<ComposePage />} />
              <Route path="/drafts" element={<DraftsPage />} />
              <Route path="/p/:slug" element={<PostDetailPage />} />
              <Route path="/u/:handle" element={<ProfilePage />} />
              <Route path="/t/:slug" element={<TagPage />} />
              <Route path="/c/:slug" element={<CircleDetailPage />} />
              <Route
                path="/exclusive/ai-tools"
                element={
                  <ExclusivePage
                    title="AI & Industry Tools"
                    description="Curated AI tools, industry platforms, and design software built for fashion and art professionals."
                  />
                }
              />
              <Route
                path="/exclusive/jobs"
                element={
                  <ExclusivePage
                    title="Jobs"
                    description="Curated job openings at top brands, creative studios, and agencies — updated weekly."
                  />
                }
              />
              <Route
                path="/exclusive/certification"
                element={
                  <ExclusivePage
                    title="Certification"
                    description="Industry-recognised certifications to validate your expertise in fashion, art, and design."
                  />
                }
              />
              <Route
                path="/exclusive/startups"
                element={
                  <ExclusivePage
                    title="Startup / Investors"
                    description="Connect with fashion-tech founders, angel investors, and venture capital in the creative industry."
                  />
                }
              />
              <Route
                path="/exclusive/research"
                element={
                  <ExclusivePage
                    title="Research"
                    description="Trend reports, market intelligence, and academic research for fashion and art professionals."
                  />
                }
              />
              <Route
                path="/exclusive/buyers"
                element={
                  <ExclusivePage
                    title="Buyer / Manufactures"
                    description="Discover verified manufacturers, suppliers, and buyers across the global fashion supply chain."
                  />
                }
              />
            </Route>
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}
