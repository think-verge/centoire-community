import { useRef, useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AvatarBubble } from "../../components/AppShell";
import {
  useCompleteOnboarding,
  useSetInterests,
  useUpdateMe,
  useFollowUser,
  useUnfollowUser,
} from "../../lib/api/generated/users/users";
import { useJoinCircle, useLeaveCircle } from "../../lib/api/generated/circles/circles";
import { useListTags } from "../../lib/api/generated/tags/tags";
import { useGetOnboardingSuggestions } from "../../lib/api/generated/onboarding/onboarding";
import { uploadImage } from "../../lib/api/generated/uploads/uploads";

import { useAuth } from "../../lib/auth-context";
import logoDark from "../../assets/landing/logo-dark.svg";



export function OnboardingPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const stepParam = parseInt(searchParams.get("step") || "1", 10);
  const currentStep = isNaN(stepParam) || stepParam < 1 || stepParam > 3 ? 1 : stepParam;

  // 0-indexed step for array indexing
  const step = currentStep - 1;

  function setStep(newStepIndex: number) {
    setSearchParams({ step: (newStepIndex + 1).toString() });
  }

  return (
    <main className="min-h-screen w-full bg-[#ECEBE7] flex flex-col pt-[80px] pb-12 px-4 sm:px-8">
      <div className={`w-full max-w-[800px] h-auto max-h-[calc(100vh-128px)] mb-auto mx-auto bg-white p-12 border border-[#E5E5E5] shadow-[0_2px_16px_rgba(0,0,0,0.04)] flex flex-col gap-9 transition-all duration-300 ease-in-out`}>
        {/* Top Logo */}
        <div className="flex justify-center shrink-0">
          <img src={logoDark} alt="Centoire" className="h-8 sm:h-9 w-auto" />
        </div>

        <header className="flex items-center justify-between shrink-0">
          <div className="rounded-full bg-[#FCEEE8] px-3.5 py-1 font-ui text-[12px] font-bold uppercase tracking-tight text-[#E5552D]/80">
            STEP {step + 1} OF 3
          </div>
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-colors ${i === step ? "w-[26px] bg-[#D85834]" : "w-[14px] bg-[#F6D9D0]"
                  }`}
              />
            ))}
          </div>
        </header>

        {step === 0 && <InterestsStep onDone={() => setStep(1)} onBack={() => navigate("/")} />}
        {step === 1 && <FollowStep onDone={() => setStep(2)} onBack={() => setStep(0)} />}
        {step === 2 && <ProfileStep onBack={() => setStep(1)} />}
      </div>
    </main>
  );
}

function InterestsStep({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(),
  );
  const setInterests = useSetInterests({
    mutation: {
      onSuccess: onDone,
    },
  });
  const { data: tags } = useListTags();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <section className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-9">
        <h1 className="font-editorial text-[32px] sm:text-[32px] font-normal text-charcoal leading-tight">
          Tailor your Broadsheet
        </h1>
        <p className="mt-3 text-[#8A8A8A] font-ui text-[14px] sm:text-[14px] leading-[1.6] pr-0 whitespace-nowrap">
          Select multiple niches below. We configure your daily Centoire feed based on these slow-fashion indices.
        </p>

        <div className="mt-10 flex flex-wrap gap-x-2 gap-y-3">
          {(tags ?? []).map((tag) => {
            const active = selected.has(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggle(tag.id)}
                className={`font-ui rounded-full border px-3.5 py-1.5 text-[13px] outline-none focus:ring-0 transition-colors ${active
                  ? "border-[#E5552D] bg-[#E5552D] text-white"
                  : "border-[#E5E5E5] bg-white text-[#111111] hover:border-[#D4D4D4]"
                  }`}
              >
                {tag.name}
              </button>
            );
          })}
        </div>
      </div>

      {setInterests.error && (
        <p className="font-ui text-[12px] font-medium text-[#E15A3A] pt-2">
          {setInterests.error.message}
        </p>
      )}
      <div className="pt-6 border-t border-[#F2EDE4] flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="font-ui text-[14px] font-medium text-[#111111] hover:opacity-70 transition-opacity"
        >
          Back
        </button>
        <div className="flex items-center gap-5">
          <p className="text-[14px] font-ui text-[#9B9B9B]">
            Pick atleast 3
          </p>
          <button
            type="button"
            disabled={selected.size < 3 || setInterests.isPending}
            onClick={() => setInterests.mutate({ data: { tagIds: [...selected] } })}
            className={`px-8 py-3.5 font-ui text-[13px] font-bold uppercase tracking-wider transition-colors flex items-center gap-2 ${selected.size >= 3
              ? "bg-[#111111] text-white hover:bg-black"
              : "bg-[#C9C9C9] text-white cursor-not-allowed"
              }`}
          >
            CONTINUE
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}

function FollowStep({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const { data, isLoading } = useGetOnboardingSuggestions();
  
  const followUser = useFollowUser();
  const unfollowUser = useUnfollowUser();
  const joinCircle = useJoinCircle();
  const leaveCircle = useLeaveCircle();

  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());

  const curatorsRef = useRef<HTMLDivElement>(null);
  const circlesRef = useRef<HTMLDivElement>(null);

  const scrollCurators = (dir: 'left' | 'right') => {
    if (curatorsRef.current) {
      curatorsRef.current.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });
    }
  };

  const scrollCircles = (dir: 'up' | 'down') => {
    if (circlesRef.current) {
      circlesRef.current.scrollBy({ top: dir === 'up' ? -200 : 200, behavior: 'smooth' });
    }
  };

  // Initialize from backend data, only counting items that are actually displayed
  useEffect(() => {
    if (data) {
      const creatorIds = data.creators.map(c => c.id);
      const circleSlugs = data.circles.map(c => c.slug);
      
      setFollowedIds(new Set((data.followedCreatorIds || []).filter(id => creatorIds.includes(id))));
      setJoinedIds(new Set((data.joinedCircleIds || []).filter(slug => circleSlugs.includes(slug))));
    }
  }, [data]);

  const totalFollows = followedIds.size + joinedIds.size;

  function toggleFollow(id: string) {
    if (followedIds.has(id)) {
      unfollowUser.mutate({ id });
      setFollowedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } else {
      followUser.mutate({ id });
      setFollowedIds(prev => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    }
  }

  function toggleJoin(id: string) {
    if (joinedIds.has(id)) {
      leaveCircle.mutate({ slug: id }); // API expects 'slug' for leaveCircle
      setJoinedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } else {
      joinCircle.mutate({ slug: id }); // API expects 'slug' for joinCircle
      setJoinedIds(prev => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    }
  }

  return (
    <section className="flex flex-col flex-1 min-h-0">
      <div className="relative flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-8">
          <h1 className="font-editorial text-[32px] sm:text-[32px] font-normal text-[#333333] leading-tight">
            Connect with Curation Circles
          </h1>
          <p className="mt-3 text-[#8A8A8A] font-ui text-[14px] sm:text-[14.5px] leading-[1.6] pr-0">
            Select suggested creators and circles below. Following at least 3 members or communities activates your personalized daily stream.
          </p>

          <div className="mt-10">
            <div className="flex items-center justify-between mb-2">
              <p className="font-ui text-[13px] font-semibold uppercase tracking-wider text-[#555555]">
                RECOMMENDED FASHION CURATORS
              </p>
              <div className="flex gap-4 text-[#555555] hidden sm:flex cursor-pointer">
                <svg onClick={() => scrollCurators('left')} className="size-6 hover:text-black transition-colors" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <svg onClick={() => scrollCurators('right')} className="size-6 hover:text-black transition-colors" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
            </div>
            <div ref={curatorsRef} className="flex gap-4 overflow-x-auto snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {isLoading || !data ? (
                // Skeletons
                Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex flex-col bg-[#EAEAEA] p-5 min-h-[220px] shrink-0 w-[calc(33.333%-10.66px)] snap-start">
                      <div className="flex items-center gap-3">
                      <div className="size-12 rounded-full bg-white animate-pulse shrink-0" />
                      <div className="flex flex-col gap-0 flex-1">
                        <div className="h-4 w-24 bg-white animate-pulse" />
                        <div className="h-3 w-16 bg-white animate-pulse mt-1" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-0 my-5 flex-1">
                      <div className="h-4 w-full bg-white animate-pulse" />
                      <div className="h-4 w-11/12 bg-white animate-pulse mt-1" />
                      <div className="h-4 w-4/5 bg-white animate-pulse mt-1" />
                    </div>
                    <div className="mt-auto w-full py-2 h-9 bg-white animate-pulse" />
                  </div>
                ))
              ) : data.creators.map((creator) => {
                const following = followedIds.has(creator.id);
                return (
                  <div
                    key={creator.id}
                    className="flex flex-col bg-[#EAEAEA] p-5 min-h-[220px] shrink-0 w-[calc(33.333%-10.66px)] snap-start"
                  >
                    <div className="flex items-center gap-3">
                      <AvatarBubble name={creator.displayName!} url={creator.avatarUrl || null} size="size-12 text-lg shrink-0" />
                      <div className="min-w-0">
                        <p className="font-ui font-bold text-[#111111] text-[15px] truncate">{creator.displayName}</p>
                        <p className="text-[13px] text-[#737373] truncate">@{creator.handle}</p>
                      </div>
                    </div>
                    <p className="font-ui tracking-tight text-[13.5px] text-[#5A5A5A] my-5 leading-[1.3] line-clamp-3">
                      {creator.bio}
                    </p>
                    <button
                      type="button"
                      onClick={() => toggleFollow(creator.id)}
                      className={`mt-auto w-full py-2 font-ui text-[13px] font-bold transition-colors ${following
                        ? "bg-[#E5552D] text-white hover:opacity-90"
                        : "bg-[#111111] text-white hover:bg-black"
                        }`}
                    >
                      {following ? "Following" : "Follow"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-10">
            <div className="flex items-center justify-between mb-3">
              <p className="font-ui text-[13px] font-semibold uppercase tracking-wider text-[#555555]">
                RECOMMENDED CIRCLES
              </p>
              <div className="flex gap-4 text-[#555555] cursor-pointer">
                <svg onClick={() => scrollCircles('up')} className="size-6 hover:text-black transition-colors" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M5 15l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <svg onClick={() => scrollCircles('down')} className="size-6 hover:text-black transition-colors" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
            </div>
            <div ref={circlesRef} className="flex flex-col gap-4 overflow-y-auto max-h-[172px] snap-y snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {isLoading || !data ? (
                // Skeletons
                Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between gap-4 bg-[#E5E5E5] px-5 py-3.5 shrink-0 snap-start">
                    <div className="size-10 shrink-0 rounded-full bg-white animate-pulse" />
                    <div className="flex-1 min-w-0 flex flex-col gap-0">
                      <div className="h-4 w-32 bg-white animate-pulse" />
                      <div className="h-3.5 w-full bg-white animate-pulse mt-1" />
                      <div className="h-3.5 w-1/2 bg-white animate-pulse mt-1" />
                    </div>
                    <div className="flex flex-col items-center shrink-0 w-[80px]">
                      <div className="w-full h-6 bg-white rounded-full animate-pulse" />
                      <div className="h-2 w-16 bg-white animate-pulse mt-1.5" />
                    </div>
                  </div>
                ))
              ) : data.circles.map((circle) => {
                const joined = joinedIds.has(circle.slug);
                return (
                  <div
                    key={circle.id}
                    className="flex items-center justify-between gap-4 bg-[#E5E5E5] px-5 py-3.5 shrink-0 snap-start"
                  >
                    <div className="size-10 shrink-0 rounded-full bg-[#111111] overflow-hidden flex items-center justify-center">
                      {circle.avatarUrl ? (
                        <img src={circle.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-display-serif text-white text-xl font-bold">{circle.name![0]}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-ui font-bold text-[#111111] text-[15px] truncate">
                        {circle.name}
                      </p>
                      <p className="font-ui text-[13px] tracking-tight text-[#5A5A5A] leading-[1.3] mt-0.5 line-clamp-2 whitespace-pre-line">{circle.description}</p>
                    </div>
                    <div className="flex flex-col items-center shrink-0 w-[80px]">
                      <button
                        type="button"
                        onClick={() => toggleJoin(circle.slug!)}
                        className={`w-full py-1 rounded-full font-ui text-[13px] font-bold transition-colors border ${joined
                          ? "bg-[#E5552D] text-white hover:opacity-90 border-transparent"
                          : "bg-white text-[#111111] hover:bg-gray-50 border-[#999999]"
                          }`}
                      >
                        {joined ? "Joined" : "Join"}
                      </button>
                      <p className="font-ui text-[9px] text-[#8A8A8A] mt-1.5 whitespace-nowrap text-center">
                        {circle.memberCount!.toLocaleString()} members
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-[#EAEAEA] flex items-center justify-between shrink-0">
        <button type="button" onClick={onBack} className="font-ui text-[14px] font-bold text-[#111111] hover:opacity-70">
          Back
        </button>
        <div className="flex items-center gap-5">
          <p className="text-[14px] font-ui text-[#9B9B9B]">
            {totalFollows < 1 ? `Pick at least 1 more to continue` : ""}
          </p>
          <button
            type="button"
            disabled={totalFollows < 1}
            onClick={onDone}
            className={`px-8 py-3.5 font-ui text-[13px] font-bold uppercase tracking-wider transition-colors flex items-center gap-2 ${totalFollows >= 1
              ? "bg-[#111111] text-white hover:bg-black"
              : "bg-[#C9C9C9] text-white cursor-not-allowed"
              }`}
          >
            CONTINUE
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}

function ProfileStep({ onBack }: { onBack: () => void }) {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [handle, setHandle] = useState(user?.handle ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>("editor");
  const [isSettingUp, setIsSettingUp] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const updateMe = useUpdateMe();
  const complete = useCompleteOnboarding({
    mutation: {
      onSuccess: async () => {
        await refresh();
        navigate("/feed", { replace: true });
      },
    },
  });

  const roles = [
    {
      id: "explorer",
      title: "Explorer",
      description: "I browse and discover trends",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-7" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="m15.5 8.5-2 5-5 2 2-5z" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: "creator",
      title: "Creator",
      description: "I curate and publish content",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-7" aria-hidden>
          <path d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: "professional",
      title: "Professional",
      description: "I work in fashion or luxury",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-7" aria-hidden>
          <rect x="3" y="8" width="18" height="13" rx="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 8V6a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="8" y1="8" x2="8" y2="21" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="16" y1="8" x2="16" y2="21" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
  ];

  async function handleAvatar(file: File) {
    setAvatarUploading(true);
    try {
      const result = await uploadImage({ file });
      setAvatarUrl(result.url);
    } finally {
      setAvatarUploading(false);
    }
  }

  async function finish() {
    setIsSettingUp(true);
    try {
      await Promise.all([
        updateMe.mutateAsync({
          data: { handle, bio: bio || undefined, avatarUrl: avatarUrl ?? undefined },
        }),
        new Promise((resolve) => setTimeout(resolve, 4000)), // 4-second minimum delay
      ]);
      await complete.mutateAsync();
    } catch {
      // Revert setup state if submission fails
      setIsSettingUp(false);
    }
  }

  const handleError = updateMe.error;
  const isValidHandle = /^[a-z0-9_]{3,24}$/.test(handle);
  const canSubmit = isValidHandle && !updateMe.isPending && !complete.isPending && selectedRole;

  if (isSettingUp) {
    return (
      <div className="fixed inset-0 bg-[#F4F4F4] z-50 flex items-center justify-center">
        <style>{`
          @keyframes spin-v {
            0% { transform: rotateX(0deg); }
            15%, 55% { transform: rotateX(360deg); }
            70%, 100% { transform: rotateX(0deg); }
          }
          @keyframes spin-h1 {
            0%, 15% { transform: rotateY(0deg); }
            30%, 70% { transform: rotateY(360deg); }
            85%, 100% { transform: rotateY(0deg); }
          }
          @keyframes spin-h2 {
            0%, 30% { transform: rotateY(0deg); }
            45%, 85% { transform: rotateY(360deg); }
            100% { transform: rotateY(0deg); }
          }
          .animate-cube-y { animation: spin-v 5s infinite ease-in-out; }
          .animate-cube-x1 { animation: spin-h1 5s infinite ease-in-out; }
          .animate-cube-x2 { animation: spin-h2 5s infinite ease-in-out; }
        `}</style>
        <div className="flex flex-col items-center justify-center">
          {/* Animated "Cube/Layout" Loader */}
          <div className="grid grid-cols-[1fr_2fr] gap-4 w-[260px] h-[150px] mb-8" style={{ perspective: '800px' }}>
            <div className="bg-[#DFDFDF] w-full h-full animate-cube-y" />
            <div className="flex flex-col gap-4 h-full" style={{ perspective: '800px' }}>
              <div className="bg-[#DFDFDF] w-full h-full animate-cube-x1" />
              <div className="bg-[#DFDFDF] w-full h-full animate-cube-x2" />
            </div>
          </div>

          <h2 className="font-editorial text-[24px] text-charcoal mb-0.5">
            Setting up your broadsheet...
          </h2>
          <p className="font-ui text-[12px] text-[#555555]">
            Preparing your experience
          </p>
        </div>
      </div>
    );
  }

  return (
    <section className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-4">
        <h1 className="font-editorial text-[32px] sm:text-[32px] font-normal text-charcoal leading-tight">
          Establish Your Identity
        </h1>
        <p className="mt-3 text-[#8A8A8A] font-ui text-[14px] sm:text-[14px] leading-[1.6] pr-0">
          Define your curated handle and setup a minimal style blueprint. This represents how you will appear inside broadsheet comment sections and lookbooks. You can complete your profile in the settings later.
        </p>

        <div className="mt-8 flex flex-col gap-6">

          {/* Profile Portrait */}
          <div className="flex gap-5 items-start">
            <div className="relative shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-[84px] h-[84px] rounded-full object-cover" />
              ) : (
                <div className="w-[84px] h-[84px] rounded-full bg-[#A2D4B6] flex items-center justify-center text-charcoal text-3xl font-ui font-bold">
                  PS
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="font-ui text-[12px] font-bold uppercase tracking-wider text-[#737373]">
                PROFILE PORTRAIT
              </p>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  disabled={avatarUploading}
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 bg-[#111111] text-white px-4 py-2 font-ui text-[12px] font-bold rounded-none hover:opacity-90 transition-opacity"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" x2="12" y1="3" y2="15" />
                  </svg>
                  {avatarUploading ? "Uploading..." : "Upload Photo"}
                </button>
                <button 
                  type="button" 
                  onClick={() => setAvatarUrl(null)}
                  className="border border-[#EAEAEA] px-4 py-2 font-ui text-[12px] text-[#737373] hover:text-[#111111] transition-colors rounded-none"
                >
                  Remove
                </button>
              </div>
              <p className="font-ui text-[11px] text-[#8A8A8A] font-medium">
                JPG or PNG. Max 5MB. Standard portrait ratio preferred.
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleAvatar(file);
              }}
            />
          </div>

          {/* Grid for Name and Handle */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-ui text-[12px] font-bold uppercase tracking-wider text-[#737373] mb-2 block">
                YOUR NAME
              </label>
              <input
                type="text"
                readOnly
                value={user?.displayName || "Pranjul Singh"}
                className="w-full border border-[#EAEAEA] rounded-none px-4 py-2.5 text-[14px] text-[#111111] outline-none bg-white focus:border-[#D4D4D4]"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="font-ui text-[12px] font-bold uppercase tracking-wider text-[#737373]">
                  CURATOR HANDLE
                </label>
                {handleError ? (
                  <span className="font-ui text-[12px] font-medium text-[#E15A3A]">{handleError.message}</span>
                ) : (
                  handle.length >= 3 && (
                    <span className="font-ui text-[12px] font-medium text-[#10B981]">Handle is available</span>
                  )
                )}
              </div>
              <input
                type="text"
                placeholder="Enter your username"
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase())}
                className={`w-full border rounded-none px-4 py-2.5 text-[14px] outline-none bg-white transition-colors ${handleError ? "border-[#F6D9D0] text-[#E15A3A]" : "border-[#EAEAEA] text-[#111111] focus:border-[#D4D4D4]"
                  }`}
              />
            </div>
          </div>

          {/* Role */}
          <div>
            <label className="font-ui text-[12px] font-bold uppercase tracking-wider text-[#737373] mb-2 block">
              PRIMARY STYLE ROLE
            </label>
            <div className="relative">
              <select
                value={selectedRole || "editor"}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full appearance-none border border-[#EAEAEA] rounded-none px-4 py-2.5 pr-10 text-[14px] text-[#111111] outline-none bg-white focus:border-[#D4D4D4] cursor-pointer"
              >
                <option value="" disabled>Select your role</option>
                <option value="editor">Editor</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.title} — {role.description}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[#737373]">
                <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="font-ui text-[12px] font-bold uppercase tracking-wider text-[#737373] mb-2 block">
              ONE-LINE STYLE BIO (OPTIONAL)
            </label>
            <textarea
              rows={1}
              maxLength={160}
              placeholder="Documenting raw drapes, linen trenches, and the structural integrity Documenting raw drapes."
              value={bio}
              onChange={(e) => {
                setBio(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              className="w-full border border-[#EAEAEA] rounded-none px-4 py-2.5 text-[14px] text-[#111111] outline-none bg-white focus:border-[#D4D4D4] resize-none overflow-hidden"
            />
          </div>

        </div>
      </div>

      {complete.error && (
        <p className="font-ui text-[12px] font-medium text-[#E15A3A] pb-2">
          {complete.error.message}
        </p>
      )}
      <div className="pt-6 border-t border-hairline flex items-center justify-between shrink-0">
        <button type="button" onClick={onBack} className="font-ui text-sm font-semibold text-charcoal hover:opacity-70">
          Back
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={finish}
          className={`px-8 py-3.5 font-ui text-[13px] font-bold uppercase tracking-wider transition-colors flex items-center gap-2 ${canSubmit
            ? "bg-[#111111] text-white hover:bg-black"
            : "bg-[#D5D5D5] text-white cursor-not-allowed"
            }`}
        >
          GET STARTED
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </section>
  );
}
