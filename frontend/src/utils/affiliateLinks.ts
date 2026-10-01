/** Affiliate links on the coach profile (ATH-35), stored in coaches.affiliate_links. */

export const MAX_AFFILIATE_LINKS = 3;

export interface AffiliateLink {
  brand: string;
  url: string;
  code?: string;
}

/** Returns a normalized https/http URL, or null when the value is not a web link. */
export const toAffiliateUrl = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
};

/** Reads the stored jsonb defensively: drops malformed entries and caps the list. */
export const parseAffiliateLinks = (value: unknown): AffiliateLink[] => {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((entry): AffiliateLink[] => {
      if (!entry || typeof entry !== "object") return [];
      const { brand, url, code } = entry as Record<string, unknown>;
      const safeUrl = typeof url === "string" ? toAffiliateUrl(url) : null;
      const name = typeof brand === "string" ? brand.trim() : "";
      if (!safeUrl || !name) return [];
      const discount = typeof code === "string" ? code.trim() : "";
      return [discount ? { brand: name, url: safeUrl, code: discount } : { brand: name, url: safeUrl }];
    })
    .slice(0, MAX_AFFILIATE_LINKS);
};
