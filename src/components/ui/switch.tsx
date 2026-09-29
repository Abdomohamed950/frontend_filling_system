import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Minimal switch built on a native checkbox — no extra Radix dependency,
 * and it keeps form semantics and keyboard behaviour for free.
 */
function Switch({
  className,
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  ...props
}: Omit<React.ComponentProps<"input">, "type" | "onChange"> & {
  onCheckedChange?: (checked: boolean) => void
}) {
  return (
    <label
      data-slot="switch"
      data-disabled={disabled || undefined}
      className={cn(
        "group relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-input transition-colors",
        "has-checked:bg-primary has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
    >
      <input
        type="checkbox"
        role="switch"
        className="peer sr-only"
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        onChange={(event) => onCheckedChange?.(event.target.checked)}
        {...props}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute start-0.5 size-5 rounded-full bg-background shadow transition-transform ltr:peer-checked:translate-x-5 rtl:peer-checked:-translate-x-5"
      />
    </label>
  )
}

export { Switch }
