import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-center"
      offset={24}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-card group-[.toaster]:border-dark group-[.toaster]:bg-dark group-[.toaster]:text-light group-[.toaster]:shadow-overlay",
          description: "group-[.toast]:text-light-600",
          actionButton:
            "group-[.toast]:bg-transparent group-[.toast]:text-primary-200",
          cancelButton:
            "group-[.toast]:bg-transparent group-[.toast]:text-light-600",
        },
      }}
      {...props}
    />
  )
}

/* eslint-disable react-refresh/only-export-components */
export { Toaster, toast }
/* eslint-enable react-refresh/only-export-components */
