// Replaced at build time by scripts/build.mjs (esbuild --define). Per-variant allow-list of Centoire origins.
declare const __ORIGINS__: string[];
declare const __DEBUG__: boolean;
export const DEBUG: boolean = __DEBUG__;
export const ORIGINS: readonly string[] = __ORIGINS__;

export const PERMS: chrome.permissions.Permissions = {
  permissions: ["declarativeNetRequestWithHostAccess"],
  origins: ["*://*/*"],
};
