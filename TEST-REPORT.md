# Overnight test report, 16-17 September 2026

Everything below was run without supervision, against the live site
(`valiant-solutions.vercel.app`) and against a local copy with a real Postgres database
and real Stripe test-mode calls.

**Result: 55 automated checks passed, 1 real bug found and fixed, 3 items need you.**

## What needs you

### 1. The publishable key in Vercel belongs to a different Stripe account

`STRIPE_SECRET_KEY` on the live site belongs to a Stripe account whose connected accounts
look like `acct_...HnZp...`. The `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is
`pk_test_51UASA7HxaNUuYlCE...`, which belongs to a *different* sandbox (the one on this
computer, whose accounts look like `acct_...HxaN...`).

Effect: the embedded Stripe panels on the workshop's **Payouts** and **Transactions** pages
will not load. Nothing else is affected; debits, plans and the customer flow do not use the
publishable key.

Fix: in Stripe, switch to the account your live secret key belongs to, in test mode, then
**Developers → API keys** → copy that account's **publishable** key. In Vercel, remove
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` and add it again with that value, Type **Config**.

### 2. The Stripe webhook is registered in the wrong Stripe account

The webhook endpoint `we_1UG9jHHxaNUuYlCEBw7g8VHJ` was created in the sandbox on this
computer, not in the account the live site uses. Your production Stripe account therefore
has no webhook pointing at the live site, so it will not push payment updates.

Effect: smaller than it sounds. The debit job re-reads every processing payment directly
from Stripe on each run, which is how the two payments in this report were settled. Updates
arrive within 15 minutes instead of within seconds.

Fix: in the Stripe account the live site uses, test mode → **Developers → Webhooks → Add
destination** → events from **Connected accounts** → select `payment_intent.processing`,
`payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`,
`mandate.updated`, `checkout.session.completed`, `account.updated` → URL
`https://valiant-solutions.vercel.app/api/webhooks/stripe`. Put the new `whsec_...` into
Vercel as `STRIPE_WEBHOOK_SECRET` (Type Secret) and redeploy.

### 3. No payment plan exists on the live site yet

Harbour Auto Works is signed up and Stripe has switched on BECS Direct Debit for it, but it
has no plans. The plan form was filled in correctly twice, and both times the final button
press did not reach the page: button clicks sent from this session do not register in your
Chrome (the same thing happened with Vercel's own Deploy and Create Database buttons).
Typing into fields works; pressing the button does not.

To finish the live test: open `/dashboard/plans/new`, fill it in, and press **Create plan**
yourself. Then send yourself the customer link and add the test bank details, BSB `000-000`,
account `000123456`.

## The bug found and fixed

**The admin setup page was being served from the CDN cache.** It reads the database but uses
no cookies or headers, so Next.js prerendered it at build time and Vercel served a copy that
was nearly seven hours old. Anyone visiting `/admin/setup` saw the "Create your admin
account" form even though your admin already existed.

It was never a security hole: the server action re-checks inside a database transaction and
refuses once any admin exists. But the page was misleading. Fixed in commit `9170239` by
forcing the page to render per request, and verified live: it now returns
`x-vercel-cache: MISS` and says "Admin already set up".

## Live site: 28 of 28 checks passed

| Area | Checks |
|---|---|
| Public pages | Home, login, signup, admin login, admin setup all return 200 with the right content |
| Not-found handling | Unknown plan tokens and unknown URLs return 404, not an error page |
| Workshop pages | All six dashboard pages redirect to `/login` when signed out, leaking nothing |
| Admin pages | `/admin` and `/admin/workshops/1` redirect to `/admin/login`; a forged admin cookie is refused |
| Debit job API | No secret → 401. Wrong secret → 401. Correct secret → 200. Background mode → 202. Malformed date → 400. GET and POST both work |
| Stripe panel API | Refuses unauthenticated callers with 401 |
| Webhooks | No signature → 400. Bad signature → 400. **Correctly signed event → 200 and processed.** The same event delivered twice → recognised as a duplicate |
| Transport | HSTS enabled for two years including subdomains; plain HTTP redirects to HTTPS |

Page response times were 280-1200ms, with the database-backed page at 3.8 seconds on a cold
start (Neon's free tier sleeps when idle, then wakes).

## Payment engine: 14 of 14 checks passed

Run against a throwaway Postgres database with synthetic Stripe responses: retries that
never stop, workshop notified once per failed instalment while the customer is emailed every
time, closed bank accounts pausing the plan, new bank details resuming it and requeuing the
missed payment, plans completing exactly once, cancelled direct debit authorities pausing
the plan, money totals adding up, and concurrent activations and notifications each
happening only once.

## Access control: 13 of 13 checks passed

Tested over real HTTP against the local site:

- An active workshop reaches its dashboard and sees its own plans
- A suspended workshop is locked out of every page, including customer data
- **A suspended workshop's customers are unaffected**: their payment link still works and
  their scheduled debits stay in place
- Restoring access works immediately
- Customer links: a short token, and a well-formed but unknown token, both return 404
- A forged Stripe Checkout session ID is refused
- Forged session cookies are refused

## Real money movement, end to end

Two real debits were collected through Stripe test mode during the night, on the local copy.

**Kingsway Auto Service, payment 2 of 6, $333.34**

| | |
|---|---|
| Customer charged | $333.34 |
| Stripe's fee to the workshop | $3.18 + $0.32 GST = **$3.50** |
| Workshop receives | **$329.84** |
| Charged to Halfshaft | **$0.00** |
| Application fee on the payment | **none** |
| Platform balance transactions | **zero** |

That is the whole business model, verified: money moves from the customer's bank account to
the workshop's own Stripe account, Stripe bills the workshop, and Halfshaft neither pays nor
collects anything.

**Overlapping schedulers cannot double-charge.** Four debit runs were fired at the same
instant against the same due instalment. Exactly one PaymentIntent was created, the
instalment's attempt count stayed at 1, and the other runs reported "skipped". A second
payment for a different workshop was collected in the same burst, proving the lock is per
instalment and not a global freeze. No PaymentIntent is shared between two instalments, and
no instalment has ever been attempted twice.

Both payments then settled to `paid` through the reconciliation pass, which is how the
system copes without webhooks.

## The scheduler

GitHub Actions has run the debit job **36 times, every one successful**, roughly every 15
minutes through the night, each finishing in 6-9 seconds.

## Secrets

- No API key, webhook secret or password appears in any tracked file
- No `.env` file has ever been committed, in any commit in the repository's history
- `.gitignore` correctly excludes `.env.local`, the local database and `.vercel`
- The only committed environment file is `.env.example`, which contains placeholders

## Still not done

- **Email is switched off.** Messages to workshops and customers are recorded in the
  database and marked "skipped". Turning it on needs a domain and a Resend account.
- **Stripe is in test mode.** No real money can move.
- **Vercel Hobby** is for non-commercial use; move to Pro before taking paying clients.
- **No rate limiting on login.** Worth adding before real customers, so passwords can't be
  guessed at speed.
