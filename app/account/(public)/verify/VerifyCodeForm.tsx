"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/Field";
import { FormError } from "@/components/forms/FormError";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { resendSignInCode, verifySignInCode } from "./actions";

export function VerifyCodeForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(verifySignInCode, undefined);
  const [resendState, resendAction] = useActionState(resendSignInCode, undefined);

  return (
    <>
      <form action={action} className="grid gap-5">
        <input type="hidden" name="email" value={email} />
        <Field
          id="code"
          label="Six-digit code"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          maxLength={6}
          required
          error={state?.error}
        />

        {state?.error && <FormError>{state.error}</FormError>}

        <button type="submit" className="btn btn-primary w-full" disabled={pending}>
          {pending ? "Checking" : "Sign in"}
        </button>
      </form>

      <form action={resendAction} className="mt-5 border-t border-edge pt-5">
        <input type="hidden" name="email" value={email} />
        {resendState?.resent ? (
          <p role="status" className="text-sm text-body">
            Sent again. Codes can take a moment to arrive.
          </p>
        ) : (
          <SubmitButton pendingLabel="Sending" className="text-sm font-semibold text-accent-ink underline-offset-2 hover:underline">
            Send another code
          </SubmitButton>
        )}
        {resendState?.error && <FormError>{resendState.error}</FormError>}
      </form>
    </>
  );
}
