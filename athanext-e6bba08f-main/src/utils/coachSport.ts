export type CoachSportValue = "soccer" | "rowing";

type CoachSportSource = {
  sport?: string | null;
  sport_type?: string | null;
  sportType?: string | null;
  position?: string | null;
  coach_position?: string | null;
  company?: string | null;
  positions?: Array<string | null> | null;
  session_types?: Array<string | null> | null;
  specialties?: Array<string | null> | null;
};

const ROWING_PATTERNS = [
  /\brow(?:ing|er|ers)?\b/,
  /\bcrew\b/,
  /\bcox(?:swain)?\b/,
  /\bscull(?:er|ing)?\b/,
];

const SOCCER_PATTERNS = [
  /\bsoccer\b/,
  /\bscoccer\b/,
  /\bfootball\b/,
  /\bgoalkeeper\b/,
  /\bdefender\b/,
  /\bmidfielder\b/,
  /\bforward\b/,
  /\bstriker\b/,
  /\bwinger\b/,
  /\bon field development\b/,
];

const matchesAnyPattern = (value: string, patterns: RegExp[]) =>
  patterns.some((pattern) => pattern.test(value));

export const normalizeCoachSport = (value?: string | null): CoachSportValue | undefined => {
  const normalized = value?.toLowerCase().trim() ?? "";
  if (!normalized) return undefined;

  if (matchesAnyPattern(normalized, ROWING_PATTERNS)) return "rowing";
  if (matchesAnyPattern(normalized, SOCCER_PATTERNS)) return "soccer";

  return undefined;
};

export const detectCoachSport = (
  coach?: CoachSportSource | null,
  fallbackSport?: string | null,
): CoachSportValue | undefined => {
  const directSportSources = [
    fallbackSport,
    coach?.sport,
    coach?.sport_type,
    coach?.sportType,
  ];

  for (const source of directSportSources) {
    const normalizedSport = normalizeCoachSport(source);
    if (normalizedSport) return normalizedSport;
  }

  const positionSource = [
    coach?.position,
    coach?.coach_position,
    ...(coach?.positions ?? []),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  const positionSport = normalizeCoachSport(positionSource);
  if (positionSport) return positionSport;

  const metadataSource = [
    coach?.company,
    ...(coach?.session_types ?? []),
    ...(coach?.specialties ?? []),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  return normalizeCoachSport(metadataSource);
};
