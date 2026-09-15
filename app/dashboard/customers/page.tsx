import type { Metadata } from "next";
import Link from "next/link";
import { Plus, UsersThree } from "@phosphor-icons/react/ssr";
import { requireWorkshop } from "@/lib/auth/dal";
import { listCustomers } from "@/lib/plans";
import { formatDate } from "@/lib/schedule";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { PageHeader } from "@/components/dashboard/PageHeader";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage() {
  const { centre } = await requireWorkshop();
  const customers = await listCustomers(centre.id);

  const addButton = (
    <Link href="/dashboard/customers/new" className="btn btn-primary">
      <Plus size={18} weight="bold" />
      Add customer
    </Link>
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-10 md:py-12">
      <PageHeader
        title="Customers"
        description={`${customers.length} ${customers.length === 1 ? "customer" : "customers"}`}
        action={customers.length > 0 ? addButton : undefined}
      />

      <div className="mt-8">
        {customers.length === 0 ? (
          <EmptyState
            icon={<UsersThree size={24} weight="duotone" />}
            title="No customers yet"
            body="Add a customer here, or create them while setting up their first payment plan."
            action={addButton}
          />
        ) : (
          <section className="rounded-3xl border border-edge bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="text-xs text-mute">
                    <th scope="col" className="px-5 py-3 font-semibold">Name</th>
                    <th scope="col" className="px-5 py-3 font-semibold">Vehicle</th>
                    <th scope="col" className="px-5 py-3 font-semibold">Phone</th>
                    <th scope="col" className="px-5 py-3 font-semibold">Plans</th>
                    <th scope="col" className="px-5 py-3 font-semibold">Added</th>
                    <th scope="col" className="px-5 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-edge border-t border-edge">
                  {customers.map((customer) => (
                    <tr key={customer.id}>
                      <td className="px-5 py-4">
                        <p className="font-semibold">{customer.full_name}</p>
                        <p className="mt-0.5 text-xs text-mute">{customer.email}</p>
                      </td>
                      <td className="px-5 py-4 text-body">{customer.vehicle_rego ?? "Not recorded"}</td>
                      <td className="px-5 py-4 text-body">{customer.phone ?? "Not recorded"}</td>
                      <td className="tabular px-5 py-4 text-body">{customer.plan_count}</td>
                      <td className="tabular px-5 py-4 text-body">{formatDate(customer.created_at)}</td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/dashboard/plans/new?customer=${customer.id}`}
                          className="text-sm font-semibold text-accent-ink underline-offset-2 hover:underline"
                        >
                          New plan
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
