"use client";

import { useActionState } from "react";
import { CopyField } from "@/components/dashboard/CopyField";
import { Field } from "@/components/forms/Field";
import { FormError } from "@/components/forms/FormError";
import {
  saveBusiness,
  savePassword,
  saveProfile,
  inviteStaff,
} from "./actions";

function Saved({ text }: { text: string }) {
  return (
    <p role="status" className="rounded-2xl bg-accent-pale px-4 py-3 text-sm font-semibold text-accent-ink">
      {text}
    </p>
  );
}

function Submit({ pending, label, pendingLabel }: { pending: boolean; label: string; pendingLabel: string }) {
  return (
    <button type="submit" className="btn btn-primary justify-self-start" disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [state, action, pending] = useActionState(saveProfile, undefined);
  return (
    <form action={action} className="grid gap-4 sm:max-w-md">
      <Field id="name" label="Your name" autoComplete="name" required defaultValue={name} />
      <Field id="email" type="email" label="Your login email" autoComplete="email" required defaultValue={email} />
      {state?.error && <FormError>{state.error}</FormError>}
      {state?.saved && <Saved text="Saved." />}
      <Submit pending={pending} label="Save" pendingLabel="Saving" />
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(savePassword, undefined);
  return (
    <form action={action} className="grid gap-4 sm:max-w-md">
      <Field id="currentPassword" type="password" label="Current password" autoComplete="current-password" required />
      <Field
        id="newPassword"
        type="password"
        label="New password"
        hint="At least 10 characters."
        autoComplete="new-password"
        required
      />
      <Field id="confirmPassword" type="password" label="New password again" autoComplete="new-password" required />
      {state?.error && <FormError>{state.error}</FormError>}
      {state?.saved && <Saved text="Password changed. You've been signed out on every other device." />}
      <Submit pending={pending} label="Change password" pendingLabel="Changing" />
    </form>
  );
}

export function BusinessForm({ name, phone, email }: { name: string; phone: string; email: string }) {
  const [state, action, pending] = useActionState(saveBusiness, undefined);
  return (
    <form action={action} className="grid gap-4 sm:max-w-md">
      <Field
        id="businessName"
        label="Business name"
        hint="Starts every text your customers get, and signs every email."
        required
        maxLength={80}
        defaultValue={name}
      />
      <Field
        id="businessPhone"
        type="tel"
        label="Phone number for customers"
        hint="Shown in reminders and failed-payment texts as the number to call with questions."
        optional
        defaultValue={phone}
      />
      <Field
        id="businessEmail"
        type="email"
        label="Business email"
        hint="Payment alerts go here, and customers' replies to plan emails come here."
        required
        defaultValue={email}
      />
      {state?.error && <FormError>{state.error}</FormError>}
      {state?.saved && <Saved text="Saved. New customer texts and emails use these details." />}
      <Submit pending={pending} label="Save business details" pendingLabel="Saving" />
    </form>
  );
}

export function InviteStaffForm() {
  const [state, action, pending] = useActionState(inviteStaff, undefined);
  return (
    <>
      <form action={action} className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <Field id="staffName" label="Their name" autoComplete="off" required placeholder="Sam Taylor" />
        <Field id="staffEmail" type="email" label="Their email" autoComplete="off" required placeholder="sam@example.com" />
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Creating" : "Create invite"}
        </button>
      </form>
      {state?.error && (
        <div className="mt-4">
          <FormError>{state.error}</FormError>
        </div>
      )}
      {state?.link && (
        <div className="mt-5 rounded-2xl bg-accent-pale p-5">
          <p className="font-semibold text-accent-ink">Send this link to {state.name}</p>
          <p className="mt-1 text-sm text-body">
            It works once, expires in 7 days, and lets them choose their own password. It&apos;s shown only now, so copy
            it before you leave this page.
          </p>
          <div className="mt-4">
            <CopyField value={state.link} label="Staff invite link" />
          </div>
        </div>
      )}
    </>
  );
}
