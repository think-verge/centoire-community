import { useState, type FormEvent, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateCircle } from "../../lib/api/generated/circles/circles";
import { HashtagInput } from "../../components/HashtagInput";
import { uploadImage } from "../../lib/api/generated/uploads/uploads";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function CreateCirclePage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: "", description: "", rules: "" });
  const [customHandle, setCustomHandle] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);

  // Circle image (avatar) & Banner image (cover)
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [coverImageUrl, setCoverImageUrl] = useState<string>("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [topicError, setTopicError] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const createCircle = useCreateCircle({
    mutation: {
      onSuccess: (circle) => navigate(`/c/${circle.slug}`),
    },
  });

  const slugifiedHandle = form.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAvatarError(null);
    if (file.size > MAX_IMAGE_BYTES) {
      setAvatarError("Image is too large. Please choose one under 5 MB.");
      return;
    }
    try {
      setUploadingAvatar(true);
      const { url } = await uploadImage({ file });
      setAvatarUrl(url);
    } catch {
      setAvatarError("Couldn't upload that image. Please try again.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleBannerFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBannerError(null);
    if (file.size > MAX_IMAGE_BYTES) {
      setBannerError("Banner image is too large. Please choose one under 5 MB.");
      return;
    }
    try {
      setUploadingBanner(true);
      const { url } = await uploadImage({ file });
      setCoverImageUrl(url);
    } catch {
      setBannerError("Couldn't upload banner image. Please try again.");
    } finally {
      setUploadingBanner(false);
    }
  };

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (hashtags.length === 0) {
      setTopicError("Add at least one topic for your circle.");
      return;
    }

    const rules = form.rules
      .split("\n")
      .map((r) => r.trim())
      .filter(Boolean)
      .slice(0, 10);

    createCircle.mutate({
      data: {
        name: form.name.trim(),
        description: form.description.trim() || form.name.trim(),
        rules: rules.length > 0 ? rules : undefined,
        hashtags,
        avatarUrl: avatarUrl || undefined,
        coverImageUrl: coverImageUrl || undefined,
        isPrivate,
      },
    });
  }

  return (
    <div className="w-full bg-[#F5F5F5] min-h-[calc(100vh-64px)] py-12 px-4 sm:px-8">
      <div className="max-w-[760px] mx-auto">
        {/* Heading Container: 760px width, 1px gap between title block and description */}
        <header className="w-full max-w-[760px] mx-auto mb-6 flex flex-col gap-[1px]">
          {/* Frame 2147226090: Eyebrow + Title */}
          <div className="flex flex-col justify-start">
            <p className="font-ui text-[14px] font-semibold uppercase tracking-[0.08em] text-[#E4572E] leading-none h-[18px] flex items-center mb-[3px]">
              BUILD YOUR COMMUNITY
            </p>
            <h1 className="font-editorial text-[44px] font-normal text-[#111111] leading-none tracking-normal">
              Create a new Circle
            </h1>
          </div>
          {/* Description / Subheading */}
          <p className="font-ui text-[14px] font-normal text-[rgba(17,17,17,0.6)] leading-[22px] tracking-normal mt-3">
            Bring people together around a shared craft, interest, or point of view. You can refine these details later.
          </p>
        </header>

        {/* Form Card (sharp edges, 32px padding, 24px gap) */}
        <div className="bg-white border border-[#EAEAEA] p-6 sm:p-8 shadow-[0_8px_30px_rgba(23,23,21,0.06)]">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Top row: Circle Image & Banner Image */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pb-6 border-b border-[rgba(17,17,17,0.2)]">
              
              {/* Circle Image */}
              <div className="flex items-start gap-3.5">
                <div
                  className="size-[72px] shrink-0 bg-white hover:bg-[#FAFAFA] flex flex-col items-center justify-center gap-1.5 cursor-pointer relative overflow-hidden transition-colors rounded-none"
                  onClick={() => avatarInputRef.current?.click()}
                  title="Click to upload circle image"
                >
                  {/* Exact 8, 8 dashed border */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    <rect x="0.5" y="0.5" width="71" height="71" fill="none" stroke="rgba(17, 17, 17, 0.2)" strokeWidth="1" strokeDasharray="8 8" />
                  </svg>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Circle avatar" className="w-full h-full object-cover relative z-10" />
                  ) : (
                    <>
                      <svg className="size-[24px] text-[rgba(17,17,17,0.6)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 8.25H7.5A2.25 2.25 0 0 0 5.25 10.5V19.5A2.25 2.25 0 0 0 7.5 21.75H16.5A2.25 2.25 0 0 0 18.75 19.5V10.5A2.25 2.25 0 0 0 16.5 8.25H14.5" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.25V15M8 5.75L12 2.25L16 5.75" />
                      </svg>
                      <span className="font-ui text-[12px] font-normal text-[rgba(17,17,17,0.6)] leading-none">
                        {uploadingAvatar ? "..." : "Upload"}
                      </span>
                    </>
                  )}
                  <input
                    type="file"
                    ref={avatarInputRef}
                    className="hidden"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAvatarFileChange}
                  />
                </div>
                <div className="flex-1 min-w-0 mt-[10px]">
                  <h3 className="font-ui text-[14px] font-semibold uppercase tracking-normal text-[#111111] leading-none mb-[10px]">
                    CIRCLE IMAGE
                  </h3>
                  <p className="font-ui text-[12px] font-normal text-[rgba(17,17,17,0.6)] leading-[18px] tracking-normal max-w-[254px]">
                    Choose a image that makes your Circle easy to recognise. JPG or PNG, up to 5 MB.
                  </p>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl("")}
                      className="mt-1 font-ui text-[11px] text-[#E4572E] hover:underline"
                    >
                      Remove
                    </button>
                  )}
                  {avatarError && <p className="mt-1 font-ui text-[11px] text-[#E4572E]">{avatarError}</p>}
                </div>
              </div>

              {/* Banner Image */}
              <div className="flex items-start gap-3.5">
                <div
                  className="size-[72px] shrink-0 bg-white hover:bg-[#FAFAFA] flex flex-col items-center justify-center gap-1.5 cursor-pointer relative overflow-hidden transition-colors rounded-none"
                  onClick={() => bannerInputRef.current?.click()}
                  title="Click to upload banner image"
                >
                  {/* Exact 8, 8 dashed border */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    <rect x="0.5" y="0.5" width="71" height="71" fill="none" stroke="rgba(17, 17, 17, 0.2)" strokeWidth="1" strokeDasharray="8 8" />
                  </svg>
                  {coverImageUrl ? (
                    <img src={coverImageUrl} alt="Banner" className="w-full h-full object-cover relative z-10" />
                  ) : (
                    <>
                      <svg className="size-[24px] text-[rgba(17,17,17,0.6)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 8.25H7.5A2.25 2.25 0 0 0 5.25 10.5V19.5A2.25 2.25 0 0 0 7.5 21.75H16.5A2.25 2.25 0 0 0 18.75 19.5V10.5A2.25 2.25 0 0 0 16.5 8.25H14.5" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.25V15M8 5.75L12 2.25L16 5.75" />
                      </svg>
                      <span className="font-ui text-[12px] font-normal text-[rgba(17,17,17,0.6)] leading-none">
                        {uploadingBanner ? "..." : "Upload"}
                      </span>
                    </>
                  )}
                  <input
                    type="file"
                    ref={bannerInputRef}
                    className="hidden"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleBannerFileChange}
                  />
                </div>
                <div className="flex-1 min-w-0 mt-[10px]">
                  <h3 className="font-ui text-[14px] font-semibold uppercase tracking-normal text-[#111111] leading-none mb-[10px]">
                    BANNER IMAGE
                  </h3>
                  <p className="font-ui text-[12px] font-normal text-[rgba(17,17,17,0.6)] leading-[18px] tracking-normal max-w-[254px]">
                    Add a banner image that represents your Circle. JPG or PNG, up to 5 MB.
                  </p>
                  {coverImageUrl && (
                    <button
                      type="button"
                      onClick={() => setCoverImageUrl("")}
                      className="mt-1 font-ui text-[11px] text-[#E4572E] hover:underline"
                    >
                      Remove
                    </button>
                  )}
                  {bannerError && <p className="mt-1 font-ui text-[11px] text-[#E4572E]">{bannerError}</p>}
                </div>
              </div>

            </div>

            {/* Circle Name */}
            <div>
              <label htmlFor="name" className="block font-ui text-[14px] font-semibold uppercase tracking-normal text-[#111111] leading-none mb-2">
                CIRCLE NAME
              </label>
              <input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                minLength={3}
                maxLength={40}
                placeholder="e.g. Material Matters"
                className="w-full h-[48px] rounded-none border border-[rgba(17,17,17,0.2)] bg-white px-[14px] font-ui text-[14px] text-[#111111] placeholder:text-[rgba(17,17,17,0.6)] focus:border-[#111111] focus:outline-none transition-colors"
              />
              <p className="mt-[6px] font-ui text-[12px] font-normal text-[rgba(17,17,17,0.6)] leading-[17px]">
                Choose a clear, memorable name. 40 characters maximum.
              </p>
            </div>

            {/* Circle Handle */}
            <div>
              <label htmlFor="handle" className="block font-ui text-[14px] font-semibold uppercase tracking-normal text-[#111111] leading-none mb-2">
                CIRCLE HANDLE
              </label>
              <div className="flex items-center w-full h-[48px] rounded-none border border-[rgba(17,17,17,0.2)] bg-white px-[14px] focus-within:border-[#111111] transition-colors">
                <span className="font-ui text-[14px] font-normal text-[#111111] select-none mr-1.5">
                  c/
                </span>
                <input
                  id="handle"
                  value={customHandle}
                  onChange={(e) => setCustomHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                  placeholder={slugifiedHandle || "enter your handle"}
                  className="w-full bg-transparent font-ui text-[14px] text-[#111111] placeholder:text-[rgba(17,17,17,0.6)] focus:outline-none"
                />
              </div>
              <p className="mt-[6px] font-ui text-[12px] font-normal text-[rgba(17,17,17,0.6)] leading-[17px]">
                Your Circle's unique address on Centoire.
              </p>
            </div>

            {/* About Your Circle */}
            <div>
              <label htmlFor="description" className="block font-ui text-[14px] font-semibold uppercase tracking-normal text-[#111111] leading-none mb-2">
                ABOUT YOUR CIRCLE
              </label>
              <textarea
                id="description"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                required
                maxLength={160}
                placeholder="What will members discover, discuss, and share here?"
                className="block w-full rounded-none border border-[rgba(17,17,17,0.2)] bg-white px-[14px] py-3 font-ui text-[14px] text-[#111111] placeholder:text-[rgba(17,17,17,0.6)] focus:border-[#111111] focus:outline-none transition-colors resize-none min-h-[96px]"
              />
              <p className="mt-[6px] font-ui text-[12px] font-normal text-[rgba(17,17,17,0.6)] leading-[17px]">
                A thoughtful description helps the right people find your community.
              </p>
            </div>

            {/* Who Can Join? */}
            <div>
              <label className="block font-ui text-[14px] font-semibold uppercase tracking-normal text-[#111111] leading-none mb-3">
                WHO CAN JOIN?
              </label>
              
              <div className="space-y-4">
                {/* Option 1: Open Circle */}
                <div>
                  <div
                    className="flex items-start gap-2.5 cursor-pointer select-none"
                    onClick={() => setIsPrivate(false)}
                  >
                    {!isPrivate ? (
                      <div className="size-3 rounded-full bg-[#E4572E] shrink-0 mt-[0.5px]" />
                    ) : (
                      <div className="size-3 rounded-full border border-[#111111] shrink-0 mt-[0.5px]" />
                    )}
                    <div>
                      <p className={`font-ui text-[14px] leading-none mb-1 ${!isPrivate ? "font-semibold text-[#111111]" : "font-semibold text-[rgba(17,17,17,0.6)]"}`}>
                        Open Circle
                      </p>
                      <p className="font-ui text-[12px] text-[rgba(17,17,17,0.6)] leading-normal">
                        Anyone can discover and join this Circle.
                      </p>
                    </div>
                  </div>

                  {/* Topics input nested inside Open Circle option when active */}
                  {!isPrivate && (
                    <div className="mt-3 sm:ml-5.5">
                      <HashtagInput
                        id="circle-topics"
                        value={hashtags}
                        onChange={(next) => {
                          setHashtags(next);
                          setTopicError(null);
                        }}
                        max={3}
                        placeholder="Add up to 3 topics..."
                        className="min-h-[48px] border-[rgba(17,17,17,0.2)] px-[14px]"
                        roundedClassName="rounded-none"
                        tagClassName="inline-flex items-center gap-1.5 rounded-full bg-[#F5F5F5] px-2.5 py-1 font-ui text-[12px] font-normal text-[#111111]"
                        showHashPrefix={false}
                        showCount={false}
                        removeIconType="circled"
                      />
                      {topicError && (
                        <p className="mt-1.5 font-ui text-[12px] text-[#E4572E]">{topicError}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Option 2: Private Circle */}
                <div>
                  <div
                    className="flex items-start gap-2.5 cursor-pointer select-none"
                    onClick={() => setIsPrivate(true)}
                  >
                    {isPrivate ? (
                      <div className="size-3 rounded-full bg-[#E4572E] shrink-0 mt-[0.5px]" />
                    ) : (
                      <div className="size-3 rounded-full border border-[#111111] shrink-0 mt-[0.5px]" />
                    )}
                    <div>
                      <p className={`font-ui text-[14px] leading-none mb-1 ${isPrivate ? "font-semibold text-[#111111]" : "font-semibold text-[rgba(17,17,17,0.6)]"}`}>
                        Private Circle
                      </p>
                      <p className="font-ui text-[12px] text-[rgba(17,17,17,0.6)] leading-normal">
                        Only people you invite or approve can join.
                      </p>
                    </div>
                  </div>

                  {/* Topics input nested inside Private Circle option when active */}
                  {isPrivate && (
                    <div className="mt-3 sm:ml-5.5">
                      <HashtagInput
                        id="circle-topics-private"
                        value={hashtags}
                        onChange={(next) => {
                          setHashtags(next);
                          setTopicError(null);
                        }}
                        max={3}
                        placeholder="Add up to 3 topics..."
                        className="min-h-[48px] border-[rgba(17,17,17,0.2)] px-[14px]"
                        roundedClassName="rounded-none"
                        tagClassName="inline-flex items-center gap-1.5 rounded-full bg-[#F5F5F5] px-2.5 py-1 font-ui text-[12px] font-normal text-[#111111]"
                        showHashPrefix={false}
                        showCount={false}
                        removeIconType="circled"
                      />
                      {topicError && (
                        <p className="mt-1.5 font-ui text-[12px] text-[#E4572E]">{topicError}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Rules */}
            <div>
              <label htmlFor="rules" className="block font-ui text-[14px] font-semibold uppercase tracking-normal text-[#111111] leading-none mb-2">
                RULES
              </label>
              <textarea
                id="rules"
                rows={3}
                value={form.rules}
                onChange={(e) => setForm({ ...form, rules: e.target.value })}
                placeholder="Add 2–3 rules for members, such as respect, no self-promotion, and on-topic discussion."
                className="block w-full rounded-none border border-[rgba(17,17,17,0.2)] bg-white px-[14px] py-3 font-ui text-[14px] text-[#111111] placeholder:text-[rgba(17,17,17,0.6)] focus:border-[#111111] focus:outline-none transition-colors resize-none min-h-[96px]"
              />
              <p className="mt-[6px] font-ui text-[12px] font-normal text-[rgba(17,17,17,0.6)] leading-[17px]">
                Clear rules help set expectations and keep your Circle welcoming.
              </p>
            </div>

            {createCircle.error && (
              <p className="text-sm text-[#E4572E] font-ui bg-[#FFF5F2] p-3 border border-[#E4572E]/20">
                {createCircle.error.message}
              </p>
            )}

            {/* Footer / Buttons */}
            <div className="pt-6 border-t border-[rgba(17,17,17,0.2)] flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-4">
              <p className="font-ui text-[12px] text-[#8A8A8A]">
                By creating a Circle, you agree to Centoire's community guidelines.
              </p>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="rounded-full border border-[#D0D0D0] bg-white px-6 py-2.5 font-ui text-[13px] font-medium text-[#111111] hover:bg-[#F5F5F5] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createCircle.isPending || uploadingAvatar || uploadingBanner || hashtags.length === 0 || !form.name.trim()}
                  className="rounded-full bg-[#E4572E] hover:bg-[#CC4824] px-6 py-2.5 font-ui text-[13px] font-medium text-white transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  {createCircle.isPending ? "Creating..." : "Create Circle"}
                  {!createCircle.isPending && (
                    <svg className="size-[16px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
