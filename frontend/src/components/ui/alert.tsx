import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-control border px-[15px] py-[11px] text-body-m [&>svg~*]:pl-[26px] [&>svg]:absolute [&>svg]:left-[15px] [&>svg]:top-[12px] [&>svg]:size-4",
  {
    variants: {
      variant: {
        default: "border-light-525 bg-light-400 text-dark [&>svg]:text-dark-300",
        info: "border-info-300 bg-info-50 text-info-700 [&>svg]:text-info-700",
        success: "border-success-300 bg-success-50 text-success-700 [&>svg]:text-success-600",
        destructive: "border-error-300 bg-error-50 text-error-700 [&>svg]:text-error-600",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 text-label-sm", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-paragraph", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
