import { CheckCircle2, AlertTriangle } from "@/components/icons"

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
          // Design system Toast: dark fill, light text, a 16px icon, an optional Undo-style action.
          <Toast key={id} {...props} variant={variant}>
            <div className="flex w-full items-start gap-2">
              <Icon
                className={cn("mt-px size-4 shrink-0", isDestructive ? "text-error-300" : "text-success-400")}
                strokeWidth={1.5}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && <ToastDescription>{description}</ToastDescription>}
              </div>
              {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
            </div>
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
