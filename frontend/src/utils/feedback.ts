/** The word shown next to the 0 to 10 session score (ATH-82). */
export const scoreWord = (score: number) =>
  score <= 3 ? "Rough" : score <= 5 ? "Okay" : score <= 7 ? "Good" : score <= 9 ? "Great" : "Excellent";

const joinNames = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

/** Roll call count in words: "All 6 here", "5 here · 1 missed", "Nobody came". */
export const rollCallCount = (total: number, missed: number) => {
  const here = Math.max(0, total - missed);
  if (total <= 0) return "No athletes";
  if (here === 0) return "Nobody came";
  if (missed <= 0) return total === 1 ? "1 here" : `All ${total} here`;
  return `${here} here · ${missed} missed`;
};

/**
 * The line under the roll call: who gets the summary, who the notes are for, who missed it.
 * `missedGetsShortMessage` mirrors the server switch for families of athletes marked as missed.
 */
export const rollCallLine = ({
  cameCount,
  missedNames,
  missedGetsShortMessage,
}: {
  cameCount: number;
  missedNames: string[];
  missedGetsShortMessage: boolean;
}) => {
  if (cameCount === 0) return "Nobody came. Your message goes to every family and the session is saved as a no-show.";
  const athletes = cameCount === 1 ? "the 1 athlete who came" : `the ${cameCount} athletes who came`;
  if (!missedNames.length) return `Your summary goes to every family. Notes below are only for ${athletes}.`;
  const are = missedNames.length === 1 ? "is" : "are";
  const summary = missedGetsShortMessage
    ? `Your summary goes to the ${cameCount === 1 ? "family" : "families"} of ${athletes}.`
    : "Your summary goes to every family.";
  const missed = missedGetsShortMessage
    ? `${joinNames(missedNames)} ${are} marked as missed, so ${missedNames.length === 1 ? "their family gets" : "their families get"} a short "missed this session" message instead.`
    : `${joinNames(missedNames)} ${are} marked as missed.`;
  return `${summary} Notes below are only for ${athletes}. ${missed}`;
};
