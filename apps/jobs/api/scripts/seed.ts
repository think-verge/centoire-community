/**
 * Dev seed: fictional demo companies with jobs, so the Jobs app has something to browse.
 *
 *   SEED_OWNER_HANDLE=<core user handle> npm run seed -w @centoire/jobs-api
 *   SEED_OWNER_HANDLE=<handle> npm run seed -w @centoire/jobs-api -- --reset   (remove demo data only)
 *
 * Demo companies are fictional and tagged "(Demo data)" in their About text; --reset deletes
 * exactly those, never real ones. For launch, add real brands through the admin flow instead.
 */
import mongoose from "mongoose";
import { connectDb } from "../src/config/db.js";
import { Application, Company, CompanyMember, Job, SavedJob } from "../src/models/index.js";
import { getUserByHandle } from "../src/platform.js";
import type { IJob } from "../src/models/index.js";
import { slugify } from "../src/utils/slugify.js";

const DEMO_TAG = "(Demo data)";

type JobSeed = Pick<IJob, "title" | "function" | "seniority" | "employmentType" | "workplace"> & {
  description: string;
  city: string;
  country: string;
  salary?: [number, number, string, "year" | "month"];
  skills: string[];
};

interface CompanySeed {
  name: string;
  segment: "luxury" | "premium" | "fast_fashion" | "textiles" | "manufacturing" | "retail" | "beauty" | "media" | "agency";
  size: "1-10" | "11-50" | "51-200" | "201-1000" | "1000+";
  city: string;
  country: string;
  about: string;
  jobs: JobSeed[];
}

const COMPANIES: CompanySeed[] = [
  {
    name: "Atelier Voss", segment: "luxury", size: "51-200", city: "Copenhagen", country: "DK",
    about: "A fictional Nordic ready-to-wear house known for precise tailoring and quiet colour.",
    jobs: [
      { title: "Senior Knitwear Designer", function: "design", seniority: "senior", employmentType: "full_time", workplace: "hybrid", city: "Copenhagen", country: "DK", salary: [62000, 78000, "EUR", "year"], skills: ["Knit design", "Stoll", "Trend research"], description: "Lead the knitwear line for two seasons a year, from yarn selection to final sample approval.\n\nYou will work with our atelier and mills, present to the creative director, and mentor two junior designers." },
      { title: "Pattern Cutter, Womenswear", function: "pattern_making", seniority: "mid", employmentType: "full_time", workplace: "onsite", city: "Copenhagen", country: "DK", skills: ["Gerber", "Draping", "Tailoring"], description: "Cut and fit first patterns for our womenswear collection and keep the block library accurate.\n\nYou will work on fittings daily and collaborate with the sample room." },
    ],
  },
  {
    name: "Lumen Studio", segment: "agency", size: "11-50", city: "Paris", country: "FR",
    about: "A fictional creative studio producing campaigns and lookbooks for independent labels.",
    jobs: [
      { title: "Fashion Stylist (Freelance)", function: "styling", seniority: "mid", employmentType: "freelance", workplace: "onsite", city: "Paris", country: "FR", skills: ["Editorial styling", "Set etiquette"], description: "Style campaign shoots for emerging labels, from moodboards to wrap day.\n\nBring a portfolio that shows a clear point of view." },
      { title: "Textile Sourcing Lead", function: "sourcing", seniority: "lead", employmentType: "contract", workplace: "hybrid", city: "Paris", country: "FR", salary: [550, 700, "EUR", "month"], skills: ["Mill relationships", "Sustainable fibres", "Costing"], description: "Own fabric and trim sourcing for our client collections, including mill visits and cost negotiation." },
    ],
  },
  {
    name: "Northgate Denim Works", segment: "manufacturing", size: "201-1000", city: "Istanbul", country: "TR",
    about: "A fictional denim manufacturer supplying premium brands with sustainable washes.",
    jobs: [
      { title: "Production Manager, Denim", function: "production", seniority: "senior", employmentType: "full_time", workplace: "onsite", city: "Istanbul", country: "TR", skills: ["Production planning", "QC", "Lean"], description: "Run daily production across cutting, sewing and finishing, keeping on-time delivery above 95%.\n\nYou will report to the head of operations." },
      { title: "Wash Technician", function: "textile", seniority: "junior", employmentType: "full_time", workplace: "onsite", city: "Istanbul", country: "TR", skills: ["Laser finishing", "Ozone wash"], description: "Develop and replicate washes to buyer standards, documenting recipes for repeat orders." },
    ],
  },
  {
    name: "Oakline Retail Group", segment: "retail", size: "1000+", city: "London", country: "GB",
    about: "A fictional multi-brand retailer with flagship stores across the UK.",
    jobs: [
      { title: "Visual Merchandiser", function: "retail", seniority: "mid", employmentType: "full_time", workplace: "onsite", city: "London", country: "GB", salary: [34000, 42000, "GBP", "year"], skills: ["Window display", "Planograms"], description: "Plan and install seasonal windows and in-store displays for our London flagship." },
      { title: "Assistant Buyer, Accessories", function: "buying", seniority: "junior", employmentType: "full_time", workplace: "hybrid", city: "London", country: "GB", skills: ["Excel", "Range planning"], description: "Support the accessories buying team with range plans, supplier follow-up and sales analysis." },
    ],
  },
  {
    name: "Kōri Beauty", segment: "beauty", size: "11-50", city: "Seoul", country: "KR",
    about: "A fictional skincare and cosmetics brand with a strong creator community.",
    jobs: [
      { title: "Brand Marketing Manager", function: "marketing", seniority: "senior", employmentType: "full_time", workplace: "hybrid", city: "Seoul", country: "KR", skills: ["Campaigns", "Influencer strategy", "Analytics"], description: "Own seasonal campaigns across social and retail, working with creators and the product team." },
    ],
  },
  {
    name: "Threadwell Studio", segment: "premium", size: "1-10", city: "New York", country: "US",
    about: "A fictional contemporary label making small-batch womenswear in New York.",
    jobs: [
      { title: "Fashion Design Intern", function: "design", seniority: "intern", employmentType: "internship", workplace: "onsite", city: "New York", country: "US", skills: ["Illustrator", "Sketching"], description: "Assist the design team with tech packs, fabric research and sample tracking for a six-month placement." },
      { title: "Merchandising Associate", function: "merchandising", seniority: "junior", employmentType: "full_time", workplace: "hybrid", city: "New York", country: "US", salary: [58000, 66000, "USD", "year"], skills: ["Line planning", "Wholesale"], description: "Support line planning and wholesale order management across two seasons." },
    ],
  },
  {
    name: "Meridian Fabrics", segment: "textiles", size: "51-200", city: "Como", country: "IT",
    about: "A fictional Italian silk and technical-fabric mill.",
    jobs: [
      { title: "Textile Technologist", function: "textile", seniority: "mid", employmentType: "full_time", workplace: "onsite", city: "Como", country: "IT", skills: ["Weaving", "Quality testing"], description: "Develop new weaves with our design team and run quality testing against buyer specifications." },
    ],
  },
  {
    name: "Pixelloom", segment: "media", size: "11-50", city: "Berlin", country: "DE",
    about: "A fictional fashion-tech startup building 3D sampling tools for brands.",
    jobs: [
      { title: "3D Fashion Designer (CLO3D)", function: "tech", seniority: "mid", employmentType: "full_time", workplace: "remote", city: "Berlin", country: "DE", salary: [52000, 68000, "EUR", "year"], skills: ["CLO3D", "Marvelous Designer", "Pattern making"], description: "Build digital garments and avatars for brand partners, replacing physical first samples." },
      { title: "Fashion Photographer (Freelance)", function: "photography", seniority: "mid", employmentType: "freelance", workplace: "onsite", city: "Berlin", country: "DE", skills: ["Studio lighting", "Retouching"], description: "Shoot product and lookbook imagery for our partner brands on a per-project basis." },
    ],
  },
];

async function reset(): Promise<void> {
  const demo = await Company.find({ about: { $regex: `\\Q${DEMO_TAG}\\E$` } }).select("_id");
  const ids = demo.map((c) => c._id);
  const jobs = await Job.find({ companyId: { $in: ids } }).select("_id");
  await SavedJob.deleteMany({ jobId: { $in: jobs.map((j) => j._id) } });
  await Application.deleteMany({ companyId: { $in: ids } });
  await Job.deleteMany({ companyId: { $in: ids } });
  await CompanyMember.deleteMany({ companyId: { $in: ids } });
  await Company.deleteMany({ _id: { $in: ids } });
  console.log(`[seed] removed ${ids.length} demo companies and ${jobs.length} jobs`);
}

async function seed(ownerId: string): Promise<void> {
  const ttl = 30 * 24 * 60 * 60 * 1000;
  let companies = 0;
  let jobs = 0;
  for (const c of COMPANIES) {
    const slug = slugify(c.name);
    if (await Company.exists({ slug })) continue;
    const company = await Company.create({
      slug, name: c.name, segment: c.segment, sizeRange: c.size, hq: { city: c.city, countryCode: c.country },
      about: `${c.about} ${DEMO_TAG}`, verified: true, verifiedAt: new Date(), verifiedBy: ownerId, createdBy: ownerId,
    });
    await CompanyMember.create({ companyId: company._id, userId: ownerId, role: "owner" });
    companies++;
    for (const [i, j] of c.jobs.entries()) {
      const publishedAt = new Date(Date.now() - (companies * 3 + i) * 24 * 60 * 60 * 1000);
      await Job.create({
        companyId: company._id, postedBy: ownerId, title: j.title, slug: slugify(j.title), description: j.description,
        function: j.function, seniority: j.seniority, employmentType: j.employmentType, workplace: j.workplace,
        location: { city: j.city, countryCode: j.country },
        salary: j.salary ? { min: j.salary[0], max: j.salary[1], currency: j.salary[2], period: j.salary[3], visible: true } : undefined,
        skills: j.skills, applyMode: "internal", status: "published", publishedAt, expiresAt: new Date(publishedAt.getTime() + ttl),
        reviewedBy: ownerId, reviewedAt: publishedAt,
      });
      jobs++;
    }
    company.openJobCount = c.jobs.length;
    await company.save();
  }
  console.log(`[seed] added ${companies} demo companies and ${jobs} jobs (${COMPANIES.length - companies} already existed)`);
}

async function main(): Promise<void> {
  await connectDb();
  if (process.argv.includes("--reset")) {
    await reset();
  } else {
    const handle = process.env.SEED_OWNER_HANDLE;
    if (!handle) throw new Error("Set SEED_OWNER_HANDLE to the handle of the Centoire user who should own the demo companies");
    const owner = await getUserByHandle(handle);
    if (!owner) throw new Error(`No Centoire user with handle @${handle} (is the core API running?)`);
    await seed(owner.id);
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[seed] failed:", err.message);
  process.exit(1);
});
