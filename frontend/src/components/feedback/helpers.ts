import { formatClock } from "@/utils/schedule";

/** "Ava P." */
export const shortName = (name: string) => {
  const parts = name.split(" ").filter(Boolean);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : name;
};
export const firstName = (name: string) => name.split(" ")[0] ?? "";
export const lastName = (name: string) => {
  const parts = name.split(" ").filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : "";
};
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
export const families = (n: number) => `${n} ${n === 1 ? "family" : "families"}`;

/** "4:00 to 5:00 pm", or "11:00 am to 12:00 pm" across noon. */
export const timeRange = (start: Date, end: Date, timeZone: string) => {
  const a = formatClock(start, timeZone);
  const b = formatClock(end, timeZone);
  return `${a.slice(-2) === b.slice(-2) ? a.slice(0, -3) : a} to ${b}`;
};

/** Adds a starter phrase to what's already written, as its own sentence. */
export const appendSentence = (text: string, phrase: string) => {
  const t = text.trim();
  return t ? `${t}${/[.!?]$/.test(t) ? "" : "."} ${phrase}.` : `${phrase}.`;
};

/** What a session usually works on, per pillar: the summary starter chips use these. */
const TOPICS: Record<string, string[]> = {
  "On-field training": ["First touch", "Passing and receiving", "Finishing", "1v1 attacking", "Defending 1v1s", "Scanning"],
  "Video analysis": ["Positioning", "Decision making", "Off-ball movement", "Pressing triggers"],
  Mentorship: ["Goal setting", "Confidence", "Game-day routine", "Handling setbacks"],
  "Performance coaching": ["Speed", "Agility", "Strength", "Conditioning", "Mobility"],
  "Academic tutoring": ["Homework", "Test prep", "Study habits", "Time management"],
  "College recruiting": ["Highlight video", "Player profile", "Coach outreach", "Showcase planning"],
};
const lower = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

export const NO_SHOW_STARTERS = ["We missed you today", "Want to book a make-up session?", "See you at the next one"];
export const NOTE_STARTERS = ["Strong effort today", "Keep working on first touch", "Use your weak foot more", "Great communication"];

export const summaryStarters = (pillar: string | null) => {
  const topics = TOPICS[pillar ?? ""] ?? TOPICS["On-field training"];
  const next = topics.slice(0, 4).find((x) => x !== topics[0] && x !== topics[1]) ?? topics[0];
  return [`Worked on ${lower(topics[0])}`, `Good progress on ${lower(topics[1] ?? topics[0])}`, `Next time: ${lower(next)}`];
};

/** Working Copy `.cap` and `.fb-ta`. */
export const caption = "text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]";

export const textarea =
  "min-h-[88px] w-full resize-y rounded-[8px] border border-[#EAEADF] bg-[#F7F7F0] p-3 text-[14px] leading-[20px] tracking-[-0.03em] text-[#1A202C] placeholder:text-[#A3A6AB] focus:border-[#99BBE1] focus:outline-none disabled:bg-[#F4F4EB] disabled:text-[#A3A6AB]";
