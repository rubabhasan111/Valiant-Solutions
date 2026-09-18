"use server";

import { redirect } from "next/navigation";
import { completePasswordReset } from "@/lib/auth/password-reset";
import { createWorkshopSession } from "@/lib/auth/session";

export type ResetPasswordState = { error?: string } | undefined;

const MIN_PASSWORD_LENGTH = 10;

export async function resetPasswordAction(
  token: string,
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmPassword") ?? "");

  if (password.length < MIN_PASSWORD_LENGTH) return { error: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
  if (password !== confirmation) return { error: "Both passwords need to match." };

  const userId = await completePasswordReset(token, password);
  if (!userId) return { error: "This link has expired or has already been used. Ask for a new one." };

  await createWorkshopSession(userId);
  redirect("/dashboard");
}
