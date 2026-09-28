const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isCoachUuid = (value?: string | null) =>
  Boolean(value && UUID_RE.test(value));

export const coachProfilePath = (slugOrId: string) => `/coach/${slugOrId}`;

export const coachPricingPath = (slugOrId: string) =>
  `/coach/${slugOrId}/pricing`;

export const coachProfileUrl = (slugOrId: string, origin = window.location.origin) =>
  `${origin}${coachProfilePath(slugOrId)}`;

export const coachPricingUrl = (slugOrId: string, origin = window.location.origin) =>
  `${origin}${coachPricingPath(slugOrId)}`;

/** Display form used on the share card footer, matching the design. */
export const coachPublicLinkLabel = (slug: string) =>
  `athanext.com/${slug}`;

export const coachPricingLinkLabel = (slug: string) =>
  `athanext.com/${slug}/pricing`;
