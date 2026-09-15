"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

type ConfirmButtonProps = {
  children: ReactNode;
  pendingLabel: string;
  // Shown in the browser's confirmation dialog before the form submits.
  confirmMessage: string;
  className?: string;
};

export function ConfirmButton({ children, pendingLabel, confirmMessage, className = "btn btn-secondary" }: ConfirmButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) event.preventDefault();
      }}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
