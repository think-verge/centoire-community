import logoDark from "../../../assets/landing/logo-dark.svg";

const LINK_GROUPS = [
  { heading: "Curation", links: ["Stories", "Designers", "Lookbooks"] },
  { heading: "Company", links: ["About Us", "Careers", "Press Kit"] },
  { heading: "Legal", links: ["Privacy Policy", "Terms of Use", "Cookie Settings"] },
];

function SocialIcon({ label, path }: { label: string; path: string }) {
  return (
    <a
      href="#"
      aria-label={label}
      className="flex size-8 items-center justify-center rounded-full border border-hairline text-charcoal transition-colors hover:border-charcoal"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5">
        <path d={path} />
      </svg>
    </a>
  );
}

export function Footer() {
  return (
    <footer className="flex flex-col gap-16 bg-sand px-6 pb-10 pt-16 sm:px-20 sm:pt-20">
      <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
        <div className="flex max-w-[300px] flex-col gap-4">
          <img src={logoDark} alt="Centoire" className="h-10 w-auto" />
          <p className="font-ui text-[13px] leading-[1.5] text-stone">
            High-fashion and lifestyle curation platform. Bringing together editorial, lookbooks,
            and essays on design in one clean broadsheet stream.
          </p>
        </div>

        <div className="flex flex-wrap gap-10 sm:gap-20">
          {LINK_GROUPS.map((group) => (
            <div key={group.heading} className="flex flex-col gap-4">
              <p className="font-ui text-xs font-bold text-charcoal">{group.heading}</p>
              {group.links.map((link) => (
                <span key={link} className="font-ui cursor-default text-sm text-stone">
                  {link}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-start gap-4 border-t border-hairline pt-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-ui text-xs text-taupe">
          © 2026 Centoire Collective. All rights reserved. Made in public.
        </p>
        <div className="flex items-center gap-6">
          <SocialIcon
            label="Instagram"
            path="M12 2c2.7 0 3.06.01 4.12.06 1.06.05 1.79.22 2.43.47.66.26 1.21.6 1.75 1.14.5.5.85 1.07 1.14 1.75.25.64.42 1.37.47 2.43.05 1.06.06 1.42.06 4.12s-.01 3.06-.06 4.12c-.05 1.06-.22 1.79-.47 2.43a4.6 4.6 0 0 1-1.14 1.75 4.6 4.6 0 0 1-1.75 1.14c-.64.25-1.37.42-2.43.47-1.06.05-1.42.06-4.12.06s-3.06-.01-4.12-.06c-1.06-.05-1.79-.22-2.43-.47a4.6 4.6 0 0 1-1.75-1.14 4.6 4.6 0 0 1-1.14-1.75c-.25-.64-.42-1.37-.47-2.43C2.01 15.06 2 14.7 2 12s.01-3.06.06-4.12c.05-1.06.22-1.79.47-2.43a4.6 4.6 0 0 1 1.14-1.75A4.6 4.6 0 0 1 5.42 2.53c.64-.25 1.37-.42 2.43-.47C8.94 2.01 9.3 2 12 2zm0 3.6a6.4 6.4 0 1 0 0 12.8 6.4 6.4 0 0 0 0-12.8zm0 10.56a4.16 4.16 0 1 1 0-8.32 4.16 4.16 0 0 1 0 8.32zm6.4-10.72a1.44 1.44 0 1 1-2.88 0 1.44 1.44 0 0 1 2.88 0z"
          />
          <SocialIcon
            label="Twitter"
            path="M22 5.9c-.72.33-1.5.55-2.3.65a3.98 3.98 0 0 0 1.75-2.2c-.77.46-1.62.79-2.53.97a3.98 3.98 0 0 0-6.78 3.63 11.3 11.3 0 0 1-8.2-4.16 3.98 3.98 0 0 0 1.23 5.3 3.95 3.95 0 0 1-1.8-.5c0 1.9 1.35 3.5 3.14 3.87a3.98 3.98 0 0 1-1.8.07 3.98 3.98 0 0 0 3.71 2.76A7.98 7.98 0 0 1 2 18.4a11.27 11.27 0 0 0 6.1 1.79c7.33 0 11.34-6.07 11.34-11.34l-.01-.52c.78-.55 1.45-1.25 1.98-2.04-.72.32-1.49.53-2.29.62A3.98 3.98 0 0 0 22 5.9z"
          />
          <SocialIcon
            label="Pinterest"
            path="M12 2a10 10 0 0 0-3.65 19.3c-.06-.83-.11-2.1.02-3 .12-.83.79-5.3.79-5.3s-.2-.4-.2-1c0-.94.54-1.64 1.22-1.64.57 0 .85.43.85.95 0 .58-.37 1.44-.56 2.24-.16.67.34 1.22 1 1.22 1.2 0 2.13-1.27 2.13-3.09 0-1.62-1.16-2.75-2.82-2.75-1.92 0-3.05 1.44-3.05 2.93 0 .58.22 1.2.5 1.54a.2.2 0 0 1 .05.19c-.05.22-.17.68-.2.78-.03.13-.1.16-.24.1-.9-.42-1.46-1.72-1.46-2.78 0-2.26 1.64-4.34 4.74-4.34 2.49 0 4.42 1.77 4.42 4.14 0 2.47-1.56 4.46-3.72 4.46-.73 0-1.41-.38-1.64-.83 0 0-.4 1.5-.49 1.86-.17.68-.65 1.53-.97 2.05A10 10 0 1 0 12 2z"
          />
        </div>
      </div>
    </footer>
  );
}
