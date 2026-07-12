import bcrypt from "bcryptjs";
import { connectDb, disconnectDb } from "../src/config/db.js";
import { Circle } from "../src/models/Circle.js";
import { CircleMembership } from "../src/models/CircleMembership.js";
import { Source } from "../src/models/Source.js";
import { Tag } from "../src/models/Tag.js";
import { User } from "../src/models/User.js";
import { slugify } from "../src/utils/slugify.js";

const TAGS: Array<{ name: string; category: "style" | "craft" | "business" | "culture"; description: string }> = [
  { name: "Streetwear", category: "style", description: "Drops, collabs, and the culture around them" },
  { name: "Couture", category: "style", description: "Haute couture and made-to-measure craft" },
  { name: "Menswear", category: "style", description: "Tailoring to casualwear for men" },
  { name: "Womenswear", category: "style", description: "Ready-to-wear and design for women" },
  { name: "Techwear", category: "style", description: "Performance fabrics and functional design" },
  { name: "Vintage", category: "style", description: "Archive fashion, thrifting, and revivals" },
  { name: "Bridal", category: "style", description: "Wedding and occasion design" },
  { name: "Accessories", category: "style", description: "Bags, jewelry, eyewear, and more" },
  { name: "Sneakers", category: "style", description: "Sneaker design, drops, and resale" },
  { name: "Textiles", category: "craft", description: "Fabric innovation, mills, and materials" },
  { name: "Knitwear", category: "craft", description: "Knit design, machines, and yarns" },
  { name: "Denim", category: "craft", description: "Selvedge, washes, and denim heritage" },
  { name: "Pattern Making", category: "craft", description: "Drafting, draping, and construction" },
  { name: "Footwear Design", category: "craft", description: "Shoe lasts, soles, and construction" },
  { name: "Embroidery", category: "craft", description: "Hand and machine embellishment" },
  { name: "Sustainability", category: "business", description: "Circularity, deadstock, and ethical supply" },
  { name: "Supply Chain", category: "business", description: "Sourcing, factories, and logistics" },
  { name: "Retail", category: "business", description: "Stores, e-commerce, and merchandising" },
  { name: "Fashion Tech", category: "business", description: "Software, AI, and tools for fashion" },
  { name: "Branding", category: "business", description: "Identity, campaigns, and positioning" },
  { name: "Runway", category: "culture", description: "Shows, seasons, and collections" },
  { name: "Street Style", category: "culture", description: "What people actually wear" },
  { name: "Fashion History", category: "culture", description: "Archives, houses, and movements" },
  { name: "Editorial", category: "culture", description: "Fashion photography and magazines" },
];

const SOURCES: Array<{ name: string; siteUrl: string; feedUrl: string; tagSlugs: string[] }> = [
  { name: "Business of Fashion", siteUrl: "https://www.businessoffashion.com", feedUrl: "https://www.businessoffashion.com/arc/outboundfeeds/rss/?outputType=xml", tagSlugs: ["retail", "supply-chain", "branding"] },
  { name: "Hypebeast", siteUrl: "https://hypebeast.com", feedUrl: "https://hypebeast.com/feed", tagSlugs: ["streetwear", "sneakers", "street-style"] },
  { name: "Highsnobiety", siteUrl: "https://www.highsnobiety.com", feedUrl: "https://www.highsnobiety.com/feed/", tagSlugs: ["streetwear", "sneakers"] },
  { name: "Fashionista", siteUrl: "https://fashionista.com", feedUrl: "https://fashionista.com/.rss/excerpt/", tagSlugs: ["womenswear", "retail", "editorial"] },
  { name: "The Fashion Law", siteUrl: "https://www.thefashionlaw.com", feedUrl: "https://www.thefashionlaw.com/feed/", tagSlugs: ["retail", "branding", "supply-chain"] },
  { name: "Vogue Runway", siteUrl: "https://www.vogue.com", feedUrl: "https://www.vogue.com/feed/rss", tagSlugs: ["runway", "womenswear", "editorial"] },
  { name: "Sourcing Journal", siteUrl: "https://sourcingjournal.com", feedUrl: "https://sourcingjournal.com/feed/", tagSlugs: ["supply-chain", "textiles", "sustainability"] },
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

  // Tags — upsert by slug
  for (const t of TAGS) {
    await Tag.updateOne(
      { slug: slugify(t.name) },
      { $setOnInsert: { name: t.name, slug: slugify(t.name), category: t.category, description: t.description } },
      { upsert: true },
    );
  }
  console.log(`[seed] ${TAGS.length} tags ensured`);

  const tagBySlug = new Map((await Tag.find()).map((t) => [t.slug, t._id]));

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
      interests: [tagBySlug.get("runway"), tagBySlug.get("streetwear"), tagBySlug.get("textiles")].filter(Boolean),
    });
    console.log("[seed] admin user created (admin@centoire.app / centoire-admin)");
  } else {
    console.log("[seed] admin user already exists");
  }

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
          tags: s.tagSlugs.map((slug) => tagBySlug.get(slug)).filter(Boolean),
          active: true,
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
      tags: c.tagSlugs.map((s) => tagBySlug.get(s)).filter(Boolean),
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
