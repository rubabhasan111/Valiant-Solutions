"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { callerAddress } from "@/lib/auth/caller";
import {
  checkRateLimit, tooManyAttemptsMessage } from "@/lib/auth/rate-limit";
import { requestCustomerCode } from "@/lib/customer/auth";
import { deliverPendingMessages } from "@/lib/messaging";
import { EMAIL, formText } from "@/lib/validation";

export type RequestCodeState = { error?: string; email?: string } | undefined;

export async function requestSignInCode(_prev: RequestCodeState, formData: FormData): Promise<RequestCodeState> {
  const email = formText(formData, "email").toLowerCase();
  if (!EMAIL.test(email)) return { error: "Enter the email address your workshop has for you.", email };

  const address = await callerAddress();
  const limit = await checkRateLimit("customer_code", email, address);
  if (!limit.allowed) return { error: tooManyAttemptsMessage(limit.retryAfterMinutes), email };

  await requestCustomerCode(email);
  after(() => deliverPendingMessages());

  // The next page looks the same whether or not that address has a plan.
  redirect(`/account/verify?email=${encodeURIComponent(email)}`);
}
