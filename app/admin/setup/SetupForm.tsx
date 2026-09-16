"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/Field";
import { FormError } from "@/components/forms/FormError";
import { createFirstAdmin } from "./actions";

export function SetupForm() {
  const [state, action, pending] = useActionState(createFirstAdmin, undefined);

  return (
    <form action={action} className="grid gap-5">
      <Field
        id="token"
        type="password"
        label="Setup key"
        hint="The CRON_SECRET from this deployment's environment variables."
        autoComplete="off"
        required
        error={state?.fieldErrors?.token}
      />
      <Field id="name" label="Your name" autoComplete="name" required defaultValue={state?.values?.name} error={state?.fieldErrors?.name} />
      <Field
        id="email"
        type="email"
        label="Email"
        autoComplete="username"
        required
        defaultValue={state?.values?.email}
        error={state?.fieldErrors?.email}
      />
      <Field
        id="password"
        type="password"
        label="Choose a password"
        hint="At least 10 characters."
        autoComplete="new-password"
        required
        error={state?.fieldErrors?.password}
      />

      {state?.error && <FormError>{state.error}</FormError>}

      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Creating your account" : "Create admin account"}
      </button>
    </form>
  );
}
