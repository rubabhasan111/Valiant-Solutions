"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/Field";
import { FormError } from "@/components/forms/FormError";
import { login } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form action={action} className="grid gap-5">
      {next && <input type="hidden" name="next" value={next} />}
      <Field id="email" type="email" label="Email" autoComplete="email" required defaultValue={state?.email} />
      <Field id="password" type="password" label="Password" autoComplete="current-password" required />

      {state?.error && <FormError>{state.error}</FormError>}

      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Logging in" : "Log in"}
      </button>
      <a href="/forgot-password" className="text-center text-sm font-semibold text-body underline-offset-2 hover:text-ink hover:underline">
        Forgot your password?
      </a>
    </form>
  );
}
