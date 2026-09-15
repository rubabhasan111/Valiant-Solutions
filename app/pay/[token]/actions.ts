"use server";

import { redirect } from "next/navigation";
import { createBankSetupSession } from "@/lib/bank-setup";
import { getPlanByToken } from "@/lib/plans";

// Sends the customer to Stripe Checkout to add bank details: for a new plan, or to
// resume a plan paused because its bank account couldn't be debited.
export async function startBankSetup(token: string) {
  const data = await getPlanByToken(token);
  if (!data) redirect("/");

  const planPage = `/pay/${data.plan.setup_token}`;
  if (data.plan.status !== "draft" && data.plan.status !== "failed") redirect(planPage);

  let checkoutUrl: string;
  try {
    checkoutUrl = await createBankSetupSession(data);
  } catch (err) {
    console.error(`Bank setup failed to start for plan ${data.plan.id}:`, err);
    redirect(`${planPage}?setup=error`);
  }

  redirect(checkoutUrl);
}
