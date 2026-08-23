import thumb1 from "../../../assets/landing/mustread-thumb-1.jpg";
import thumb2 from "../../../assets/landing/mustread-thumb-2.jpg";
import thumb3 from "../../../assets/landing/mustread-thumb-3.jpg";
import thumb4 from "../../../assets/landing/mustread-thumb-4.jpg";
import thumb5 from "../../../assets/landing/mustread-thumb-5.jpg";

const ITEMS = [
  {
    image: thumb1,
    source: "Vogue",
    title: "The Architecture of the Modern Linen Trench",
    body: "How tailoring houses are utilizing double-weave organic flax to create structural lines that resist summer humidity without synthetic stiffeners.",
  },
  {
    image: thumb2,
    source: "GQ",
    title: "Why Brutalist Home Fragrances Are Taking Over",
    body: "Heavy concrete votives and cold stone diffusers: why modern homes are trading traditional sweet notes for sharp cedar, wet clay, and industrial ash.",
  },
  {
    image: thumb3,
    source: "Wired Style",
    title: "The Digital Loom: Algorithmic Weaving Explained",
    body: "Apparel designers are pairing with custom machine scripts to generate flawless structural drapes previously impossible with mechanical weaving.",
  },
  {
    image: thumb4,
    source: "Harper's Bazaar",
    title: "The Raw Silk Paradigm Shift in Travel Wardrobes",
    body: "No monograms, no synthetic fibers. Why pristine, natural silks with rich texture are the definitive choice for premium transit silhouettes.",
  },
  {
    image: thumb5,
    source: "Vogue Living",
    title: "Post-Preservative Beauty: The Fresh Formulation Era",
    body: "Luxury beauty brands are completely abandoning synthetic parabens for botanical complexes that maintain formula stability at temperature.",
  },
];

export function MustReads() {
  return (
    <section className="flex flex-col gap-12 border-b border-hairline px-6 py-16 sm:px-20 sm:py-24">
      <div className="flex flex-col gap-3">
        <h2 className="font-editorial text-3xl text-charcoal sm:text-[40px]">Must Reads</h2>
        <p className="font-ui text-base text-stone">
          The ranked, aggregated broadsheet edit. Community metrics meet editorial oversight.
        </p>
      </div>

      <div className="flex flex-col">
        {ITEMS.map((item, i) => (
          <div
            key={item.title}
            className={`flex items-center gap-6 py-6 sm:gap-10 ${
              i < ITEMS.length - 1 ? "border-b border-hairline" : ""
            }`}
          >
            <span className="font-editorial w-10 shrink-0 text-3xl text-coral sm:w-12">
              {String(i + 1).padStart(2, "0")}
            </span>
            <img
              src={item.image}
              alt=""
              className="size-[72px] shrink-0 rounded-[6px] object-cover sm:size-[100px]"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="font-ui text-[11px] font-bold uppercase text-charcoal">
                  {item.source}
                </span>
                <span className="size-[3px] rounded-full bg-taupe" />
                <span className="font-ui text-[11px] text-taupe">Trending Now</span>
              </div>
              <h3 className="font-editorial text-xl leading-[1.2] text-charcoal sm:text-[26px]">
                {item.title}
              </h3>
              <p className="font-ui hidden text-sm leading-[1.5] text-stone sm:block">
                {item.body}
              </p>
            </div>
            <button
              type="button"
              aria-label="Read"
              className="hidden size-12 shrink-0 rounded-full border border-hairline transition-colors hover:border-coral sm:block"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
