// Camp emails: receipt / spot held (to the parent), new sign-up (to the coach), finish your
// account, and camp details for an athlete the coach added. Pure, so the copy is tested.
import { emailButton, emailShell, escapeEmailHtml } from "./email_shell.ts";

export interface CampEmailCamp {
  name: string;
  starts_on: string | null;
  ends_on: string | null;
  location: string | null;
  included?: unknown;
  coach_name: string;
}

export interface CampEmailAthlete {
  first_name: string;
  last_name?: string | null;
  group_name?: string | null;
  start_time?: string | null;
  end_time?: string | null;
}

const e = (value: unknown) => escapeEmailHtml(String(value ?? ""));
const wrap = (title: string, parts: string[]) => emailShell(title, parts);
const button = (href: string, label: string) => emailButton(href, label);

/** "Nov 24" from "2026-11-24", read as a calendar date (no time zone shift). */
export const campDay = (iso: string | null | undefined) => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
};

/** "Nov 24 to 26" style date range; one day shows once. */
export const campDates = (starts: string | null | undefined, ends: string | null | undefined) => {
  const a = campDay(starts);
  const b = campDay(ends);
  if (!a) return "";
  if (!b || a === b) return a;
  return `${a} to ${b}`;
};

/**
 * Camp times are Eastern wall-clock (SESSION_TIME_ZONE, America/New_York), so emails label
 * them: families outside Eastern would otherwise read them as their own time.
 */
export const CAMP_TIME_ZONE_LABEL = "ET";

/** "9am", "9:30am", "12pm" from "09:00" (same style as the app's formatCampTime). */
export const campTime = (hhmm: string | null | undefined) => {
  if (!hhmm || !/^\d{2}:\d{2}/.test(hhmm)) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return m ? `${h12}:${String(m).padStart(2, "0")}${suffix}` : `${h12}${suffix}`;
};

/** "4pm to 5:30pm ET"; one time alone gets the label too; nothing when neither is set. */
export const campTimes = (start: string | null | undefined, end: string | null | undefined) => {
  const a = campTime(start);
  const b = campTime(end);
  const range = a && b ? `${a} to ${b}` : a || b;
  return range ? `${range} ${CAMP_TIME_ZONE_LABEL}` : "";
};

export const money = (cents: number) => `$${(Math.max(0, Math.round(cents)) / 100).toFixed(2)}`;

const campLines = (camp: CampEmailCamp) => {
  const when = campDates(camp.starts_on, camp.ends_on);
  return [
    when ? `<p><strong>When:</strong> ${e(when)}</p>` : "",
    camp.location ? `<p><strong>Where:</strong> ${e(camp.location)}</p>` : "",
  ].filter(Boolean);
};

const athleteList = (athletes: CampEmailAthlete[]) =>
  `<ul>${athletes
    .map((a) => {
      const time = a.start_time && a.end_time ? `, ${campTimes(a.start_time, a.end_time)}` : "";
      const group = a.group_name ? ` (${e(a.group_name)}${e(time)})` : "";
      return `<li>${e([a.first_name, a.last_name].filter(Boolean).join(" "))}${group}</li>`;
    })
    .join("")}</ul>`;

const includedList = (included: unknown) => {
  const items = Array.isArray(included) ? included.filter((i): i is string => typeof i === "string" && i.trim() !== "") : [];
  return items.length ? `<p><strong>What to bring and what's included:</strong></p><ul>${items.map((i) => `<li>${e(i)}</li>`).join("")}</ul>` : "";
};

/** To the parent after a card payment (paid) or a direct-pay hold (held). */
export const campParentEmail = (input: {
  kind: "paid" | "held";
  parentName: string | null;
  camp: CampEmailCamp;
  athletes: CampEmailAthlete[];
  amountCents?: number | null;
  finishUrl?: string | null;
}) => {
  const { kind, camp } = input;
  const hi = input.parentName ? `Hi ${e(input.parentName.split(" ")[0])},` : "Hi,";
  const subject = kind === "paid" ? `You're in: ${camp.name}` : `Spot held: ${camp.name}`;
  const lead =
    kind === "paid"
      ? `<p>${hi} your spot at <strong>${e(camp.name)}</strong> with ${e(camp.coach_name)} is confirmed.</p>`
      : `<p>${hi} we're holding your spot at <strong>${e(camp.name)}</strong>. ${e(camp.coach_name)} confirms it once you've paid him. Nothing was charged.</p>`;
  const parts = [
    lead,
    athleteList(input.athletes),
    ...campLines(camp),
    kind === "paid" && input.amountCents ? `<p><strong>Paid:</strong> ${e(money(input.amountCents))}</p>` : "",
    includedList(camp.included),
    input.finishUrl
      ? `<p>Finish your AthaNext account to see the camp on your schedule. Your spot doesn't depend on it.</p>${button(input.finishUrl, "Finish your account")}`
      : "",
  ].filter(Boolean);
  return { subject, html: wrap(kind === "paid" ? "You're in" : "Your spot is held", parts) };
};

/** To the coach for a new family sign-up. */
export const campCoachEmail = (input: {
  kind: "paid" | "held";
  camp: CampEmailCamp;
  parentName: string | null;
  parentEmail: string | null;
  athletes: CampEmailAthlete[];
  registrationsUrl: string;
}) => {
  const n = input.athletes.length;
  const who = n === 1 ? "1 athlete" : `${n} athletes`;
  const subject =
    input.kind === "paid"
      ? `${who} signed up for ${input.camp.name}`
      : `${who} waiting for payment: ${input.camp.name}`;
  const parts = [
    `<p>${e(input.parentName ?? "A family")}${input.parentEmail ? ` (${e(input.parentEmail)})` : ""} ${
      input.kind === "paid" ? "signed up and paid in the app." : "signed up and will pay you directly. Mark it paid once they have."
    }</p>`,
    athleteList(input.athletes),
    button(input.registrationsUrl, "See registrations"),
  ];
  return { subject, html: wrap("New camp sign-up", parts) };
};

/** "Finish your account" (Resend link from the coach's registrations). */
export const campFinishAccountEmail = (input: { camp: CampEmailCamp; athleteFirstName: string; finishUrl: string }) => ({
  subject: `Finish your AthaNext account for ${input.camp.name}`,
  html: wrap("Finish your account", [
    `<p>${e(input.athleteFirstName)} has a spot at <strong>${e(input.camp.name)}</strong> with ${e(input.camp.coach_name)}.</p>`,
    ...campLines(input.camp),
    `<p>Finish your account in one step to see the camp on your schedule. Your spot doesn't depend on it.</p>`,
    button(input.finishUrl, "Finish your account"),
  ]),
});

/** Camp details for an athlete the coach added (paid outside or not paid yet). */
export const campDetailsEmail = (input: {
  camp: CampEmailCamp;
  parentName: string | null;
  athlete: CampEmailAthlete;
  status: string;
  finishUrl: string | null;
}) => ({
  subject: `${input.athlete.first_name} is signed up for ${input.camp.name}`,
  html: wrap("Camp details", [
    `<p>${input.parentName ? `Hi ${e(input.parentName.split(" ")[0])}, ` : ""}${e(input.camp.coach_name)} added ${e(
      input.athlete.first_name,
    )} to <strong>${e(input.camp.name)}</strong>.${input.status === "paid" ? "" : ` Pay ${e(input.camp.coach_name)} directly to confirm the spot.`}</p>`,
    athleteList([input.athlete]),
    ...campLines(input.camp),
    includedList(input.camp.included),
    input.finishUrl ? button(input.finishUrl, "Finish your account") : "",
  ].filter(Boolean)),
});

/** To the coach when a camp card payment was fully refunded or disputed: the spots are free again. */
export const campReversedEmail = (input: {
  status: "refunded" | "disputed";
  camp: CampEmailCamp;
  parentName: string | null;
  parentEmail: string | null;
  athletes: CampEmailAthlete[];
  registrationsUrl: string;
}) => {
  const what = input.status === "refunded" ? "was refunded" : "is disputed with the card issuer";
  return {
    subject: `${input.status === "refunded" ? "Refunded" : "Disputed"}: ${input.camp.name} sign-up`,
    html: wrap(input.status === "refunded" ? "Camp payment refunded" : "Camp payment disputed", [
      `<p>The card payment from ${e(input.parentName ?? "a family")}${input.parentEmail ? ` (${e(input.parentEmail)})` : ""} ${e(what)}. These athletes no longer hold a spot, and the payout for them is cancelled.</p>`,
      athleteList(input.athletes),
      button(input.registrationsUrl, "See registrations"),
    ]),
  };
};
