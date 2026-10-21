import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// AthaNext Design System Button. One primary per view, last in a group.
// Disabled uses the light-400 / light-525 / dark-200 recipe, never opacity.
const filledDisabled = "disabled:border-light-525 disabled:bg-light-400 disabled:text-dark-200"
// Phones: a text button may shrink inside a row and wrap its label instead of pushing the row
// off screen. Icon buttons keep their size.
const narrowWrap = "max-sm:min-w-0 max-sm:whitespace-normal max-sm:text-center"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control border border-transparent font-medium tracking-[-0.03em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: `border-primary-300 bg-primary text-light hover:bg-primary-600 ${filledDisabled}`,
        secondary: `border-light-525 bg-light-400 text-dark hover:border-light-600 ${filledDisabled}`,
        // Older name for secondary, kept so existing call sites read the same.
        outline: `border-light-525 bg-light-400 text-dark hover:border-light-600 ${filledDisabled}`,
        // Teal: only for group, sport or category actions such as joining a group session.
        tertiary: `border-secondary-600 bg-secondary-700 text-light hover:bg-secondary-600 ${filledDisabled}`,
        destructive: `border-error-300 bg-error-50 text-error-700 hover:border-error-600 ${filledDisabled}`,
        success: `border-success-300 bg-success-50 text-success-700 hover:border-success-600 ${filledDisabled}`,
        ghost: `text-dark hover:bg-light-400 ${filledDisabled}`,
        link: "h-auto border-0 p-0 text-primary hover:text-primary-600 disabled:text-dark-200",
        text: "h-auto border-0 p-0 text-primary hover:text-primary-600 disabled:text-dark-200",
        back: "h-auto gap-1 border-0 p-0 text-label-sm text-dark-300 hover:text-dark disabled:text-dark-200",
      },
      size: {
        default: `h-control px-4 text-label ${narrowWrap}`,
        sm: `h-control-sm px-3 text-label-sm ${narrowWrap}`,
        lg: `h-input px-5 text-label ${narrowWrap}`,
        icon: "size-control",
      },
    },
    compoundVariants: [
      { variant: ["link", "text", "back"], size: ["default", "sm", "lg"], className: "h-auto px-0" },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

/* eslint-disable-next-line react-refresh/only-export-components */
export { Button, buttonVariants }
