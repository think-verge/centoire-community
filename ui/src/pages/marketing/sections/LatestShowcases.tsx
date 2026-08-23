import showcaseLg from "../../../assets/landing/showcase-lg.jpg";
import showcaseMd1 from "../../../assets/landing/showcase-md-1.jpg";
import showcaseMd2 from "../../../assets/landing/showcase-md-2.jpg";

function ShowcaseCard({
  image,
  label,
  title,
  className = "",
}: {
  image: string;
  label: string;
  title: string;
  className?: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-[12px] ${className}`}>
      <img src={image} alt="" className="absolute inset-0 size-full object-cover object-top" />
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-6">
        <span className="font-ui text-[11px] font-bold uppercase text-white">{label}</span>
        <h3 className="font-editorial text-2xl leading-[1.1] text-white sm:text-[32px]">{title}</h3>
      </div>
    </div>
  );
}

export function LatestShowcases() {
  return (
    <section className="flex flex-col gap-12 border-b border-hairline px-6 py-16 sm:px-20 sm:py-24">
      <div className="flex flex-col gap-3">
        <h2 className="font-editorial text-3xl text-charcoal sm:text-[40px]">Latest News</h2>
        <p className="font-ui text-base text-stone">
          A curated tapestry of runway capsules, seasonal editorials, and design spaces.
        </p>
      </div>

      <div className="flex flex-col gap-8 sm:flex-row">
        <ShowcaseCard
          image={showcaseLg}
          label="VOGUE EDITORIAL"
          title="Pristine Textures: The Nordic Summer Retreat"
          className="h-[320px] flex-1 sm:h-[580px]"
        />
        <div className="flex flex-1 flex-col gap-8">
          <ShowcaseCard
            image={showcaseMd1}
            label="HARPER'S COUTURE"
            title="The Reimagined Classic Evening Drapes"
            className="h-[220px] sm:h-[274px]"
          />
          <ShowcaseCard
            image={showcaseMd2}
            label="W MAGAZINE ART"
            title="Monochromatic Pigment Layers of the 70s"
            className="h-[220px] sm:h-[274px]"
          />
        </div>
      </div>
    </section>
  );
}
