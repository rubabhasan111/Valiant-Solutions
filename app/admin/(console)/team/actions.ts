"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/dal";
import { recordAudit } from "@/lib/admin/data";
import { createAdminInvite, removeAdmin, revokeAdminInvite } from "@/lib/admin/invites";
import { EMAIL, formText } from "@/lib/validation";

export type InviteState = { error?: string; link?: string; name?: string } | undefined;

export async function inviteAdmin(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const admin = await requireAdmin();
  const name = formText(formData, "name");
  const email = formText(formData, "email").toLowerCase();

  if (!name) return { error: "Enter their name." };
  if (!EMAIL.test(email)) return { error: "Enter a valid email address." };

  const result = await createAdminInvite(admin.id, name, email);
  if ("error" in result) return { error: result.error };

  await recordAudit(admin.id, "admin_invited", { detail: `${name} (${email})` });
  revalidatePath("/admin/team");
  // The link is shown once, for the inviter to pass on; only its hash is stored.
  return { link: result.link, name };
}

export async function revokeInvite(email: string) {
  const admin = await requireAdmin();
  const revoked = await revokeAdminInvite(email);
  if (revoked) await recordAudit(admin.id, "admin_invite_revoked", { detail: email });
  redirect(`/admin/team?notice=${revoked ? "invite-revoked" : "nothing-to-revoke"}`);
}

export async function removeAdminAccount(adminId: number) {
  const admin = await requireAdmin();
  if (!Number.isInteger(adminId)) redirect("/admin/team");

  const result = await removeAdmin(admin.id, adminId);
  if ("error" in result) redirect(`/admin/team?notice=${encodeURIComponent(result.error)}`);

  await recordAudit(admin.id, "admin_removed", { detail: `Admin #${adminId}` });
  redirect("/admin/team?notice=admin-removed");
}
