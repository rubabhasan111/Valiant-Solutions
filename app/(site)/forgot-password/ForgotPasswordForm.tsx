"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/Field";
import { FormError } from "@/components/forms/FormError";
import { requestPasswordResetAction } from "./actions";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, undefined);

  if (state?.sent) {
    return (
      <p role="status" className="leading-relaxed text-body">
        If <span className="font-semibold text-ink">{state.email}</span> has a Halfshaft login, a reset link is on its
        way. It works once and expires in an hour. Check your spam folder if it doesn&apos;t arrive.
      </p>
    );
  }

  return (
    <form action={action} className="grid gap-5">
      <Field
        id="email"
        type="email"
        label="Email"
        hint="The address you log in with."
        autoComplete="username"
        required
        defaultValue={state?.email}
      />

      {state?.error && <FormError>{state.error}</FormError>}

      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Sending" : "Email me a reset link"}
      </button>
    </form>
  );
}
