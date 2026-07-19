import { useEffect, useState } from "react";
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
  label = "Zip Code",
  placeholder = "Enter your zip code",
  required = false,
  onLocationResolved,
}: ZipCodeInputProps) => {
  const [locationInfo, setLocationInfo] = useState<LocationInfo | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false);

  const fetchAndSetLocation = async (zip: string) => {
    // Safety checks: ensure zip is a valid string
    if (!zip || typeof zip !== 'string' || zip.trim().length < 3) {
      setLocationInfo(null);
      setHasAttemptedFetch(false);
      onLocationResolved?.(null, false);
      return;
    }

    setIsLoadingLocation(true);
    try {
      // Safety check: ensure fetchLocationFromZipCode is available
      if (typeof fetchLocationFromZipCode !== 'function') {
        throw new Error('Location fetch function is not available');
      }
      
      const location = await fetchLocationFromZipCode(zip);
      
      // Safety check: validate location response
      const isValid = location && typeof location === 'object' && hasValidLocationData(location);
      setLocationInfo(isValid ? location : null);
      onLocationResolved?.(isValid ? location : null, Boolean(isValid));
      setHasAttemptedFetch(true);
    } catch (error) {
      console.error('Error fetching location:', error);
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
      if (value && typeof value === 'string' && value.trim().length >= 3) {
        fetchAndSetLocation(value);
      } else if (!value || typeof value !== 'string' || value.trim() === '') {
        setLocationInfo(null);
        setHasAttemptedFetch(false);
        onLocationResolved?.(null, false);
      }
    }, 500);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [value]);

  return (
    <div className="grid gap-2">
      {showLabel && (
        <Label htmlFor={id}>
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
        <p className="text-xs text-muted-foreground">Loading location...</p>
      )}
      {!isLoadingLocation && hasAttemptedFetch && value && typeof value === 'string' && value.length >= 3 && locationInfo && typeof hasValidLocationData === 'function' && hasValidLocationData(locationInfo) && (
        <div className="mt-2 p-3 bg-blue-50 rounded-md border border-blue-200">
          <p className="text-xs text-slate-700">
            {typeof formatLocationDisplay === 'function' ? formatLocationDisplay(locationInfo) : 'Location found'}
          </p>
        </div>
      )}
      {!isLoadingLocation && hasAttemptedFetch && value && typeof value === 'string' && value.length >= 3 && (!locationInfo || (typeof hasValidLocationData === 'function' && !hasValidLocationData(locationInfo))) && (
        <div className="mt-2 p-3 bg-amber-50 rounded-md border border-amber-200">
          <p className="text-xs text-amber-700">
            Location not found for this zip code. Please verify the code is correct.
          </p>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
};
