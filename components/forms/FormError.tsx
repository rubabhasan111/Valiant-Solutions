import type { ReactNode } from "react";
import { WarningCircle } from "@phosphor-icons/react";

export function FormError({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex gap-3 rounded-2xl bg-danger-pale p-4 text-sm text-danger">
      <WarningCircle size={20} weight="fill" className="mt-px shrink-0" />
      <p>{children}</p>
    </div>
  );
}
