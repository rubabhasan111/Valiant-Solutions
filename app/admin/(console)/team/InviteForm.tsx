"use client";

import { useActionState } from "react";
import { CopyField } from "@/components/dashboard/CopyField";
import { Field } from "@/components/forms/Field";
import { FormError } from "@/components/forms/FormError";
import { inviteAdmin } from "./actions";

export function InviteForm() {
  const [state, action, pending] = useActionState(inviteAdmin, undefined);

  return (
    <>
      <form action={action} className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <Field id="name" label="Their name" autoComplete="off" required placeholder="Sam Taylor" />
        <Field id="email" type="email" label="Their email" autoComplete="off" required placeholder="sam@example.com" />
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
            It works once, expires in 7 days, and lets them choose their own password. It&apos;s shown here only now,
            so copy it before you leave this page.
          </p>
          <div className="mt-4">
            <CopyField value={state.link} label="Admin invite link" />
          </div>
        </div>
      )}
    </>
  );
}
