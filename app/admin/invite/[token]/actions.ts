"use server";

import { redirect } from "next/navigation";
import { acceptAdminInvite } from "@/lib/admin/invites";
import { createAdminSession } from "@/lib/admin/session";
import { formText } from "@/lib/validation";

export type AcceptInviteState = { error?: string } | undefined;

const MIN_PASSWORD_LENGTH = 10;

export async function acceptInvite(
  token: string,
  _prev: AcceptInviteState,
  formData: FormData,
): Promise<AcceptInviteState> {
  const name = formText(formData, "name");
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmPassword") ?? "");

  if (!name) return { error: "Enter your name." };
  if (password.length < MIN_PASSWORD_LENGTH) return { error: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
  if (password !== confirmation) return { error: "Both passwords need to match." };

  const adminId = await acceptAdminInvite(token, name, password);
  if (!adminId) return { error: "This invite has expired or has already been used. Ask for a new one." };

  await createAdminSession(adminId);
  redirect("/admin");
}
