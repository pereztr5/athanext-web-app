import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchLocationFromZipCode, formatLocationDisplay, hasValidLocationData, type LocationInfo } from "@/utils/geolocation";

interface ZipCodeInputProps {
  value: string | null;
  onChange: (value: string) => void;
  onLocationResolved?: (info: LocationInfo | null, isValid: boolean) => void;
  disabled?: boolean;
  error?: string;
  id?: string;
  showLabel?: boolean;
  label?: string;
  placeholder?: string;
  required?: boolean;
}

export const ZipCodeInput = ({
  value,
  onChange,
  disabled = false,
  error,
  id = "zipCode",
  showLabel = true,
  label = "Zip code",
  placeholder = "Enter your zip code",
  required = false,
  onLocationResolved,
}: ZipCodeInputProps) => {
  const [locationInfo, setLocationInfo] = useState<LocationInfo | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false);

  const fetchAndSetLocation = async (zip: string) => {
    // Safety checks: ensure zip is a valid string
    if (!zip || typeof zip !== "string" || zip.trim().length < 3) {
      setLocationInfo(null);
      setHasAttemptedFetch(false);
      // Incomplete zip is not a hard fail — parent decides Save rules.
      onLocationResolved?.(null, zip.trim().length === 0);
      return;
    }

    setIsLoadingLocation(true);
    try {
      // Safety check: ensure fetchLocationFromZipCode is available
      if (typeof fetchLocationFromZipCode !== "function") {
        throw new Error("Location fetch function is not available");
      }

      const location = await fetchLocationFromZipCode(zip);

      // Safety check: validate location response
      const isValid = location && typeof location === "object" && hasValidLocationData(location);
      setLocationInfo(isValid ? location : null);
      onLocationResolved?.(isValid ? location : null, Boolean(isValid));
      setHasAttemptedFetch(true);
    } catch (error) {
      console.error("Error fetching location:", error);
      setLocationInfo(null);
      onLocationResolved?.(null, false);
      setHasAttemptedFetch(true);
    } finally {
      setIsLoadingLocation(false);
    }
  };

  // Debounce zip code changes to fetch location
  useEffect(() => {
    const timer = setTimeout(() => {
      // Safety checks: ensure value is valid before processing
      if (value && typeof value === "string" && value.trim().length >= 3) {
        fetchAndSetLocation(value);
      } else if (!value || typeof value !== "string" || value.trim() === "") {
        setLocationInfo(null);
        setHasAttemptedFetch(false);
        // Empty zip: signal "no failed lookup" so parents with existing locations can still save.
        onLocationResolved?.(null, true);
      }
    }, 500);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [value]);

  return (
    <div className="grid gap-1.5">
      {showLabel && (
        <Label
          htmlFor={id}
          className="text-[12px] font-medium leading-[14px] tracking-[-0.03em] text-[#767980]"
        >
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <Input
        id={id}
        type="text"
        placeholder={placeholder}
        value={value || ''}
        onChange={(e) => {
          // Safety check: ensure onChange is a function and event has value
          if (typeof onChange === 'function' && e?.target?.value !== undefined) {
            onChange(e.target.value);
          }
        }}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        required={required}
      />
      {isLoadingLocation && (
        <p className="text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]">Finding location…</p>
      )}
      {!isLoadingLocation && hasAttemptedFetch && value && typeof value === 'string' && value.length >= 3 && locationInfo && typeof hasValidLocationData === 'function' && hasValidLocationData(locationInfo) && (
        <div className="flex items-center gap-2 rounded-[8px] bg-[#F4F4EB] px-3 py-2.5">
          <MapPin strokeWidth={1.5} className="h-4 w-4 flex-none text-[#767980]" aria-hidden="true" />
          <p className="text-[12px] leading-[14px] tracking-[-0.03em] text-[#484D56]">
            {typeof formatLocationDisplay === 'function' ? formatLocationDisplay(locationInfo) : 'Location found'}
          </p>
        </div>
      )}
      {!isLoadingLocation && hasAttemptedFetch && value && typeof value === 'string' && value.length >= 3 && (!locationInfo || (typeof hasValidLocationData === 'function' && !hasValidLocationData(locationInfo))) && (
        <div className="rounded-[8px] bg-[#FDF7EC] px-3 py-2.5">
          <p className="text-[12px] leading-[14px] tracking-[-0.03em] text-[#906A29]">
            We couldn't find a location for this zip code. Check it and try again.
          </p>
        </div>
      )}
      {error && <p className="text-[12px] leading-[14px] tracking-[-0.03em] text-destructive">{error}</p>}
    </div>
  );
};
