"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/Field";
import { FormError } from "@/components/forms/FormError";
import { resetPasswordAction } from "./actions";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction.bind(null, token), undefined);

  return (
    <form action={action} className="grid gap-5">
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
        {pending ? "Saving" : "Save new password"}
      </button>
      <p className="text-xs leading-relaxed text-mute">
        Saving signs you out on every other device, in case someone else had your old password.
      </p>
    </form>
  );
}
