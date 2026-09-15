"use server";

import { revalidatePath } from "next/cache";
import { requireWorkshop } from "@/lib/auth/dal";
import { markAllNotificationsRead } from "@/lib/notifications";

export async function markAllReadAction() {
  const { centre } = await requireWorkshop();
  await markAllNotificationsRead(centre.id);
  // The unread badge lives in the dashboard layout.
  revalidatePath("/dashboard", "layout");
}
