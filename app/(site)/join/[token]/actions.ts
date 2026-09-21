"use server";

import { redirect } from "next/navigation";
import { createWorkshopSession } from "@/lib/auth/session";
import { formText } from "@/lib/validation";
import { MIN_PASSWORD_LENGTH } from "@/lib/workshop-settings";
import { acceptStaffInvite } from "@/lib/workshop-team";

export type JoinState = { error?: string } | undefined;

export async function joinWorkshop(token: string, _prev: JoinState, formData: FormData): Promise<JoinState> {
  const name = formText(formData, "name");
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmPassword") ?? "");

  if (!name) return { error: "Enter your name." };
  if (password.length < MIN_PASSWORD_LENGTH) return { error: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
  if (password !== confirmation) return { error: "Both passwords need to match." };

  const userId = await acceptStaffInvite(token, name, password);
  if (!userId) return { error: "This invite has expired or has already been used. Ask the workshop's owner for a new one." };

  await createWorkshopSession(userId);
  redirect("/dashboard");
}
