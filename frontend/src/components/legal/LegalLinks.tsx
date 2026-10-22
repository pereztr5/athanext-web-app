/**
 * Shared legal links (WC4 #22): Terms and Privacy open the in-app overlay.
 * Stripe Connect stays on stripe.com. Coach terms open the in-app /coach-terms page.
 */
import { ExternalLink, Scale } from "@/components/icons";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getPrivacyPolicyContent } from "@/api/privacy-policy";
import { getTermsAndConditionsContent } from "@/api/terms";
import { openLegalDoc, type LegalDoc } from "@/components/legal/LegalOverlay";
import { Card, sub } from "@/components/settings/CoachSettings";
import { meta } from "@/components/schedule/styles";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { STRIPE_CONNECT_AGREEMENT } from "@/utils/offlinePay";
import { formatDayISO } from "@/utils/schedule";

export type LegalKind = "terms" | "privacy" | "coach" | "stripe";

const LABELS: Record<LegalKind, { label: string; detail: string }> = {
  terms: { label: "Terms of service", detail: "Using AthaNext, bookings and payments" },
  privacy: { label: "Privacy policy", detail: "What we collect and how we protect it" },
  coach: { label: "Coach terms", detail: "Coaching on AthaNext, fees, payouts and verification" },
  stripe: { label: "Stripe Connected Account Agreement", detail: "Payouts are handled by Stripe" },
};

const openKind = (kind: LegalKind) => {
  if (kind === "stripe") {
    window.open(STRIPE_CONNECT_AGREEMENT, "_blank", "noopener,noreferrer");
    return;
  }
  if (kind === "coach") {
    window.open(ROUTES.COACH_TERMS, "_blank", "noopener,noreferrer");
    return;
  }
  openLegalDoc(kind as LegalDoc);
};

export const LegalAnchor = ({
  kind,
  children,
  className,
}: {
  kind: LegalKind;
  children?: string;
  className?: string;
}) => {
  const text = children ?? LABELS[kind].label;
  if (kind === "stripe") {
    return (
      <a
        href={STRIPE_CONNECT_AGREEMENT}
        target="_blank"
        rel="noopener noreferrer"
        className={cn("underline underline-offset-2 hover:text-primary", className)}
      >
        {text}
      </a>
    );
  }
  if (kind === "coach") {
    // New tab so an in-progress form (payout setup) keeps its state.
    return (
      <Link
        to={ROUTES.COACH_TERMS}
        target="_blank"
        rel="noopener noreferrer"
        className={cn("underline underline-offset-2 hover:text-primary", className)}
      >
        {text}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={cn("underline underline-offset-2 hover:text-primary", className)}
      onClick={() => openKind(kind)}
    >
      {text}
    </button>
  );
};

/** Compact footer for sign-in / sign-up: "Terms of Service · Privacy Policy". */
export const LegalAuthFooter = ({ className }: { className?: string }) => (
  <p className={cn("text-center text-caption text-dark-300", className)}>
    <LegalAnchor kind="terms" className="text-dark-300 no-underline hover:underline" />
    {" · "}
    <LegalAnchor kind="privacy" className="text-dark-300 no-underline hover:underline" />
  </p>
);

export const LegalCard = ({ role, compact = false }: { role: "coach" | "athlete"; compact?: boolean }) => {
  const { userProfile } = useAuth();
  const terms = useQuery({ queryKey: ["legal-terms"], queryFn: async () => (await getTermsAndConditionsContent()).data });
  const privacy = useQuery({ queryKey: ["legal-privacy"], queryFn: async () => (await getPrivacyPolicyContent()).data });
  const kinds: LegalKind[] = role === "coach" ? ["terms", "privacy", "coach", "stripe"] : ["terms", "privacy"];

  const acceptance = (kind: LegalKind) => {
    if (kind === "terms") {
      const at = (userProfile as { terms_accepted_at?: string | null } | null)?.terms_accepted_at;
      const v = terms.data?.version ?? (userProfile as { terms_version?: string | null } | null)?.terms_version;
      const updatedRaw = terms.data?.last_updated ?? "";
      const updated = /^\d{4}-\d{2}-\d{2}/.test(updatedRaw) ? updatedRaw.slice(0, 10) : null;
      return [
        v != null ? `Version ${v}` : null,
        updated ? `Updated ${formatDayISO(updated, { month: "short", day: "numeric", year: "numeric" })}` : null,
        at ? `You accepted ${formatDayISO(at.slice(0, 10), { month: "short", day: "numeric", year: "numeric" })}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
    }
    if (kind === "privacy") {
      const at = (userProfile as { privacy_accepted_at?: string | null } | null)?.privacy_accepted_at;
      const v = privacy.data?.version ?? (userProfile as { privacy_version?: string | null } | null)?.privacy_version;
      const updatedRaw = privacy.data?.policy?.last_updated ?? "";
      const updated = /^\d{4}-\d{2}-\d{2}/.test(updatedRaw) ? updatedRaw.slice(0, 10) : null;
      return [
        v != null ? `Version ${v}` : null,
        updated ? `Updated ${formatDayISO(updated, { month: "short", day: "numeric", year: "numeric" })}` : null,
        at ? `You accepted ${formatDayISO(at.slice(0, 10), { month: "short", day: "numeric", year: "numeric" })}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
    }
    return LABELS[kind].detail;
  };

  return (
    <Card icon={<Scale className="size-5 text-dark-300" strokeWidth={1.5} />} title="Legal">
      {compact ? null : <p className={sub}>The agreements that cover your AthaNext account.</p>}
      <div className="flex flex-col gap-1">
        {kinds.map((kind) => {
          // Stripe and Coach terms open in a new tab, so the settings page keeps its place.
          const external = kind === "stripe" || kind === "coach";
          return (
            <button
              key={kind}
              type="button"
              className="flex w-full items-center gap-3 rounded-control px-3 py-3 text-left hover:bg-light-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              onClick={() => openKind(kind)}
            >
              <span className="flex min-w-0 grow flex-col gap-1">
                <span className="text-label-sm text-dark">{LABELS[kind].label}</span>
                {compact ? null : <span className={meta}>{acceptance(kind) || LABELS[kind].detail}</span>}
              </span>
              {external ? <ExternalLink className="size-4 flex-none text-dark-300" strokeWidth={1.5} aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
    </Card>
  );
};

/** Line under the Pay button on checkout. */
export const CheckoutTermsLine = ({ className }: { className?: string }) => (
  <span className={cn(meta, "text-center", className)}>
    By paying you agree to the <LegalAnchor kind="terms" /> and the coach&apos;s cancellation policy.
  </span>
);
