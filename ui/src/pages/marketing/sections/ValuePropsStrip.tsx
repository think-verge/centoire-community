import iconBookOpen from "../../../assets/landing/icon-book-open.svg";
import iconSparkles from "../../../assets/landing/icon-sparkles.svg";
import iconClock from "../../../assets/landing/icon-clock.svg";
import iconBookmark from "../../../assets/landing/icon-bookmark.svg";

const PROPS = [
  {
    icon: iconBookOpen,
    title: "Curated from 50+ Sources",
    body: "Vogue, GQ, Harper's and beyond",
  },
  {
    icon: iconSparkles,
    title: "Personalized to Your Taste",
    body: "An algorithmic feed that learns what you love",
  },
  {
    icon: iconClock,
    title: "Updated Daily",
    body: "No slow cycles. Fresh global insights every day",
  },
  {
    icon: iconBookmark,
    title: "Save & Share Collections",
    body: "Build private boards and share lookbooks",
  },
];

export function ValuePropsStrip() {
  return (
    <section className="flex flex-col gap-8 border-b border-hairline bg-sand-deep px-6 py-10 sm:flex-row sm:items-start sm:justify-between sm:px-20">
      {PROPS.map((prop) => (
        <div key={prop.title} className="flex max-w-[260px] flex-col items-start gap-2">
          <div className="flex size-9 items-center justify-center rounded-[18px] border border-hairline bg-white">
            <img src={prop.icon} alt="" className="size-4" />
          </div>
          <p className="font-ui text-[15px] font-bold text-charcoal">{prop.title}</p>
          <p className="font-ui text-[13px] leading-[1.4] text-stone">{prop.body}</p>
        </div>
      ))}
    </section>
  );
}
