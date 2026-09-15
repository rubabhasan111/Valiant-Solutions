import { CheckCircle, Circle, Clock } from "@phosphor-icons/react/ssr";
import type { CapabilityState, OnboardingStatus } from "@/lib/centres";

type State = "done" | "pending" | "todo";

const STYLE: Record<State, { label: string; chip: string; Icon: typeof CheckCircle }> = {
  done: { label: "Active", chip: "bg-accent-pale text-accent-ink", Icon: CheckCircle },
  pending: { label: "In review", chip: "bg-pending-pale text-pending", Icon: Clock },
  todo: { label: "Not started", chip: "bg-edge/60 text-body", Icon: Circle },
};

const fromCapability = (state: CapabilityState): State =>
  state === "active" ? "done" : state === "pending" ? "pending" : "todo";

export function OnboardingChecklist({ status }: { status: OnboardingStatus }) {
  const rows: { title: string; body: string; state: State }[] = [
    {
      title: "Business details",
      body: "ABN, representatives and bank account submitted to Stripe.",
      state: status.detailsSubmitted ? "done" : "todo",
    },
    {
      title: "BECS Direct Debit",
      body: "Debit customers' Australian bank accounts for each instalment.",
      state: fromCapability(status.becs),
    },
    {
      title: "Card payments",
      body: "Required by Stripe alongside BECS Direct Debit.",
      state: fromCapability(status.cards),
    },
    {
      title: "Payouts",
      body: "Collected instalments are paid out to your business account.",
      state: status.payoutsEnabled ? "done" : status.detailsSubmitted ? "pending" : "todo",
    },
  ];

  return (
    <ul className="grid gap-1">
      {rows.map(({ title, body, state }) => {
        const { label, chip, Icon } = STYLE[state];
        return (
          <li key={title} className="flex items-start gap-4 rounded-2xl p-3">
            <Icon size={22} weight={state === "done" ? "fill" : "regular"} className="mt-0.5 shrink-0 text-accent-ink" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold">{title}</h3>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${chip}`}>{label}</span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-body">{body}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
