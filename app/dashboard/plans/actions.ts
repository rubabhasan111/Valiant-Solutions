"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { requireWorkshop } from "@/lib/auth/dal";
import { deliverPendingMessages } from "@/lib/messaging";
import { formatAud } from "@/lib/money";
import { normaliseAuMobile } from "@/lib/phone";
import { queuePlanLink } from "@/lib/plan-links";
import { createPlan, customerEmailExists, getCustomer, type NewCustomer } from "@/lib/plans";
import {
  isFrequency,
  isIsoDate,
  MAX_INSTALMENTS,
  MAX_PLAN_CENTS,
  MIN_INSTALMENT_CENTS,
  MIN_INSTALMENTS,
  todayInSydney,
} from "@/lib/schedule";
import { EMAIL, formText, parseAudToCents } from "@/lib/validation";

type Field =
  | "customerId"
  | "fullName"
  | "email"
  | "phone"
  | "description"
  | "total"
  | "instalmentCount"
  | "frequency"
  | "startDate";

export type PlanFormState =
  | {
      error?: string;
      fieldErrors?: Partial<Record<Field, string>>;
      values?: { fullName: string; email: string; phone: string; vehicleRego: string; description: string };
    }
  | undefined;

export async function createPlanAction(_prev: PlanFormState, formData: FormData): Promise<PlanFormState> {
  const { centre } = await requireWorkshop();

  const values = {
    fullName: formText(formData, "fullName"),
    email: formText(formData, "email").toLowerCase(),
    phone: formText(formData, "phone"),
    vehicleRego: formText(formData, "vehicleRego").toUpperCase(),
    description: formText(formData, "description"),
  };

  if (!(centre.charges_enabled && centre.becs_capability === "active")) {
    return { error: "Finish Stripe onboarding before creating payment plans.", values };
  }

  const fieldErrors: Partial<Record<Field, string>> = {};

  let customer: { id: number } | NewCustomer | null = null;
  const customerChoice = formText(formData, "customerId");
  if (customerChoice === "new") {
    const mobile = normaliseAuMobile(values.phone);
    if (!values.fullName) fieldErrors.fullName = "Enter the customer's full name.";
    if (!EMAIL.test(values.email)) fieldErrors.email = "Enter a valid email address.";
    else if (await customerEmailExists(centre.id, values.email)) {
      fieldErrors.email = "This customer already exists. Choose them from the list above.";
    }
    if (!values.phone) fieldErrors.phone = "Enter the customer's mobile. Payment reminders are texted to it.";
    else if (!mobile) fieldErrors.phone = "Enter an Australian mobile, for example 0412 345 678.";
    customer = {
      fullName: values.fullName,
      email: values.email,
      phone: mobile,
      vehicleRego: values.vehicleRego.slice(0, 12) || null,
    };
  } else {
    const existing = await getCustomer(centre.id, Number(customerChoice));
    if (existing) customer = { id: existing.id };
    else fieldErrors.customerId = "Choose a customer, or add a new one.";
  }

  if (!values.description) fieldErrors.description = "Describe the work being paid off.";

  const totalCents = parseAudToCents(formText(formData, "total"));
  if (totalCents === null || totalCents <= 0) {
    fieldErrors.total = "Enter the amount in dollars, for example 1284.60.";
  } else if (totalCents > MAX_PLAN_CENTS) {
    fieldErrors.total = `Plans can be up to ${formatAud(MAX_PLAN_CENTS)}.`;
  }

  const instalmentCount = Number(formText(formData, "instalmentCount"));
  if (!Number.isInteger(instalmentCount) || instalmentCount < MIN_INSTALMENTS || instalmentCount > MAX_INSTALMENTS) {
    fieldErrors.instalmentCount = `Choose between ${MIN_INSTALMENTS} and ${MAX_INSTALMENTS} payments.`;
  } else if (totalCents && Math.floor(totalCents / instalmentCount) < MIN_INSTALMENT_CENTS) {
    fieldErrors.instalmentCount = `Each payment needs to be at least ${formatAud(MIN_INSTALMENT_CENTS)}.`;
  }

  const frequency = formText(formData, "frequency");
  if (!isFrequency(frequency)) fieldErrors.frequency = "Choose how often payments are taken.";

  const startDate = formText(formData, "startDate");
  if (!isIsoDate(startDate) || startDate < todayInSydney()) {
    fieldErrors.startDate = "Choose today or a later date.";
  }

  if (Object.keys(fieldErrors).length > 0 || !customer || totalCents === null || !isFrequency(frequency)) {
    return { fieldErrors, values };
  }

  const planId = await createPlan(centre.id, customer, {
    description: values.description,
    totalCents,
    instalmentCount,
    frequency,
    startDate,
  });

  // Email and text the customer their link straight away, without holding up the page.
  await queuePlanLink(planId, "created");
  after(() => deliverPendingMessages());

  redirect(`/dashboard/plans/${planId}?created=1`);
}
