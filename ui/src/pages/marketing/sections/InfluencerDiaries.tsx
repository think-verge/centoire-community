import avatar from "../../../assets/landing/avatar.jpg";

const DIARIES = [
  {
    name: "Elena V. Rostova",
    quote:
      "“Dressing with intention is a silent conversation with your surroundings. I choose pieces that match the architecture.”",
    topic: "Linen Trench & Brutalism",
  },
  {
    name: "Camille Lafleur",
    quote:
      "“I'm stepping back from seasonal drops. I want garments with structural integrity that feel complete up close.”",
    topic: "Raw Weaves & Natural Fibers",
  },
  {
    name: "Hiroshi Jin Aoki",
    quote:
      "“The spaces we reside in should flow directly into our closets. Earth pigments bridging stoneware and drapes.”",
    topic: "Stoneware & Wardrobe Tone",
  },
  {
    name: "Sophia Sterling",
    quote:
      "“A well-balanced outfit has weight but zero heaviness. It's about engineering gravity inside the linen layers.”",
    topic: "Unstructured Summer Suits",
  },
];

export function InfluencerDiaries() {
  return (
    <section className="flex flex-col gap-12 border-b border-sand-deep px-6 py-16 sm:px-20 sm:py-24">
      <div className="flex flex-col gap-3">
        <h2 className="font-editorial text-3xl text-charcoal sm:text-[40px]">Influencer Diaries</h2>
        <p className="font-ui text-base text-stone">
          Personal dispatches, styling journals, and unfiltered closets.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {DIARIES.map((diary) => (
          <div
            key={diary.name}
            className="flex flex-col gap-6 rounded-lg border border-hairline bg-sand p-8"
          >
            <div className="flex items-center gap-4">
              <img src={avatar} alt="" className="size-12 rounded-full object-cover" />
              <div className="flex flex-col gap-0.5">
                <p className="font-ui text-sm font-bold text-charcoal">{diary.name}</p>
                <p className="font-ui text-xs font-semibold text-coral">Style Journal</p>
              </div>
            </div>
            <p className="font-editorial text-xl leading-[1.4] text-stone">{diary.quote}</p>
            <div className="flex flex-col gap-1">
              <span className="font-ui text-[11px] font-semibold uppercase text-taupe">
                Topic Discussed
              </span>
              <span className="font-ui text-[13px] font-semibold text-charcoal">{diary.topic}</span>
            </div>
            <span className="font-ui text-[13px] font-bold text-charcoal underline">Read Diary</span>
          </div>
        ))}
      </div>
    </section>
  );
}
