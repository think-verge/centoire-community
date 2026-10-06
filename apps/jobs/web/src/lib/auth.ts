import { loginUrl } from "@centoire/web-platform";
import { CORE_URL } from "./env";

export function goToLogin(): void {
  window.location.assign(loginUrl(CORE_URL, window.location.href));
}

export const SIGNUP_URL = `${CORE_URL}/signup`;
export const SETTINGS_URL = `${CORE_URL}/settings`;
export const SUPPORT_URL = `${CORE_URL}/support`;
