import type { ReactNode } from "react";

interface ExternalNavLinkProps {
  href: string;
  className?: string;
  title?: string;
  children: ReactNode;
}

/** Opens another Centoire app in a new tab. `noopener` (not `noreferrer`) keeps the referrer for analytics. */
export function ExternalNavLink({ href, className, title, children }: ExternalNavLinkProps) {
  return (
    <a href={href} target="_blank" rel="noopener" title={title} className={className}>
      {children}
    </a>
  );
}
