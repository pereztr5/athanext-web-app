import * as React from "react"
import * as TogglePrimitive from "@radix-ui/react-toggle"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-control border border-transparent text-label-sm text-dark-300 transition-colors hover:text-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:text-dark-200 data-[state=on]:border-light-550 data-[state=on]:bg-light-50 data-[state=on]:text-dark",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline:
          "border-light-525 bg-light-400 hover:border-light-600",
      },
      size: {
        default: "h-control px-3",
        sm: "h-7 px-2.5",
        lg: "h-input px-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> &
    VariantProps<typeof toggleVariants>
>(({ className, variant, size, ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={cn(toggleVariants({ variant, size, className }))}
    {...props}
  />
))

Toggle.displayName = TogglePrimitive.Root.displayName

/* eslint-disable react-refresh/only-export-components */
export { Toggle, toggleVariants }
/* eslint-enable react-refresh/only-export-components */
