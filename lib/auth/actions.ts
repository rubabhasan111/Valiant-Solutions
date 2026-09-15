"use server";

import { redirect } from "next/navigation";
import { destroyWorkshopSession } from "@/lib/auth/session";

export async function logout() {
  await destroyWorkshopSession();
  redirect("/login");
}
