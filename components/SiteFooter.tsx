import Link from "next/link";
import { LEGAL, operatorLine } from "@/lib/legal";

// One footer for every public page, so any page can reach any other: the workshop pages,
// the customer sign-in, and the legal pages.
const COLUMNS = [
  {
    title: "For workshops",
    links: [
      { href: "/for-workshops", label: "How Halfshaft works" },
      { href: "/guide", label: "Setup guide" },
      { href: "/shop/signup", label: "Sign up your workshop" },
      { href: "/login", label: "Workshop log in" },
    ],
  },
  {
    title: "For customers",
    links: [{ href: "/account/login", label: "See your payments" }],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms of use" },
      { href: "/privacy", label: "Privacy policy" },
    ],
  },
];

export function SiteFooter() {
  const testMode = !process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_");

  return (
    <footer className="mt-auto border-t border-edge print:hidden">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 md:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,1fr))] md:px-8">
        <div>
          <Link href="/" className="text-lg font-extrabold tracking-tight">
            Halfshaft
          </Link>
          <p className="mt-2 max-w-[34ch] text-sm leading-relaxed text-mute">
            Repayment plans for Australian car workshops, paid by direct debit through Stripe.
          </p>
          {LEGAL.contactEmail && (
            <a
              href={`mailto:${LEGAL.contactEmail}`}
              className="mt-3 inline-block text-sm font-semibold text-body underline-offset-2 hover:text-ink hover:underline"
            >
              {LEGAL.contactEmail}
            </a>
          )}
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h2 className="text-sm font-bold text-ink">{column.title}</h2>
            <ul className="mt-3 grid gap-2 text-sm">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-body underline-offset-2 hover:text-ink hover:underline">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-edge">
        <p className="mx-auto max-w-7xl px-5 py-5 text-xs leading-relaxed text-mute md:px-8">
          Halfshaft is run by {operatorLine()}. Payments are processed by Stripe.
          {testMode && " Test mode: no real money moves."}
        </p>
      </div>
    </footer>
  );
}
