import { timingSafeEqual } from "node:crypto";
import { after, type NextRequest } from "next/server";
import { runDebitsAndEmails } from "@/lib/jobs";
import { isIsoDate, todayInSydney } from "@/lib/schedule";

// The scheduled debit job. Any scheduler can call it (Vercel Cron, a server cron job,
// Windows Task Scheduler) with "Authorization: Bearer <CRON_SECRET>". Run it every 15
// minutes: failed debits are retried on the next run after Stripe reports the failure,
// and interrupted debits must be retried well within Stripe's 24-hour idempotency window.

// Each debit is a Stripe call made one at a time, so give a busy run room to finish.
export const maxDuration = 300;

function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

async function run(request: NextRequest) {
  if (!authorised(request)) return Response.json({ error: "Unauthorised." }, { status: 401 });

  // Test mode only: run as if it were a later date, to exercise debits before they're due.
  const asOfParam = request.nextUrl.searchParams.get("as_of");
  if (asOfParam) {
    const testMode = process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_");
    if (!testMode || !isIsoDate(asOfParam)) {
      return Response.json({ error: "as_of is only accepted as YYYY-MM-DD in test mode." }, { status: 400 });
    }
  }

  const asOf = asOfParam ?? todayInSydney();

  // Schedulers with short request timeouts (cron-job.org gives up after 30 seconds) call
  // with ?background=1: the job keeps running after the 202 response, and its result is
  // recorded in job_runs, which the admin page shows.
  // Reminders are normally held to daytime hours in Sydney; a test run with as_of sends them
  // whatever the clock says.
  const options = { ignoreQuietHours: Boolean(asOfParam) };

  if (request.nextUrl.searchParams.get("background") === "1") {
    after(() =>
      runDebitsAndEmails(asOf, "scheduler", options).then(
        () => undefined,
        (err) => console.error("Scheduled debit run failed:", err),
      ),
    );
    return Response.json({ accepted: true, asOf }, { status: 202 });
  }

  const { debits, reminders, messages } = await runDebitsAndEmails(asOf, "scheduler", options);
  return Response.json({ ...debits, reminders, emails: messages.emails, texts: messages.texts });
}

// Vercel Cron sends GET requests; other schedulers usually POST.
export const GET = run;
export const POST = run;
