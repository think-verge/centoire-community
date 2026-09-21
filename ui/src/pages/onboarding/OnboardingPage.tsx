import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AvatarBubble } from "../../components/AppShell";
import {
  useCompleteOnboarding,
  useSetInterests,
  useUpdateMe,
} from "../../lib/api/generated/users/users";
import { uploadImage } from "../../lib/api/generated/uploads/uploads";
import type { Tag } from "../../lib/api/generated/model";
import { useAuth } from "../../lib/auth-context";
import logoDark from "../../assets/landing/logo-dark.svg";

const CATEGORY_LABELS: Record<Tag["category"], string> = {
  style: "STYLE",
  craft: "CRAFT",
  business: "BUSINESS",
  culture: "CULTURE",
};

export function OnboardingPage() {
  const [step, setStep] = useState(0);

  return (
    <main className="min-h-screen w-full bg-[#ECEBE7] flex flex-col py-8 px-4 sm:px-8">
      <div className={`w-full max-w-[840px] ${step === 3 ? "h-[720px]" : "h-[640px]"} max-h-[calc(100vh-4rem)] my-auto mx-auto bg-white px-8 sm:px-14 pt-10 pb-10 sm:pb-12 border border-[#E5E5E5] shadow-[0_2px_16px_rgba(0,0,0,0.04)] flex flex-col transition-[height] duration-300 ease-in-out`}>
        {/* Top Logo */}
        <div className="flex justify-center mb-8 sm:mb-10 shrink-0">
          <img src={logoDark} alt="Centoire" className="h-8 sm:h-9 w-auto" />
        </div>

        <header className="mb-5 sm:mb-6 flex items-center justify-between shrink-0">
          <div className="rounded-full bg-[#FCEEE8] px-2.5 py-1 font-ui text-[12px] font-black uppercase tracking-tight text-[#E5552D]">
            STEP {step + 1} OF 4
          </div>
          <div className="flex items-center gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-colors ${i === step ? "w-[26px] bg-[#D85834]" : "w-[14px] bg-[#F6D9D0]"
                  }`}
              />
            ))}
          </div>
        </header>

        {step === 0 && <RoleStep onDone={() => setStep(1)} />}
        {step === 1 && <InterestsStep onDone={() => setStep(2)} onBack={() => setStep(0)} />}
        {step === 2 && <FollowStep onDone={() => setStep(3)} onBack={() => setStep(1)} />}
        {step === 3 && <ProfileStep onBack={() => setStep(2)} />}
      </div>
    </main>
  );
}

function RoleStep({ onDone }: { onDone: () => void }) {
  const [selectedRole, setSelectedRole] = useState<string | null>("creator");

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

  return (
    <section className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-4">
        <h1 className="font-editorial text-[32px] sm:text-[34px] font-normal text-charcoal leading-tight">
          How are you planning to use Centoire?
        </h1>
        <p className="mt-3 text-[#8A8A8A] font-ui text-[14px] sm:text-[14.5px] leading-[1.6] pr-0">
          We customize your broadsheet feed, archival access, and collection dispatches according to your specific professional or personal focus.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {roles.map((role) => {
            const active = selectedRole === role.id;
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => setSelectedRole(role.id)}
                className={`group flex flex-col items-center justify-center px-2 py-6 sm:px-3 sm:py-6 transition-all duration-200 outline-none cursor-pointer text-left rounded-none
                ${active
                    ? "border border-[#D85834] bg-white shadow-[0_20px_24px_-12px_rgba(0,0,0,0.25)]"
                    : "border border-[#E5E5E5] bg-white shadow-[0_12px_16px_-8px_rgba(0,0,0,0.1)] hover:border-[#D4D4D4] hover:shadow-[0_16px_20px_-10px_rgba(0,0,0,0.15)]"
                  }`}
              >
                <div
                  className={`flex items-center justify-center size-[60px] sm:size-[64px] rounded-[16px] mb-5 transition-colors ${active ? "bg-[#FCE5DA] text-[#D85834]" : "bg-[#EBEBEB] text-[#111111]"
                    }`}
                >
                  {role.icon}
                </div>
                <h3 className="font-editorial text-[22px] sm:text-[24px] font-bold text-charcoal mb-1.5 text-center">
                  {role.title}
                </h3>
                <p className="font-ui font-normal text-[13px] sm:text-[14px] text-[#737373] text-center leading-normal">
                  {role.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-6 border-t border-[#F2EDE4] flex justify-end shrink-0">
        <button
          type="button"
          disabled={!selectedRole}
          onClick={onDone}
          className={`font-ui text-[13px] font-bold uppercase tracking-wider px-8 py-3.5 transition-colors flex items-center gap-2.5 ${selectedRole
            ? "bg-[#111111] text-white hover:bg-black cursor-pointer"
            : "bg-[#D4D4D8] text-white cursor-not-allowed"
            }`}
        >
          CONTINUE
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </section>
  );
}

function InterestsStep({ onDone, onBack }: { onDone: () => void, onBack: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(),
  );
  const setInterests = useSetInterests({
    mutation: {
      onSuccess: onDone,
      onError: () => onDone(), // Proceed anyway since we are using hardcoded tags
    },
  });

  const grouped = useMemo(() => {
    return [
      ['culture', [
        { id: '11111111-1111-1111-1111-111111111111', name: "Women's Apparel" },
        { id: '22222222-2222-2222-2222-222222222222', name: 'Streetwear' },
        { id: '33333333-3333-3333-3333-333333333333', name: 'Accessories' },
        { id: '44444444-4444-4444-4444-444444444444', name: 'Footwear' },
        { id: '55555555-5555-5555-5555-555555555555', name: 'Outerwear' },
        { id: '66666666-6666-6666-6666-666666666666', name: 'Luxury Fashion' },
        { id: '77777777-7777-7777-7777-777777777777', name: "Men's Apparel" },
        { id: '88888888-8888-8888-8888-888888888888', name: 'Sustainable Fashion' },
      ]],
      ['style', [
        { id: '99999999-9999-9999-9999-999999999999', name: 'Activewear' },
        { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'Footwear' },
        { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', name: 'Accessories' },
        { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', name: 'Outerwear' },
        { id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', name: 'Denim' },
      ]]
    ] as const;
  }, []);

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
      <div className="flex-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-4">
        <h1 className="font-editorial text-[32px] sm:text-[34px] font-normal text-charcoal leading-tight">
          Tailor your Broadsheet
        </h1>
        <p className="mt-3 text-[#8A8A8A] font-ui text-[14px] sm:text-[14.5px] leading-[1.6] pr-0">
          Select multiple design niches below. We configure your daily Centoire feed based on these slow-fashion indices.
        </p>

        <div className="mt-10 flex flex-col gap-8">
          {grouped.map(([category, categoryTags]) => (
            <div key={category}>
              <p className="font-ui mb-3 text-[13px] font-bold uppercase tracking-wider text-[#737373]">
                {CATEGORY_LABELS[category] || category}
              </p>
              <div className="flex flex-wrap gap-x-2 gap-y-3">
                {categoryTags.map((tag) => {
                  const active = selected.has(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggle(tag.id)}
                      className={`font-ui rounded-full border px-[18px] py-[2px] text-[12.5px] outline-none focus:ring-0 transition-colors ${active
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
          ))}
        </div>
      </div>

      <div className="pt-6 border-t border-[#F2EDE4] flex items-center justify-between shrink-0">
        <button type="button" onClick={onBack} className="font-ui text-[14px] font-bold text-charcoal hover:opacity-70">
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
  const data = {
    creators: [
      { id: '1', displayName: 'Camille Lafleur', handle: 'camille', bio: 'Curating raw weaves, minimal silhouettes, and the return of heavy structured linens.', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop' },
      { id: '2', displayName: 'Sophia Sterling', handle: 'sterling', bio: 'Fashion analyst investigating unstructured summer silhouettes and architectural...', avatarUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150&h=150&fit=crop' },
      { id: '3', displayName: 'Hiroshi Jin Aoki', handle: 'jin_aoki', bio: 'Exploring the intersections of Brutalist concrete interior spaces and permanent caps...', avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop' },
    ],
    circles: [
      { id: 'c1', name: 'Slow Textiles & Linen', description: 'For researchers and curators documenting raw, organic, and earth-pigmented weaving\u00A0techniques.', memberCount: 12400, slug: 'slow-textiles', avatarUrl: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=150&h=150&fit=crop' },
      { id: 'c2', name: 'Brutalist Apparel', description: 'Structural, heavy, monochrome garments that communicate directly with raw concrete architecture.', memberCount: 8400, slug: 'brutalist-apparel', avatarUrl: 'https://images.unsplash.com/photo-1502014822147-1aedfb0676e0?w=150&h=150&fit=crop' },
    ]
  };

  const [followedIds, setFollowedIds] = useState(new Set(['1']));
  const [joinedIds, setJoinedIds] = useState(new Set(['c1']));

  const totalFollows = followedIds.size + joinedIds.size;

  function toggleFollow(id: string) {
    setFollowedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleJoin(id: string) {
    setJoinedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <section className="flex flex-col flex-1 min-h-0">
      <div className="relative flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-12">
          <h1 className="font-editorial text-[32px] sm:text-[34px] font-normal text-[#333333] leading-tight">
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
                <svg className="size-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <svg className="size-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {data.creators.map((creator) => {
                const following = followedIds.has(creator.id);
                return (
                  <div
                    key={creator.id}
                    className="flex flex-col bg-[#EAEAEA] p-5"
                  >
                    <div className="flex items-center gap-3">
                      <AvatarBubble name={creator.displayName} url={creator.avatarUrl} size="size-12 text-lg" />
                      <div>
                        <p className="font-ui font-bold text-[#111111] text-[15px]">{creator.displayName}</p>
                        <p className="text-[13px] text-[#737373]">@{creator.handle}</p>
                      </div>
                    </div>
                    <p className="font-ui tracking-tight text-[13.5px] text-[#5A5A5A] mt-2 mb-3 leading-[1.3] line-clamp-3">
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
                <svg className="size-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M5 15l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <svg className="size-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              {data.circles.map((circle) => {
                const joined = joinedIds.has(circle.id);
                return (
                  <div
                    key={circle.id}
                    className="flex items-center justify-between gap-4 bg-[#E5E5E5] px-5 py-3.5"
                  >
                    <div className="size-14 shrink-0 rounded-full bg-[#111111] overflow-hidden flex items-center justify-center">
                      {circle.avatarUrl ? (
                        <img src={circle.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-display-serif text-white text-2xl font-bold">{circle.name[0]}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-ui font-bold text-[#111111] text-[15px] truncate">
                        {circle.name}
                      </p>
                      <p className="font-ui text-[13px] tracking-tight text-[#5A5A5A] leading-[1.3] mt-0 line-clamp-2">{circle.description}</p>
                    </div>
                    <div className="flex flex-col items-center shrink-0 w-[80px]">
                      <button
                        type="button"
                        onClick={() => toggleJoin(circle.id)}
                        className={`w-full py-1.5 rounded-full font-ui text-[13px] font-bold transition-colors border ${joined
                          ? "bg-[#E5552D] text-white hover:opacity-90 border-transparent"
                          : "bg-white text-[#111111] hover:bg-gray-50 border-[#999999]"
                          }`}
                      >
                        {joined ? "Joined" : "Join"}
                      </button>
                      <p className="font-ui text-[11px] text-[#8A8A8A] mt-2 whitespace-nowrap text-center">
                        {circle.memberCount.toLocaleString()} members
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
            {totalFollows < 3 ? `Pick ${3 - totalFollows} more to continue` : ""}
          </p>
          <button
            type="button"
            disabled={totalFollows < 3}
            onClick={onDone}
            className={`px-8 py-3.5 font-ui text-[13px] font-bold uppercase tracking-wider transition-colors flex items-center gap-2 ${totalFollows >= 3
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
    await updateMe.mutateAsync({
      data: { handle, bio: bio || undefined, avatarUrl: avatarUrl ?? undefined },
    });
    complete.mutate();
  }

  const error = updateMe.error ?? complete.error;
  const isMockError = handle === 'pranjulsingh92' || handle === 'centoire_team';
  const isError = isMockError || !!error;
  const isValidHandle = /^[a-z0-9_]{3,24}$/.test(handle);
  const canSubmit = isValidHandle && !isError && !updateMe.isPending && !complete.isPending;

  return (
    <section className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-4">
        <h1 className="font-editorial text-[32px] sm:text-[34px] font-normal text-charcoal leading-tight">
          Establish Your Identity
        </h1>
        <p className="mt-3 text-[#8A8A8A] font-ui text-[14px] sm:text-[14.5px] leading-[1.6] pr-0">
          Define your curated handle and setup a minimal style blueprint. This represents how you will appear inside broadsheet comment sections and lookbooks. You can complete your profile in the settings later.
        </p>

        <div className="mt-12 grid sm:grid-cols-[200px_1fr] gap-0">

          {/* Left Col: Upload */}
          <div className="flex flex-col items-center sm:border-r border-hairline pr-6">
            <p className="font-ui text-[13px] font-extrabold uppercase tracking-wider text-[#737373] mb-6 self-start whitespace-nowrap">
              UPLOAD YOUR PICTURE
            </p>
            <div className="flex flex-col items-center justify-center pt-2">
              <div className="relative cursor-pointer" onClick={() => fileRef.current?.click()}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-[100px] h-[100px] rounded-full object-cover" />
                ) : (
                  <div className="w-[100px] h-[100px] rounded-full bg-[#A2D4B6] flex items-center justify-center text-charcoal text-4xl font-ui font-medium">
                    P
                  </div>
                )}
              </div>
              <button
                type="button"
                disabled={avatarUploading}
                onClick={() => fileRef.current?.click()}
                className="mt-6 flex items-center gap-2 font-ui text-[13px] font-semibold text-charcoal hover:opacity-70"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" x2="12" y1="3" y2="15" />
                </svg>
                {avatarUploading ? "Uploading..." : "Upload a photo"}
              </button>
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
          </div>

          {/* Right Col: Form */}
          <div className="flex flex-col pl-6">

            <div className="mb-6">
              <label className="font-ui text-[13px] font-bold uppercase tracking-wider text-[#737373] mb-2 block">
                YOUR NAME
              </label>
              <input
                type="text"
                readOnly
                value={user?.displayName || ""}
                className="w-full border border-hairline px-4 py-3 text-[15px] text-charcoal outline-none bg-white focus:border-stone"
              />
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="font-ui text-[13px] font-bold uppercase tracking-wider text-[#737373]">
                  CURATOR HANDLE
                </label>
                {isError && (
                  <span className="font-ui text-[13px] font-normal text-[#E15A3A]">Handle already existed</span>
                )}
              </div>
              <input
                type="text"
                placeholder="Enter your username"
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase())}
                className={`w-full border px-4 py-3 text-[15px] outline-none bg-white transition-colors ${isError ? "border-[#F6D9D0] text-[#E15A3A]" : "border-hairline text-charcoal focus:border-stone"
                  }`}
              />
            </div>

            <div>
              <label className="font-ui text-[13px] font-bold uppercase tracking-wider text-[#737373] mb-2 block">
                ONE-LINE STYLE BIO (OPTIONAL)
              </label>
              <textarea
                rows={1}
                maxLength={160}
                placeholder="e.g. Minimalist with a love for raw textures"
                value={bio}
                onChange={(e) => {
                  setBio(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                className="w-full border border-hairline px-4 py-3 text-[15px] text-stone outline-none bg-white focus:border-stone resize-none overflow-hidden"
              />
            </div>

          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-hairline flex items-center justify-between shrink-0">
        <button type="button" onClick={onBack} className="font-ui text-sm font-semibold text-charcoal hover:opacity-70">
          Back
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={finish}
          className={`px-6 py-3.5 font-ui text-[13px] font-bold uppercase tracking-widest transition-colors flex items-center gap-2 ${canSubmit
            ? "bg-[#111111] text-white hover:bg-black"
            : "bg-[#D5D5D5] text-white cursor-not-allowed"
            }`}
        >
          GET STARTED <span>→</span>
        </button>
      </div>
    </section>
  );
}
