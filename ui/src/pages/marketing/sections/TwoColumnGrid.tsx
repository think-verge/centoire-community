import essay1 from "../../../assets/landing/essay-1.jpg";
import essay2 from "../../../assets/landing/essay-2.jpg";
import essay3 from "../../../assets/landing/essay-3.jpg";

const ESSAYS = [
  {
    image: essay1,
    tag: "Curation",
    author: "Camille Lafleur",
    title: "The Return of the Heavy Buckle: Industrial Hardware Reclaims the Waist",
    body: "Why designers are trading invisible fasteners for raw brass, heavy iron, and oversized architectural buckles. Hand craft details meet high utility.",
  },
  {
    image: essay2,
    tag: "Analysis",
    author: "Sophia Sterling",
    title: "Unstructured Tailoring: Designing Air into Spring Silhouettes",
    body: "No pads, no heavy linings. We look at the technical marvels keeping raw garments fluid yet architectural under extreme summer conditions.",
  },
  {
    image: essay3,
    tag: "Culture",
    author: "Elena Rostova",
    title: "The Digital Loom: Algorithmic Weaving and Slow Fashion Convergence",
    body: "Apparel designers are partnering with custom machine scripts to generate flawless structural drapes previously impossible with purely hand-woven loom structures.",
  },
];

const POPULAR = [
  { category: "Curation", title: "The Raw Silk Paradigm Shift in Travel Wardrobes" },
  { category: "Design", title: "Brutalist Architecture and the Clothing We Live In" },
  { category: "Living", title: "Why Modern Homes are Trading Sweet Fragrances for Concrete and Ash" },
  { category: "Showcase", title: "Nordic Summer Retreats: A Curation of Textured Stoneware" },
  { category: "Couture", title: "The Return of Raw, Unprocessed Linens" },
];

export function TwoColumnGrid() {
  return (
    <section className="flex flex-col gap-12 bg-white px-6 py-16 sm:px-20 sm:py-20 lg:flex-row lg:gap-8">
      <div className="flex flex-1 flex-col gap-12">
        <div className="flex flex-col gap-2 border-b border-hairline pb-6">
          <h2 className="font-editorial text-[32px] font-semibold text-charcoal">Weekly Essays</h2>
          <p className="font-ui text-sm text-stone">
            Comprehensive writing on Slow Craft, Aesthetics, and Curation.
          </p>
        </div>
        {ESSAYS.map((essay) => (
          <div key={essay.title} className="flex gap-6">
            <img
              src={essay.image}
              alt=""
              className="hidden h-[180px] w-[240px] shrink-0 rounded-sm object-cover object-top sm:block"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="font-ui text-[11px] font-bold uppercase text-coral">{essay.tag}</span>
                <span className="size-[3px] rounded-full bg-taupe" />
                <span className="font-ui text-[11px] text-taupe">by {essay.author}</span>
              </div>
              <h3 className="font-editorial text-2xl font-medium leading-[1.2] text-charcoal">
                {essay.title}
              </h3>
              <p className="font-ui text-sm leading-[1.5] text-stone">{essay.body}</p>
              <span className="font-ui text-[13px] font-bold text-charcoal underline">Read Article</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-6 rounded-sm bg-sand-warm p-8 lg:w-[405px] lg:shrink-0">
        <h2 className="font-editorial text-2xl font-semibold text-charcoal">Popular This Week</h2>
        <div className="flex flex-col">
          {POPULAR.map((item, i) => (
            <div
              key={item.title}
              className={`flex gap-4 py-3 ${i < POPULAR.length - 1 ? "border-b border-hairline" : ""}`}
            >
              <span className="font-editorial w-10 shrink-0 text-3xl font-semibold text-coral">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex flex-col gap-1">
                <span className="font-ui text-[10px] font-bold uppercase text-taupe">
                  {item.category}
                </span>
                <p className="font-ui text-sm font-semibold leading-[1.3] text-charcoal">
                  {item.title}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
