import bcrypt from "bcryptjs";
import { connectDb, disconnectDb } from "../src/config/db.js";
import { Circle } from "../src/models/Circle.js";
import { CircleMembership } from "../src/models/CircleMembership.js";
import { ModerationPolicy } from "../src/models/ModerationPolicy.js";
import { Source } from "../src/models/Source.js";
import { Hashtag } from "../src/models/Hashtag.js";
import { User } from "../src/models/User.js";
import { Post } from "../src/models/Post.js";
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

const CIRCLES: Array<{
  name: string;
  description: string;
  tagSlugs: string[];
  rules: string[];
}> = [
  {
    name: "Beauty Notes",
    description: "Share skincare routines, makeup tips, and everyday beauty favorites.",
    tagSlugs: ["beauty", "lifestyle"],
    rules: ["Constructive product reviews only", "Disclose sponsored items"],
  },
  {
    name: "Wardrobe Diaries",
    description: "Document your personal style, favorite pieces, and seasonal edits.",
    tagSlugs: ["fashion", "wardrobe"],
    rules: ["Original styling photos preferred", "List brands when known"],
  },
  {
    name: "Evening Wear",
    description: "Find inspiration for occasion dressing and formal nights out.",
    tagSlugs: ["couture", "fashion"],
    rules: ["Celebrate craft and detailing"],
  },
  {
    name: "Workwear Edit",
    description: "Build polished, modern outfits for the office and beyond.",
    tagSlugs: ["fashion", "workwear"],
    rules: ["Keep recommendations practical"],
  },
  {
    name: "Fashion Week",
    description: "Share runway looks, street style inspiration, and emerging designer news.",
    tagSlugs: ["fashion", "runway", "editorial"],
    rules: ["Credit photographers and houses"],
  },
  {
    name: "Accessories Edit",
    description: "Curate bags, shoes, and jewelry that elevate every outfit.",
    tagSlugs: ["accessories", "fashion"],
    rules: ["No counterfeit discussion"],
  },
  {
    name: "Street Style",
    description: "Spot the best looks from fashion weeks and city streets.",
    tagSlugs: ["street-style", "fashion"],
    rules: ["Credit photographers and subjects"],
  },
  {
    name: "Sustainable Style",
    description: "Explore conscious fashion, second-hand finds, and timeless wardrobe pieces.",
    tagSlugs: ["sustainability", "fashion"],
    rules: ["No greenwashing claims without sources"],
  },
  {
    name: "Art & Architecture",
    description: "Explore contemporary art spaces, architectural wonders, and spatial design.",
    tagSlugs: ["art", "architecture", "design"],
    rules: ["Credit designers and architects"],
  },
  {
    name: "Ceramics & Objects",
    description: "Modern ceramics, sculptural homeware, and craft techniques.",
    tagSlugs: ["art", "craft", "design"],
    rules: ["Highlight artisan processes"],
  },
  {
    name: "Textile Innovations",
    description: "Smart fabrics, biomaterials, and experimental textile crafts.",
    tagSlugs: ["textiles", "design", "fashion-tech"],
    rules: ["Cite research papers or material labs"],
  },
  {
    name: "Graphic Forms",
    description: "Typography, editorial design, printmaking, and visual identity.",
    tagSlugs: ["design", "art"],
    rules: ["Celebrate independent typefoundries and studios"],
  },
  {
    name: "Japanese Denim",
    description: "Selvedge, shuttle looms, and repair culture",
    tagSlugs: ["denim", "vintage"],
    rules: ["Credit makers and mills", "No resale listings"],
  },
  {
    name: "Pattern Room",
    description: "Drafting, draping, and construction help",
    tagSlugs: ["pattern-making", "couture"],
    rules: ["Share your process, not just results"],
  },
  {
    name: "Deadstock Design",
    description: "Designing with deadstock and reclaimed fabric",
    tagSlugs: ["sustainability", "textiles"],
    rules: ["Source transparency required"],
  },
  {
    name: "Sneaker Sketches",
    description: "Footwear concepts, renders, and critique",
    tagSlugs: ["footwear-design", "sneakers"],
    rules: ["Constructive critique only"],
  },
  {
    name: "Indie Labels",
    description: "Running a small label — production, pricing, retail",
    tagSlugs: ["retail", "branding", "supply-chain"],
    rules: ["No spam or self-promo without context"],
  },
  {
    name: "Knit Lab",
    description: "Machine knitting, yarns, and swatch experiments",
    tagSlugs: ["knitwear", "textiles"],
    rules: ["Label your machines and gauges"],
  },
  {
    name: "Centoire Community",
    description: "The place to talk about the Centoire platform: ask questions, share feedback and shape what we build together.",
    tagSlugs: ["fashion-tech", "branding"],
    rules: ["Be respectful and kind"],
  },
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
    let circle = await Circle.findOne({ slug });
    if (!circle) {
      circle = await Circle.create({
        name: c.name,
        slug,
        description: c.description,
        rules: c.rules,
        hashtags: toHashtags(c.tagSlugs),
        createdBy: admin._id,
        memberCount: 1,
      });
      await CircleMembership.create({ circleId: circle._id, userId: admin._id, role: "owner" });
    } else {
      const realCount = await CircleMembership.countDocuments({ circleId: circle._id });
      await Circle.updateOne(
        { _id: circle._id },
        {
          $set: {
            memberCount: Math.max(1, realCount),
          },
        },
      );
    }
  }
  console.log(`[seed] ${CIRCLES.length} circles ensured`);

  // Seed creators & published native posts (Cold-Start & Discovery Polish)
  const SEED_CREATORS = [
    {
      email: "elena@centoire.app",
      displayName: "Elena Vance",
      handle: "elena_vance",
      bio: "Fashion journalist & couture critic. Formerly Vogue Paris, now curating independent runway perspectives.",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=300&fit=crop",
      role: "creator" as const,
      followedHashtags: ["couture", "runway", "editorial", "fashion"],
      reputation: 85,
      followerCount: 1420,
      followingCount: 38,
      postCount: 12,
    },
    {
      email: "marco@centoire.app",
      displayName: "Marco Chen",
      handle: "marco_chen",
      bio: "Textile engineer & material researcher. Exploring algorithmic looms, dense flax weaves & technical fabrics.",
      avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop",
      role: "creator" as const,
      followedHashtags: ["textiles", "fashion-tech", "sustainability", "design"],
      reputation: 92,
      followerCount: 980,
      followingCount: 45,
      postCount: 8,
    },
    {
      email: "camille@centoire.app",
      displayName: "Camille Laurent",
      handle: "camille_l",
      bio: "Parisian street style photographer & creative director. Chronicling movement, silhouettes, and everyday aesthetics.",
      avatarUrl: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=300&h=300&fit=crop",
      role: "creator" as const,
      followedHashtags: ["street-style", "photography", "wardrobe", "fashion"],
      reputation: 110,
      followerCount: 2310,
      followingCount: 62,
      postCount: 19,
    },
    {
      email: "kenji@centoire.app",
      displayName: "Kenji Sato",
      handle: "kenji_sato",
      bio: "Tokyo-based knitwear designer & experimental yarn collector. Documenting shima seiki techniques.",
      avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&h=300&fit=crop",
      role: "creator" as const,
      followedHashtags: ["knitwear", "textiles", "menswear", "design"],
      reputation: 74,
      followerCount: 840,
      followingCount: 29,
      postCount: 6,
    },
    {
      email: "sofia@centoire.app",
      displayName: "Sofia Rossi",
      handle: "sofia_rossi",
      bio: "Milanese leather craft & accessory artisan. Highlighting small atelier traditions and slow design.",
      avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&h=300&fit=crop",
      role: "creator" as const,
      followedHashtags: ["accessories", "craft", "luxury", "fashion"],
      reputation: 68,
      followerCount: 1150,
      followingCount: 33,
      postCount: 9,
    },
  ];

  const SEED_POSTS = [
    {
      creatorHandle: "elena_vance",
      title: "The Architecture of Modern Couture: Volume, Drape, and Structural Restraint",
      slug: "architecture-of-modern-couture-volume-drape",
      excerpt: "Why the Spring/Summer ateliers are retreating from surface ornamentation to focus on pure structural line and tactile luxury.",
      coverImageUrl: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&h=500&fit=crop",
      hashtags: ["couture", "runway", "fashion", "editorial"],
      readTimeMinutes: 5,
      upvoteCount: 142,
      commentCount: 18,
    },
    {
      creatorHandle: "marco_chen",
      title: "Algorithmic Looms and High-Density Flax: Redefining Sustainable Wefts",
      slug: "algorithmic-looms-and-high-density-flax",
      excerpt: "Blending traditional Belgian coarse flax with computational Jacquard weaving creates a tensile strength that rivals synthetic polymers.",
      coverImageUrl: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&h=500&fit=crop",
      hashtags: ["textiles", "fashion-tech", "sustainability"],
      readTimeMinutes: 4,
      upvoteCount: 98,
      commentCount: 12,
    },
    {
      creatorHandle: "camille_l",
      title: "A Fresh Perspective on Paris Street Style: Quiet Neutrals and Sculptural Forms",
      slug: "fresh-perspective-paris-street-style-neutrals",
      excerpt: "Spotted outside the Palais de Tokyo: oversized trench coats, structured leather totes, and vintage wool trousers that speak without shouting.",
      coverImageUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&h=500&fit=crop",
      hashtags: ["street-style", "fashion", "wardrobe"],
      readTimeMinutes: 3,
      upvoteCount: 231,
      commentCount: 34,
    },
    {
      creatorHandle: "kenji_sato",
      title: "Dimensional Knitwear: Gauge Variations and Seamless WholeGarment Techniques",
      slug: "dimensional-knitwear-gauge-variations-techniques",
      excerpt: "An inside look at our latest capsule knitted on 3D flatbed machines without a single cut seam or wasted yarn.",
      coverImageUrl: "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800&h=500&fit=crop",
      hashtags: ["knitwear", "textiles", "design"],
      readTimeMinutes: 4,
      upvoteCount: 87,
      commentCount: 9,
    },
    {
      creatorHandle: "sofia_rossi",
      title: "Preserving the Tuscan Saddle Stitch: Craftsmanship in an Age of Fast Luxury",
      slug: "preserving-tuscan-saddle-stitch-craftsmanship",
      excerpt: "Why true hand-burnished edges and two-needle saddle stitching endure when factory heat-glued seams peel within months.",
      coverImageUrl: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&h=500&fit=crop",
      hashtags: ["accessories", "craft", "luxury"],
      readTimeMinutes: 5,
      upvoteCount: 115,
      commentCount: 16,
    },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const creatorsByHandle = new Map<string, any>();
  for (const c of SEED_CREATORS) {
    let user = await User.findOne({ handle: c.handle });
    if (!user) {
      user = await User.create({
        ...c,
        passwordHash: await bcrypt.hash("creator-pass-123", 12),
        emailVerified: true,
        onboardingCompletedAt: new Date(),
      });
      console.log(`[seed] creator user created (@${c.handle})`);
    } else {
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            role: "creator",
            bio: c.bio,
            avatarUrl: c.avatarUrl,
            followedHashtags: c.followedHashtags,
          },
        },
      );
    }
    creatorsByHandle.set(c.handle, user);
  }

  for (const p of SEED_POSTS) {
    const creator = creatorsByHandle.get(p.creatorHandle);
    if (!creator) continue;
    const existing = await Post.findOne({ slug: p.slug });
    if (!existing) {
      await Post.create({
        title: p.title,
        slug: p.slug,
        excerpt: p.excerpt,
        contentHtml: `<p>${p.excerpt}</p><p>Read full editorial discussion on Centoire community.</p>`,
        content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: p.excerpt }] }] },
        coverImageUrl: p.coverImageUrl,
        hashtags: p.hashtags,
        origin: "native",
        status: "published",
        authorId: creator._id,
        readTimeMinutes: p.readTimeMinutes,
        upvoteCount: p.upvoteCount,
        commentCount: p.commentCount,
        bookmarkCount: Math.floor(p.upvoteCount / 3),
        publishedAt: new Date(Date.now() - Math.floor(Math.random() * 5 + 1) * 24 * 60 * 60 * 1000),
      });
      console.log(`[seed] native post created: "${p.title}"`);
    }
  }
  console.log(`[seed] ${SEED_CREATORS.length} creators and ${SEED_POSTS.length} posts ensured`);

  await disconnectDb();
  console.log("[seed] done");
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
