import type { ReactNode } from "react"
import { AlertCircle, CheckCircle2, Info } from "@/components/icons"

import { cn } from "@/lib/utils"

// Design system Banner: a one-line in-page message with at most one action.
// 50 fill, 1px 300 border, 700 text, and always a leading 16px icon so meaning
// never rests on colour. Info = waiting on the person, error = failed, success = done.
type Tone = "info" | "error" | "success" | "neutral"

const TONE: Record<Tone, { box: string; icon: string; Icon: typeof Info }> = {
  info: { box: "border-info-300 bg-info-50 text-info-700", icon: "text-info-700", Icon: Info },
  error: { box: "border-error-300 bg-error-50 text-error-700", icon: "text-error-600", Icon: AlertCircle },
  success: { box: "border-success-300 bg-success-50 text-success-700", icon: "text-success-600", Icon: CheckCircle2 },
  neutral: { box: "border-light-525 bg-light-400 text-dark", icon: "text-dark-300", Icon: Info },
}

export function Banner({
  tone = "info",
  icon,
  action,
  children,
  className,
}: {
  tone?: Tone
  /** Override the default icon for the tone. */
  icon?: ReactNode
  /** One btn-text action on the right. */
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  const t = TONE[tone]
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex items-center gap-2.5 rounded-control border px-[15px] py-[11px] text-body-m", t.box, className)}
    >
      <span className={cn("shrink-0 [&>svg]:size-4", t.icon)}>{icon ?? <t.Icon strokeWidth={1.5} />}</span>
      <div className="min-w-0 flex-1">{children}</div>
      {action && <div className="shrink-0 text-label-sm [&_a]:text-primary [&_button]:text-primary">{action}</div>}
    </div>
  )
}
