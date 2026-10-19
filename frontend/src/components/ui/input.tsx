import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-input w-full rounded-control border border-dark-250 bg-light px-3 text-body-m text-dark placeholder:text-dark-200 hover:border-dark-300 focus-visible:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-primary aria-[invalid=true]:border-error-600 aria-[invalid=true]:outline aria-[invalid=true]:outline-1 aria-[invalid=true]:-outline-offset-1 aria-[invalid=true]:outline-error-600 read-only:border-light-525 read-only:bg-light-400 read-only:text-dark-300 disabled:cursor-not-allowed disabled:border-light-525 disabled:bg-light-400 disabled:text-dark-200 py-2 file:border-0 file:bg-transparent file:text-label-sm file:text-dark",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
