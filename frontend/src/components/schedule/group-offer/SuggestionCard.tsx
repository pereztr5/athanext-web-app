/**
 * Intro-call follow-up in chat ("For Casey's first session I'd suggest: …"): the coach suggests a
 * session type or package, with no session picked yet. Families book it from here.
 */
import { Link } from "react-router-dom";
import { BrandPill } from "@/components/brand";
import { cardFoot, cardHead, cardShell } from "@/components/schedule/group-offer/parts";
import { meta, primaryButton } from "@/components/schedule/styles";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import type { GroupOffer } from "@/api/schedule";
import { coachPricingPath } from "@/utils/coachSlug";
import { formatDateInZone } from "@/utils/viewerTime";

export const SuggestionCard = ({ offer, isOwner, className }: { offer: GroupOffer; isOwner: boolean; className?: string }) => {
  const timeZone = useViewerTimeZone();
  const s = offer.suggestion;
  if (!s) return null;
  const first = offer.coachName.split(" ")[0] || "Coach";
  const until = s.expiresAt ? formatDateInZone(new Date(s.expiresAt), timeZone, { month: "short", day: "numeric" }) : null;
  const expired = offer.closed;
  // A package opens the coach's prices; a 1-on-1 opens booking with this coach.
  const href = s.key.startsWith("p:")
    ? coachPricingPath(offer.coachSlug || offer.coachId)
    : `${ROUTES.BOOK}?coach=${offer.coachId}`;
  return (
    <div className={cn(cardShell, className)}>
      <div className={cardHead}>
        <div className="flex items-center justify-between gap-3">
          <b className="text-subtitle">{isOwner ? "Your first-session suggestion" : `${first} suggests a first session`}</b>
          {expired ? <BrandPill tone="neutral">Expired</BrandPill> : <BrandPill tone="green">Open</BrandPill>}
        </div>
        <span className={meta}>{expired ? "This suggestion has expired." : until ? `Good until ${until}` : "Good for 7 days"}</span>
      </div>
      <div className="px-4 py-3">
        <b className="break-words text-label-sm">{s.label}</b>
      </div>
      {!isOwner && !expired ? (
        <div className={cardFoot}>
          <Link to={href} className={cn(primaryButton, "h-10 w-full")}>
            {s.key.startsWith("p:") ? "See the package" : `Book with ${first}`}
          </Link>
        </div>
      ) : null}
    </div>
  );
};
