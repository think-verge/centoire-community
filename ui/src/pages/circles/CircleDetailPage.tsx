import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CircleRulesModal } from "../../components/CircleRulesModal";
import { PostCard } from "../../components/PostCard";
import {
  useGetCircle,
  useJoinCircle,
  useLeaveCircle,
  useListCircleMembers,
  useListCirclePosts,
} from "../../lib/api/generated/circles/circles";

// Mock Data for "Circle highlights"
const HIGHLIGHTS = [
  { id: 1, title: "Weekly fit check", description: "Share your latest outfit and get constructive feedback from the community.", badge: "T", posts: "2.1k" },
  { id: 2, title: "Member spotlights", description: "Discover fresh perspectives and standout style moments from active members.", badge: "T", posts: "1.8k" },
  { id: 3, title: "Style Q&A", description: "Ask for advice on fit, color, and styling decisions before you post.", badge: "T", posts: "1.4k" },
];

export function CircleDetailPage() {
  const { slug } = useParams();
  const [rulesOpen, setRulesOpen] = useState(false);
  const { data: circle, isLoading, refetch } = useGetCircle(slug ?? "");
  const { data: posts, isLoading: postsLoading } = useListCirclePosts(slug ?? "");

  // We grab members just to show top 3 as moderators/avatars
  const { data: members } = useListCircleMembers(slug ?? "");

  const join = useJoinCircle({ mutation: { onSuccess: () => refetch() } });
  const leave = useLeaveCircle({ mutation: { onSuccess: () => refetch() } });

  if (isLoading) return <div className="p-10 text-ink-faint font-ui">Loading...</div>;
  if (!circle) {
    return (
      <div className="p-10 text-center">
        <p className="kicker mb-2">Not found</p>
        <p className="text-ink-soft font-ui">This circle does not exist.</p>
      </div>
    );
  }

  const joined = Boolean(circle.viewerRole);

  // Moderators mock (first 3 members)
  const moderators = members?.slice(0, 3) || [];

  function handleJoinClick() {
    if (!circle) return;
    if (joined) {
      leave.mutate({ slug: circle.slug });
    } else if (circle.rules.length > 0) {
      setRulesOpen(true);
    } else {
      join.mutate({ slug: circle.slug });
    }
  }

  return (
    <div className="flex flex-col lg:flex-row bg-[#F0F0F0]">

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 pb-12">
        {/* Banner area */}
        <div className="relative">
          <div className="h-[100px] sm:h-[120px] w-full bg-[#E5E5E5] overflow-hidden">
            {circle.coverImageUrl ? (
              <img src={circle.coverImageUrl} alt="Cover" className="w-full h-full object-cover" />
            ) : (
              // Fallback placeholder image matching screenshot tone if empty
              <img src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2070&auto=format&fit=crop" alt="Cover" className="w-full h-full object-cover opacity-80" />
            )}
          </div>
          <div className="absolute bottom-0 left-0 w-full translate-y-[45%] px-6 sm:px-10 flex justify-between items-end">
            <div className="size-[90px] sm:size-[110px] rounded-full border-[4px] border-[#FAFAFA] bg-white overflow-hidden shadow-sm">
              {circle.avatarUrl ? (
                <img src={circle.avatarUrl} alt={circle.name} className="w-full h-full object-cover" />
              ) : (
                <img src="https://images.unsplash.com/photo-1582552938357-32b906df40cb?auto=format&fit=crop&q=80&w=200" alt={circle.name} className="w-full h-full object-cover" />
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleJoinClick}
                disabled={join.isPending || leave.isPending}
                className="rounded-[20px] border border-[#111111] bg-transparent px-5 sm:px-6 py-1.5 sm:py-2 font-ui text-[13px] font-bold text-[#111111] transition-colors hover:bg-black hover:text-white disabled:opacity-50"
              >
                {joined ? "Joined" : "Join circle"}
              </button>
              {joined && (
                <Link
                  to="/compose"
                  className="rounded-[20px] bg-[#111111] px-5 sm:px-6 py-1.5 sm:py-2 font-ui text-[13px] font-bold text-white transition-colors hover:bg-black"
                >
                  Create post
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Title and Intro */}
        <div className="mt-[50px] sm:mt-[60px] px-6 sm:px-10">
          <h1 className="font-editorial text-[28px] sm:text-[32px] font-medium text-[#111111] leading-tight mb-1">
            {circle.name}
          </h1>
          <p className="font-ui text-[14px] sm:text-[15px] text-[#5A5A5A] leading-relaxed max-w-3xl">
            {circle.description}
          </p>
        </div>

        <hr className="my-5 mx-6 sm:mx-10 border-t border-[#D0D0D0]" />

        {/* Circle Highlights */}
        <div className="px-6 sm:px-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-ui text-[16px] font-bold text-[#111111]">Circle highlights</h2>
            <button className="font-ui text-[13px] font-medium text-[#5A5A5A] hover:text-[#111111]">View all</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {HIGHLIGHTS.map(h => (
              <div key={h.id} className="bg-white border border-[#EAEAEA] rounded-[16px] px-5 py-3.5 shadow-[0_4px_16px_rgba(0,0,0,0.06)] flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="size-8 rounded-full bg-[#111111] text-white flex items-center justify-center font-ui text-[13px] font-bold">
                    {h.badge}
                  </div>
                  <span className="font-ui text-[11px] font-bold text-[#111111] bg-[#F5F5F5] px-2.5 py-1 rounded-full">
                    {h.posts}
                  </span>
                </div>
                <h3 className="font-ui text-[15px] font-bold text-[#111111] mb-1.5">{h.title}</h3>
                <p className="font-ui text-[13px] text-[#8A8A8A] leading-snug line-clamp-3">
                  {h.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Posts Feed Header */}
        <div className="mt-4 px-6 sm:px-10 flex items-center justify-between mb-3">
          <h2 className="font-ui text-[16px] font-bold text-[#111111]">Feed</h2>
          <button className="flex items-center gap-1.5 font-ui text-[14px] font-medium text-[#111111] bg-white border border-[#EAEAEA] rounded-full px-4 py-1.5 focus:outline-none cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:bg-gray-50">
            Filters
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          </button>
        </div>

        {/* Vertical Feed */}
        <div className="px-6 sm:px-10 space-y-5">
          {postsLoading ? (
            <p className="font-ui text-[14px] text-[#8A8A8A]">Loading posts...</p>
          ) : posts?.length === 0 ? (
            <div className="space-y-5">
              {/* Mock Post 1 */}
              <div className="rounded-[16px] border border-[#EAEAEA] bg-white p-5 shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="size-11 rounded-full bg-[#3b5998] text-white flex items-center justify-center font-ui text-[15px] font-bold">A</div>
                    <div>
                      <p className="font-ui text-[14px] font-bold text-[#111111]">Amelia Rose</p>
                      <p className="font-ui text-[12px] text-[#8A8A8A]">2h ago • 1.2k comments</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="text-[#A3A3A3] hover:text-[#111111] px-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                    </button>
                    <button className="text-[#5A5A5A] hover:text-[#111111] border border-[#EAEAEA] rounded-[8px] size-7 flex items-center justify-center bg-white hover:bg-gray-50 transition-colors">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                    </button>
                  </div>
                </div>
                <h3 className="font-editorial text-[22px] font-medium text-[#111111] mb-2 leading-snug">What onboarding flow changes actually made your circle feel more welcoming?</h3>
                <p className="font-ui text-[14px] text-[#5A5A5A] leading-relaxed mb-4">We're rebuilding the first week of our circle and I want to hear from people who have already shipped something that worked. What changed the vibe, what reduced drop-off, and what made members actually start posting?</p>
                <div className="flex items-center gap-5 text-[#333333] font-ui text-[13px] font-bold">
                  <span className="flex items-center gap-1.5"><svg className="text-[#8A8A8A]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19V5M5 12l7-7 7 7" /></svg> 2.4k</span>
                  <span className="flex items-center gap-1.5"><svg className="text-[#8A8A8A]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M19 12l-7 7-7-7" /></svg> 18</span>
                  <span className="flex items-center gap-1.5"><svg className="text-[#8A8A8A]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> 1.2k</span>
                  <span className="flex items-center gap-1.5"><svg className="text-[#8A8A8A]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg> 84</span>
                  <span className="flex items-center gap-1.5"><svg className="text-[#8A8A8A]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg> 312</span>
                </div>
              </div>

              {/* Mock Post 2 */}
              <div className="rounded-[16px] border border-[#EAEAEA] bg-white p-5 shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="size-11 rounded-full bg-[#119822] text-white flex items-center justify-center font-ui text-[15px] font-bold">M</div>
                    <div>
                      <p className="font-ui text-[14px] font-bold text-[#111111]">Maya Patel</p>
                      <p className="font-ui text-[12px] text-[#8A8A8A]">8h ago • 1.1k comments</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="text-[#A3A3A3] hover:text-[#111111] px-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                    </button>
                    <button className="text-[#5A5A5A] hover:text-[#111111] border border-[#EAEAEA] rounded-[8px] size-7 flex items-center justify-center bg-white hover:bg-gray-50 transition-colors">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                    </button>
                  </div>
                </div>
                <h3 className="font-editorial text-[22px] font-medium text-[#111111] mb-2 leading-snug">How to make video posts feel less formal and more like a real discussion</h3>
                <p className="font-ui text-[14px] text-[#5A5A5A] leading-relaxed mb-4">I recorded a quick walkthrough of our moderation workflow and people loved it. The key was keeping it short, using a conversational tone, and treating it like a live conversation instead of a polished tutorial.</p>
                <div className="relative -mx-5 h-[280px] overflow-hidden mb-4 bg-gray-100">
                  <img src="https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&q=80&w=800" alt="Post media" className="w-full h-full object-cover" />
                  <div className="absolute top-3 left-5 bg-white/90 backdrop-blur text-[#111111] text-[11px] font-bold px-2 py-1 rounded-full">video post</div>
                  <div className="absolute bottom-3 right-5 bg-black/70 text-white text-[11px] font-bold px-2 py-1 rounded-full">4:12</div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-12 rounded-full bg-black/40 flex items-center justify-center border border-white/20">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M5 3l14 9-14 9V3z" /></svg>
                  </div>
                </div>
                <div className="flex items-center gap-5 text-[#333333] font-ui text-[13px] font-bold">
                  <span className="flex items-center gap-1.5"><svg className="text-[#8A8A8A]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19V5M5 12l7-7 7 7" /></svg> 1.6k</span>
                  <span className="flex items-center gap-1.5"><svg className="text-[#8A8A8A]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M19 12l-7 7-7-7" /></svg> 9</span>
                  <span className="flex items-center gap-1.5"><svg className="text-[#8A8A8A]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> 1.1k</span>
                  <span className="flex items-center gap-1.5"><svg className="text-[#8A8A8A]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg> 59</span>
                  <span className="flex items-center gap-1.5"><svg className="text-[#8A8A8A]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg> 219</span>
                </div>
              </div>

              {/* Mock Post 3 */}
              <div className="rounded-[16px] border border-[#EAEAEA] bg-white p-5 shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="size-11 rounded-full bg-[#6a1b9a] text-white flex items-center justify-center font-ui text-[15px] font-bold">O</div>
                    <div>
                      <p className="font-ui text-[14px] font-bold text-[#111111]">Olivia Bennett</p>
                      <p className="font-ui text-[12px] text-[#8A8A8A]">18h ago • 756 comments</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="text-[#A3A3A3] hover:text-[#111111] px-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                    </button>
                    <button className="text-[#5A5A5A] hover:text-[#111111] border border-[#EAEAEA] rounded-[8px] size-7 flex items-center justify-center bg-white hover:bg-gray-50 transition-colors">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                    </button>
                  </div>
                </div>
                <h3 className="font-editorial text-[22px] font-medium text-[#111111] mb-2 leading-snug">How to turn a weekly thread into a recurring discussion people actually look forward to</h3>
                <p className="font-ui text-[14px] text-[#5A5A5A] leading-relaxed mb-4">We used to post a weekly update and it felt like homework. Now we frame it as a discussion prompt and people show up because they want to participate, not just because they have to.</p>
                <div className="relative -mx-5 h-[280px] overflow-hidden mb-4 bg-gray-100">
                  <img src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=800" alt="Post media" className="w-full h-full object-cover" />
                  <div className="absolute top-3 left-5 bg-white/90 backdrop-blur text-[#111111] text-[11px] font-bold px-2 py-1 rounded-full">photo post</div>
                </div>
                <div className="flex items-center gap-5 text-[#333333] font-ui text-[13px] font-bold">
                  <span className="flex items-center gap-1.5"><svg className="text-[#8A8A8A]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19V5M5 12l7-7 7 7" /></svg> 1.1k</span>
                  <span className="flex items-center gap-1.5"><svg className="text-[#8A8A8A]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M19 12l-7 7-7-7" /></svg> 8</span>
                  <span className="flex items-center gap-1.5"><svg className="text-[#8A8A8A]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> 756</span>
                  <span className="flex items-center gap-1.5"><svg className="text-[#8A8A8A]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg> 46</span>
                  <span className="flex items-center gap-1.5"><svg className="text-[#8A8A8A]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg> 191</span>
                </div>
              </div>

              {/* Mock Post 4 */}
              <div className="rounded-[16px] border border-[#EAEAEA] bg-white p-5 shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="size-11 rounded-full bg-[#1b9a22] text-white flex items-center justify-center font-ui text-[15px] font-bold">N</div>
                    <div>
                      <p className="font-ui text-[14px] font-bold text-[#111111]">Nora Chen</p>
                      <p className="font-ui text-[12px] text-[#8A8A8A]">1d ago • 612 comments</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="text-[#A3A3A3] hover:text-[#111111] px-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                    </button>
                    <button className="text-[#5A5A5A] hover:text-[#111111] border border-[#EAEAEA] rounded-[8px] size-7 flex items-center justify-center bg-white hover:bg-gray-50 transition-colors">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                    </button>
                  </div>
                </div>
                <h3 className="font-editorial text-[22px] font-medium text-[#111111] mb-2 leading-snug">What makes a community post feel like a real discussion instead of a blog post?</h3>
                <p className="font-ui text-[14px] text-[#5A5A5A] leading-relaxed mb-4">I'm looking for the language, the structure, and the prompts that make people respond like they're talking to each other instead of reading a newsletter.</p>
                <div className="relative -mx-5 h-[280px] overflow-hidden mb-4 bg-gray-100">
                  <img src="https://images.unsplash.com/photo-1584916201218-f4242ceb4809?auto=format&fit=crop&q=80&w=800" alt="Post media" className="w-full h-full object-cover" />
                  <div className="absolute top-3 left-5 bg-white/90 backdrop-blur text-[#111111] text-[11px] font-bold px-2 py-1 rounded-full">photo post</div>
                </div>
                <div className="flex items-center gap-5 text-[#333333] font-ui text-[13px] font-bold">
                  <span className="flex items-center gap-1.5"><svg className="text-[#8A8A8A]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19V5M5 12l7-7 7 7" /></svg> 1.0k</span>
                  <span className="flex items-center gap-1.5"><svg className="text-[#8A8A8A]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M19 12l-7 7-7-7" /></svg> 6</span>
                  <span className="flex items-center gap-1.5"><svg className="text-[#8A8A8A]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> 612</span>
                  <span className="flex items-center gap-1.5"><svg className="text-[#8A8A8A]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg> 41</span>
                  <span className="flex items-center gap-1.5"><svg className="text-[#8A8A8A]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg> 176</span>
                </div>
              </div>
            </div>
          ) : (
            posts?.map(post => (
              <PostCard key={post.id} post={post} />
            ))
          )}
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-full lg:w-[300px] shrink-0 border-t lg:border-t-0 lg:border-l border-[#EAEAEA] bg-white">
        <div className="lg:sticky lg:top-14 px-6 pt-4 pb-6 sm:px-8 sm:pt-4 sm:pb-8 lg:overflow-y-auto lg:h-[calc(100vh-56px)] space-y-5 no-scrollbar">

          {/* Top Section */}
          <div>
            <h2 className="font-editorial text-[26px] font-medium text-[#111111] mb-1">
              {circle.name}
            </h2>
            <p className="font-ui text-[13px] text-[#5A5A5A] leading-relaxed mb-4">
              {circle.description}
            </p>
            <div className="flex gap-2">
              <div className="bg-[#F5F5F5] rounded-[12px] px-3 py-2 min-w-[85px]">
                <p className="font-ui text-[10px] font-bold text-[#8A8A8A] uppercase tracking-wider mb-1">MEMBERS</p>
                <p className="font-ui text-[16px] font-bold text-[#111111]">2.4k</p>
              </div>
              <div className="bg-[#F5F5F5] rounded-[12px] px-3 py-2 min-w-[85px]">
                <p className="font-ui text-[10px] font-bold text-[#8A8A8A] uppercase tracking-wider mb-1">POSTS</p>
                <p className="font-ui text-[16px] font-bold text-[#111111]">128</p>
              </div>
            </div>
          </div>

          <hr className="border-t border-[#EAEAEA]" />

          {/* About */}
          <div>
            <h3 className="font-ui text-[13px] font-bold text-[#8A8A8A] uppercase tracking-wider mb-3">ABOUT THE CIRCLE</h3>
            <p className="font-ui text-[13px] text-[#5A5A5A] leading-[1.6] mb-4">
              {circle.about || "Share runway analysis, street style observations, and seasonal trend notes. This circle is for readers who want to stay close to the fashion conversation without noise."}
            </p>
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full border border-[#EAEAEA] bg-white px-2.5 py-1 font-ui text-[11px] text-[#111111]">Runway</span>
              <span className="rounded-full border border-[#EAEAEA] bg-white px-2.5 py-1 font-ui text-[11px] text-[#111111]">Street Style</span>
              <span className="rounded-full border border-[#EAEAEA] bg-white px-2.5 py-1 font-ui text-[11px] text-[#111111]">Trends</span>
              <span className="rounded-full border border-[#EAEAEA] bg-white px-2.5 py-1 font-ui text-[11px] text-[#111111]">Collections</span>
            </div>
          </div>

          <hr className="border-t border-[#EAEAEA]" />

          {/* Rules */}
          <div>
            <h3 className="font-ui text-[13px] font-bold text-[#8A8A8A] uppercase tracking-wider mb-2">RULES</h3>
            <ul className="space-y-3">
              <li className="flex gap-2.5 items-start">
                <span className="mt-1.5 size-1.5 rounded-full bg-[#E5552D] shrink-0" />
                <span className="font-ui text-[12px] text-[#5A5A5A] leading-[1.5]">Keep posts focused on fashion, beauty, and lifestyle.</span>
              </li>
              <li className="flex gap-2.5 items-start">
                <span className="mt-1.5 size-1.5 rounded-full bg-[#E5552D] shrink-0" />
                <span className="font-ui text-[12px] text-[#5A5A5A] leading-[1.5]">Use the weekly prompts to start new conversations.</span>
              </li>
              <li className="flex gap-2.5 items-start">
                <span className="mt-1.5 size-1.5 rounded-full bg-[#E5552D] shrink-0" />
                <span className="font-ui text-[12px] text-[#5A5A5A] leading-[1.5]">No self-promotion, spam, or affiliate links.</span>
              </li>
              <li className="flex gap-2.5 items-start">
                <span className="mt-1.5 size-1.5 rounded-full bg-[#E5552D] shrink-0" />
                <span className="font-ui text-[12px] text-[#5A5A5A] leading-[1.5]">Be kind, respectful, and constructive<br/>in comments.</span>
              </li>
            </ul>
          </div>

          <hr className="border-t border-[#EAEAEA]" />

          {/* Membership */}
          <div>
            <h3 className="font-ui text-[13px] font-bold text-[#8A8A8A] uppercase tracking-wider mb-2">MEMBERSHIP</h3>
            <p className="font-ui text-[12px] text-[#5A5A5A] leading-relaxed mb-2">
              Open to members who want to read, share, and discuss fashion with a thoughtful community.
            </p>
            <div className="space-y-1.5 font-ui text-[12px]">
              <div className="flex justify-between items-center">
                <span className="text-[#8A8A8A]">Type</span>
                <span className="font-bold text-[#111111]">Public</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#8A8A8A]">Approval</span>
                <span className="font-bold text-[#111111]">Instant</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#8A8A8A]">Moderators</span>
                <div className="flex items-center gap-1 rounded-full border border-[#EAEAEA] pl-0.5 pr-1.5 py-0.5 bg-white">
                  <div className="flex -space-x-1.5">
                    {moderators.map((mod, i) => (
                      <div key={i} className="size-[18px] rounded-full border-[1.5px] border-white overflow-hidden bg-[#F0F0F0] relative z-[1]">
                        {mod.user.avatarUrl ? (
                          <img src={mod.user.avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <img src={`https://i.pravatar.cc/100?u=${mod.user.id || i}`} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>
                    ))}
                    {moderators.length === 0 && (
                      <>
                        <img src="https://i.pravatar.cc/100?img=1" className="size-[18px] rounded-full border-[1.5px] border-white object-cover relative z-[3]" />
                        <img src="https://i.pravatar.cc/100?img=2" className="size-[18px] rounded-full border-[1.5px] border-white object-cover relative z-[2]" />
                        <img src="https://i.pravatar.cc/100?img=3" className="size-[18px] rounded-full border-[1.5px] border-white object-cover relative z-[1]" />
                      </>
                    )}
                  </div>
                  <span className="font-bold text-[#111111] text-[11px]">{moderators.length > 0 ? moderators.length : 3}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Related Circles */}
          <div>
            <h3 className="font-ui text-[13px] font-bold text-[#8A8A8A] uppercase tracking-wider mb-3">RELATED CIRCLES</h3>
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full border border-[#EAEAEA] bg-white px-2.5 py-1 font-ui text-[11px] text-[#111111] cursor-pointer hover:border-[#111111]">Beauty Notes</span>
              <span className="rounded-full border border-[#EAEAEA] bg-white px-2.5 py-1 font-ui text-[11px] text-[#111111] cursor-pointer hover:border-[#111111]">Design Jobs</span>
              <span className="rounded-full border border-[#EAEAEA] bg-white px-2.5 py-1 font-ui text-[11px] text-[#111111] cursor-pointer hover:border-[#111111]">Street Style</span>
            </div>
          </div>

        </div>
      </div>

      {rulesOpen && (
        <CircleRulesModal
          circle={circle}
          onCancel={() => setRulesOpen(false)}
          onAgree={() =>
            join.mutate(
              { slug: circle.slug },
              { onSuccess: () => setRulesOpen(false) },
            )
          }
          loading={join.isPending}
        />
      )}
    </div>
  );
}
