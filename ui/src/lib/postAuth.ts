import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { clearReturnTo, readReturnTo } from "@centoire/web-platform";
import { ALLOWED_RETURN_ORIGINS } from "./miniApps";

/**
 * After login/signup: go back to the mini app that sent the user here (validated against the
 * allowed origins), otherwise to the in-app destination.
 */
export function usePostAuthRedirect() {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(
    (fallback = "/feed") => {
      const returnTo = readReturnTo(location.search, ALLOWED_RETURN_ORIGINS);
      if (returnTo) {
        clearReturnTo();
        window.location.assign(returnTo);
        return;
      }
      navigate(fallback, { replace: true });
    },
    [location.search, navigate],
  );
}
