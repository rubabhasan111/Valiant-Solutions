"use client";

import { useActionState } from "react";
import { CopyField } from "@/components/dashboard/CopyField";
import { createWorkshopResetLink } from "../../actions";

// Makes a one-time password reset link for a locked-out workshop login, and shows it once.
export function ResetLinkButton({ centreId, userId, name }: { centreId: number; userId: number; name: string }) {
  const [state, action, pending] = useActionState(createWorkshopResetLink.bind(null, centreId, userId), undefined);

  if (state?.link) {
    return (
      <div className="ml-auto max-w-md text-left">
        <p className="text-xs font-semibold text-accent-ink">
          Send this to {state.name}. It works once, lasts 24 hours, and is shown only now.
        </p>
        <div className="mt-2">
          <CopyField value={state.link} label={`Password reset link for ${name}`} />
        </div>
      </div>
    );
  }

  return (
    <form action={action}>
      <button
        type="submit"
        disabled={pending}
        className="text-sm font-semibold text-accent-ink underline-offset-2 hover:underline disabled:opacity-60"
      >
        {pending ? "Making link" : "Password reset link"}
      </button>
      {state?.error && <p className="mt-1 text-xs text-danger">{state.error}</p>}
    </form>
  );
}
