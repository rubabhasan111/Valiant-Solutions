"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/Field";
import { FormError } from "@/components/forms/FormError";
import { recoverAdminAccount } from "./actions";

export function RecoverForm() {
  const [state, action, pending] = useActionState(recoverAdminAccount, undefined);

  return (
    <form action={action} className="grid gap-5">
      <Field
        id="key"
        type="password"
        label="Setup key"
        hint="The CRON_SECRET from this deployment's environment variables."
        autoComplete="off"
        required
      />
      <Field
        id="email"
        type="email"
        label="Admin email"
        hint="The address on the account you're recovering."
        autoComplete="username"
        required
        defaultValue={state?.email}
      />
      <Field
        id="password"
        type="password"
        label="New password"
        hint="At least 10 characters."
        autoComplete="new-password"
        required
      />
      <Field id="confirmPassword" type="password" label="Type it again" autoComplete="new-password" required />

      {state?.error && <FormError>{state.error}</FormError>}

      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Saving" : "Set a new password"}
      </button>
      <p className="text-xs leading-relaxed text-mute">
        This signs the account out everywhere else and is recorded in the admin log.
      </p>
    </form>
  );
}
