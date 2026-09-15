import type { Metadata } from "next";
import { requireWorkshop } from "@/lib/auth/dal";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { CustomerForm } from "./CustomerForm";

export const metadata: Metadata = { title: "Add customer" };

export default async function NewCustomerPage() {
  await requireWorkshop();

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-10 md:py-12">
      <PageHeader
        title="Add customer"
        description="Save their details once, then set up as many payment plans as they need."
        back={{ href: "/dashboard/customers", label: "Customers" }}
      />
      <section className="mt-8 max-w-2xl rounded-3xl border border-edge bg-surface p-6 md:p-8">
        <CustomerForm />
      </section>
    </main>
  );
}
