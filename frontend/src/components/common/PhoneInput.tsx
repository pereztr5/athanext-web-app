import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PHONE_COUNTRIES, findPhoneCountry, parsePhone, phoneCountryFlag, toE164 } from "@/utils/phone";

interface PhoneInputProps {
  id?: string;
  /** Stored E.164 value ("" when empty). */
  value: string | null | undefined;
  onChange: (value: string) => void;
  invalid?: boolean;
}

/** Country select (dial code) + national number, emitting a single E.164 string. */
export const PhoneInput = ({ id, value, onChange, invalid }: PhoneInputProps) => {
  const [parts, setParts] = useState(() => parsePhone(value));

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

  const country = findPhoneCountry(parts.iso);

  return (
    <div className="flex gap-2">
      <Select value={country.iso} onValueChange={(iso) => update(iso, parts.national)}>
        <SelectTrigger
          className="w-[112px] shrink-0"
          aria-label={`Country code, ${country.name} +${country.dialCode}`}
        >
          <SelectValue>
            <span aria-hidden>{phoneCountryFlag(country.iso)}</span> +{country.dialCode}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[280px]">
          {PHONE_COUNTRIES.map((option) => (
            <SelectItem key={option.iso} value={option.iso}>
              <span aria-hidden>{phoneCountryFlag(option.iso)}</span> {option.name} (+{option.dialCode})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
      />
    </div>
  );
};
