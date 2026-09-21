import { randomBytes } from "node:crypto";
import { hashPassword } from "@/lib/auth/password";
import { hashSessionToken } from "@/lib/auth/tokens";
import { db, isUniqueViolation, transaction, type MembershipRole } from "@/lib/db";
import { appUrl } from "@/lib/stripe";

// A workshop owner adds staff with a one-time invite link; each person chooses their own
// password. Staff can run plans and customers but can't change the business details, the
// team, or where Stripe pays out. A login belongs to one workshop.

const INVITE_VALID_DAYS = 7;
const TOKEN = /^[\w-]{43}$/;

export type TeamMember = {
  id: number;
  name: string;
  email: string;
  role: MembershipRole;
  joined_at: string;
  last_login_at: string | null;
};

export function listTeam(centreId: number): Promise<TeamMember[]> {
  return db.query<TeamMember>(
    `SELECT u.id, u.name, u.email, m.role, m.created_at AS joined_at,
            (SELECT MAX(s.created_at) FROM user_sessions s WHERE s.user_id = u.id) AS last_login_at
       FROM memberships m JOIN users u ON u.id = m.user_id
      WHERE m.service_centre_id = $1
      ORDER BY m.role = 'owner' DESC, m.created_at`,
    [centreId],
  );
}

export type PendingStaffInvite = { email: string; name: string; expires_at: string; created_at: string };

export function listPendingStaffInvites(centreId: number): Promise<PendingStaffInvite[]> {
  return db.query<PendingStaffInvite>(
    `SELECT email, name, expires_at, created_at FROM workshop_invites
      WHERE service_centre_id = $1 AND used_at IS NULL AND expires_at > now()
      ORDER BY created_at DESC`,
    [centreId],
  );
}

export type StaffInviteResult = { link: string } | { error: string };

// The link is returned once, for the owner to pass on; only its hash is stored. It's also
// emailed to the person (once email sending is on).
export async function createStaffInvite(
  centre: { id: number; name: string },
  inviter: { id: number; name: string },
  name: string,
  email: string,
): Promise<StaffInviteResult> {
  const address = email.trim().toLowerCase();
  if (await db.one("SELECT 1 FROM users WHERE email = $1", [address])) {
    return { error: "That email already has a Halfshaft login. Each login belongs to one workshop, so use another address." };
  }

  const token = randomBytes(32).toString("base64url");
  const link = `${appUrl()}/join/${token}`;
  const tokenHash = hashSessionToken(token);

  await transaction(async (tx) => {
    await tx.run("DELETE FROM workshop_invites WHERE service_centre_id = $1 AND email = $2 AND used_at IS NULL", [
      centre.id,
      address,
    ]);
    await tx.run(
      `INSERT INTO workshop_invites (token_hash, service_centre_id, email, name, invited_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, now() + make_interval(days => $6))`,
      [tokenHash, centre.id, address, name.trim(), inviter.id, INVITE_VALID_DAYS],
    );
    await tx.run(
      `INSERT INTO email_outbox (service_centre_id, notification_id, audience, recipient, subject, text_body, dedupe_key)
       VALUES ($1, NULL, 'workshop', $2, $3, $4, $5)`,
      [
        centre.id,
        address,
        `${inviter.name} added you to ${centre.name} on Halfshaft`,
        `Hi ${name.trim().split(/\s+/)[0]},\n\n${inviter.name} has added you to ${centre.name}'s Halfshaft account, where the workshop sets up and tracks customer repayment plans.\n\nChoose your password here:\n${link}\n\nThe link works once and expires in ${INVITE_VALID_DAYS} days.\n\nHalfshaft`,
        `staff_invite:${tokenHash.slice(0, 24)}`,
      ],
    );
  });

  return { link };
}

export function revokeStaffInvite(centreId: number, email: string): Promise<number> {
  return db.run("DELETE FROM workshop_invites WHERE service_centre_id = $1 AND email = $2 AND used_at IS NULL", [
    centreId,
    email.trim().toLowerCase(),
  ]);
}

export type OpenStaffInvite = { email: string; name: string; centre_name: string; invited_by_name: string | null };

export async function readStaffInvite(token: string): Promise<OpenStaffInvite | null> {
  if (!TOKEN.test(token)) return null;
  const invite = await db.one<OpenStaffInvite>(
    `SELECT i.email, i.name, sc.name AS centre_name, u.name AS invited_by_name
       FROM workshop_invites i
       JOIN service_centres sc ON sc.id = i.service_centre_id
       LEFT JOIN users u ON u.id = i.invited_by
      WHERE i.token_hash = $1 AND i.used_at IS NULL AND i.expires_at > now() AND sc.suspended_at IS NULL`,
    [hashSessionToken(token)],
  );
  return invite ?? null;
}

// Turns an invite into a staff login. Returns the new user's ID, or null if the link was
// expired, already used, or the email has since been taken.
export async function acceptStaffInvite(token: string, name: string, password: string): Promise<number | null> {
  if (!TOKEN.test(token)) return null;
  const passwordHash = await hashPassword(password);

  try {
    return await transaction(async (tx) => {
      const invite = await tx.one<{ email: string; service_centre_id: number }>(
        `UPDATE workshop_invites i SET used_at = now()
           FROM service_centres sc
          WHERE i.token_hash = $1 AND i.used_at IS NULL AND i.expires_at > now()
            AND sc.id = i.service_centre_id AND sc.suspended_at IS NULL
          RETURNING i.email, i.service_centre_id`,
        [hashSessionToken(token)],
      );
      if (!invite) return null;

      const user = await tx.one<{ id: number }>(
        "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
        [name.trim(), invite.email, passwordHash],
      );
      await tx.run("INSERT INTO memberships (user_id, service_centre_id, role) VALUES ($1, $2, 'staff')", [
        user!.id,
        invite.service_centre_id,
      ]);
      return user!.id;
    });
  } catch (err) {
    if (isUniqueViolation(err)) return null;
    throw err;
  }
}

// Removes a staff login entirely, which signs them out everywhere. The owner can't be
// removed this way, and only staff of this workshop can be.
export async function removeStaffMember(centreId: number, userId: number): Promise<boolean> {
  if (!Number.isInteger(userId)) return false;
  const removed = await db.run(
    `DELETE FROM users WHERE id = $1
        AND EXISTS (SELECT 1 FROM memberships WHERE user_id = $1 AND service_centre_id = $2 AND role = 'staff')`,
    [userId, centreId],
  );
  return removed > 0;
}
