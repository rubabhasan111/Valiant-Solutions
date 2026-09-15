import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Receipt } from "@phosphor-icons/react/ssr";
import { requireWorkshop } from "@/lib/auth/dal";
import { listPlans } from "@/lib/plans";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { PlanTable } from "@/components/dashboard/PlanTable";

export const metadata: Metadata = { title: "Payment plans" };

export default async function PlansPage() {
  const { centre } = await requireWorkshop();
  const plans = await listPlans(centre.id);
  const canCreate = Boolean(centre.charges_enabled && centre.becs_capability === "active");

  const newButton = canCreate ? (
    <Link href="/dashboard/plans/new" className="btn btn-primary">
      <Plus size={18} weight="bold" />
      New plan
    </Link>
  ) : undefined;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-10 md:py-12">
      <PageHeader
        title="Payment plans"
        description={`${plans.length} ${plans.length === 1 ? "plan" : "plans"}`}
        action={plans.length > 0 ? newButton : undefined}
      />

      <div className="mt-8">
        {plans.length === 0 ? (
          <EmptyState
            icon={<Receipt size={24} weight="duotone" />}
            title="No payment plans yet"
            body={
              canCreate
                ? "Set up a plan at the counter, then send the customer their link to add bank details."
                : "Once Stripe switches on BECS Direct Debit for your workshop, you can start creating plans."
            }
            action={newButton}
          />
        ) : (
          <section className="rounded-3xl border border-edge bg-surface">
            <PlanTable plans={plans} />
          </section>
        )}
      </div>
    </main>
  );
}
