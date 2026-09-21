import type { ReactNode } from "react";
import Link from "next/link";
import { LEGAL } from "@/lib/legal";

// Shared layout for the terms and privacy pages: a title, a last-updated line, and
// numbered sections that are easy to cite ("clause 4").
export function LegalPage({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12 md:py-16">
      <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight">{title}</h1>
      <p className="mt-3 text-sm text-mute">Last updated {LEGAL.lastUpdated}</p>
      {!LEGAL.reviewed && (
        <p className="mt-6 rounded-2xl bg-pending-pale px-5 py-3 text-sm font-semibold text-pending">
          Draft: this page hasn&apos;t been reviewed by a lawyer yet and may change before Halfshaft launches.
        </p>
      )}
      <div className="mt-6 text-lg leading-relaxed text-body">{intro}</div>
      <div className="mt-10 grid gap-10">{children}</div>
      <p className="mt-12 border-t border-edge pt-6 text-sm text-mute">
        See also the{" "}
        <Link href="/terms" className="font-semibold text-ink underline underline-offset-2">
          terms of use
        </Link>{" "}
        and the{" "}
        <Link href="/privacy" className="font-semibold text-ink underline underline-offset-2">
          privacy policy
        </Link>
        .
      </p>
    </main>
  );
}

export function Clause({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`clause-${n}`}>
      <h2 id={`clause-${n}`} className="text-xl font-extrabold tracking-tight text-ink">
        {n}. {title}
      </h2>
      <div className="mt-3 grid gap-3 leading-relaxed text-body [&_li]:ml-5 [&_li]:list-disc [&_ul]:grid [&_ul]:gap-1.5">
        {children}
      </div>
    </section>
  );
}

// How to reach Halfshaft, or where the details will go once they're set.
export function ContactLine() {
  return LEGAL.contactEmail ? (
    <a href={`mailto:${LEGAL.contactEmail}`} className="font-semibold text-ink underline underline-offset-2">
      {LEGAL.contactEmail}
    </a>
  ) : (
    <span className="font-semibold text-ink">the contact email that will be listed here before launch</span>
  );
}
