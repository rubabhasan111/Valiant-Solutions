"use server";

import { after } from "next/server";
import { requestPasswordReset } from "@/lib/auth/password-reset";
import { deliverPendingMessages } from "@/lib/messaging";
import { EMAIL, formText } from "@/lib/validation";

export type ForgotPasswordState = { sent?: boolean; error?: string; email?: string } | undefined;

export async function requestPasswordResetAction(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = formText(formData, "email").toLowerCase();
  if (!EMAIL.test(email)) return { error: "Enter a valid email address.", email };

  await requestPasswordReset(email);
  after(() => deliverPendingMessages());

  // The same answer either way, so this page can't be used to find out who has an account.
  return { sent: true, email };
}
