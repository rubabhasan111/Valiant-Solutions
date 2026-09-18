"use server";

import { redirect } from "next/navigation";
import { requireWorkshop } from "@/lib/auth/dal";
import { normaliseAuMobile } from "@/lib/phone";
import { customerEmailExists, insertCustomer } from "@/lib/plans";
import { EMAIL, formText } from "@/lib/validation";

type Field = "fullName" | "email" | "phone" | "vehicleRego";

export type CustomerFormState =
  | {
      fieldErrors?: Partial<Record<Field, string>>;
      values?: { fullName: string; email: string; phone: string; vehicleRego: string };
    }
  | undefined;

export async function createCustomerAction(_prev: CustomerFormState, formData: FormData): Promise<CustomerFormState> {
  const { centre } = await requireWorkshop();

  const values = {
    fullName: formText(formData, "fullName"),
    email: formText(formData, "email").toLowerCase(),
    phone: formText(formData, "phone"),
    vehicleRego: formText(formData, "vehicleRego").toUpperCase(),
  };
  const mobile = normaliseAuMobile(values.phone);

  const fieldErrors: Partial<Record<Field, string>> = {};
  if (!values.fullName) fieldErrors.fullName = "Enter the customer's full name.";
  if (!EMAIL.test(values.email)) fieldErrors.email = "Enter a valid email address.";
  else if (await customerEmailExists(centre.id, values.email)) fieldErrors.email = "You already have a customer with this email.";
  if (!values.phone) fieldErrors.phone = "Enter the customer's mobile. Payment reminders are texted to it.";
  else if (!mobile) fieldErrors.phone = "Enter an Australian mobile, for example 0412 345 678.";
  if (values.vehicleRego.length > 12) fieldErrors.vehicleRego = "Registration numbers are 12 characters or fewer.";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, values };

  const customerId = await insertCustomer(centre.id, {
    fullName: values.fullName,
    email: values.email,
    phone: mobile,
    vehicleRego: values.vehicleRego || null,
  });

  redirect(formData.get("then") === "plan" ? `/dashboard/plans/new?customer=${customerId}` : "/dashboard/customers");
}
