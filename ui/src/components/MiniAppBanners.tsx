import { MiniAppBanner } from "@centoire/ui";
import { miniApps, miniAppHref } from "../lib/miniApps";

/** Feed promo cards for every mini app that is live and has banner copy. */
export function MiniAppBanners() {
  return (
    <>
      {miniApps.map((app) => {
        const href = miniAppHref(app, "feed_banner");
        if (!href || !app.banner) return null;
        return <MiniAppBanner key={app.id} {...app.banner} href={href} />;
      })}
    </>
  );
}
