import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

// Design system Stat: one number that matters, a label and one line of context.
// Meta says what the change means ("4 more than last month"), not "+20%".
export function Stat({
  label,
  value,
  meta,
  trend,
  className,
}: {
  label: ReactNode
  value: ReactNode
  meta?: ReactNode
  /** up = good change (success-700), down = a problem (error-700). */
  trend?: "up" | "down"
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-label-sm text-dark-300">{label}</span>
      <span className="text-stat tabular-nums text-dark">{value}</span>
      {meta && (
        <span
          className={cn(
            "text-caption",
            trend === "up" ? "text-success-700" : trend === "down" ? "text-error-700" : "text-dark-300",
          )}
        >
          {meta}
        </span>
      )}
    </div>
  )
}

// Dashed light-600 outline: marks an empty slot or an "add" target.
export function Placeholder({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "flex min-h-target w-full items-center justify-center gap-2 rounded-control border border-dashed border-light-600 bg-transparent text-body-m text-dark-300 hover:border-dark-200 hover:text-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&_svg]:size-4",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
