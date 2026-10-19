import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-pill border px-[7px] py-[2px] text-label-xsm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&>svg]:size-3",
  {
    variants: {
      variant: {
        // Same recipe as BrandPill: 100 fill, 300 border, darkest text.
        default: "border-primary-300 bg-primary-100 text-primary",
        secondary: "border-light-600 bg-light-525 text-dark-400",
        teal: "border-secondary-300 bg-secondary-100 text-secondary-700",
        success: "border-success-300 bg-success-100 text-success-800",
        pending: "border-info-300 bg-info-100 text-info-800",
        destructive: "border-error-300 bg-error-100 text-error-700",
        notify: "border-primary bg-primary text-light",
        outline: "border-light-600 bg-transparent text-dark-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

/* eslint-disable-next-line react-refresh/only-export-components */
export { Badge, badgeVariants }
