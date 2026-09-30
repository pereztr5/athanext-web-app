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
  // Remaining ITU dial codes, so a pasted "+<code>…" never falls back to the default country.
  { iso: "AG", name: "Antigua and Barbuda", dialCode: "1" },
  { iso: "AI", name: "Anguilla", dialCode: "1" },
  { iso: "AS", name: "American Samoa", dialCode: "1" },
  { iso: "BB", name: "Barbados", dialCode: "1" },
  { iso: "BM", name: "Bermuda", dialCode: "1" },
  { iso: "DM", name: "Dominica", dialCode: "1" },
  { iso: "GD", name: "Grenada", dialCode: "1" },
  { iso: "GU", name: "Guam", dialCode: "1" },
  { iso: "KN", name: "Saint Kitts and Nevis", dialCode: "1" },
  { iso: "KY", name: "Cayman Islands", dialCode: "1" },
  { iso: "LC", name: "Saint Lucia", dialCode: "1" },
  { iso: "MP", name: "Northern Mariana Islands", dialCode: "1" },
  { iso: "MS", name: "Montserrat", dialCode: "1" },
  { iso: "SX", name: "Sint Maarten", dialCode: "1" },
  { iso: "TC", name: "Turks and Caicos Islands", dialCode: "1" },
  { iso: "VC", name: "Saint Vincent and the Grenadines", dialCode: "1" },
  { iso: "VG", name: "British Virgin Islands", dialCode: "1" },
  { iso: "VI", name: "U.S. Virgin Islands", dialCode: "1" },
  { iso: "AF", name: "Afghanistan", dialCode: "93" },
  { iso: "AL", name: "Albania", dialCode: "355" },
  { iso: "DZ", name: "Algeria", dialCode: "213" },
  { iso: "AD", name: "Andorra", dialCode: "376" },
  { iso: "AO", name: "Angola", dialCode: "244" },
  { iso: "AM", name: "Armenia", dialCode: "374" },
  { iso: "AW", name: "Aruba", dialCode: "297" },
  { iso: "AZ", name: "Azerbaijan", dialCode: "994" },
  { iso: "BH", name: "Bahrain", dialCode: "973" },
  { iso: "BY", name: "Belarus", dialCode: "375" },
  { iso: "BZ", name: "Belize", dialCode: "501" },
  { iso: "BJ", name: "Benin", dialCode: "229" },
  { iso: "BT", name: "Bhutan", dialCode: "975" },
  { iso: "BA", name: "Bosnia and Herzegovina", dialCode: "387" },
  { iso: "BW", name: "Botswana", dialCode: "267" },
  { iso: "BN", name: "Brunei", dialCode: "673" },
  { iso: "BF", name: "Burkina Faso", dialCode: "226" },
  { iso: "BI", name: "Burundi", dialCode: "257" },
  { iso: "KH", name: "Cambodia", dialCode: "855" },
  { iso: "CV", name: "Cape Verde", dialCode: "238" },
  { iso: "CF", name: "Central African Republic", dialCode: "236" },
  { iso: "TD", name: "Chad", dialCode: "235" },
  { iso: "KM", name: "Comoros", dialCode: "269" },
  { iso: "CG", name: "Congo", dialCode: "242" },
  { iso: "CD", name: "Congo (DRC)", dialCode: "243" },
  { iso: "CK", name: "Cook Islands", dialCode: "682" },
  { iso: "CW", name: "Curaçao", dialCode: "599" },
  { iso: "CY", name: "Cyprus", dialCode: "357" },
  { iso: "DJ", name: "Djibouti", dialCode: "253" },
  { iso: "GQ", name: "Equatorial Guinea", dialCode: "240" },
  { iso: "ER", name: "Eritrea", dialCode: "291" },
  { iso: "EE", name: "Estonia", dialCode: "372" },
  { iso: "SZ", name: "Eswatini", dialCode: "268" },
  { iso: "ET", name: "Ethiopia", dialCode: "251" },
  { iso: "FK", name: "Falkland Islands", dialCode: "500" },
  { iso: "FO", name: "Faroe Islands", dialCode: "298" },
  { iso: "FJ", name: "Fiji", dialCode: "679" },
  { iso: "GF", name: "French Guiana", dialCode: "594" },
  { iso: "PF", name: "French Polynesia", dialCode: "689" },
  { iso: "GA", name: "Gabon", dialCode: "241" },
  { iso: "GM", name: "Gambia", dialCode: "220" },
  { iso: "GE", name: "Georgia", dialCode: "995" },
  { iso: "GI", name: "Gibraltar", dialCode: "350" },
  { iso: "GL", name: "Greenland", dialCode: "299" },
  { iso: "GP", name: "Guadeloupe", dialCode: "590" },
  { iso: "GG", name: "Guernsey", dialCode: "44" },
  { iso: "GN", name: "Guinea", dialCode: "224" },
  { iso: "GW", name: "Guinea-Bissau", dialCode: "245" },
  { iso: "GY", name: "Guyana", dialCode: "592" },
  { iso: "IR", name: "Iran", dialCode: "98" },
  { iso: "IQ", name: "Iraq", dialCode: "964" },
  { iso: "IM", name: "Isle of Man", dialCode: "44" },
  { iso: "JE", name: "Jersey", dialCode: "44" },
  { iso: "JO", name: "Jordan", dialCode: "962" },
  { iso: "XK", name: "Kosovo", dialCode: "383" },
  { iso: "KW", name: "Kuwait", dialCode: "965" },
  { iso: "KG", name: "Kyrgyzstan", dialCode: "996" },
  { iso: "KI", name: "Kiribati", dialCode: "686" },
  { iso: "LA", name: "Laos", dialCode: "856" },
  { iso: "LV", name: "Latvia", dialCode: "371" },
  { iso: "LB", name: "Lebanon", dialCode: "961" },
  { iso: "LS", name: "Lesotho", dialCode: "266" },
  { iso: "LR", name: "Liberia", dialCode: "231" },
  { iso: "LY", name: "Libya", dialCode: "218" },
  { iso: "LI", name: "Liechtenstein", dialCode: "423" },
  { iso: "LT", name: "Lithuania", dialCode: "370" },
  { iso: "LU", name: "Luxembourg", dialCode: "352" },
  { iso: "MO", name: "Macao", dialCode: "853" },
  { iso: "MG", name: "Madagascar", dialCode: "261" },
  { iso: "MW", name: "Malawi", dialCode: "265" },
  { iso: "MV", name: "Maldives", dialCode: "960" },
  { iso: "ML", name: "Mali", dialCode: "223" },
  { iso: "MT", name: "Malta", dialCode: "356" },
  { iso: "MH", name: "Marshall Islands", dialCode: "692" },
  { iso: "MQ", name: "Martinique", dialCode: "596" },
  { iso: "MR", name: "Mauritania", dialCode: "222" },
  { iso: "MU", name: "Mauritius", dialCode: "230" },
  { iso: "YT", name: "Mayotte", dialCode: "262" },
  { iso: "FM", name: "Micronesia", dialCode: "691" },
  { iso: "MD", name: "Moldova", dialCode: "373" },
  { iso: "MC", name: "Monaco", dialCode: "377" },
  { iso: "MN", name: "Mongolia", dialCode: "976" },
  { iso: "ME", name: "Montenegro", dialCode: "382" },
  { iso: "MZ", name: "Mozambique", dialCode: "258" },
  { iso: "MM", name: "Myanmar", dialCode: "95" },
  { iso: "NA", name: "Namibia", dialCode: "264" },
  { iso: "NR", name: "Nauru", dialCode: "674" },
  { iso: "NP", name: "Nepal", dialCode: "977" },
  { iso: "NC", name: "New Caledonia", dialCode: "687" },
  { iso: "NE", name: "Niger", dialCode: "227" },
  { iso: "KP", name: "North Korea", dialCode: "850" },
  { iso: "MK", name: "North Macedonia", dialCode: "389" },
  { iso: "OM", name: "Oman", dialCode: "968" },
  { iso: "PW", name: "Palau", dialCode: "680" },
  { iso: "PS", name: "Palestine", dialCode: "970" },
  { iso: "PG", name: "Papua New Guinea", dialCode: "675" },
  { iso: "RE", name: "Réunion", dialCode: "262" },
  { iso: "RW", name: "Rwanda", dialCode: "250" },
  { iso: "PM", name: "Saint Pierre and Miquelon", dialCode: "508" },
  { iso: "WS", name: "Samoa", dialCode: "685" },
  { iso: "SM", name: "San Marino", dialCode: "378" },
  { iso: "ST", name: "São Tomé and Príncipe", dialCode: "239" },
  { iso: "SC", name: "Seychelles", dialCode: "248" },
  { iso: "SL", name: "Sierra Leone", dialCode: "232" },
  { iso: "SB", name: "Solomon Islands", dialCode: "677" },
  { iso: "SO", name: "Somalia", dialCode: "252" },
  { iso: "SS", name: "South Sudan", dialCode: "211" },
  { iso: "LK", name: "Sri Lanka", dialCode: "94" },
  { iso: "SD", name: "Sudan", dialCode: "249" },
  { iso: "SR", name: "Suriname", dialCode: "597" },
  { iso: "SY", name: "Syria", dialCode: "963" },
  { iso: "TJ", name: "Tajikistan", dialCode: "992" },
  { iso: "TZ", name: "Tanzania", dialCode: "255" },
  { iso: "TL", name: "Timor-Leste", dialCode: "670" },
  { iso: "TG", name: "Togo", dialCode: "228" },
  { iso: "TO", name: "Tonga", dialCode: "676" },
  { iso: "TN", name: "Tunisia", dialCode: "216" },
  { iso: "TM", name: "Turkmenistan", dialCode: "993" },
  { iso: "TV", name: "Tuvalu", dialCode: "688" },
  { iso: "UG", name: "Uganda", dialCode: "256" },
  { iso: "VU", name: "Vanuatu", dialCode: "678" },
  { iso: "VA", name: "Vatican City", dialCode: "39" },
  { iso: "YE", name: "Yemen", dialCode: "967" },
  { iso: "ZM", name: "Zambia", dialCode: "260" },
  { iso: "ZW", name: "Zimbabwe", dialCode: "263" },
  { iso: "AX", name: "Åland Islands", dialCode: "358" },
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
