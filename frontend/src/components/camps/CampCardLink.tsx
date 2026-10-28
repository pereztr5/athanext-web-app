/**
 * Makes a whole camp card open the camp: the camp name is a link whose hit area stretches over
 * the card (put `relative` on the card). Buttons inside the card sit above it with
 * `campCardActions`, so they keep their own action. Enter and Space open it; the focus ring
 * outlines the whole card.
 */
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

/** Put on the card's buttons (or their row) so they stay clickable above the card link. */
export const campCardActions = "relative z-10";

/** Hover feedback for a card that opens on click. */
export const campCardHover = "transition-colors hover:border-light-600";

export const CampCardLink = ({
  to,
  onOpen,
  label,
  radius = "after:rounded-control",
  className,
  children,
}: {
  /** The camp page. Without it the card calls onOpen instead (a camp with no link yet). */
  to?: string | null;
  onOpen?: () => void;
  /** Accessible name when the visible text alone isn't enough. */
  label?: string;
  /** Matches the card's corner radius, e.g. after:rounded-card. */
  radius?: string;
  className?: string;
  children: ReactNode;
}) => {
  const navigate = useNavigate();
  const stretched = cn(
    "text-left outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-primary",
    radius,
    className,
  );
  if (to) {
    return (
      <Link
        to={to}
        aria-label={label}
        className={stretched}
        onKeyDown={(e) => {
          if (e.key !== " ") return;
          e.preventDefault();
          navigate(to);
        }}
      >
        {children}
      </Link>
    );
  }
  if (!onOpen) return <span className={className}>{children}</span>;
  return (
    <button type="button" aria-label={label} className={stretched} onClick={onOpen}>
      {children}
    </button>
  );
};
