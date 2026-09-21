import { useState, type FormEvent, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateCircle } from "../../lib/api/generated/circles/circles";
import { useListTags } from "../../lib/api/generated/tags/tags";
import { uploadImage } from "../../lib/api/generated/uploads/uploads";

export function CreateCirclePage() {
  const navigate = useNavigate();
  const { data: tags } = useListTags();
  
  const [form, setForm] = useState({ name: "", description: "" });
  const [tagIds, setTagIds] = useState<string[]>(["custom-design"]);
  const [customTags, setCustomTags] = useState<{id: string, name: string}[]>([
    { id: "custom-design", name: "Design" }
  ]);
  const [topicInput, setTopicInput] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createCircle = useCreateCircle({
    mutation: {
      onSuccess: (circle) => navigate(`/c/${circle.slug}`),
    },
  });

  const slugifiedHandle = form.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      const formData = new FormData();
      formData.append("file", file);
      try {
        setUploading(true);
        const { url } = await uploadImage({ file });
        setAvatarUrl(url);
      } catch (err) {
        console.error("Failed to upload image", err);
      } finally {
        setUploading(false);
      }
    }
  };

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    createCircle.mutate({
      data: {
        name: form.name,
        description: form.description,
        tagIds,
        avatarUrl: avatarUrl || undefined,
        // isPrivate is just local state as agreed
      },
    });
  }

  return (
    <div className="w-full bg-[#F0F0F0] min-h-[calc(100vh-64px)] py-12 px-4 sm:px-8">
      <div className="max-w-[760px] mx-auto">
        <header className="mb-10 text-center sm:text-left">
          <p className="font-ui text-[11px] font-bold uppercase tracking-wider text-[#E5552D] mb-3">
            BUILD YOUR COMMUNITY
          </p>
          <h1 className="font-editorial text-[36px] sm:text-[44px] font-normal text-[#111111] mb-2 leading-tight">
            Create a new Circle
          </h1>
          <p className="font-ui text-[14px] text-[#8A8A8A]">
            Bring people together around a shared craft, interest, or point of view. You can refine these <br />details later.
          </p>
        </header>

        <div className="bg-white rounded-none border border-[#EAEAEA] p-6 sm:p-10 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Circle image */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-6 pb-8 border-b border-[#D0D0D0]">
              <div 
                className="size-[100px] rounded-[16px] border border-[#D0D0D0] bg-[#F5F5F5] flex flex-col items-center justify-center cursor-pointer hover:bg-[#EAEAEA] transition-colors relative overflow-hidden shrink-0"
                onClick={() => fileInputRef.current?.click()}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Circle avatar" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <svg className="size-[28px] text-[#8A8A8A] mb-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                    </svg>
                    <span className="font-ui text-[12px] font-medium text-[#5A5A5A]">
                      {uploading ? "..." : "Upload"}
                    </span>
                  </>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                />
              </div>
              <div>
                <h3 className="font-ui text-[16px] font-bold text-[#111111] mb-1">Circle image</h3>
                <p className="font-ui text-[12px] text-[#8A8A8A]">
                  Choose a square image that makes your Circle easy to recognize. JPG or PNG, up to 5 MB.
                </p>
              </div>
            </div>

            {/* Circle name */}
            <div>
              <label htmlFor="name" className="block font-ui text-[14px] font-bold text-[#111111] mb-2">Circle name</label>
              <input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                minLength={3}
                maxLength={60}
                placeholder="e.g. Material Matters"
                className="w-full rounded-[10px] border border-[#D0D0D0] bg-white px-4 py-3 font-ui text-[14px] placeholder:text-[#A3A3A3] focus:border-[#999999] focus:outline-none transition-colors"
              />
              <p className="mt-2 font-ui text-[12px] text-[#8A8A8A]">
                Choose a clear, memorable name. 40 characters maximum.
              </p>
            </div>

            {/* Circle handle */}
            <div>
              <label htmlFor="handle" className="block font-ui text-[14px] font-bold text-[#111111] mb-2">Circle handle</label>
              <div className="relative flex items-center">
                <span className="absolute left-4 font-ui text-[14px] text-[#A3A3A3] pointer-events-none">
                  centoire.com/circles/material-matters
                </span>
                <input
                  id="handle"
                  value={slugifiedHandle}
                  readOnly
                  className="w-full rounded-[10px] border border-[#D0D0D0] bg-white pl-[150px] pr-4 py-3 font-ui text-[14px] text-[#A3A3A3] focus:outline-none"
                />
              </div>
              <p className="mt-2 font-ui text-[12px] text-[#8A8A8A]">
                Your Circle's unique address on Centoire.
              </p>
            </div>

            {/* About your Circle */}
            <div>
              <label htmlFor="description" className="block font-ui text-[14px] font-bold text-[#111111] mb-2">About your Circle</label>
              <textarea
                id="description"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                required
                maxLength={160}
                placeholder="What will members discover, discuss, and share here?"
                className="w-full rounded-[10px] border border-[#D0D0D0] bg-white px-4 py-3 font-ui text-[14px] placeholder:text-[#A3A3A3] focus:border-[#999999] focus:outline-none transition-colors resize-none min-h-[100px]"
              />
              <p className="mt-2 font-ui text-[12px] text-[#8A8A8A]">
                A thoughtful description helps the right people find your community.
              </p>
            </div>

            {/* Topics */}
            <div>
              <label className="block font-ui text-[14px] font-bold text-[#111111] mb-2">Topics</label>
              <div className="w-full rounded-[10px] border border-[#D0D0D0] bg-white px-3 py-2 min-h-[50px] flex flex-wrap items-center gap-2">
                {[...(tags || []), ...customTags].filter(t => tagIds.includes(t.id)).map(tag => (
                  <span key={tag.id} className="flex items-center gap-1.5 bg-[#F5F5F5] rounded-full px-3.5 py-1.5 font-ui text-[13px] font-medium text-[#111111]">
                    {tag.name}
                    <button type="button" onClick={() => setTagIds(prev => prev.filter(id => id !== tag.id))} className="text-[#A3A3A3] hover:text-[#555555] flex items-center justify-center">
                      <svg className="size-[16px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                  </span>
                ))}
                
                <input 
                  type="text"
                  placeholder="Add up to 5 topics..."
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  onBlur={() => {
                    if (topicInput.trim() && tagIds.length < 5) {
                      const name = topicInput.trim();
                      const existing = [...(tags || []), ...customTags].find(t => t.name.toLowerCase() === name.toLowerCase());
                      let newId: string;
                      if (existing?.id) {
                        newId = existing.id;
                      } else {
                        newId = `custom-${Date.now()}`;
                        setCustomTags(prev => [...prev, { id: newId, name }]);
                      }
                      if (!tagIds.includes(newId)) {
                        setTagIds(prev => [...prev, newId]);
                      }
                      setTopicInput("");
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
                      e.preventDefault();
                      if (topicInput.trim() && tagIds.length < 5) {
                        const name = topicInput.trim();
                        const existing = [...(tags || []), ...customTags].find(t => t.name.toLowerCase() === name.toLowerCase());
                        let newId: string;
                        if (existing?.id) {
                          newId = existing.id;
                        } else {
                          newId = `custom-${Date.now()}`;
                          setCustomTags(prev => [...prev, { id: newId, name }]);
                        }
                        if (!tagIds.includes(newId)) {
                          setTagIds(prev => [...prev, newId]);
                        }
                        setTopicInput("");
                      }
                    }
                  }}
                  className="bg-transparent font-ui text-[14px] placeholder:text-[#A3A3A3] text-[#111111] focus:outline-none flex-1 min-w-[150px] ml-1"
                />
              </div>
            </div>

            {/* Who can join? */}
            <div>
              <label className="block font-ui text-[14px] font-bold text-[#111111] mb-3">Who can join?</label>
              <div className="space-y-3">
                <label className={`flex items-start gap-3 px-4 py-3.5 rounded-[10px] border cursor-pointer transition-colors ${!isPrivate ? "border-[#E5552D] bg-[#FFF5F2]" : "border-[#D0D0D0] bg-white hover:border-[#B3B3B3]"}`}>
                  <div className={`mt-1.5 size-[22px] flex items-center justify-center ${!isPrivate ? "text-[#E5552D]" : "text-[#777777]"}`}>
                    <svg className="size-[22px]" fill="none" stroke="currentColor" strokeWidth="1.25" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                      <path d="M2 12h20"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-ui text-[14px] font-bold mb-0.5 text-[#111111]">Open Circle</p>
                    <p className="font-ui text-[12px] text-[#8A8A8A]">Anyone can discover and join this Circle.</p>
                  </div>
                  <div className={`mt-2 flex items-center justify-center size-[16px] rounded-full border-[1.5px] ${!isPrivate ? "border-transparent bg-[#E5552D]" : "border-[#777777]"}`}>
                  </div>
                  <input type="radio" name="privacy" checked={!isPrivate} onChange={() => setIsPrivate(false)} className="hidden" />
                </label>

                <label className={`flex items-start gap-3 px-4 py-3.5 rounded-[10px] border cursor-pointer transition-colors ${isPrivate ? "border-[#E5552D] bg-[#FFF5F2]" : "border-[#D0D0D0] bg-white hover:border-[#B3B3B3]"}`}>
                  <div className={`mt-1.5 size-[22px] flex items-center justify-center ${isPrivate ? "text-[#E5552D]" : "text-[#777777]"}`}>
                    <svg className="size-[22px]" fill="none" stroke="currentColor" strokeWidth="1.25" viewBox="0 0 24 24">
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-ui text-[14px] font-bold mb-0.5 text-[#111111]">Private Circle</p>
                    <p className="font-ui text-[12px] text-[#8A8A8A]">Only people you invite or approve can join.</p>
                  </div>
                  <div className={`mt-2 flex items-center justify-center size-[16px] rounded-full border-[1.5px] ${isPrivate ? "border-transparent bg-[#E5552D]" : "border-[#777777]"}`}>
                  </div>
                  <input type="radio" name="privacy" checked={isPrivate} onChange={() => setIsPrivate(true)} className="hidden" />
                </label>
              </div>
            </div>

            {createCircle.error && (
              <p className="text-sm text-[#E5552D] font-ui bg-[#FFF5F2] p-3 rounded-md">
                {createCircle.error.message}
              </p>
            )}

            <div className="pt-8 border-t border-[#D0D0D0] flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-6">
              <p className="font-ui text-[12px] text-[#8A8A8A] whitespace-nowrap">
                By creating a Circle, you agree to Centoire's community guidelines.
              </p>
              <div className="flex items-center gap-4 shrink-0">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="rounded-full border border-[#CCCCCC] bg-white px-5 py-3 font-ui text-[13px] font-bold text-[#111111] hover:bg-[#FAFAFA] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createCircle.isPending || uploading}
                  className="rounded-full bg-[#E5552D] px-5 py-3 font-ui text-[13px] font-bold text-white hover:bg-[#CC4824] transition-colors disabled:opacity-50 flex items-center gap-2 shadow-[0_2px_8px_rgba(229,85,45,0.3)]"
                >
                  {createCircle.isPending ? "Creating..." : "Create Circle"}
                  {!createCircle.isPending && (
                    <svg className="size-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
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
