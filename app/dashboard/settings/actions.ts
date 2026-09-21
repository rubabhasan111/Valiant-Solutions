"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireWorkshop } from "@/lib/auth/dal";
import { hashSessionToken, WORKSHOP_SESSION_COOKIE } from "@/lib/auth/session";
import { deliverPendingMessages } from "@/lib/messaging";
import { EMAIL, formText } from "@/lib/validation";
import { changePassword, updateBusinessDetails, updateProfile } from "@/lib/workshop-settings";
import { createStaffInvite, removeStaffMember, revokeStaffInvite } from "@/lib/workshop-team";

export type SettingsFormState = { error?: string; saved?: boolean } | undefined;
export type StaffInviteState = { error?: string; link?: string; name?: string } | undefined;

const PAGE = "/dashboard/settings";

export async function saveProfile(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const { user } = await requireWorkshop();
  const result = await updateProfile(user.id, { name: formText(formData, "name"), email: formText(formData, "email") });
  if (!result.ok) return { error: result.error };
  revalidatePath("/dashboard", "layout");
  return { saved: true };
}

export async function savePassword(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const { user } = await requireWorkshop();
  const token = (await cookies()).get(WORKSHOP_SESSION_COOKIE)?.value;
  const result = await changePassword(user.id, token ? hashSessionToken(token) : null, {
    current: String(formData.get("currentPassword") ?? ""),
    next: String(formData.get("newPassword") ?? ""),
    confirm: String(formData.get("confirmPassword") ?? ""),
  });
  return result.ok ? { saved: true } : { error: result.error };
}

// Owner only: the business details appear in every customer text and email.
export async function saveBusiness(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const { centre, role } = await requireWorkshop();
  if (role !== "owner") return { error: "Only the workshop's owner can change these details." };
  const result = await updateBusinessDetails(centre.id, {
    name: formText(formData, "businessName"),
    phone: formText(formData, "businessPhone"),
    email: formText(formData, "businessEmail"),
  });
  if (!result.ok) return { error: result.error };
  revalidatePath("/dashboard", "layout");
  return { saved: true };
}

export async function inviteStaff(_prev: StaffInviteState, formData: FormData): Promise<StaffInviteState> {
  const { user, centre, role } = await requireWorkshop();
  if (role !== "owner") return { error: "Only the workshop's owner can add staff." };

  const name = formText(formData, "staffName");
  const email = formText(formData, "staffEmail").toLowerCase();
  if (!name) return { error: "Enter their name." };
  if (!EMAIL.test(email)) return { error: "Enter a valid email address." };

  const result = await createStaffInvite(centre, user, name, email);
  if ("error" in result) return { error: result.error };
  await deliverPendingMessages();
  revalidatePath(PAGE);
  // The link is shown once, for the owner to pass on; only its hash is stored.
  return { link: result.link, name };
}

export async function cancelStaffInvite(email: string) {
  const { centre, role } = await requireWorkshop();
  if (role !== "owner") redirect(PAGE);
  const revoked = await revokeStaffInvite(centre.id, email);
  redirect(`${PAGE}?team=${revoked ? "invite-cancelled" : "nothing"}`);
}

export async function removeStaff(userId: number) {
  const { centre, role } = await requireWorkshop();
  if (role !== "owner") redirect(PAGE);
  const removed = await removeStaffMember(centre.id, userId);
  redirect(`${PAGE}?team=${removed ? "removed" : "nothing"}`);
}
