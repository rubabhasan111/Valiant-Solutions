import type { Metadata } from "next";
import Link from "next/link";
import { requireWorkshop } from "@/lib/auth/dal";
import { listCustomers } from "@/lib/plans";
import { todayInSydney } from "@/lib/schedule";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { PlanForm } from "./PlanForm";

export const metadata: Metadata = { title: "New payment plan" };

export default async function NewPlanPage({ searchParams }: PageProps<"/dashboard/plans/new">) {
  const { centre } = await requireWorkshop();
  const { customer } = await searchParams;
  const canCreate = Boolean(centre.charges_enabled && centre.becs_capability === "active");

  const customers = (await listCustomers(centre.id)).map(({ id, full_name, email, vehicle_rego }) => ({
    id,
    full_name,
    email,
    vehicle_rego,
  }));
  const requested = Number(customer);
  const initialCustomerId = customers.some((c) => c.id === requested) ? requested : undefined;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-10 md:py-12">
      <PageHeader
        title="New payment plan"
        description="Split the invoice into regular direct debits from the customer's bank account."
        back={{ href: "/dashboard/plans", label: "Payment plans" }}
      />

      <div className="mt-8">
        {canCreate ? (
          <PlanForm customers={customers} today={todayInSydney()} initialCustomerId={initialCustomerId} />
        ) : (
          <section className="max-w-2xl rounded-3xl border border-edge bg-surface p-6 md:p-8">
            <h2 className="text-xl font-extrabold tracking-tight">Payments aren&apos;t switched on yet</h2>
            <p className="mt-3 leading-relaxed text-body">
              Stripe needs to finish verifying your workshop and switch on BECS Direct Debit before you can create
              plans.
            </p>
            <Link href="/dashboard" className="btn btn-primary mt-6">
              Check onboarding status
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}
