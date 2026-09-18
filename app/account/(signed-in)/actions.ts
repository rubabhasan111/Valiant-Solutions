"use server";

import { redirect } from "next/navigation";
import { destroyCustomerSession } from "@/lib/customer/session";

export async function customerLogout() {
  await destroyCustomerSession();
  redirect("/account/login");
}
