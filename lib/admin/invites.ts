import { randomBytes } from "node:crypto";
import { hashPassword } from "@/lib/auth/password";
import { hashSessionToken } from "@/lib/auth/tokens";
import { db, isUniqueViolation, transaction } from "@/lib/db";
import { appUrl } from "@/lib/stripe";

// Halfshaft staff invite each other rather than sharing a password. The invite carries a
// one-time link; the person opening it chooses their own password.

const INVITE_VALID_DAYS = 7;
const TOKEN = /^[\w-]{43}$/;

export type AdminListItem = {
  id: number;
  name: string;
  email: string;
  created_at: string;
  last_signed_in_at: string | null;
};

export async function listAdmins(): Promise<AdminListItem[]> {
  return db.query<AdminListItem>(
    `SELECT a.id, a.name, a.email, a.created_at,
            (SELECT MAX(s.created_at) FROM admin_sessions s WHERE s.admin_id = a.id) AS last_signed_in_at
       FROM admins a
      ORDER BY a.created_at`,
  );
}

export type PendingInvite = {
  email: string;
  name: string;
  expires_at: string;
  created_at: string;
  invited_by_name: string | null;
};

export async function listPendingInvites(): Promise<PendingInvite[]> {
  return db.query<PendingInvite>(
    `SELECT i.email, i.name, i.expires_at, i.created_at, a.name AS invited_by_name
       FROM admin_invites i
       LEFT JOIN admins a ON a.id = i.invited_by
      WHERE i.used_at IS NULL AND i.expires_at > now()
      ORDER BY i.created_at DESC`,
  );
}

export type InviteResult = { link: string } | { error: string };

// The link is returned once, for the inviter to pass on however they like. Only its hash
// is stored, so it can't be recovered later; a lost invite is replaced by a new one.
export async function createAdminInvite(invitedBy: number, name: string, email: string): Promise<InviteResult> {
  const address = email.trim().toLowerCase();

  if (await db.one("SELECT 1 FROM admins WHERE email = $1", [address])) {
    return { error: "That email already has an admin account." };
  }

  const token = randomBytes(32).toString("base64url");
  await db.run("DELETE FROM admin_invites WHERE email = $1 AND used_at IS NULL", [address]);
  await db.run(
    `INSERT INTO admin_invites (token_hash, email, name, invited_by, expires_at)
     VALUES ($1, $2, $3, $4, now() + make_interval(days => $5))`,
    [hashSessionToken(token), address, name.trim(), invitedBy, INVITE_VALID_DAYS],
  );

  return { link: `${appUrl()}/admin/invite/${token}` };
}

export async function revokeAdminInvite(email: string): Promise<number> {
  return db.run("DELETE FROM admin_invites WHERE email = $1 AND used_at IS NULL", [email.trim().toLowerCase()]);
}

export type OpenInvite = { email: string; name: string; invited_by_name: string | null };

export async function readAdminInvite(token: string): Promise<OpenInvite | null> {
  if (!TOKEN.test(token)) return null;
  const invite = await db.one<OpenInvite>(
    `SELECT i.email, i.name, a.name AS invited_by_name
       FROM admin_invites i
       LEFT JOIN admins a ON a.id = i.invited_by
      WHERE i.token_hash = $1 AND i.used_at IS NULL AND i.expires_at > now()`,
    [hashSessionToken(token)],
  );
  return invite ?? null;
}

// Turns an invite into an admin account. Returns the new admin's ID, or null if the link
// was expired, already used, or the email has since been taken.
export async function acceptAdminInvite(token: string, name: string, password: string): Promise<number | null> {
  if (!TOKEN.test(token)) return null;
  const passwordHash = await hashPassword(password);

  try {
    return await transaction(async (tx) => {
      const invite = await tx.one<{ email: string }>(
        `UPDATE admin_invites SET used_at = now()
          WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
          RETURNING email`,
        [hashSessionToken(token)],
      );
      if (!invite) return null;

      const admin = await tx.one<{ id: number }>(
        "INSERT INTO admins (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
        [name.trim(), invite.email, passwordHash],
      );
      return admin!.id;
    });
  } catch (err) {
    if (isUniqueViolation(err)) return null;
    throw err;
  }
}

export type RemoveResult = { removed: true } | { error: string };

// Removing an admin signs them out everywhere. The last admin can't be removed, and nobody
// can remove themselves, so the console can never be locked out.
export async function removeAdmin(actingAdminId: number, adminId: number): Promise<RemoveResult> {
  if (actingAdminId === adminId) return { error: "You can't remove your own account." };

  return transaction(async (tx) => {
    const total = await tx.one<{ n: number }>("SELECT COUNT(*) AS n FROM admins");
    if ((total?.n ?? 0) <= 1) return { error: "There has to be at least one admin." };

    const removed = await tx.run("DELETE FROM admins WHERE id = $1", [adminId]);
    return removed ? { removed: true } : { error: "That admin no longer exists." };
  });
}
