/** The word shown next to the 0 to 10 session score (ATH-82). */
export const scoreWord = (score: number) =>
  score <= 3 ? "Rough" : score <= 5 ? "Okay" : score <= 7 ? "Good" : score <= 9 ? "Great" : "Excellent";
