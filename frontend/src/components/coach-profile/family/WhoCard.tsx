import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, CalendarPlus, MessageCircle } from "@/components/icons";
import { primaryButton, secondaryButton } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";
import { CoachProfileCard } from "../CoachProfileCard";
import { Stars } from "./Stars";
import { caption, cardGap, initialsOf, plural } from "./styles";

export interface WhoCardProps {
  name: string;
  photoUrl?: string | null;
  verified?: boolean;
  role: string;
  city: string;
  academy?: { name: string; to: string } | null;
  rating: number;
  totalReviews: number;
  showRating: boolean;
  onReviews: () => void;
  /** Null hides Book (coaches viewing another coach). */
  onBook: (() => void) | null;
  bookLabel: string;
  onMessage?: () => void;
  messaging?: boolean;
  facts: [string, string][];
  /** The free intro call row, under Book and Message. */
  intro?: ReactNode;
}

/** Who (Working Copy `.sp2-who`, `.sp2-cta`, `.sp2-facts`): avatar, name, rating, Book and Message, facts. */
export const WhoCard = ({
  name,
  photoUrl,
  verified,
  role,
  city,
  academy,
  rating,
  totalReviews,
  showRating,
  onReviews,
  onBook,
  bookLabel,
  onMessage,
  messaging,
  facts,
  intro,
}: WhoCardProps) => {
  const ctas = [onBook ? "book" : null, onMessage ? "message" : null].filter(Boolean);
  return (
    <CoachProfileCard className={cardGap} aria-label="Coach">
      <div className="flex items-center gap-4">
        <span className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-light-550 bg-primary-50 text-section text-primary md:size-[76px]">
          {photoUrl ? <img src={photoUrl} alt="" className="absolute inset-0 size-full object-cover" /> : initialsOf(name)}
        </span>
        <div className="flex min-w-0 flex-col gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <h1 className="text-page-title-phone text-dark">{name}</h1>
            {verified ? <BadgeCheck className="size-5 shrink-0 text-primary" strokeWidth={1.5} aria-label="Verified" /> : null}
          </span>
          <span className={caption}>
            {[role, city].filter(Boolean).join(" · ")}
            {academy ? (
              <>
                {" · "}
                <Link to={academy.to} className="font-medium text-primary hover:text-primary-600">
                  {academy.name}
                </Link>
              </>
            ) : null}
          </span>
          {showRating ? (
            <span className="flex items-center gap-1.5">
              <Stars value={rating} size={13} />
              <b className="text-label-sm text-dark">{rating.toFixed(1)}</b>
              <button type="button" onClick={onReviews} className="text-caption text-dark-300 hover:text-dark rounded-pill focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                {plural(totalReviews, "review")}
              </button>
            </span>
          ) : totalReviews > 0 ? (
            <button type="button" onClick={onReviews} className={cn(caption, "self-start hover:text-dark")}>
              {plural(totalReviews, "review")}
            </button>
          ) : (
            <span className={caption}>No reviews yet</span>
          )}
        </div>
      </div>

      {ctas.length ? (
        <div className={cn("grid gap-2", ctas.length === 2 ? "grid-cols-2" : "grid-cols-1")}>
          {onBook ? (
            <button type="button" onClick={onBook} className={cn(primaryButton, "min-w-0 px-3")}>
              <CalendarPlus strokeWidth={1.5} aria-hidden="true" />
              <span className="truncate">{bookLabel}</span>
            </button>
          ) : null}
          {onMessage ? (
            <button type="button" onClick={onMessage} disabled={messaging} className={cn(secondaryButton, "min-w-0 px-3")}>
              <MessageCircle strokeWidth={1.5} aria-hidden="true" />
              Message
            </button>
          ) : null}
        </div>
      ) : null}

      {intro}

      {facts.length ? (
        <div className="grid grid-cols-2 gap-y-[14px] border-t border-light-525 pt-4 md:grid-cols-4 md:gap-y-0">
          {facts.map(([label, value], i) => (
            <div
              key={label}
              className={cn(
                "flex min-w-0 flex-col gap-1.5 pr-2.5",
                i > 0 && "border-l border-light-525 pl-[14px]",
                // Phone 2x2: the third fact starts a row, so no divider.
                i === 2 && "max-md:border-l-0 max-md:pl-0"
              )}
            >
              <span className={caption}>{label}</span>
              <span className="text-label-sm text-dark">{value}</span>
            </div>
          ))}
        </div>
      ) : null}
    </CoachProfileCard>
  );
};
