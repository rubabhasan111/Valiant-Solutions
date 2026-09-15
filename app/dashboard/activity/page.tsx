import type { Metadata } from "next";
import Link from "next/link";
import { ArrowsClockwise, Bell, CheckCircle, Clock, WarningCircle } from "@phosphor-icons/react/ssr";
import type { NotificationKind } from "@/lib/db";
import { requireWorkshop } from "@/lib/auth/dal";
import { listNotifications } from "@/lib/notifications";
import { formatTimestamp } from "@/lib/schedule";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { markAllReadAction } from "./actions";

export const metadata: Metadata = { title: "Activity" };

const KIND_STYLE: Record<NotificationKind, { Icon: typeof CheckCircle; className: string }> = {
  plan_activated: { Icon: CheckCircle, className: "text-accent-ink" },
  debit_processing: { Icon: Clock, className: "text-pending" },
  debit_paid: { Icon: CheckCircle, className: "text-accent-ink" },
  debit_failed: { Icon: WarningCircle, className: "text-danger" },
  debit_missed: { Icon: WarningCircle, className: "text-danger" },
  bank_details_needed: { Icon: WarningCircle, className: "text-danger" },
  bank_details_updated: { Icon: ArrowsClockwise, className: "text-accent-ink" },
  plan_completed: { Icon: CheckCircle, className: "text-accent-ink" },
};

export default async function ActivityPage() {
  const { centre } = await requireWorkshop();
  const notifications = await listNotifications(centre.id);
  const unread = notifications.filter((n) => !n.read_at).length;

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8 md:px-10 md:py-12">
      <PageHeader
        title="Activity"
        description={
          unread > 0 ? `${unread} unread ${unread === 1 ? "update" : "updates"}` : "Every payment update for your workshop."
        }
        action={
          unread > 0 ? (
            <form action={markAllReadAction}>
              <SubmitButton pendingLabel="Marking as read" className="btn btn-secondary">
                Mark all as read
              </SubmitButton>
            </form>
          ) : undefined
        }
      />

      <div className="mt-8">
        {notifications.length === 0 ? (
          <EmptyState
            icon={<Bell size={24} weight="duotone" />}
            title="Nothing yet"
            body="Payment updates show up here as customers set up direct debits and payments are collected."
          />
        ) : (
          <ul className="divide-y divide-edge overflow-hidden rounded-3xl border border-edge bg-surface">
            {notifications.map((notification) => {
              const { Icon, className } = KIND_STYLE[notification.kind];
              const isUnread = !notification.read_at;
              return (
                <li key={notification.id} className={`flex items-start gap-4 px-5 py-4 ${isUnread ? "bg-accent-pale/40" : ""}`}>
                  <Icon size={22} weight="fill" className={`mt-0.5 shrink-0 ${className}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <p className="font-semibold">
                        {notification.title}
                        {isUnread && <span className="sr-only"> (unread)</span>}
                      </p>
                      <time className="shrink-0 text-xs text-mute" dateTime={notification.created_at}>
                        {formatTimestamp(notification.created_at)}
                      </time>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-body">{notification.body}</p>
                    {notification.payment_plan_id && (
                      <Link
                        href={`/dashboard/plans/${notification.payment_plan_id}`}
                        className="mt-2 inline-block text-sm font-semibold text-accent-ink underline-offset-2 hover:underline"
                      >
                        View plan
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
