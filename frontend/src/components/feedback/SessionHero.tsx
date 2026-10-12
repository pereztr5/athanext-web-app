/**
 * Session card at the top of check-in (Working Copy `.fbh`).
 * Shares SessionHeader with the coach session page.
 */
import { BrandPill } from "@/components/brand";
import type { FeedbackScreen } from "@/api/feedback";
import { SessionHeader, type SessionHeaderModel } from "@/components/session/SessionHeader";
import { families, firstName } from "./helpers";

export const feedbackToHeader = (screen: FeedbackScreen): SessionHeaderModel => {
  const group = screen.sessionType === "group";
  const a0 = screen.athletes[0];
  const adult = a0?.age != null && a0.age >= 18;
  return {
    title: group ? screen.sessionName : a0 ? `1-on-1 with ${firstName(a0.name)}` : screen.sessionName,
    sessionType: screen.sessionType,
    pillar: screen.pillar,
    date: screen.date,
    startTime: screen.startTime,
    endTime: screen.endTime,
    location: screen.location,
    place: screen.place,
    statusPills: screen.submitted ? <BrandPill tone="green">Feedback sent</BrandPill> : <BrandPill tone="amber">Feedback due</BrandPill>,
    people: screen.athletes.map((a) => ({
      name: a.name,
      imageUrl: a.imageUrl,
      line: [a.age, a.position, adult && a === a0 ? "Athlete, 18+" : null].filter((x) => x != null && x !== "").join(" · ") || null,
    })),
    peopleLabel: group ? `${screen.athletes.length} ${screen.athletes.length === 1 ? "athlete" : "athletes"} · ${families(screen.athletes.length)}` : undefined,
  };
};

export const SessionHero = ({ screen, timeZone }: { screen: FeedbackScreen; timeZone: string }) => (
  <SessionHeader session={feedbackToHeader(screen)} timeZone={timeZone} />
);
