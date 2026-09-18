"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/Field";
import { FormError } from "@/components/forms/FormError";
import { acceptInvite } from "./actions";

export function AcceptInviteForm({ token, name }: { token: string; name: string }) {
  const [state, action, pending] = useActionState(acceptInvite.bind(null, token), undefined);

  return (
    <form action={action} className="grid gap-5">
      <Field id="name" label="Your name" autoComplete="name" required defaultValue={name} />
      <Field
        id="password"
        type="password"
        label="Choose a password"
        hint="At least 10 characters."
        autoComplete="new-password"
        required
      />
      <Field id="confirmPassword" type="password" label="Type it again" autoComplete="new-password" required />

      {state?.error && <FormError>{state.error}</FormError>}

      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Setting up" : "Create my admin account"}
      </button>
    </form>
  );
}
