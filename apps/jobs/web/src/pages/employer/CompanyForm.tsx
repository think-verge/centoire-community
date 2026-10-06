import { useState, type FormEvent } from "react";
import { Btn } from "../../components/Btn";
import { ErrorNotice } from "../../components/Feedback";
import { SelectInput, TextArea, TextInput } from "../../components/FormFields";
import {
  CompanyInputSegment,
  CompanyInputSizeRange,
  type Company,
  type CompanyInput,
} from "../../lib/api/generated/model";
import { countryName, opt } from "../../lib/format";
import { COUNTRIES, isOneOf, useTaxonomyOptions } from "../../lib/options";
import { card } from "../../lib/styles";

interface Props {
  company?: Company;
  /** Platform admins creating on behalf of a brand may name the first owner. */
  allowOwnerHandle?: boolean;
  submitLabel: string;
  pending: boolean;
  error: unknown;
  onSubmit: (data: CompanyInput) => void;
}

export function CompanyForm({ company, allowOwnerHandle = false, submitLabel, pending, error, onSubmit }: Props) {
  const options = useTaxonomyOptions();
  const [name, setName] = useState(company?.name ?? "");
  const [logoUrl, setLogoUrl] = useState(company?.logoUrl ?? "");
  const [coverUrl, setCoverUrl] = useState(company?.coverUrl ?? "");
  const [website, setWebsite] = useState(company?.website ?? "");
  const [about, setAbout] = useState(company?.about ?? "");
  const [segment, setSegment] = useState(company?.segment ?? "");
  const [sizeRange, setSizeRange] = useState(company?.sizeRange ?? "");
  const [city, setCity] = useState(company?.hq?.city ?? "");
  const [country, setCountry] = useState(company?.hq?.countryCode ?? "");
  const [ownerHandle, setOwnerHandle] = useState("");
  const [nameError, setNameError] = useState<string>();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setNameError("Company name must be at least 2 characters.");
    setNameError(undefined);
    const hqCity = opt(city);
    const data: CompanyInput = {
      name: name.trim(),
      ...(opt(logoUrl) ? { logoUrl: logoUrl.trim() } : {}),
      ...(opt(coverUrl) ? { coverUrl: coverUrl.trim() } : {}),
      ...(opt(website) ? { website: website.trim() } : {}),
      about: about.trim(),
      ...(isOneOf(Object.values(CompanyInputSegment), segment) ? { segment } : {}),
      ...(isOneOf(Object.values(CompanyInputSizeRange), sizeRange) ? { sizeRange } : {}),
      ...(hqCity || country ? { hq: { ...(hqCity ? { city: hqCity } : {}), ...(country ? { countryCode: country } : {}) } } : {}),
      ...(allowOwnerHandle && opt(ownerHandle) ? { ownerHandle: ownerHandle.trim().replace(/^@/, "") } : {}),
    };
    onSubmit(data);
  };

  return (
    <form onSubmit={submit} className={`${card} space-y-4 p-6`}>
      <TextInput label="Company name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} error={nameError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Logo URL" type="url" maxLength={500} value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://" />
        <TextInput label="Cover image URL" type="url" maxLength={500} value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://" />
      </div>
      <TextInput label="Website" type="url" maxLength={500} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
      <TextArea label="About" rows={6} maxLength={4000} value={about} onChange={(e) => setAbout(e.target.value)} hint={`${about.length}/4000`} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectInput label="Segment" value={segment} onChange={setSegment} options={options.segments} placeholder="Select…" />
        <SelectInput label="Company size" value={sizeRange} onChange={setSizeRange} options={options.sizes} placeholder="Select…" format={(v) => `${v} people`} />
        <TextInput label="HQ city" maxLength={80} value={city} onChange={(e) => setCity(e.target.value)} />
        <SelectInput label="HQ country" value={country} onChange={setCountry} options={COUNTRIES} placeholder="Select…" format={countryName} />
      </div>
      {allowOwnerHandle && (
        <TextInput label="Owner handle (admin only)" maxLength={40} value={ownerHandle} onChange={(e) => setOwnerHandle(e.target.value)} placeholder="centoire handle of the first owner" hint="Leave empty to own the company yourself." />
      )}
      <ErrorNotice error={error} verifyHint />
      <div className="flex justify-end">
        <Btn type="submit" loading={pending}>
          {submitLabel}
        </Btn>
      </div>
    </form>
  );
}
