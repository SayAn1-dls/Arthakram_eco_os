"use client";

import { Printer } from "lucide-react";
import { buttonClass } from "./ui";

export function PrintButton({ label = "Print / save PDF" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass({ variant: "outline", size: "sm" }, "no-print")}>
      <Printer className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
