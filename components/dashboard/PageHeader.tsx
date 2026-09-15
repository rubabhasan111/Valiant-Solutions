import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/ssr";

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  back?: { href: string; label: string };
};

export function PageHeader({ title, description, action, back }: PageHeaderProps) {
  return (
    <header>
      {back && (
        <Link
          href={back.href}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-body transition-colors hover:text-ink"
        >
          <ArrowLeft size={16} weight="bold" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{title}</h1>
          {description && <div className="mt-2 text-sm text-body">{description}</div>}
        </div>
        {action}
      </div>
    </header>
  );
}
