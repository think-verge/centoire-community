import bcrypt from "bcryptjs";
import { connectDb, disconnectDb } from "../src/config/db.js";
import { Circle } from "../src/models/Circle.js";
import { CircleMembership } from "../src/models/CircleMembership.js";
import { ModerationPolicy } from "../src/models/ModerationPolicy.js";
import { Source } from "../src/models/Source.js";
import { Hashtag } from "../src/models/Hashtag.js";
import { User } from "../src/models/User.js";
import { SEED_HASHTAGS } from "../src/config/seedHashtags.js";
import { normalizeHashtag } from "../src/utils/hashtag.js";
import { slugify } from "../src/utils/slugify.js";

const SOURCES: Array<{ name: string; siteUrl: string; feedUrl: string; tagSlugs: string[]; active?: boolean }> = [
  // ── Already seeded originals ──────────────────────────────────────────────
  { name: "Business of Fashion", siteUrl: "https://www.businessoffashion.com", feedUrl: "https://www.businessoffashion.com/arc/outboundfeeds/rss/?outputType=xml", tagSlugs: ["retail", "supply-chain", "branding"] },
  { name: "Hypebeast", siteUrl: "https://hypebeast.com", feedUrl: "https://hypebeast.com/feed", tagSlugs: ["streetwear", "sneakers", "street-style"] },
  { name: "Highsnobiety", siteUrl: "https://www.highsnobiety.com", feedUrl: "https://www.highsnobiety.com/feed/", tagSlugs: ["streetwear", "sneakers"] },
  { name: "Fashionista", siteUrl: "https://fashionista.com", feedUrl: "https://fashionista.com/.rss/excerpt/", tagSlugs: ["womenswear", "retail", "editorial"] },
  { name: "The Fashion Law", siteUrl: "https://www.thefashionlaw.com", feedUrl: "https://www.thefashionlaw.com/feed/", tagSlugs: ["retail", "branding", "supply-chain"] },
  { name: "Vogue Runway", siteUrl: "https://www.vogue.com", feedUrl: "https://www.vogue.com/feed/rss", tagSlugs: ["runway", "womenswear", "editorial"] },
  { name: "Sourcing Journal", siteUrl: "https://sourcingjournal.com", feedUrl: "https://sourcingjournal.com/feed/", tagSlugs: ["supply-chain", "textiles", "sustainability"] },

  // ── Fashion Business ──────────────────────────────────────────────────────
  { name: "Vogue Business", siteUrl: "https://www.voguebusiness.com", feedUrl: "https://www.voguebusiness.com/rss", tagSlugs: ["runway", "retail", "branding"] },
  { name: "WWD", siteUrl: "https://wwd.com", feedUrl: "https://wwd.com/feed/", tagSlugs: ["retail", "branding", "runway"] },
  { name: "Fashion United", siteUrl: "https://fashionunited.com", feedUrl: "https://fashionunited.com/rss.xml", tagSlugs: ["retail", "supply-chain"] },
  { name: "Glossy", siteUrl: "https://www.glossy.co", feedUrl: "https://www.glossy.co/feed/", tagSlugs: ["retail", "branding", "fashion-tech"] },

  // ── Fashion Editorial ─────────────────────────────────────────────────────
  { name: "Harper's Bazaar", siteUrl: "https://www.harpersbazaar.com", feedUrl: "https://www.harpersbazaar.com/rss/all.xml/", tagSlugs: ["runway", "editorial", "womenswear"] },
  { name: "Elle", siteUrl: "https://www.elle.com", feedUrl: "https://www.elle.com/rss/all.xml/", tagSlugs: ["runway", "editorial", "womenswear"] },
  { name: "Vanity Fair", siteUrl: "https://www.vanityfair.com", feedUrl: "https://www.vanityfair.com/feed/rss", tagSlugs: ["editorial", "runway", "luxury"] },
  { name: "Marie Claire", siteUrl: "https://www.marieclaire.com", feedUrl: "https://www.marieclaire.com/rss/all.xml/", tagSlugs: ["editorial", "womenswear", "beauty"] },
  { name: "L'Officiel USA", siteUrl: "https://www.lofficielusa.com", feedUrl: "https://www.lofficielusa.com/feed", tagSlugs: ["runway", "couture", "editorial"] },
  { name: "Who What Wear", siteUrl: "https://www.whowhatwear.com", feedUrl: "https://www.whowhatwear.com/rss", tagSlugs: ["womenswear", "retail", "street-style"] },
  { name: "Cosmopolitan", siteUrl: "https://www.cosmopolitan.com", feedUrl: "https://www.cosmopolitan.com/rss/all.xml/", tagSlugs: ["womenswear", "beauty", "editorial"] },

  // ── Menswear ──────────────────────────────────────────────────────────────
  { name: "GQ", siteUrl: "https://www.gq.com", feedUrl: "https://www.gq.com/feed/rss", tagSlugs: ["menswear", "runway", "luxury"] },
  { name: "Esquire", siteUrl: "https://www.esquire.com", feedUrl: "https://www.esquire.com/rss/all.xml/", tagSlugs: ["menswear", "luxury", "editorial"] },
  { name: "Robb Report", siteUrl: "https://robbreport.com", feedUrl: "https://robbreport.com/feed/", tagSlugs: ["menswear", "luxury"] },

  // ── Youth / Culture / Photography ─────────────────────────────────────────
  { name: "Dazed", siteUrl: "https://www.dazeddigital.com", feedUrl: "https://www.dazeddigital.com/rss", tagSlugs: ["editorial", "photography", "street-style"] },
  { name: "i-D", siteUrl: "https://i-d.vice.com", feedUrl: "https://i-d.vice.com/en_us/rss", tagSlugs: ["editorial", "photography", "street-style"] },

  // ── Trend Forecasting ─────────────────────────────────────────────────────
  { name: "Heuritech", siteUrl: "https://heuritech.com", feedUrl: "https://heuritech.com/feed/", tagSlugs: ["fashion-tech", "sustainability"] },

  // ── Art ───────────────────────────────────────────────────────────────────
  { name: "Artsy", siteUrl: "https://www.artsy.net", feedUrl: "https://www.artsy.net/rss/news", tagSlugs: ["art", "editorial"] },
  { name: "Artnet News", siteUrl: "https://news.artnet.com", feedUrl: "https://news.artnet.com/feed/", tagSlugs: ["art", "luxury"] },
  { name: "Artforum", siteUrl: "https://www.artforum.com", feedUrl: "https://www.artforum.com/feed/", tagSlugs: ["art", "editorial"] },
  { name: "Hyperallergic", siteUrl: "https://hyperallergic.com", feedUrl: "https://hyperallergic.com/feed/", tagSlugs: ["art", "editorial"] },

  // ── Design ────────────────────────────────────────────────────────────────
  { name: "Creative Boom", siteUrl: "https://www.creativeboom.com", feedUrl: "https://www.creativeboom.com/feed/", tagSlugs: ["art", "design", "photography"] },
  { name: "It's Nice That", siteUrl: "https://www.itsnicethat.com", feedUrl: "https://www.itsnicethat.com/rss", tagSlugs: ["design", "art", "editorial"] },
  { name: "Dezeen", siteUrl: "https://www.dezeen.com", feedUrl: "https://www.dezeen.com/feed/", tagSlugs: ["design", "architecture", "fashion-tech"] },
  { name: "Designboom", siteUrl: "https://www.designboom.com", feedUrl: "https://www.designboom.com/feed/", tagSlugs: ["design", "art", "architecture"] },

  // ── Beauty ────────────────────────────────────────────────────────────────
  { name: "Allure", siteUrl: "https://www.allure.com", feedUrl: "https://www.allure.com/feed/rss", tagSlugs: ["beauty", "editorial"] },
  { name: "Beauty Independent", siteUrl: "https://www.beautyindependent.com", feedUrl: "https://www.beautyindependent.com/feed/", tagSlugs: ["beauty", "retail", "branding"] },

  // ── Technology ────────────────────────────────────────────────────────────
  { name: "MIT Technology Review", siteUrl: "https://www.technologyreview.com", feedUrl: "https://www.technologyreview.com/feed/", tagSlugs: ["fashion-tech", "technology"] },
  { name: "TechCrunch", siteUrl: "https://techcrunch.com", feedUrl: "https://techcrunch.com/feed/", tagSlugs: ["technology", "fashion-tech"] },
  { name: "WIRED", siteUrl: "https://www.wired.com", feedUrl: "https://www.wired.com/feed/rss", tagSlugs: ["technology", "editorial"] },

  // ── Sustainable Fashion & Textiles ────────────────────────────────────────
  { name: "Good On You", siteUrl: "https://goodonyou.eco", feedUrl: "https://goodonyou.eco/feed/", tagSlugs: ["sustainability", "retail", "branding"] },
  { name: "EcoCult", siteUrl: "https://ecocult.com", feedUrl: "https://ecocult.com/feed/", tagSlugs: ["sustainability", "textiles"] },
  { name: "Fashion Revolution", siteUrl: "https://www.fashionrevolution.org", feedUrl: "https://www.fashionrevolution.org/feed/", tagSlugs: ["sustainability", "supply-chain"] },
  { name: "Textile Exchange", siteUrl: "https://textileexchange.org", feedUrl: "https://textileexchange.org/feed/", tagSlugs: ["textiles", "sustainability", "supply-chain"] },
  { name: "Ecotextile News", siteUrl: "https://www.ecotextile.com", feedUrl: "https://www.ecotextile.com/rss/news.xml", tagSlugs: ["textiles", "sustainability", "supply-chain"] },

  // ── Indian Fashion ────────────────────────────────────────────────────────
  { name: "Vogue India", siteUrl: "https://www.vogue.in", feedUrl: "https://www.vogue.in/feed/rss", tagSlugs: ["womenswear", "runway", "editorial"] },
  { name: "Grazia India", siteUrl: "https://www.graziaindia.com", feedUrl: "https://www.graziaindia.com/feed/", tagSlugs: ["womenswear", "beauty", "editorial"] },

  // ── Inactive — no public RSS or subscription-only (activate via Admin UI) ─
  { name: "SSENSE", siteUrl: "https://www.ssense.com", feedUrl: "https://www.ssense.com/en-us/editorial/rss", tagSlugs: ["luxury", "editorial", "menswear"], active: false },
  { name: "WGSN", siteUrl: "https://www.wgsn.com", feedUrl: "https://www.wgsn.com/feed", tagSlugs: ["fashion-tech", "retail"], active: false },
  { name: "Numero", siteUrl: "https://www.numero.com", feedUrl: "https://www.numero.com/en/rss", tagSlugs: ["couture", "editorial", "photography"], active: false },
  { name: "Fashion Snoops", siteUrl: "https://www.fashionsnoops.com", feedUrl: "https://www.fashionsnoops.com/feed", tagSlugs: ["fashion-tech", "retail"], active: false },
  { name: "Pinterest Predicts", siteUrl: "https://business.pinterest.com", feedUrl: "https://business.pinterest.com/en/pinterest-predicts/feed", tagSlugs: ["street-style", "retail"], active: false },
  { name: "Google Trends", siteUrl: "https://trends.google.com", feedUrl: "https://trends.google.com/trends/hottrends/atom/feed", tagSlugs: ["fashion-tech", "retail"], active: false },
  { name: "Lyst", siteUrl: "https://www.lyst.com", feedUrl: "https://www.lyst.com/news/feed", tagSlugs: ["retail", "branding"], active: false },
  { name: "L'Officiel India", siteUrl: "https://www.lofficielindia.com", feedUrl: "https://www.lofficielindia.com/feed", tagSlugs: ["couture", "editorial", "luxury"], active: false },
];

const CIRCLES: Array<{ name: string; description: string; tagSlugs: string[]; rules: string[] }> = [
  { name: "Japanese Denim", description: "Selvedge, shuttle looms, and repair culture", tagSlugs: ["denim", "vintage"], rules: ["Credit makers and mills", "No resale listings"] },
  { name: "Pattern Room", description: "Drafting, draping, and construction help", tagSlugs: ["pattern-making", "couture"], rules: ["Share your process, not just results"] },
  { name: "Deadstock Design", description: "Designing with deadstock and reclaimed fabric", tagSlugs: ["sustainability", "textiles"], rules: ["Source transparency required"] },
  { name: "Sneaker Sketches", description: "Footwear concepts, renders, and critique", tagSlugs: ["footwear-design", "sneakers"], rules: ["Constructive critique only"] },
  { name: "Indie Labels", description: "Running a small label — production, pricing, retail", tagSlugs: ["retail", "branding", "supply-chain"], rules: ["No spam or self-promo without context"] },
  { name: "Knit Lab", description: "Machine knitting, yarns, and swatch experiments", tagSlugs: ["knitwear", "textiles"], rules: ["Label your machines and gauges"] },
];

async function main(): Promise<void> {
  await connectDb();

  // Hashtags — upsert by name; featured ones are (re)flagged so the onboarding set stays curated.
  for (const h of SEED_HASHTAGS) {
    await Hashtag.updateOne(
      { name: h.name },
      {
        $setOnInsert: { name: h.name, postCount: 0, followerCount: 0, status: "active" },
        ...(h.featured ? { $set: { featured: true } } : { $setOnInsert: { featured: false } }),
      },
      { upsert: true },
    );
  }
  console.log(`[seed] ${SEED_HASHTAGS.length} hashtags ensured`);

  // Source/circle fixtures list hashtags by their old tag slug ("supply-chain"); normalize them.
  const toHashtags = (names: string[]) =>
    [...new Set(names.map((n) => normalizeHashtag(n)).filter((n): n is string => Boolean(n)))];

  // Admin user
  const adminEmail = "admin@centoire.app";
  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    admin = await User.create({
      email: adminEmail,
      passwordHash: await bcrypt.hash("centoire-admin", 12),
      displayName: "Centoire Team",
      handle: "centoire_team",
      role: "admin",
      emailVerified: true,
      onboardingCompletedAt: new Date(),
      followedHashtags: ["runway", "streetwear", "textiles"],
    });
    console.log("[seed] admin user created (admin@centoire.app / centoire-admin)");
  } else {
    console.log("[seed] admin user already exists");
  }

  // Default catch-all policy: AI-analyzed non-spam content auto-approves
  // Condition: ai_is_spam not_equals true
  //   Phase 1 (undefined): returns false → post stays pending_review → AI fires
  //   Phase 2 (false for non-spam): returns true → matches → auto_approve
  await ModerationPolicy.updateOne(
    { name: "Default — auto-approve AI-analyzed non-spam content" },
    {
      $setOnInsert: {
        name: "Default — auto-approve AI-analyzed non-spam content",
        conditions: [{ key: "ai_is_spam", operator: "not_equals", values: [true] }],
        logic: "and",
        action: "auto_approve",
        priority: 0,
        reason: "Seeded default: any post AI has processed that is not spam gets published automatically.",
        active: true,
        createdBy: admin._id,
      },
    },
    { upsert: true },
  );
  console.log("[seed] default auto-approve policy ensured");

  // Sources — upsert by feedUrl
  for (const s of SOURCES) {
    await Source.updateOne(
      { feedUrl: s.feedUrl },
      {
        $setOnInsert: {
          name: s.name,
          siteUrl: s.siteUrl,
          feedUrl: s.feedUrl,
          faviconUrl: `https://www.google.com/s2/favicons?domain=${new URL(s.siteUrl).hostname}&sz=64`,
          hashtags: toHashtags(s.tagSlugs),
          active: s.active ?? true,
          createdBy: admin._id,
        },
      },
      { upsert: true },
    );
  }
  console.log(`[seed] ${SOURCES.length} sources ensured`);

  // Starter circles owned by admin
  for (const c of CIRCLES) {
    const slug = slugify(c.name);
    const existing = await Circle.findOne({ slug });
    if (existing) continue;
    const circle = await Circle.create({
      name: c.name,
      slug,
      description: c.description,
      rules: c.rules,
      hashtags: toHashtags(c.tagSlugs),
      createdBy: admin._id,
      memberCount: 1,
    });
    await CircleMembership.create({ circleId: circle._id, userId: admin._id, role: "owner" });
  }
  console.log(`[seed] ${CIRCLES.length} circles ensured`);

  await disconnectDb();
  console.log("[seed] done");
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
