/**
 * Athlete phone numbers are stored as a single E.164 string ("+<dial code><national number>").
 * The country picks the dial code; the athlete only types the national part.
 */

export interface PhoneCountry {
  iso: string;
  name: string;
  dialCode: string;
}

export const DEFAULT_PHONE_COUNTRY = "US";

// Countries sharing a dial code are listed with the preferred default first (US before CA for +1).
export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso: "US", name: "United States", dialCode: "1" },
  { iso: "CA", name: "Canada", dialCode: "1" },
  { iso: "PR", name: "Puerto Rico", dialCode: "1" },
  { iso: "JM", name: "Jamaica", dialCode: "1" },
  { iso: "BS", name: "Bahamas", dialCode: "1" },
  { iso: "TT", name: "Trinidad and Tobago", dialCode: "1" },
  { iso: "DO", name: "Dominican Republic", dialCode: "1" },
  { iso: "MX", name: "Mexico", dialCode: "52" },
  { iso: "GT", name: "Guatemala", dialCode: "502" },
  { iso: "SV", name: "El Salvador", dialCode: "503" },
  { iso: "HN", name: "Honduras", dialCode: "504" },
  { iso: "NI", name: "Nicaragua", dialCode: "505" },
  { iso: "CR", name: "Costa Rica", dialCode: "506" },
  { iso: "PA", name: "Panama", dialCode: "507" },
  { iso: "HT", name: "Haiti", dialCode: "509" },
  { iso: "CU", name: "Cuba", dialCode: "53" },
  { iso: "AR", name: "Argentina", dialCode: "54" },
  { iso: "BR", name: "Brazil", dialCode: "55" },
  { iso: "CL", name: "Chile", dialCode: "56" },
  { iso: "CO", name: "Colombia", dialCode: "57" },
  { iso: "VE", name: "Venezuela", dialCode: "58" },
  { iso: "BO", name: "Bolivia", dialCode: "591" },
  { iso: "EC", name: "Ecuador", dialCode: "593" },
  { iso: "PY", name: "Paraguay", dialCode: "595" },
  { iso: "PE", name: "Peru", dialCode: "51" },
  { iso: "UY", name: "Uruguay", dialCode: "598" },
  { iso: "GB", name: "United Kingdom", dialCode: "44" },
  { iso: "IE", name: "Ireland", dialCode: "353" },
  { iso: "FR", name: "France", dialCode: "33" },
  { iso: "DE", name: "Germany", dialCode: "49" },
  { iso: "ES", name: "Spain", dialCode: "34" },
  { iso: "PT", name: "Portugal", dialCode: "351" },
  { iso: "IT", name: "Italy", dialCode: "39" },
  { iso: "NL", name: "Netherlands", dialCode: "31" },
  { iso: "BE", name: "Belgium", dialCode: "32" },
  { iso: "CH", name: "Switzerland", dialCode: "41" },
  { iso: "AT", name: "Austria", dialCode: "43" },
  { iso: "DK", name: "Denmark", dialCode: "45" },
  { iso: "SE", name: "Sweden", dialCode: "46" },
  { iso: "NO", name: "Norway", dialCode: "47" },
  { iso: "FI", name: "Finland", dialCode: "358" },
  { iso: "IS", name: "Iceland", dialCode: "354" },
  { iso: "PL", name: "Poland", dialCode: "48" },
  { iso: "CZ", name: "Czechia", dialCode: "420" },
  { iso: "SK", name: "Slovakia", dialCode: "421" },
  { iso: "HU", name: "Hungary", dialCode: "36" },
  { iso: "RO", name: "Romania", dialCode: "40" },
  { iso: "BG", name: "Bulgaria", dialCode: "359" },
  { iso: "GR", name: "Greece", dialCode: "30" },
  { iso: "HR", name: "Croatia", dialCode: "385" },
  { iso: "RS", name: "Serbia", dialCode: "381" },
  { iso: "SI", name: "Slovenia", dialCode: "386" },
  { iso: "UA", name: "Ukraine", dialCode: "380" },
  { iso: "TR", name: "Türkiye", dialCode: "90" },
  { iso: "RU", name: "Russia", dialCode: "7" },
  { iso: "KZ", name: "Kazakhstan", dialCode: "7" },
  { iso: "UZ", name: "Uzbekistan", dialCode: "998" },
  { iso: "IL", name: "Israel", dialCode: "972" },
  { iso: "AE", name: "United Arab Emirates", dialCode: "971" },
  { iso: "SA", name: "Saudi Arabia", dialCode: "966" },
  { iso: "QA", name: "Qatar", dialCode: "974" },
  { iso: "EG", name: "Egypt", dialCode: "20" },
  { iso: "MA", name: "Morocco", dialCode: "212" },
  { iso: "NG", name: "Nigeria", dialCode: "234" },
  { iso: "GH", name: "Ghana", dialCode: "233" },
  { iso: "SN", name: "Senegal", dialCode: "221" },
  { iso: "CM", name: "Cameroon", dialCode: "237" },
  { iso: "CI", name: "Côte d'Ivoire", dialCode: "225" },
  { iso: "KE", name: "Kenya", dialCode: "254" },
  { iso: "ZA", name: "South Africa", dialCode: "27" },
  { iso: "IN", name: "India", dialCode: "91" },
  { iso: "PK", name: "Pakistan", dialCode: "92" },
  { iso: "BD", name: "Bangladesh", dialCode: "880" },
  { iso: "CN", name: "China", dialCode: "86" },
  { iso: "HK", name: "Hong Kong", dialCode: "852" },
  { iso: "TW", name: "Taiwan", dialCode: "886" },
  { iso: "JP", name: "Japan", dialCode: "81" },
  { iso: "KR", name: "South Korea", dialCode: "82" },
  { iso: "PH", name: "Philippines", dialCode: "63" },
  { iso: "VN", name: "Vietnam", dialCode: "84" },
  { iso: "TH", name: "Thailand", dialCode: "66" },
  { iso: "MY", name: "Malaysia", dialCode: "60" },
  { iso: "SG", name: "Singapore", dialCode: "65" },
  { iso: "ID", name: "Indonesia", dialCode: "62" },
  { iso: "AU", name: "Australia", dialCode: "61" },
  { iso: "NZ", name: "New Zealand", dialCode: "64" },
];

const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

// Countries whose national numbers keep their leading 0 inside E.164.
const KEEPS_LEADING_ZERO = new Set(["IT"]);

export const findPhoneCountry = (iso: string | null | undefined): PhoneCountry =>
  PHONE_COUNTRIES.find((country) => country.iso === iso) ??
  PHONE_COUNTRIES.find((country) => country.iso === DEFAULT_PHONE_COUNTRY)!;

export const phoneCountryFlag = (iso: string): string =>
  iso
    .toUpperCase()
    .replace(/[A-Z]/g, (char) => String.fromCodePoint(0x1f1e6 + char.charCodeAt(0) - 65));

/** Builds the stored E.164 string, or "" when no national number was typed. */
export const toE164 = (iso: string, national: string): string => {
  const country = findPhoneCountry(iso);
  let digits = (national ?? "").replace(/\D/g, "");
  if (!KEEPS_LEADING_ZERO.has(country.iso)) digits = digits.replace(/^0+/, "");
  // NANP numbers typed with the leading country "1" (e.g. 1 555 123 4567).
  if (country.dialCode === "1" && digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (!digits) return "";
  // No truncation: over-long numbers fail isValidE164 instead of being silently cut.
  return `+${country.dialCode}${digits}`;
};

/**
 * Splits a stored value into country + national number.
 * Values without "+" (legacy free-text) are treated as a national number in the fallback country.
 */
export const parsePhone = (
  value: string | null | undefined,
  fallbackIso: string = DEFAULT_PHONE_COUNTRY
): { iso: string; national: string } => {
  const raw = (value ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  if (!raw.startsWith("+")) return { iso: findPhoneCountry(fallbackIso).iso, national: digits };

  // Keep the current country when it already matches the dial code (e.g. CA stays CA for +1).
  const fallback = findPhoneCountry(fallbackIso);
  if (digits.startsWith(fallback.dialCode) && digits.length > fallback.dialCode.length) {
    return { iso: fallback.iso, national: digits.slice(fallback.dialCode.length) };
  }

  let match: PhoneCountry | null = null;
  for (const country of PHONE_COUNTRIES) {
    if (digits.startsWith(country.dialCode) && (!match || country.dialCode.length > match.dialCode.length)) {
      match = country;
    }
  }
  if (!match) return { iso: fallback.iso, national: digits };
  return { iso: match.iso, national: digits.slice(match.dialCode.length) };
};

export const isValidE164 = (value: string): boolean => E164_PATTERN.test(value);

/** Re-derives a stored value as E.164 ("" when it holds no digits, e.g. a bare "+"). */
export const normalizeStoredPhone = (value: string | null | undefined): string => {
  const { iso, national } = parsePhone(value);
  return toE164(iso, national);
};
