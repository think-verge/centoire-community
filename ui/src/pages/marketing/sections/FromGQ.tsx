import gq1 from "../../../assets/landing/gq-1.jpg";
import gq2 from "../../../assets/landing/gq-2.jpg";
import gq3 from "../../../assets/landing/gq-3.jpg";
import gq4 from "../../../assets/landing/gq-4.jpg";

const CARDS = [
  { image: gq1, category: "Sartorial", title: "The Modern Gentleman's Essential Wardrobe" },
  { image: gq2, category: "Grooming", title: "The Best Summer Wood Fragrances of 2026" },
  { image: gq3, category: "Street Style", title: "Milan Report: The Return of Oversized Outerwear" },
  { image: gq4, category: "Travel", title: "Minimalist Hideaways: European Coffee Culture" },
];

export function FromGQ() {
  return (
    <section className="flex flex-col gap-12 px-6 py-16 sm:px-20 sm:py-24">
      <div className="flex flex-wrap items-baseline gap-4">
        <h2 className="font-feature text-3xl text-charcoal sm:text-[32px]">From GQ</h2>
        <span className="font-ui text-sm font-semibold text-[#55524e]">Menswear & Lifestyle</span>
      </div>

      <div className="flex gap-6 overflow-x-auto pb-2">
        {CARDS.map((card) => (
          <div key={card.title} className="flex w-[260px] shrink-0 flex-col gap-4 sm:w-[302px]">
            <img
              src={card.image}
              alt=""
              className="h-[280px] w-full rounded-[8px] object-cover object-top sm:h-[320px]"
            />
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="font-ui text-[11px] font-bold uppercase text-ochre">GQ</span>
                <span className="size-1 rounded-full bg-taupe" />
                <span className="font-ui text-[11px] font-medium uppercase text-taupe">
                  {card.category}
                </span>
              </div>
              <h3 className="font-feature text-2xl leading-[1.15] text-charcoal">{card.title}</h3>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
