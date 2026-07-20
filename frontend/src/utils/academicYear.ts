type AcademicYearConfig = {
  value: string;
  label: string;
  graduationOffset: number;
  aliases: string[];
};

const ACADEMIC_YEAR_CONFIG: AcademicYearConfig[] = [
  {
    value: "freshman",
    label: "Freshman",
    graduationOffset: 3,
    aliases: ["freshman", "first year", "first-year", "1st year", "freshman (first year)", "freshman (first-year)"],
  },
  {
    value: "sophomore",
    label: "Sophomore",
    graduationOffset: 2,
    aliases: ["sophomore", "second year", "second-year", "2nd year", "sophomore (second year)", "sophomore (second-year)"],
  },
  {
    value: "junior",
    label: "Junior",
    graduationOffset: 1,
    aliases: ["junior", "third year", "third-year", "3rd year", "junior (third year)", "junior (third-year)"],
  },
  {
    value: "senior",
    label: "Senior",
    graduationOffset: 0,
    aliases: ["senior", "fourth year", "fourth-year", "4th year", "senior (fourth year)", "senior (fourth-year)"],
  },
];

const ACADEMIC_YEAR_LOOKUP = new Map<string, AcademicYearConfig>();

ACADEMIC_YEAR_CONFIG.forEach((item) => {
  const keys = [item.value, item.label, ...item.aliases].map((entry) => entry.trim().toLowerCase());
  keys.forEach((key) => ACADEMIC_YEAR_LOOKUP.set(key, item));
});

export const ACADEMIC_YEAR_OPTIONS = ACADEMIC_YEAR_CONFIG.map(({ value, label }) => ({ value, label }));

export const normalizeAcademicYear = (value?: string | null): string | null => {
  if (!value || typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  const entry = ACADEMIC_YEAR_LOOKUP.get(normalized);
  return entry?.value ?? value.trim();
};

export const getAcademicYearGraduationOffset = (value?: string | null): number | null => {
  const normalized = normalizeAcademicYear(value);
  if (!normalized) return null;
  return ACADEMIC_YEAR_CONFIG.find((entry) => entry.value === normalized)?.graduationOffset ?? null;
};

export const getAcademicYearLabel = (value?: string | null): string => {
  const normalized = normalizeAcademicYear(value);
  if (!normalized) return "";
  return ACADEMIC_YEAR_CONFIG.find((entry) => entry.value === normalized)?.label ?? normalized;
};
