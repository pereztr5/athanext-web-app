/**
 * Free intro call row on the coach profile (Working Copy `AN.introRow`). own: the coach's
 * settings with Edit, or the off state with Turn on. family: Pick a time, or the booked call.
 * Renders nothing while loading or if the intro call functions aren't available.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Video } from "@/components/icons";
import { BrandPill } from "@/components/brand";
import { introCallsAPI } from "@/api/introCalls";
import { primaryButton, secondaryButton, smallButton, textButton } from "@/components/schedule/styles";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { INTRO_KEYS, introWhen } from "./helpers";
import { IntroBookingDialog } from "./IntroBookingDialog";
import { IntroSettingsDialog } from "./IntroSettingsDialog";
import { IntroRow } from "./parts";

type Props = { coachId: string; mode: "own" | "family"; coachFirstName: string };

const formatText = (format: "video" | "phone") => (format === "phone" ? "Phone call" : "Video call");

const OwnIntroCallCard = ({ coachFirstName }: { coachFirstName: string }) => {
  const [sheet, setSheet] = useState<"edit" | "turnOn" | null>(null);
  const query = useQuery({ queryKey: INTRO_KEYS.settings, queryFn: () => introCallsAPI.mySettings(), retry: false });
  const it = query.data;
  if (!it) return null;

  return (
    <>
      {it.enabled ? (
        <IntroRow
          title={`Free ${it.minutes}-min intro call`}
          caption={`Meet ${coachFirstName} before you book. ${formatText(it.format)}.`}
          action={
            <button type="button" className={cn(textButton, "h-[30px]")} onClick={() => setSheet("edit")}>
              Edit
            </button>
          }
        />
      ) : (
        <IntroRow
          off
          title="Free intro call is off"
          caption="Let families meet you before they book"
          action={
            <button type="button" className={cn(secondaryButton, smallButton)} onClick={() => setSheet("turnOn")}>
              Turn on
            </button>
          }
        />
      )}
      <IntroSettingsDialog open={sheet !== null} turnOn={sheet === "turnOn"} onClose={() => setSheet(null)} />
    </>
  );
};

const FamilyIntroCallCard = ({ coachId, coachFirstName }: { coachId: string; coachFirstName: string }) => {
  const timeZone = useViewerTimeZone();
  const [booking, setBooking] = useState(false);
  const query = useQuery({ queryKey: INTRO_KEYS.coach(coachId), queryFn: () => introCallsAPI.forCoach(coachId), retry: false });
  const intro = query.data;
  // Hidden when it's off, on the coach's own profile, and for families who already train with them.
  if (!intro?.enabled || intro.reason === "own" || intro.reason === "client") return null;

  const title = `Free ${intro.minutes}-min intro call`;
  const caption = `Meet ${coachFirstName} before you book. ${formatText(intro.format)}. A parent joins the call.`;
  const booked = intro.booked;
  let row = null;
  if (booked) {
    const start = new Date(booked.startsAt).getTime();
    const now = Date.now();
    const joinable = Boolean(booked.videoUrl) && now >= start - 10 * 60 * 1000 && now < start + booked.minutes * 60 * 1000;
    const how = intro.format === "phone" ? `${coachFirstName} calls you at the time.` : "Join from here at the time.";
    // After the call (offer sent or closed) the row goes away.
    row =
      booked.status === "booked" ? (
        <IntroRow
          title={title}
          caption={`Booked for ${introWhen(booked.startsAt, timeZone)}. ${how}`}
          action={
            joinable ? (
              <a href={booked.videoUrl!} target="_blank" rel="noopener noreferrer" className={cn(primaryButton, smallButton)}>
                <Video strokeWidth={1.5} aria-hidden="true" />
                Join
              </a>
            ) : (
              <BrandPill tone="green">Booked</BrandPill>
            )
          }
        />
      ) : null;
  } else if (intro.reason === "signin") {
    row = (
      <IntroRow
        title={title}
        caption={caption}
        action={
          <Link to={ROUTES.AUTH} className={cn(secondaryButton, smallButton)}>
            Sign in to book
          </Link>
        }
      />
    );
  } else if (intro.reason === "noAthlete") {
    row = <IntroRow title={title} caption={`${caption} Add your athlete to your account to book it.`} />;
  } else {
    row = (
      <IntroRow
        title={title}
        caption={caption}
        action={
          <button type="button" className={cn(secondaryButton, smallButton)} onClick={() => setBooking(true)}>
            Pick a time
          </button>
        }
      />
    );
  }

  // The sheet stays mounted so its "Intro call booked" step survives the refetch after booking.
  return (
    <>
      {row}
      <IntroBookingDialog open={booking} coachId={coachId} coachName={coachFirstName} intro={intro} onClose={() => setBooking(false)} />
    </>
  );
};

export const CoachIntroCallCard = ({ coachId, mode, coachFirstName }: Props) =>
  mode === "own" ? <OwnIntroCallCard coachFirstName={coachFirstName} /> : <FamilyIntroCallCard coachId={coachId} coachFirstName={coachFirstName} />;
