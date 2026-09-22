"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { callerAddress } from "@/lib/auth/caller";
import {
  checkRateLimit,
  clearAttempts,
  recordFailedAttempt,
  tooManyAttemptsMessage,
} from "@/lib/auth/rate-limit";
import { requestCustomerCode, verifyCustomerCode } from "@/lib/customer/auth";
import { createCustomerSession } from "@/lib/customer/session";
import { deliverPendingMessages } from "@/lib/messaging";
import { EMAIL, formText } from "@/lib/validation";

export type VerifyCodeState = { error?: string; resent?: boolean } | undefined;

export async function verifySignInCode(_prev: VerifyCodeState, formData: FormData): Promise<VerifyCodeState> {
  const email = formText(formData, "email").toLowerCase();
  const code = formText(formData, "code");
  if (!EMAIL.test(email)) redirect("/account/login");

  const address = await callerAddress();
  const limit = await checkRateLimit("customer_code", email, address);
  if (!limit.allowed) return { error: tooManyAttemptsMessage(limit.retryAfterMinutes) };

  const verified = await verifyCustomerCode(email, code);
  if (!verified) {
    await recordFailedAttempt("customer_code", email, address);
    return { error: "That code isn't right, or it has expired. Ask for a new one below." };
  }

  await clearAttempts("customer_code", email);
  await createCustomerSession(verified);
  redirect("/account");
}

export async function resendSignInCode(_prev: VerifyCodeState, formData: FormData): Promise<VerifyCodeState> {
  const email = formText(formData, "email").toLowerCase();
  if (!EMAIL.test(email)) redirect("/account/login");

  const address = await callerAddress();
  const limit = await checkRateLimit("customer_code", email, address);
  if (!limit.allowed) return { error: tooManyAttemptsMessage(limit.retryAfterMinutes) };

  await requestCustomerCode(email);
  after(() => deliverPendingMessages());
  return { resent: true };
}
