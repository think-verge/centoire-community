import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { hasPermission } from "@centoire/contracts";
import { useSession } from "@centoire/web-platform";
import { useCreateCompany } from "../../lib/api/generated/employer/employer";
import { invalidatePrefixes } from "../../lib/invalidate";
import { h1, muted, pageWrap } from "../../lib/styles";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { CompanyForm } from "./CompanyForm";

export function CompanyNewPage() {
  useDocumentTitle("New company");
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const create = useCreateCompany({
    mutation: {
      onSuccess: async (company) => {
        await invalidatePrefixes(queryClient, "/jobs");
        navigate(`/employer/companies/${company.slug}/settings`);
      },
    },
  });
  const admin = Boolean(user && hasPermission(user.role, "company.verify"));

  return (
    <div className={`${pageWrap} max-w-[800px]`}>
      <Link to="/employer" className="font-ui text-[12px] font-bold uppercase tracking-wider text-[var(--color-stone)] hover:text-[var(--color-charcoal)]">
        ← Employer
      </Link>
      <h1 className={`${h1} mt-3`}>Create a company</h1>
      <p className={`${muted} mb-6 mt-1`}>During launch companies are created by the Centoire team. If you are not permitted to create one you will see a message below.</p>
      <CompanyForm
        submitLabel="Create company"
        allowOwnerHandle={admin}
        pending={create.isPending}
        error={create.error}
        onSubmit={(data) => create.mutate({ data })}
      />
    </div>
  );
}
