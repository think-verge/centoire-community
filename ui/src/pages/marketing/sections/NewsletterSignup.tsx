import { useState, type FormEvent } from "react";

export function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // No newsletter backend exists yet — this is a visual-fidelity pass on the
    // landing page only. Capture intent client-side for now.
    setSubmitted(true);
  }

  return (
    <section className="flex flex-col gap-10 border-b border-hairline bg-sand-deep px-6 py-16 sm:px-20 sm:py-24 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex max-w-[520px] flex-col gap-4">
        <h2 className="font-editorial text-4xl text-charcoal sm:text-[56px]">Never Miss a Story</h2>
        <p className="font-ui text-base leading-[1.6] text-stone">
          Get the best of fashion, culture, and style curated by our global editorial desk,
          straight to your inbox every Sunday morning.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {submitted ? (
          <p className="font-ui text-sm font-semibold text-charcoal">
            You're on the list — check your inbox to confirm.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:flex-row">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address..."
              className="font-ui w-full rounded border border-hairline bg-sand px-5 py-3.5 text-sm text-charcoal placeholder:text-taupe focus:border-coral focus:outline-none sm:w-[400px]"
            />
            <button
              type="submit"
              className="font-ui shrink-0 rounded bg-charcoal px-8 py-3.5 text-sm font-bold text-sand transition-opacity hover:opacity-90"
            >
              Subscribe
            </button>
          </form>
        )}
        <p className="font-ui text-[13px] text-taupe">
          Join 42,000+ fashion insiders. Unsubscribe anytime.
        </p>
      </div>
    </section>
  );
}
