/**
 * Coach ages (ATH-95, ATH-96): the ages a coach works with. age_max 99 means "and up".
 */

export const AGE_AND_UP = 99;

/** Age groups families filter by, as in the prototype. */
export const AGE_GROUPS: { label: string; min: number; max: number }[] = [
  { label: "U10 to U12", min: 10, max: 12 },
  { label: "U13 to U15", min: 13, max: 15 },
  { label: "U16 to U18", min: 16, max: 18 },
  { label: "18 and over", min: 18, max: AGE_AND_UP },
];

type Ages = { age_min?: number | null; age_max?: number | null };

/** "10 to 18", "18 and up", or "" when the coach hasn't set it. */
export const ageRangeLabel = ({ age_min, age_max }: Ages): string => {
  if (age_min == null && age_max == null) return "";
  const min = age_min ?? 3;
  if (age_max == null || age_max >= AGE_AND_UP) return `${min} and up`;
  return min === age_max ? `${min}` : `${min} to ${age_max}`;
};

/** Pill text for coach cards: "Ages 10 to 18" or "Ages 18+". */
export const agePillLabel = (ages: Ages): string => {
  if (ages.age_min == null && ages.age_max == null) return "";
  if (ages.age_max == null || ages.age_max >= AGE_AND_UP) return `Ages ${ages.age_min ?? 3}+`;
  return `Ages ${ageRangeLabel(ages)}`;
};

/** A coach matches a group when their range overlaps it. Coaches without ages don't match. */
export const matchesAgeGroup = (ages: Ages, groupLabel: string): boolean => {
  const group = AGE_GROUPS.find((g) => g.label === groupLabel);
  if (!group) return true;
  if (ages.age_min == null && ages.age_max == null) return false;
  const min = ages.age_min ?? 3;
  const max = ages.age_max ?? AGE_AND_UP;
  return min <= group.max && max >= group.min;
};
