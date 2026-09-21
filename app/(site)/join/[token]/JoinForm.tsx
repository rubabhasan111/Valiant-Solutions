"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/Field";
import { FormError } from "@/components/forms/FormError";
import { joinWorkshop } from "./actions";

export function JoinForm({ token, name, email }: { token: string; name: string; email: string }) {
  const [state, action, pending] = useActionState(joinWorkshop.bind(null, token), undefined);

  return (
    <form action={action} className="grid gap-5">
      {/* Lets password managers save the login under the right email. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
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
        {pending ? "Setting up" : "Create my login"}
      </button>
      <p className="text-xs leading-relaxed text-mute">
        By creating a login you agree to the <a href="/terms" className="font-semibold text-ink underline underline-offset-2">terms of use</a> and{" "}
        <a href="/privacy" className="font-semibold text-ink underline underline-offset-2">privacy policy</a>.
      </p>
    </form>
  );
}
