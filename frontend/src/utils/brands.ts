/** Brand name / logo helpers (ATH-56). Name matching mirrors the brands_name_key index. */

export interface Brand {
  id: string;
  name: string;
  logo_url: string | null;
  website: string | null;
  created_by: string | null;
}

export const BRAND_LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const BRAND_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

/** Display form: trimmed, inner whitespace collapsed. */
export const cleanBrandName = (name: string | null | undefined): string =>
  typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";

/** Case-insensitive key, same as lower(regexp_replace(btrim(name), '\s+', ' ', 'g')). */
export const brandKey = (name: string | null | undefined): string => cleanBrandName(name).toLowerCase();

export const findBrandByName = <T extends Pick<Brand, "name">>(brands: T[], name: string): T | undefined => {
  const key = brandKey(name);
  return key ? brands.find((brand) => brandKey(brand.name) === key) : undefined;
};

/** Brands whose name contains the query, excluding ids already picked, sorted A–Z. */
export const filterBrands = <T extends Pick<Brand, "id" | "name">>(
  brands: T[],
  query: string,
  excludeIds: string[] = []
): T[] => {
  const key = brandKey(query);
  const excluded = new Set(excludeIds);
  return brands
    .filter((brand) => !excluded.has(brand.id) && (!key || brandKey(brand.name).includes(key)))
    .sort((a, b) => a.name.localeCompare(b.name));
};

/** Adds https:// when missing; returns null for blank or invalid input. */
export const normalizeBrandWebsite = (value: string | null | undefined): string | null => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    return url.hostname.includes(".") ? url.toString() : null;
  } catch {
    return null;
  }
};

/** Error message for an unusable logo file, or null when it's fine. */
export const validateBrandLogo = (file: Pick<File, "type" | "size">): string | null => {
  if (!BRAND_LOGO_TYPES.includes(file.type)) return "Use a PNG, JPG, WebP or SVG image.";
  if (file.size > BRAND_LOGO_MAX_BYTES) return "Logo must be 2MB or smaller.";
  return null;
};
