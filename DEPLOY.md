# Deploying Halfshaft

GitHub → Vercel → Neon Postgres, with cron-job.org calling the debit job. Deploy in
**Stripe test mode** first and run a full test before switching anything to live.

You need accounts on GitHub, Vercel, Neon (created through Vercel) and cron-job.org.

> **Vercel plan:** Vercel's free Hobby plan is for personal, non-commercial projects. It's
> fine for this test deployment, but once workshops pay you to use Halfshaft, move to Vercel
> Pro. Pro can also run the 15-minute debit job itself, so cron-job.org is no longer needed.

## 1. Put the code on GitHub

Create a **private** repository on GitHub (no README or .gitignore; the project has its own),
then from the project folder:

```bash
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

`.env.local` and the local database are gitignored, so no secrets are pushed.

## 2. Create the Vercel project

1. In Vercel, **Add New → Project** and import the GitHub repository. Vercel detects Next.js.
2. Before the first deploy, open **Settings → Functions** and set the region to **Sydney
   (syd1)**, close to the database and to workshops.

## 3. Add the Neon database

1. In the Vercel project, **Storage → Create Database → Neon**.
2. Choose the **Sydney (AWS ap-southeast-2)** region and connect it to the project.

Vercel adds the connection string for you. The tables are created automatically the first
time the app runs.

If you typed a prefix while connecting the database, Neon names its variables after it, for
example `DATABASE_URL_POSTGRES_URL` instead of `DATABASE_URL`. The app reads
`DATABASE_URL` first, then `DATABASE_URL_POSTGRES_URL`, then `POSTGRES_URL`, so either
naming works. Just make sure no leftover `DATABASE_URL` is still pointing at localhost:
delete it if the import created one from `.env.example`.

## 4. Environment variables

In **Settings → Environment Variables** (Production and Preview):

| Variable | Value |
| --- | --- |
| `STRIPE_SECRET_KEY` | Your Stripe **test** secret key (`sk_test_...`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Your Stripe **test** publishable key (`pk_test_...`) |
| `NEXT_PUBLIC_APP_URL` | The Vercel address, e.g. `https://halfshaft.vercel.app` (no trailing slash) |
| `CRON_SECRET` | A long random string (generate one below) |
| `STRIPE_WEBHOOK_SECRET` | Added in step 6 |
| `RESEND_API_KEY`, `EMAIL_FROM` | Leave unset until you have a domain; emails are recorded but not sent |
| `CLICKSEND_USERNAME`, `CLICKSEND_API_KEY`, `SMS_SENDER` | Leave unset until you have a ClickSend account; texts are recorded but not sent |

Generate `CRON_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Then **Deployments → Redeploy** so the variables apply.

## 5. Create your admin login

Copy Neon's connection string from **Storage → Neon → .env.local tab** (`DATABASE_URL`). In
PowerShell, from the project folder:

```powershell
$env:DATABASE_URL="<Neon connection string>"; npm run admin:create -- email=you@example.com name="Your Name"; Remove-Item Env:DATABASE_URL
```

It prints the database host (check it's Neon, not localhost) and a new password once. Sign
in at `https://<your-app>/admin/login`.

## 6. Stripe webhook

1. Stripe Dashboard, **test mode** → **Developers → Webhooks → Add destination**.
2. Choose events from **Connected accounts**.
3. Select: `payment_intent.processing`, `payment_intent.succeeded`,
   `payment_intent.payment_failed`, `payment_intent.canceled`, `mandate.updated`,
   `checkout.session.completed`, `account.updated`.
4. Endpoint URL: `https://<your-app>/api/webhooks/stripe`.
5. Copy the signing secret (`whsec_...`) into `STRIPE_WEBHOOK_SECRET` on Vercel and redeploy.

## 7. Schedule the debit job

Either of these works. GitHub Actions needs no extra account; cron-job.org keeps better time.

### Option A: GitHub Actions (no new account)

`.github/workflows/debits.yml` is already in the repository and runs every 15 minutes.
Add the secret it needs: on GitHub, **Settings → Secrets and variables → Actions → New
repository secret**, name `CRON_SECRET`, value the same string as in Vercel.

Then open the **Actions** tab, choose **Run debit job**, and use **Run workflow** to test it.
A run should print `HTTP 202`. GitHub can delay scheduled runs by 10-30 minutes when busy,
so move to option B (or a Vercel cron on Pro) once real customers are being debited.

### Option B: cron-job.org

1. **Create cronjob**.
2. URL: `https://<your-app>/api/cron/debits?background=1`
3. Schedule: every 15 minutes.
4. **Advanced**: request method `POST`, and add a header
   `Authorization` with the value `Bearer <CRON_SECRET>`.
5. Save, then use **Test run**. It should return `202`.

`background=1` answers straight away and finishes the job in the background, because
cron-job.org stops waiting after 30 seconds. Each run shows on the admin page under
**Debit job**. If the scheduler stops, the admin page warns you after 30 minutes.

## 8. Test end to end (still test mode)

1. Sign up a workshop at `/shop/signup` and finish Stripe onboarding with Stripe's test details.
2. Create a plan, open the customer link, and add the BECS test account (BSB `000-000`,
   account `000123456`).
3. When the first instalment is due, the scheduler charges it. Check the payment on the
   workshop's Stripe account and in `/admin`.

## 9. Messages to customers

Until these are set up, every email and text is recorded in the database and marked
"skipped", so nothing is lost and nothing is sent.

### Email (needs a domain)

1. Create a free account at resend.com.
2. **Domains → Add domain**, then add the DNS records it shows at your domain provider.
3. **API keys → Create**, and put it in Vercel as `RESEND_API_KEY` (Type Secret).
4. Set `EMAIL_FROM` to something like `Halfshaft <payments@yourdomain.com.au>` (Type Config).

Customer emails are sent in the workshop's name from that address, with **Reply-To set to
the workshop**, so a customer's reply reaches the mechanic.

Without a domain you can still test: Resend lets you send from `onboarding@resend.dev`, but
only to your own account's email address.

### Text messages

1. Create an account at clicksend.com and buy a little credit (texts cost a few cents each).
2. Find the API username and API key in the dashboard.
3. Put them in Vercel as `CLICKSEND_USERNAME` and `CLICKSEND_API_KEY` (Type Secret).
4. Optionally set `SMS_SENDER` to a name of up to 11 letters and numbers, e.g. `Halfshaft`.
   Australia is introducing a register of sender names, so check ClickSend's requirements.

Customers get a text when a plan is created, two days before each payment, and if a payment
fails. Anyone without a mobile number on file gets an email instead.

## Going live later

- Live Stripe keys, a live Connect webhook (same events), and Stripe's Connect platform review.
- A domain: point it at Vercel, set `NEXT_PUBLIC_APP_URL`, and verify it in Resend for
  `RESEND_API_KEY` and `EMAIL_FROM`.
- Vercel Pro (commercial use), which can replace cron-job.org with a Vercel cron job.
- Legal and accounting advice: direct debit terms with customers, and how workshops handle disputes.
