/**
 * Tapping a camp day on My schedule: which day of the camp it is, the group and how full it is,
 * who is on the roster (each held or paid registration with an athlete is booked into every day of
 * its group), the session page for attendance and feedback, the sign-up link to copy, and the way
 * to Registrations. Camp days aren't booked one by one.
 */
import { Link } from "react-router-dom";
import { Link as LinkIcon, MapPin, Users } from "@/components/icons";
import type { ScheduleSession } from "@/api/schedule";
import { BrandPill } from "@/components/brand";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { dialogContent, meta, primaryButton, secondaryButton } from "@/components/schedule/styles";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { getZonedISODate } from "@/utils/dateHelpers";
import { bookedAthletes, formatDayISO, sessionEnd, sessionStart } from "@/utils/schedule";
import { formatSessionSpan, sessionDisplayZone } from "@/utils/viewerTime";
import { campShareUrl } from "@/utils/camps";

export const CampDaySheet = ({
  session,
  coachSlug,
  timeZone,
  onClose,
}: {
  session: ScheduleSession & { camp: NonNullable<ScheduleSession["camp"]> };
  coachSlug: string | null;
  timeZone: string;
  onClose: () => void;
}) => {
  const { toast } = useToast();
  const camp = session.camp;
  const start = sessionStart(session);
  const end = sessionEnd(session);
  const day = formatDayISO(getZonedISODate(start, sessionDisplayZone(timeZone, true)), { weekday: "short", month: "short", day: "numeric" });
  const where = session.location === "online" ? "Video call" : session.place || "In person";
  const link = coachSlug && camp.slug ? campShareUrl(window.location.origin, coachSlug, camp.slug) : null;
  const signed = camp.signedUp ?? 0;
  const spots = camp.groupSpots ?? session.capacity;
  const roster = bookedAthletes(session);

  const copy = () => {
    if (!link) return;
    void navigator.clipboard
      .writeText(link)
      .then(() =>
        toast({
          title: "Sign-up link copied",
          description: "No account needed to sign up. Families who sign up become your clients.",
        }),
      )
      .catch(() => toast({ title: "Couldn't copy", description: link }));
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={dialogContent}>
        <div className="flex flex-col gap-1.5 px-5 pb-3 pt-5 pr-14 sm:px-[25px]">
          <BrandPill tone="teal" className="self-start">
            Camp
          </BrandPill>
          <DialogTitle className="text-section">
            Day {camp.dayIndex} of {camp.name}
          </DialogTitle>
          <DialogDescription className={meta}>
            {day} · {formatSessionSpan(start, end, timeZone, true)} · {plural(camp.daysTotal)}
          </DialogDescription>
        </div>
        <div className="flex flex-col gap-4 px-5 pb-5 sm:px-[25px]">
          <div className="flex flex-col gap-2.5 rounded-control border border-light-525 bg-light px-3 py-2.5">
            <span className="flex items-center gap-2 text-body-m">
              <Users className="size-4 flex-none text-dark-300" strokeWidth={1.5} aria-hidden="true" />
              <span>
                <b className="font-medium">{camp.groupName ?? "All athletes"}</b> · {signed} of {spots} signed up
              </span>
            </span>
            <span className="flex items-center gap-2 text-body-m">
              <MapPin className="size-4 flex-none text-dark-300" strokeWidth={1.5} aria-hidden="true" />
              {where}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-label-sm text-dark">{roster.length === 1 ? "1 athlete on the roster" : `${roster.length} athletes on the roster`}</span>
            {roster.length ? <span className={meta}>{roster.map((b) => b.athleteName || "Athlete").join(", ")}</span> : null}
            {signed > roster.length ? (
              <span className={meta}>Athletes signed up without an account join the roster once their family signs in.</span>
            ) : null}
          </div>
          <p className={meta}>Families sign up for the whole camp, not day by day. Everyone in this group is expected every day.</p>
          <div className="flex flex-wrap gap-2.5">
            {link ? (
              <button type="button" className={primaryButton} onClick={copy}>
                <LinkIcon strokeWidth={1.5} aria-hidden="true" />
                Copy sign-up link
              </button>
            ) : null}
            {roster.length ? (
              <Link to={`/sessions/${session.id}`} className={secondaryButton} onClick={onClose}>
                Open session
              </Link>
            ) : null}
            <Link to={`${ROUTES.CAMPS}?camp=${camp.id}&view=registrations`} className={cn(secondaryButton)} onClick={onClose}>
              Registrations
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const plural = (days: number) => (days === 1 ? "one-day camp" : `${days}-day camp`);
