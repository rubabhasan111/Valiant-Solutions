"use client";

import { useActionState, useState } from "react";
import { Field } from "@/components/forms/Field";
import { FormError } from "@/components/forms/FormError";
import { formatAud } from "@/lib/money";
import {
  addDays,
  buildSchedule,
  FREQUENCIES,
  FREQUENCY_LABEL,
  formatDate,
  isIsoDate,
  MAX_INSTALMENTS,
  MIN_INSTALMENTS,
  type Frequency,
} from "@/lib/schedule";
import { parseAudToCents } from "@/lib/validation";
import { createPlanAction } from "../actions";

export type CustomerOption = { id: number; full_name: string; email: string; vehicle_rego: string | null };

type PlanFormProps = {
  customers: CustomerOption[];
  today: string;
  initialCustomerId?: number;
};

export function PlanForm({ customers, today, initialCustomerId }: PlanFormProps) {
  const [state, action, pending] = useActionState(createPlanAction, undefined);
  const values = state?.values;
  const errors = state?.fieldErrors;

  // Fields that drive the schedule preview are controlled so it updates as staff type.
  const [customerChoice, setCustomerChoice] = useState(
    initialCustomerId ? String(initialCustomerId) : customers.length > 0 ? "" : "new",
  );
  const [total, setTotal] = useState("");
  const [count, setCount] = useState("6");
  const [frequency, setFrequency] = useState<Frequency>("fortnightly");
  const [startDate, setStartDate] = useState(addDays(today, 7));

  const totalCents = parseAudToCents(total);
  const countNumber = Number(count);
  const schedule =
    totalCents && Number.isInteger(countNumber) && countNumber >= MIN_INSTALMENTS && countNumber <= MAX_INSTALMENTS && isIsoDate(startDate)
      ? buildSchedule(totalCents, countNumber, frequency, startDate)
      : null;

  return (
    <form action={action} className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <div className="grid content-start gap-6">
        <section className="grid gap-5 rounded-3xl border border-edge bg-surface p-6 md:p-8">
          <h2 className="text-lg font-bold">Customer</h2>
          <div className="grid gap-2">
            <label htmlFor="customerId" className="text-sm font-semibold">
              Who is paying?
            </label>
            <select
              id="customerId"
              name="customerId"
              value={customerChoice}
              onChange={(event) => setCustomerChoice(event.target.value)}
              aria-invalid={errors?.customerId ? true : undefined}
              className="field"
              required
            >
              <option value="" disabled>
                Choose a customer
              </option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.full_name} ({customer.vehicle_rego ?? customer.email})
                </option>
              ))}
              <option value="new">New customer</option>
            </select>
            {errors?.customerId && <p className="text-xs font-semibold text-danger">{errors.customerId}</p>}
          </div>

          {customerChoice === "new" && (
            <div className="grid gap-5 border-t border-edge pt-5">
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
                hint="Their plan link goes here."
                autoComplete="off"
                required
                defaultValue={values?.email}
                error={errors?.email}
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  id="phone"
                  type="tel"
                  label="Mobile"
                  hint="Payment reminders are texted here."
                  placeholder="0412 345 678"
                  autoComplete="off"
                  required
                  defaultValue={values?.phone}
                  error={errors?.phone}
                />
                <Field
                  id="vehicleRego"
                  label="Vehicle rego"
                  optional
                  autoComplete="off"
                  maxLength={12}
                  defaultValue={values?.vehicleRego}
                />
              </div>
            </div>
          )}
        </section>

        <section className="grid gap-5 rounded-3xl border border-edge bg-surface p-6 md:p-8">
          <h2 className="text-lg font-bold">Work and schedule</h2>
          <Field
            id="description"
            label="Work being paid off"
            hint="Shown to the customer, for example: Major service and front brake pads."
            autoComplete="off"
            required
            maxLength={120}
            defaultValue={values?.description}
            error={errors?.description}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id="total"
              label="Total amount (AUD)"
              inputMode="decimal"
              placeholder="0.00"
              autoComplete="off"
              required
              value={total}
              onChange={(event) => setTotal(event.target.value)}
              error={errors?.total}
            />
            <Field
              id="instalmentCount"
              type="number"
              label="Number of payments"
              min={MIN_INSTALMENTS}
              max={MAX_INSTALMENTS}
              required
              value={count}
              onChange={(event) => setCount(event.target.value)}
              error={errors?.instalmentCount}
            />
          </div>

          <fieldset className="grid gap-2">
            <legend className="text-sm font-semibold">How often</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {FREQUENCIES.map((option) => (
                <label
                  key={option}
                  className="cursor-pointer rounded-xl border border-edge bg-canvas px-3 py-2.5 text-center text-sm font-semibold transition-colors has-[:checked]:border-ink has-[:checked]:bg-accent has-[:checked]:text-on-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2"
                >
                  <input
                    type="radio"
                    name="frequency"
                    value={option}
                    checked={frequency === option}
                    onChange={() => setFrequency(option)}
                    className="sr-only"
                  />
                  {FREQUENCY_LABEL[option]}
                </label>
              ))}
            </div>
            {errors?.frequency && <p className="text-xs font-semibold text-danger">{errors.frequency}</p>}
          </fieldset>

          <Field
            id="startDate"
            type="date"
            label="First debit date"
            hint="BECS payments take a few business days to clear after this date."
            min={today}
            required
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            error={errors?.startDate}
          />
        </section>

        {state?.error && <FormError>{state.error}</FormError>}
      </div>

      <aside className="lg:sticky lg:top-8 lg:self-start">
        <section aria-label="Schedule preview" className="rounded-3xl border border-edge bg-surface p-6 md:p-8">
          <h2 className="text-lg font-bold">Schedule preview</h2>
          {schedule ? (
            <>
              <p className="tabular mt-4 text-3xl font-extrabold tracking-tight">{formatAud(totalCents ?? 0)}</p>
              <p className="mt-1 text-sm text-body">
                {schedule.length} {FREQUENCY_LABEL[frequency].toLowerCase()} payments of about{" "}
                {formatAud(schedule[schedule.length - 1].amountCents)}
              </p>
              <ol className="mt-5 max-h-80 divide-y divide-edge overflow-y-auto border-y border-edge">
                {schedule.map((item) => (
                  <li key={item.sequence} className="tabular flex items-center justify-between gap-4 py-2.5 text-sm">
                    <span className="text-mute">{item.sequence}</span>
                    <span className="flex-1">{formatDate(item.dueDate)}</span>
                    <span className="font-semibold">{formatAud(item.amountCents)}</span>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="mt-4 text-sm leading-relaxed text-body">
              Enter a total, the number of payments and a first debit date to see each payment.
            </p>
          )}

          <button type="submit" className="btn btn-primary mt-6 w-full" disabled={pending}>
            {pending ? "Creating plan" : "Create plan"}
          </button>
          <p className="mt-3 text-xs leading-relaxed text-mute">
            Nothing is charged yet. The customer is emailed and texted a link to add their bank details.
          </p>
        </section>
      </aside>
    </form>
  );
}
