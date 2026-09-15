import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, type MembershipRole, type ServiceCentre } from "@/lib/db";
import { hashSessionToken, WORKSHOP_SESSION_COOKIE } from "@/lib/auth/session";

export type WorkshopUser = { id: number; name: string; email: string };

export type WorkshopContext = {
  user: WorkshopUser;
  centre: ServiceCentre;
  role: MembershipRole;
};

// The secure session check: the cookie token must match an unexpired session row, and
// the user's workshop must not be suspended by a Halfshaft admin.
export const getWorkshopUser = cache(async (): Promise<WorkshopUser | null> => {
  const token = (await cookies()).get(WORKSHOP_SESSION_COOKIE)?.value;
  if (!token) return null;

  const user = await db.one<WorkshopUser>(
    `SELECT u.id, u.name, u.email
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now()
        AND NOT EXISTS (
          SELECT 1 FROM memberships m
            JOIN service_centres sc ON sc.id = m.service_centre_id
           WHERE m.user_id = u.id AND sc.suspended_at IS NOT NULL
        )`,
    [hashSessionToken(token)],
  );

  return user ?? null;
});

// The logged-in user and the centre they belong to, or null. For API routes that
// answer with a status code instead of redirecting.
export const getWorkshopContext = cache(async (): Promise<WorkshopContext | null> => {
  const user = await getWorkshopUser();
  if (!user) return null;

  const row = await db.one<ServiceCentre & { membership_role: MembershipRole }>(
    `SELECT sc.*, m.role AS membership_role
       FROM memberships m
       JOIN service_centres sc ON sc.id = m.service_centre_id
      WHERE m.user_id = $1
      ORDER BY m.created_at
      LIMIT 1`,
    [user.id],
  );
  if (!row) return null;

  const { membership_role: role, ...centre } = row;
  return { user, centre, role };
});

// Every dashboard page, route and action goes through this (or getWorkshopContext), so
// all data is scoped to the logged-in user's centre. Never trust a centre ID from the URL.
export const requireWorkshop = cache(async (): Promise<WorkshopContext> => {
  if (!(await getWorkshopUser())) redirect("/login");
  const context = await getWorkshopContext();
  if (!context) redirect("/shop/signup");
  return context;
});
