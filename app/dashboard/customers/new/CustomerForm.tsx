"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/Field";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { createCustomerAction } from "../actions";

export function CustomerForm() {
  const [state, action] = useActionState(createCustomerAction, undefined);
  const values = state?.values;
  const errors = state?.fieldErrors;

  return (
    <form action={action} className="grid gap-5">
      <Field
        id="fullName"
        label="Full name"
        autoComplete="off"
        required
        defaultValue={values?.fullName}
        error={errors?.fullName}
      />
      <Field
        id="email"
        type="email"
        label="Email"
        hint="Their plan link and Stripe's direct debit notices go here."
        autoComplete="off"
        required
        defaultValue={values?.email}
        error={errors?.email}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="phone" type="tel" label="Phone" optional autoComplete="off" defaultValue={values?.phone} />
        <Field
          id="vehicleRego"
          label="Vehicle rego"
          optional
          autoComplete="off"
          maxLength={12}
          defaultValue={values?.vehicleRego}
          error={errors?.vehicleRego}
        />
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        <SubmitButton pendingLabel="Saving" name="then" value="plan">
          Save and create plan
        </SubmitButton>
        <SubmitButton pendingLabel="Saving" className="btn btn-secondary">
          Save customer
        </SubmitButton>
      </div>
    </form>
  );
}
