"use client";

import { Printer } from "@phosphor-icons/react";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn btn-secondary print:hidden">
      <Printer size={18} weight="bold" />
      Print or save as PDF
    </button>
  );
}
