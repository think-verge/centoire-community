import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useGetCompany } from "../../lib/api/generated/companies/companies";
import {
  getListCompanyMembersQueryKey,
  useAddCompanyMember,
  useListCompanyMembers,
  useRemoveCompanyMember,
  useUpdateCompany,
} from "../../lib/api/generated/employer/employer";
import { MemberInputRole } from "../../lib/api/generated/model";
import { Avatar } from "../../components/Avatar";
import { Btn } from "../../components/Btn";
import { ErrorNotice, Notice, Spinner } from "../../components/Feedback";
import { SelectInput, TextInput } from "../../components/FormFields";
import { isOneOf } from "../../lib/options";
import { prettify } from "../../lib/format";
import { invalidatePrefixes } from "../../lib/invalidate";
import { card, h1, h2, muted, pageWrap } from "../../lib/styles";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { CompanyForm } from "./CompanyForm";

function Members({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const members = useListCompanyMembers(slug);
  const refresh = () => queryClient.invalidateQueries({ queryKey: getListCompanyMembersQueryKey(slug) });
  const add = useAddCompanyMember({ mutation: { onSuccess: () => { setHandle(""); void refresh(); } } });
  const remove = useRemoveCompanyMember({ mutation: { onSuccess: () => void refresh() } });
  const [handle, setHandle] = useState("");
  const [role, setRole] = useState<string>("recruiter");
  const roles = Object.values(MemberInputRole);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!handle.trim() || !isOneOf(roles, role)) return;
    add.mutate({ slug, data: { handle: handle.trim().replace(/^@/, ""), role } });
  };

  return (
    <section className={`${card} mt-8 p-6`}>
      <h2 className={h2}>Hiring team</h2>
      <p className={`${muted} mt-1`}>People who can post jobs and review applicants for this company.</p>
      {members.isLoading && <Spinner />}
      <ErrorNotice error={members.error} />
      <ul className="mt-4 divide-y divide-[var(--color-hairline)]">
        {members.data?.map((m) => (
          <li key={m.user.id} className="flex items-center gap-3 py-3">
            <Avatar name={m.user.displayName} url={m.user.avatarUrl} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-ui text-[14px] font-semibold text-[var(--color-charcoal)]">{m.user.displayName}</p>
              <p className="font-ui text-[12px] text-[var(--color-taupe)]">{m.user.handle ? `@${m.user.handle}` : ""}</p>
            </div>
            <span className="rounded-full bg-[var(--color-sand-warm)] px-3 py-1 font-ui text-[11px] font-bold uppercase tracking-wider text-[var(--color-stone)]">{prettify(m.role)}</span>
            {m.role !== "owner" && (
              <Btn
                variant="danger"
                size="sm"
                disabled={remove.isPending}
                onClick={() => {
                  if (window.confirm(`Remove ${m.user.displayName} from the hiring team?`)) remove.mutate({ slug, userId: m.user.id });
                }}
              >
                Remove
              </Btn>
            )}
          </li>
        ))}
      </ul>
      <ErrorNotice error={remove.error} />
      <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-3">
        <TextInput wrapClass="flex-1 min-w-48" label="Add by Centoire handle" value={handle} maxLength={40} onChange={(e) => setHandle(e.target.value)} placeholder="@handle" />
        <SelectInput label="Role" value={role} onChange={setRole} options={roles} />
        <Btn type="submit" loading={add.isPending} disabled={!handle.trim()}>
          Add
        </Btn>
      </form>
      <div className="mt-3">
        <ErrorNotice error={add.error} />
      </div>
    </section>
  );
}

export function CompanySettingsPage() {
  const { slug = "" } = useParams();
  const queryClient = useQueryClient();
  const { data: company, isLoading, error } = useGetCompany(slug);
  const [saved, setSaved] = useState(false);
  useDocumentTitle(company ? `${company.name} settings` : "Company settings");
  const update = useUpdateCompany({
    mutation: {
      onSuccess: () => {
        setSaved(true);
        void invalidatePrefixes(queryClient, "/jobs");
      },
    },
  });

  if (isLoading) return <Spinner />;
  if (error || !company) return <div className={pageWrap}><ErrorNotice error={error ?? new Error("Company not found")} /></div>;

  return (
    <div className={`${pageWrap} max-w-[800px]`}>
      <Link to="/employer" className="font-ui text-[12px] font-bold uppercase tracking-wider text-[var(--color-stone)] hover:text-[var(--color-charcoal)]">
        ← Employer
      </Link>
      <div className="mb-6 mt-3 flex flex-wrap items-end justify-between gap-3">
        <h1 className={h1}>{company.name}</h1>
        <Link to={`/companies/${company.slug}`} className="font-ui text-[12px] font-bold uppercase tracking-wider text-[var(--color-coral)]">
          View public page →
        </Link>
      </div>
      {saved && <div className="mb-4"><Notice>Company saved.</Notice></div>}
      <CompanyForm
        company={company}
        submitLabel="Save changes"
        pending={update.isPending}
        error={update.error}
        onSubmit={(data) => {
          setSaved(false);
          update.mutate({ slug: company.slug, data });
        }}
      />
      {company.viewerRole ? <Members slug={company.slug} /> : <p className={`${muted} mt-6`}>Only members of this company can manage its hiring team.</p>}
    </div>
  );
}
