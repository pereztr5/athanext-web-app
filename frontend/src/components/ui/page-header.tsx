import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { ChevronLeft } from "@/components/icons"

import { cn } from "@/lib/utils"

// Design system PageHeader: optional back link, t-page-title, optional subtitle,
// actions on the right bottom-aligned with the subtitle (primary last).
// On phone the title drops to t-page-title-phone and actions wrap under it.
export function PageHeader({
  title,
  subtitle,
  actions,
  back,
  className,
  titleSuffix,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  /** Names the page it returns to: { label: "My schedule", to: "/schedule" } or an onClick. */
  back?: { label: string; to?: string; onClick?: () => void }
  className?: string
  /** Inline next to the title, e.g. a status pill. */
  titleSuffix?: ReactNode
}) {
  const backCls =
    "inline-flex items-center gap-1 self-start text-label-sm text-dark-300 hover:text-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
  return (
    <header className={cn("flex flex-col gap-4", className)}>
      {back &&
        (back.to ? (
          <Link to={back.to} className={backCls}>
            <ChevronLeft className="size-4" strokeWidth={1.5} />
            {back.label}
          </Link>
        ) : (
          <button type="button" onClick={back.onClick} className={backCls}>
            <ChevronLeft className="size-4" strokeWidth={1.5} />
            {back.label}
          </button>
        ))}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-page-title-phone text-dark md:text-page-title">{title}</h1>
            {titleSuffix}
          </div>
          {subtitle && <p className="text-body-m text-dark-300">{subtitle}</p>}
        </div>
        {actions && (
          <div className="flex w-full flex-wrap gap-2 md:w-auto [&>*]:max-md:flex-1">{actions}</div>
        )}
      </div>
    </header>
  )
}
