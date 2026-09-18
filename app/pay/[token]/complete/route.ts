import type { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { completeBankSetup } from "@/lib/bank-setup";
import { deliverPendingMessages } from "@/lib/messaging";
import { getPlanByToken } from "@/lib/plans";

// Stripe Checkout's success_url. Activates (or resumes) the plan once Stripe confirms the mandate.
export async function GET(request: NextRequest, ctx: RouteContext<"/pay/[token]/complete">) {
  const { token } = await ctx.params;
  const data = await getPlanByToken(token);
  if (!data) return new Response("Not found", { status: 404 });

  const planPage = `/pay/${data.plan.setup_token}`;
  if (data.plan.status !== "draft" && data.plan.status !== "failed") redirect(planPage);

  let completed = false;
  try {
    completed = await completeBankSetup(data, request.nextUrl.searchParams.get("session_id") ?? "");
    if (completed) await deliverPendingMessages();
  } catch (err) {
    console.error(`Bank setup confirmation failed for plan ${data.plan.id}:`, err);
  }

  redirect(`${planPage}?setup=${completed ? "done" : "error"}`);
}
