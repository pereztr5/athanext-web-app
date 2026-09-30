import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { PHONE_COUNTRIES, findPhoneCountry, parsePhone, phoneCountryFlag, toE164 } from "@/utils/phone";

interface PhoneInputProps {
  id?: string;
  /** Stored E.164 value ("" when empty). */
  value: string | null | undefined;
  onChange: (value: string) => void;
  invalid?: boolean;
  disabled?: boolean;
}

/** Searchable country picker (dial code) + national number, emitting a single E.164 string. */
export const PhoneInput = ({ id, value, onChange, invalid, disabled }: PhoneInputProps) => {
  const [parts, setParts] = useState(() => parsePhone(value));
  const [open, setOpen] = useState(false);
  const [dialogContainer, setDialogContainer] = useState<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogScrollTop = useRef(0);

  // Re-sync when the value changes from outside (e.g. the profile loads after mount).
  useEffect(() => {
    setParts((prev) => {
      if ((value ?? "") === toE164(prev.iso, prev.national)) return prev;
      return parsePhone(value, prev.iso);
    });
  }, [value]);

  const update = (iso: string, national: string) => {
    setParts({ iso, national });
    onChange(toE164(iso, national));
  };

  // cmdk scrolls its first item into view on mount, before the popover is positioned, which
  // jumps an enclosing Dialog back to the top. Put the Dialog's scroll position back.
  useEffect(() => {
    if (!open || !dialogContainer) return;
    const frame = requestAnimationFrame(() => {
      dialogContainer.scrollTop = dialogScrollTop.current;
    });
    return () => cancelAnimationFrame(frame);
  }, [open, dialogContainer]);

  const country = findPhoneCountry(parts.iso);

  return (
    <div className="flex gap-2">
      {/*
        A non-modal Popover rather than a Select: a Select adds its own scroll lock / outside
        pointer-events lock on top of an enclosing Dialog's, which left the Dialog unscrollable.
        Inside a Dialog the list is portalled into it, because the Dialog's scroll lock only lets
        wheel/touch scrolling through inside its own content.
      */}
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (next) {
            const dialog = triggerRef.current?.closest<HTMLElement>('[role="dialog"]') ?? null;
            dialogScrollTop.current = dialog?.scrollTop ?? 0;
            setDialogContainer(dialog);
          }
          setOpen(next);
        }}
      >
        <PopoverTrigger asChild>
          <button
            ref={triggerRef}
            type="button"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            aria-label={`Country code, ${country.name} +${country.dialCode}`}
            className="flex h-[38px] w-[112px] shrink-0 items-center justify-between rounded-[8px] border border-input bg-[#F1F1E6] px-3 py-2 text-[14px] leading-[18px] tracking-[-0.03em] text-foreground ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="line-clamp-1">
              <span aria-hidden>{phoneCountryFlag(country.iso)}</span> +{country.dialCode}
            </span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          container={dialogContainer}
          collisionBoundary={dialogContainer}
          align="start"
          className="w-[280px] p-0"
        >
          <Command defaultValue={country.iso}>
            <CommandInput placeholder="Search country or code" />
            <CommandList className="max-h-[240px]">
              <CommandEmpty>No country found.</CommandEmpty>
              {PHONE_COUNTRIES.map((option) => (
                <CommandItem
                  key={option.iso}
                  value={option.iso}
                  keywords={[option.name, `+${option.dialCode}`]}
                  onSelect={() => {
                    update(option.iso, parts.national);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", option.iso === country.iso ? "opacity-100" : "opacity-0")} />
                  <span aria-hidden className="mr-1.5">{phoneCountryFlag(option.iso)}</span>
                  {option.name} (+{option.dialCode})
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="Phone number"
        value={parts.national}
        onChange={(event) => {
          const raw = event.target.value;
          // A pasted international number ("+44 7911 …") picks its own country.
          if (raw.trim().startsWith("+")) {
            const parsed = parsePhone(raw, parts.iso);
            update(parsed.iso, parsed.national);
            return;
          }
          update(parts.iso, raw.replace(/[^\d\s\-().]/g, ""));
        }}
        aria-invalid={invalid}
        disabled={disabled}
      />
    </div>
  );
};
