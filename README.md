# Halfshaft

Repayment plans for Australian car service centres. A workshop signs up, connects its own
Stripe account, and sets up plans at the counter. The customer adds their bank details once
on Stripe's secure page, and each instalment is debited by BECS Direct Debit straight into
the workshop's Stripe account.

**How money moves:** every debit is a direct charge on the workshop's own Stripe account.
Stripe charges its processing fee to the workshop. Halfshaft never holds, pays or takes a
cut of plan money.

## Stack

- Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS 4, anime.js
- Postgres through `pg`: Neon in production, an embedded Postgres server locally
- Stripe Connect (Accounts v2, full Stripe Dashboard), Checkout in setup mode, BECS Direct Debit
- Resend for email (optional)

## Local development

Requires Node.js 22 or later.

```bash
npm install
```

Copy `.env.example` to `.env.local` and fill in the Stripe **test** keys, then:

```bash
npm run dev
```

That starts a local Postgres server (stored in `data/postgres`, gitignored) and the Next.js
dev server at http://localhost:3000. Tables are created automatically on first use.

| Command | What it does |
| --- | --- |
| `npm run db` | Starts only the local database, for running scripts while the app is stopped |
| `node scripts/run-debits.mjs [as_of=YYYY-MM-DD]` | Runs the debit job once on the running app (`as_of` works in test mode only) |
| `npm run admin:create -- email=you@example.com name="Your Name"` | Creates a Halfshaft admin login and prints its password once |
| `node scripts/seed-workshop.mjs ...` | Attaches an owner login to an existing Stripe test account |
| `npm run db:import-sqlite` | One-off copy of the old SQLite database into Postgres |

## How it runs

- **Workshops** log in at `/login` and manage plans at `/dashboard`.
- **Customers** use the private link on their plan (`/pay/<token>`) to add bank details.
- **The debit job** (`/api/cron/debits`) charges due instalments and retries failed ones. A
  scheduler calls it every 15 minutes with `Authorization: Bearer <CRON_SECRET>`.
- **Stripe webhooks** (`/api/webhooks/stripe`) keep payments, mandates and accounts up to
  date. The debit job also re-checks processing payments with Stripe, in case a webhook is missed.
- **Admins** (Halfshaft staff) sign in at `/admin/login` to see every workshop, suspend or
  restore a workshop's access, resend a customer's bank details link, and run the debit job.

Deploying to Vercel: see [DEPLOY.md](DEPLOY.md).
