import type { ReactNode } from "react";

type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
};

export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  return (
    <section className="flex flex-col items-center rounded-3xl border border-dashed border-edge px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-accent-pale text-accent-ink">{icon}</span>
      <h2 className="mt-4 text-lg font-bold">{title}</h2>
      <p className="mt-2 max-w-[46ch] text-sm leading-relaxed text-body">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </section>
  );
}
