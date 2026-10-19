import type { LucideIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

/** Card heading (Working Copy `.ch`): 20px icon and 20px/500 title. */
export const CardHeading = ({ icon: Icon, title }: { icon: LucideIcon; title: string }) => (
  <div className="flex items-center gap-2">
    <Icon className="size-5 flex-none" strokeWidth={1.5} aria-hidden="true" />
    <h2 className="text-card-title text-dark">{title}</h2>
  </div>
);

/** Working Copy `.cap`. */
export const caption = "text-caption text-dark-300";

/** Working Copy `.sw`: 36x20 track, 16px knob. */
export const Switch = ({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  label: string;
  disabled?: boolean;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!on)}
    className={cn(
      "flex h-5 w-9 flex-none items-center rounded-full p-0.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:bg-light-525",
      on ? "justify-end bg-primary" : "justify-start bg-light-550"
    )}
  >
    <span className="size-4 rounded-full bg-light-50" />
  </button>
);
