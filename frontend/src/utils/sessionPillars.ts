/**
 * The pillars a coach picks at sign up, per sport. Sign up and the session tag picker both read
 * this list, so a session is tagged with the same pillars families chose from.
 */
export type PillarSport = "Soccer" | "Rowing";

export const SIGNUP_PILLARS: Record<PillarSport, readonly string[]> = {
  Soccer: ["On-field training", "Video analysis", "Mentorship", "Performance coaching", "Academic tutoring", "College recruiting"],
  Rowing: [
    "On-water technique",
    "Erg and race training",
    "Mentorship",
    "Strength and conditioning",
    "Academic tutoring",
    "College recruiting",
  ],
};

/** Soccer unless the profile says rowing (the app's two sports). */
export const pillarSport = (sport?: string | null): PillarSport => (/rowing/i.test(sport ?? "") ? "Rowing" : "Soccer");

export const pillarsForSport = (sport?: string | null) => SIGNUP_PILLARS[pillarSport(sport)];
