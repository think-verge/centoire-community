import { registerAuthPaths } from "./auth.js";
import {
  registerCircleContentPaths,
  registerCommunityPaths,
  registerUserContentPaths,
} from "./community.js";
import { registerHealthPaths } from "./health.js";
import { registerEngagementPaths } from "./engagement.js";
import { registerFeedPaths } from "./feed.js";
import { registerInvitePaths } from "./invites.js";
import { registerModerationPaths } from "./moderation.js";
import { registerPostPaths } from "./posts.js";
import { registerSearchPaths } from "./search.js";
import { registerSourcePaths } from "./sources.js";

export { registry } from "./registry.js";

export function registerPaths(): void {
  registerHealthPaths();
  registerAuthPaths();
  registerInvitePaths();
  registerCommunityPaths();
  registerPostPaths();
  registerFeedPaths();
  registerEngagementPaths();
  registerCircleContentPaths();
  registerSourcePaths();
  registerSearchPaths();
  registerUserContentPaths();
  registerModerationPaths();
}
