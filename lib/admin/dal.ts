import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin/session";
import { hashSessionToken } from "@/lib/auth/session";
import { db } from "@/lib/db";

export type Admin = { id: number; name: string; email: string; alert_phone: string | null };

export const getAdmin = cache(async (): Promise<Admin | null> => {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;

  const admin = await db.one<Admin>(
    `SELECT a.id, a.name, a.email, a.alert_phone
       FROM admin_sessions s
       JOIN admins a ON a.id = s.admin_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashSessionToken(token)],
  );
  return admin ?? null;
});

// Every admin page and action goes through this. Workshop logins never grant admin access.
export const requireAdmin = cache(async (): Promise<Admin> => {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
});
