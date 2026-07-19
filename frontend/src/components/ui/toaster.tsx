import { CheckCircle2, AlertTriangle } from "lucide-react"

import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { cn } from "@/lib/utils"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant = "default", ...props }) {
        const isDestructive = variant === "destructive"
        const Icon = isDestructive ? AlertTriangle : CheckCircle2

        return (
          <Toast key={id} {...props} variant={variant}>
            <div className="flex w-full items-start gap-4 pr-10">
              <div
                className={cn(
                  "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border bg-gradient-to-br text-base shadow-inner",
                  isDestructive
                    ? "from-rose-500/15 via-rose-500/5 to-transparent border-rose-200/60 text-rose-600 dark:border-rose-500/40 dark:text-rose-100"
                    : "from-emerald-500/15 via-emerald-500/5 to-transparent border-emerald-200/70 text-emerald-600 dark:border-emerald-500/30 dark:text-emerald-100"
                )}
              >
                <Icon className="h-5 w-5" />
              </div>

              <div className="flex-1 space-y-2">
                <div className="space-y-1">
                  {title && <ToastTitle className="text-lg tracking-tight">{title}</ToastTitle>}
                  {description && (
                    <ToastDescription className="text-sm leading-relaxed text-slate-600 dark:text-slate-200">
                      {description}
                    </ToastDescription>
                  )}
                </div>
                {action ? <div className="flex flex-wrap gap-2 pt-1">{action}</div> : null}
              </div>
            </div>
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
