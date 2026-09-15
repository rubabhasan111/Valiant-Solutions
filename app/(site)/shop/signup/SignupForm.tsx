"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import { Field } from "@/components/forms/Field";
import { FormError } from "@/components/forms/FormError";
import { signupWorkshop } from "./actions";

export function SignupForm() {
  const [state, action, pending] = useActionState(signupWorkshop, undefined);
  const values = state?.values;
  const errors = state?.fieldErrors;

  return (
    <form action={action} className="grid gap-5">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight">Create your workshop account</h2>
        <p className="mt-1 text-sm text-body">You&apos;ll use this login to manage payment plans.</p>
      </div>

      <Field
        id="businessName"
        label="Business name"
        hint="As it appears on your ABN."
        autoComplete="organization"
        required
        defaultValue={values?.businessName}
        error={errors?.businessName}
      />
      <Field
        id="ownerName"
        label="Your name"
        autoComplete="name"
        required
        defaultValue={values?.ownerName}
        error={errors?.ownerName}
      />
      <Field
        id="email"
        type="email"
        label="Work email"
        hint="You'll log in with this. Stripe also sends account notices here."
        autoComplete="email"
        required
        defaultValue={values?.email}
        error={errors?.email}
      />
      <Field id="phone" type="tel" label="Phone" optional autoComplete="tel" defaultValue={values?.phone} />
      <Field
        id="password"
        type="password"
        label="Password"
        hint="At least 10 characters."
        autoComplete="new-password"
        minLength={10}
        required
        error={errors?.password}
      />

      {state?.error && (
        <FormError>
          {state.error}{" "}
          {state.suggestLogin && (
            <Link href="/login" className="font-semibold underline underline-offset-2">
              Log in instead
            </Link>
          )}
        </FormError>
      )}

      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Creating your account" : "Create account"}
        {!pending && <ArrowRight size={18} weight="bold" />}
      </button>

      <p className="text-xs leading-relaxed text-mute">
        Next, Stripe verifies your business. Stripe test mode: no real money moves and no real identity checks are made.
      </p>
    </form>
  );
}
