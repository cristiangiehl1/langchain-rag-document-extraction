"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/** Minimal accessible toggle (no external dependency). */
function Switch({
  checked,
  onCheckedChange,
  disabled,
  id,
  className,
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-border transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-50",
        checked ? "bg-accent" : "bg-surface-2",
        className,
      )}
    >
      <span
        className={cn(
          "inline-block h-3.5 w-3.5 transform rounded-full bg-background transition-transform",
          checked ? "translate-x-4" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export { Switch };
