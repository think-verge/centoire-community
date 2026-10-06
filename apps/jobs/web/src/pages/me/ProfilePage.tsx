import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@centoire/web-platform";
import { Switch } from "@centoire/ui";
import { getGetMyProfileQueryKey, useGetMyProfile, useUpdateMyProfile } from "../../lib/api/generated/candidates/candidates";
import type {
  CandidateProfile,
  CandidateProfileInput,
  CandidateProfileInputDesiredFunctionsItem,
  CandidateProfileInputVisibility,
  CandidateProfileInputWorkplacePrefsItem,
} from "../../lib/api/generated/model";
import { Btn } from "../../components/Btn";
import { ErrorNotice, Notice, Spinner } from "../../components/Feedback";
import { ChipToggleGroup, SelectInput, TextArea, TextInput } from "../../components/FormFields";
import { TagInput } from "../../components/TagInput";
import { opt, prettify } from "../../lib/format";
import { VISIBILITIES, VISIBILITY_HELP, isOneOf, useTaxonomyOptions } from "../../lib/options";
import { card, h1, h2, muted, pageWrap } from "../../lib/styles";
import { useDocumentTitle } from "../../lib/useDocumentTitle";

interface Exp {
  title: string;
  companyName: string;
  start: string;
  end: string;
  description: string;
}
interface Edu {
  school: string;
  degree: string;
  start: string;
  end: string;
}

function ProfileForm({ profile }: { profile: CandidateProfile }) {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const options = useTaxonomyOptions();
  const [headline, setHeadline] = useState(profile.headline ?? "");
  const [location, setLocation] = useState(profile.location ?? "");
  const [openToWork, setOpenToWork] = useState(profile.openToWork);
  const [visibility, setVisibility] = useState<CandidateProfileInputVisibility>(profile.visibility);
  const [functions, setFunctions] = useState<CandidateProfileInputDesiredFunctionsItem[]>(profile.desiredFunctions);
  const [locations, setLocations] = useState<string[]>(profile.desiredLocations);
  const [workplaces, setWorkplaces] = useState<CandidateProfileInputWorkplacePrefsItem[]>(profile.workplacePrefs);
  const [skills, setSkills] = useState<string[]>(profile.skills);
  const [experience, setExperience] = useState<Exp[]>(
    profile.experience.map((e) => ({ title: e.title, companyName: e.companyName, start: e.start ?? "", end: e.end ?? "", description: e.description ?? "" })),
  );
  const [education, setEducation] = useState<Edu[]>(
    profile.education.map((e) => ({ school: e.school, degree: e.degree ?? "", start: e.start ?? "", end: e.end ?? "" })),
  );
  const [portfolioUrl, setPortfolioUrl] = useState(profile.portfolioUrl ?? "");
  const [links, setLinks] = useState<string[]>(profile.links.length ? profile.links : []);
  const [saved, setSaved] = useState(false);

  const update = useUpdateMyProfile({
    mutation: {
      onSuccess: () => {
        setSaved(true);
        void queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
        void queryClient.invalidateQueries({ predicate: (q) => q.queryKey.some((k) => typeof k === "string" && k.startsWith("/jobs/candidates")) });
      },
    },
  });

  const toggle = <T extends string>(list: T[], set: (v: T[]) => void, all: readonly T[], v: string) => {
    if (!isOneOf(all, v)) return;
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSaved(false);
    const data: CandidateProfileInput = {
      headline: headline.trim(),
      location: location.trim(),
      openToWork,
      visibility,
      desiredFunctions: functions,
      desiredLocations: locations,
      workplacePrefs: workplaces,
      skills,
      experience: experience
        .filter((x) => x.title.trim() || x.companyName.trim())
        .map((x) => ({ title: x.title.trim(), companyName: x.companyName.trim(), start: opt(x.start) ?? null, end: opt(x.end) ?? null, description: opt(x.description) ?? null })),
      education: education
        .filter((x) => x.school.trim())
        .map((x) => ({ school: x.school.trim(), degree: opt(x.degree) ?? null, start: opt(x.start) ?? null, end: opt(x.end) ?? null })),
      links: links.map((l) => l.trim()).filter(Boolean),
      ...(opt(portfolioUrl) ? { portfolioUrl: portfolioUrl.trim() } : {}),
    };
    update.mutate({ data });
  };

  const patch = <T,>(list: T[], i: number, change: Partial<T>): T[] => list.map((x, idx) => (idx === i ? { ...x, ...change } : x));

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className={`${card} space-y-4 p-6`}>
        <h2 className={h2}>Basics</h2>
        <TextInput label="Headline" maxLength={120} value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Senior pattern maker, womenswear" hint={`${headline.length}/120`} />
        <TextInput label="Location" maxLength={80} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Milan, Italy" />
        <div className="flex items-center justify-between gap-4 rounded-xl bg-[var(--color-sand-warm)] px-4 py-3">
          <div>
            <p className="font-ui text-[14px] font-semibold text-[var(--color-charcoal)]">Open to work</p>
            <p className="font-ui text-[12px] text-[var(--color-stone)]">Let employers know you are looking for new roles.</p>
          </div>
          <Switch checked={openToWork} onChange={() => setOpenToWork((v) => !v)} label="Open to work" />
        </div>
        <div>
          <SelectInput
            label="Profile visibility"
            value={visibility}
            onChange={(v) => isOneOf(VISIBILITIES, v) && setVisibility(v)}
            options={VISIBILITIES}
            hint={VISIBILITY_HELP[visibility]}
          />
        </div>
      </section>

      <section className={`${card} space-y-4 p-6`}>
        <h2 className={h2}>What you are looking for</h2>
        <ChipToggleGroup label="Desired functions (up to 6)" options={options.functions} selected={functions} max={6} onToggle={(v) => toggle(functions, setFunctions, options.functions, v)} />
        <ChipToggleGroup label="Workplace preferences" options={options.workplaces} selected={workplaces} max={3} onToggle={(v) => toggle(workplaces, setWorkplaces, options.workplaces, v)} />
        <TagInput label="Desired locations" value={locations} onChange={setLocations} max={6} maxLength={80} placeholder="City or country, then Enter" />
      </section>

      <section className={`${card} space-y-4 p-6`}>
        <h2 className={h2}>Skills</h2>
        <TagInput label="Skills" value={skills} onChange={setSkills} max={30} placeholder="e.g. Clo3D, draping, tech packs" />
      </section>

      <section className={`${card} space-y-4 p-6`}>
        <div className="flex items-center justify-between">
          <h2 className={h2}>Experience</h2>
          <Btn variant="secondary" size="sm" disabled={experience.length >= 20} onClick={() => setExperience([...experience, { title: "", companyName: "", start: "", end: "", description: "" }])}>
            Add
          </Btn>
        </div>
        {experience.length === 0 && <p className={muted}>No experience added yet.</p>}
        {experience.map((x, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-[var(--color-hairline)] p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <TextInput label="Title" maxLength={120} value={x.title} onChange={(e) => setExperience(patch(experience, i, { title: e.target.value }))} />
              <TextInput label="Company" maxLength={120} value={x.companyName} onChange={(e) => setExperience(patch(experience, i, { companyName: e.target.value }))} />
              <TextInput label="Start" type="month" value={x.start} onChange={(e) => setExperience(patch(experience, i, { start: e.target.value }))} />
              <TextInput label="End (blank if current)" type="month" value={x.end} onChange={(e) => setExperience(patch(experience, i, { end: e.target.value }))} />
            </div>
            <TextArea label="Description" rows={3} maxLength={2000} value={x.description} onChange={(e) => setExperience(patch(experience, i, { description: e.target.value }))} />
            <button type="button" onClick={() => setExperience(experience.filter((_, idx) => idx !== i))} className="font-ui text-[12px] font-bold uppercase tracking-wider text-red-600">
              Remove
            </button>
          </div>
        ))}
      </section>

      <section className={`${card} space-y-4 p-6`}>
        <div className="flex items-center justify-between">
          <h2 className={h2}>Education</h2>
          <Btn variant="secondary" size="sm" disabled={education.length >= 10} onClick={() => setEducation([...education, { school: "", degree: "", start: "", end: "" }])}>
            Add
          </Btn>
        </div>
        {education.length === 0 && <p className={muted}>No education added yet.</p>}
        {education.map((x, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-[var(--color-hairline)] p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <TextInput label="School" maxLength={120} value={x.school} onChange={(e) => setEducation(patch(education, i, { school: e.target.value }))} />
              <TextInput label="Degree" maxLength={120} value={x.degree} onChange={(e) => setEducation(patch(education, i, { degree: e.target.value }))} />
              <TextInput label="Start" type="month" value={x.start} onChange={(e) => setEducation(patch(education, i, { start: e.target.value }))} />
              <TextInput label="End" type="month" value={x.end} onChange={(e) => setEducation(patch(education, i, { end: e.target.value }))} />
            </div>
            <button type="button" onClick={() => setEducation(education.filter((_, idx) => idx !== i))} className="font-ui text-[12px] font-bold uppercase tracking-wider text-red-600">
              Remove
            </button>
          </div>
        ))}
      </section>

      <section className={`${card} space-y-4 p-6`}>
        <h2 className={h2}>Portfolio and links</h2>
        <TextInput label="Portfolio URL" type="url" maxLength={500} value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} placeholder="https://" />
        {links.map((l, i) => (
          <div key={i} className="flex items-end gap-2">
            <TextInput wrapClass="flex-1" label={`Link ${i + 1}`} type="url" maxLength={500} value={l} onChange={(e) => setLinks(links.map((x, idx) => (idx === i ? e.target.value : x)))} placeholder="https://" />
            <Btn variant="ghost" size="sm" aria-label={`Remove link ${i + 1}`} onClick={() => setLinks(links.filter((_, idx) => idx !== i))}>
              Remove
            </Btn>
          </div>
        ))}
        <Btn variant="secondary" size="sm" disabled={links.length >= 6} onClick={() => setLinks([...links, ""])}>
          Add link
        </Btn>
      </section>

      <ErrorNotice error={update.error} />
      {saved && <Notice>Profile saved.</Notice>}
      <div className="sticky bottom-20 flex flex-wrap items-center gap-3 md:bottom-4">
        <Btn type="submit" loading={update.isPending}>
          Save profile
        </Btn>
        {user?.handle && profile.visibility !== "private" && (
          <Link to={`/candidates/${user.handle}`} className="font-ui text-[12px] font-bold uppercase tracking-wider text-[var(--color-coral)]">
            View public profile →
          </Link>
        )}
        <span className="font-ui text-[12px] text-[var(--color-taupe)]">Visibility: {prettify(profile.visibility)}</span>
      </div>
    </form>
  );
}

export function ProfilePage() {
  useDocumentTitle("My profile");
  const { data, isLoading, error } = useGetMyProfile();
  return (
    <div className={`${pageWrap} max-w-[800px]`}>
      <h1 className={h1}>My candidate profile</h1>
      <p className={`${muted} mb-6 mt-1`}>Your name and photo come from your Centoire account. Everything else is edited here.</p>
      {isLoading && <Spinner />}
      <ErrorNotice error={error} />
      {data && <ProfileForm profile={data} />}
    </div>
  );
}
