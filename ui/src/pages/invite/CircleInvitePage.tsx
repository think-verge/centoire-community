import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { customInstance } from "../../lib/api/http";
import { savePendingCircleInvite, normalizeCircleSlug } from "../../lib/circleInviteStorage";
import { useAuth } from "../../lib/auth-context";

interface InvitePreview {
  valid: boolean;
  circleSlug: string;
  email: string;
}

export function CircleInvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!token) {
      navigate("/signup", { replace: true });
      return;
    }
    if (isLoading) return;

    customInstance<InvitePreview>({
      url: `/circles/invites/${token}/preview`,
      method: "GET",
    })
      .then((res) => {
        const cleanSlug = normalizeCircleSlug(res?.circleSlug);
        if (cleanSlug) {
          savePendingCircleInvite(token, cleanSlug);
        }

        if (user) {
          if (!user.onboardingCompleted) {
            navigate(`/onboarding?invite=${token}&slug=${cleanSlug}`, { replace: true });
            return;
          }
          // Already logged in & completed onboarding — navigate to circle with invite token so user can view and click Join
          navigate(`/c/${cleanSlug}?invite=${token}`, { replace: true });
        } else {
          // Not logged in — send to signup with params
          navigate(
            `/signup?invite=${token}&slug=${cleanSlug}`,
            { replace: true },
          );
        }
      })
      .catch(() => {
        // Invalid/expired token — still send to signup
        navigate("/signup", { replace: true });
      });
  }, [token, user, isLoading, navigate]);

  return null;
}
