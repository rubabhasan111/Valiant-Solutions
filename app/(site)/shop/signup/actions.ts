"use server";

import { redirect } from "next/navigation";
import { db, isUniqueViolation, transaction, type ServiceCentre } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createWorkshopSession } from "@/lib/auth/session";

type Field = "businessName" | "ownerName" | "email" | "password";

export type SignupState =
  | {
      error?: string;
      suggestLogin?: boolean;
      fieldErrors?: Partial<Record<Field, string>>;
      values?: { businessName: string; ownerName: string; email: string; phone: string };
    }
  | undefined;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 10;

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

export async function signupWorkshop(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const values = {
    businessName: text(formData, "businessName"),
    ownerName: text(formData, "ownerName"),
    email: text(formData, "email").toLowerCase(),
    phone: text(formData, "phone"),
  };
  const password = String(formData.get("password") ?? "");

  const fieldErrors: Partial<Record<Field, string>> = {};
  if (!values.businessName) fieldErrors.businessName = "Enter your workshop's business name.";
  if (!values.ownerName) fieldErrors.ownerName = "Enter your name.";
  if (!EMAIL.test(values.email)) fieldErrors.email = "Enter a valid email address.";
  if (password.length < MIN_PASSWORD_LENGTH) fieldErrors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, values };

  if (await db.one("SELECT 1 FROM users WHERE email = $1", [values.email])) {
    return { error: "An account with this email already exists.", suggestLogin: true, values };
  }

  const existingCentre = await db.one<ServiceCentre>("SELECT * FROM service_centres WHERE email = $1", [values.email]);
  if (existingCentre && (await db.one("SELECT 1 FROM memberships WHERE service_centre_id = $1", [existingCentre.id]))) {
    return { error: "This workshop already has an account. Ask its owner to add you.", values };
  }

  const passwordHash = await hashPassword(password);

  let userId: number;
  try {
    userId = await transaction(async (tx) => {
      const user = await tx.one<{ id: number }>(
        "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
        [values.ownerName, values.email, passwordHash],
      );

      let centreId: number;
      if (existingCentre) {
        // Signups from before logins existed left centres with no members. The new
        // owner claims that centre and keeps its existing Stripe account.
        await tx.run("UPDATE service_centres SET name = $1, phone = $2, updated_at = now() WHERE id = $3", [
          values.businessName,
          values.phone || null,
          existingCentre.id,
        ]);
        centreId = existingCentre.id;
      } else {
        const centre = await tx.one<{ id: number }>(
          "INSERT INTO service_centres (name, email, phone) VALUES ($1, $2, $3) RETURNING id",
          [values.businessName, values.email, values.phone || null],
        );
        centreId = centre!.id;
      }

      await tx.run("INSERT INTO memberships (user_id, service_centre_id, role) VALUES ($1, $2, 'owner')", [user!.id, centreId]);
      return user!.id;
    });
  } catch (err) {
    // Two signups racing for the same email hit the UNIQUE constraint.
    if (isUniqueViolation(err)) {
      return { error: "An account with this email already exists.", suggestLogin: true, values };
    }
    throw err;
  }

  await createWorkshopSession(userId);
  // The start route creates the Stripe account and sends the owner to hosted onboarding.
  redirect("/dashboard/onboarding/start");
}
