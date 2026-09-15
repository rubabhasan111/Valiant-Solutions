"use client";

import { useState } from "react";
import { Check, Copy } from "@phosphor-icons/react";

export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be blocked; the field stays selectable for a manual copy.
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input
        readOnly
        value={value}
        aria-label={label}
        onFocus={(event) => event.currentTarget.select()}
        className="field min-w-0 font-mono text-sm"
      />
      <button type="button" onClick={copy} className="btn btn-primary shrink-0">
        {copied ? <Check size={18} weight="bold" /> : <Copy size={18} weight="bold" />}
        <span aria-live="polite">{copied ? "Copied" : "Copy link"}</span>
      </button>
    </div>
  );
}
