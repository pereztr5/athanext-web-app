import * as React from "react"

import { cn } from "@/lib/utils"

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-control border border-dark-250 bg-light px-3 text-body-m text-dark placeholder:text-dark-200 hover:border-dark-300 focus-visible:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-primary aria-[invalid=true]:border-error-600 aria-[invalid=true]:outline aria-[invalid=true]:outline-1 aria-[invalid=true]:-outline-offset-1 aria-[invalid=true]:outline-error-600 read-only:border-light-525 read-only:bg-light-400 read-only:text-dark-300 disabled:cursor-not-allowed disabled:border-light-525 disabled:bg-light-400 disabled:text-dark-200 py-2 text-paragraph",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
