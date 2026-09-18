"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/Field";
import { FormError } from "@/components/forms/FormError";
import { adminLogin } from "./actions";

export function AdminLoginForm() {
  const [state, action, pending] = useActionState(adminLogin, undefined);

  return (
    <form action={action} className="grid gap-5">
      <Field id="email" type="email" label="Email" autoComplete="username" required defaultValue={state?.email} />
      <Field id="password" type="password" label="Password" autoComplete="current-password" required />

      {state?.error && <FormError>{state.error}</FormError>}

      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Signing in" : "Sign in"}
      </button>
      <a
        href="/admin/recover"
        className="text-center text-sm font-semibold text-body underline-offset-2 hover:text-ink hover:underline"
      >
        Locked out?
      </a>
    </form>
  );
}
