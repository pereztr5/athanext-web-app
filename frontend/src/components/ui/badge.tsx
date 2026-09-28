import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-[4px] border border-transparent px-2 py-[3px] text-[12px] font-medium leading-[13px] tracking-[-0.03em] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-[#E5EDF7] text-[#0054B4]",
        secondary:
          "bg-[#F1F1E6] text-[#484D56]",
        destructive:
          "bg-destructive text-destructive-foreground",
        outline: "border-[#EAEADF] text-[#484D56]",
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
