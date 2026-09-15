import Link from "next/link";
import type { PlanListItem } from "@/lib/plans";
import { formatAud } from "@/lib/money";
import { FREQUENCY_LABEL, formatDate } from "@/lib/schedule";
import { PlanStatusChip } from "@/components/dashboard/StatusChip";

export function PlanTable({ plans }: { plans: PlanListItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead>
          <tr className="text-xs text-mute">
            <th scope="col" className="px-5 py-3 font-semibold">Customer</th>
            <th scope="col" className="px-5 py-3 font-semibold">Work</th>
            <th scope="col" className="px-5 py-3 font-semibold">Amount</th>
            <th scope="col" className="px-5 py-3 font-semibold">Schedule</th>
            <th scope="col" className="px-5 py-3 font-semibold">Next debit</th>
            <th scope="col" className="px-5 py-3 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-edge border-t border-edge">
          {plans.map((plan) => (
            <tr key={plan.id} className="transition-colors hover:bg-edge/30">
              <td className="px-5 py-4">
                <Link href={`/dashboard/plans/${plan.id}`} className="font-semibold underline-offset-2 hover:underline">
                  {plan.customer_name}
                </Link>
                {plan.vehicle_rego && <p className="mt-0.5 text-xs text-mute">{plan.vehicle_rego}</p>}
              </td>
              <td className="max-w-[16rem] truncate px-5 py-4 text-body">{plan.description}</td>
              <td className="tabular px-5 py-4">
                <p className="font-semibold">{formatAud(plan.total_amount_cents)}</p>
                <p className="mt-0.5 text-xs text-mute">{formatAud(plan.paid_cents)} paid</p>
              </td>
              <td className="px-5 py-4 text-body">
                {plan.instalment_count} payments, {FREQUENCY_LABEL[plan.frequency].toLowerCase()}
              </td>
              <td className="tabular px-5 py-4 text-body">
                {plan.next_due_date ? formatDate(plan.next_due_date) : "None"}
              </td>
              <td className="px-5 py-4">
                <PlanStatusChip status={plan.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
