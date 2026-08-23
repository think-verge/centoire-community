import featureImg from "../../../assets/landing/editorial-feature.jpg";
import thumb1 from "../../../assets/landing/editorial-thumb-1.jpg";
import thumb2 from "../../../assets/landing/editorial-thumb-2.jpg";
import thumb3 from "../../../assets/landing/editorial-thumb-3.jpg";

function CategoryPill({ brand, topic }: { brand: string; topic: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-ui text-[11px] font-bold uppercase text-coral">{brand}</span>
      <span className="size-1 rounded-full bg-taupe" />
      <span className="font-ui text-[11px] font-medium uppercase text-taupe">{topic}</span>
    </div>
  );
}

const STACKED = [
  {
    image: thumb1,
    brand: "Elle",
    topic: "Accessories",
    title: "The Return of the Heavy Buckle",
  },
  {
    image: thumb2,
    brand: "GQ",
    topic: "Style Guide",
    title: "Unstructured Tailoring for Spring",
  },
  {
    image: thumb3,
    brand: "Harper's Bazaar",
    topic: "Aesthetic",
    title: "Earth Pigments and Raw Stoneware",
  },
];

export function EditorialPicks() {
  return (
    <section className="flex flex-col gap-12 border-b border-hairline px-6 py-16 sm:px-20 sm:py-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-3">
          <h2 className="font-editorial text-3xl text-charcoal sm:text-[40px]">Editorial Picks</h2>
          <p className="font-ui text-base text-stone">
            An asymmetric curation of the season's strongest design directions.
          </p>
        </div>
        <span className="font-ui cursor-default text-sm font-bold uppercase text-charcoal underline">
          View All Blogs
        </span>
      </div>

      <div className="flex flex-col gap-12 lg:flex-row lg:items-start">
        <div className="flex flex-1 flex-col gap-6">
          <img src={featureImg} alt="" className="h-auto w-full rounded-sm object-cover object-top sm:h-[480px]" />
          <div className="flex flex-col gap-3">
            <CategoryPill brand="Vogue" topic="Artisanal Curation" />
            <h3 className="font-editorial text-3xl leading-[1.1] text-charcoal sm:text-[44px]">
              The Art of Dressing Well in 2026
            </h3>
            <p className="font-ui text-base leading-[1.6] text-stone">
              We examine the return of raw, unprocessed linens, and heavy sculptural drapery that
              rejects trend cycles in favor of slow, permanent forms. Why quiet statements are the
              loud new default.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-8 lg:w-[500px] lg:shrink-0">
          {STACKED.map((item, i) => (
            <div
              key={item.title}
              className={`flex gap-6 ${i < STACKED.length - 1 ? "border-b border-hairline pb-6" : ""}`}
            >
              <img
                src={item.image}
                alt=""
                className="size-[140px] shrink-0 rounded-[6px] object-cover object-top"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <CategoryPill brand={item.brand} topic={item.topic} />
                <h3 className="font-editorial text-[22px] leading-[1.2] text-charcoal">
                  {item.title}
                </h3>
                <span className="font-ui text-[13px] font-bold text-charcoal underline">
                  Read Article
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
