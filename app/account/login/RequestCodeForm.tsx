"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/Field";
import { FormError } from "@/components/forms/FormError";
import { requestSignInCode } from "./actions";

export function RequestCodeForm() {
  const [state, action, pending] = useActionState(requestSignInCode, undefined);

  return (
    <form action={action} className="grid gap-5">
      <Field
        id="email"
        type="email"
        label="Email"
        hint="The address your workshop has for you."
        autoComplete="email"
        required
        defaultValue={state?.email}
      />

      {state?.error && <FormError>{state.error}</FormError>}

      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Sending" : "Send me a code"}
      </button>
    </form>
  );
}
