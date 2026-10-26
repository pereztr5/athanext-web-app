import { supabase } from "@/integrations/supabase/client";
import type { FeeBreakdown } from "@/utils/fees";

/**
 * Public camp page and sign-up without an account (camp-signup edge function, get_camp_page).
 * Coach-side camp calls live in ./camps.ts.
 *
 * Flow: page() -> quote() on the review step -> signup()
 *   card:   redirect to `url` (Stripe Checkout). Stripe returns to
 *           /camps/<coach>/<camp>?signup=<id>&session_id=... (or &canceled=1), which redirects to
 *           the camp page /<coach>/<camp> with the same query; call status().
 *   direct: spot held 7 days, status "held" (Waiting for the coach).
 * Camps carry no platform fee for anyone: card adds card processing only, and "pay the coach
 * directly" is offered to every family when the camp allows it. `src: "link"` (the coach's
 * shared link, ?src=link) is still passed along to tell the coach where the family came from.
 */

type LooseError = { code?: string; message?: string };
type Loose = { data: unknown; error: LooseError | null };

const db = supabase as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => Promise<Loose> };

export type CampPageGroup = {
  id: string;
  name: string;
  description: string | null;
  start_time: string;
  end_time: string;
  spots: number;
  spots_left: number;
  /** "Fully booked". */
  full: boolean;
};

export type CampPage = {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  /** The camp's cover, else the coach's photo (cover_is_coach_photo). */
  cover_url: string | null;
  cover_is_coach_photo: boolean;
  price_cents: number;
  days: number;
  per_day_cents: number;
  starts_on: string;
  ends_on: string;
  location: string | null;
  included: string[];
  age_min: number | null;
  age_max: number | null;
  /** The camp lets families pay the coach directly (quote().direct_allowed decides). */
  pay_direct: boolean;
  /** The coach's camp waiver (https PDF or page), or null. */
  waiver_url?: string | null;
  /** False once the camp has ended. */
  open: boolean;
  spots_left: number | null;
  coach: {
    id: string;
    name: string;
    slug: string | null;
    photo_url: string | null;
    bio: string | null;
    years_experience: number | null;
    rating: number | null;
    total_reviews: number | null;
    cancellation_policy: string | null;
  };
  linked_coach: { id: string; name: string; slug: string | null; photo_url: string | null } | null;
  groups: CampPageGroup[];
};

/** The camp price and the card total (camp price plus card processing; no platform fee on camps). */
export type CampQuote = {
  camp_id: string;
  price_cents: number;
  source: "link" | "marketplace";
  athletes: number;
  /** Always true: camps have no platform fee. */
  platform_waived: boolean;
  /** Offer "Paying in cash?" (the camp allows paying the coach directly). */
  direct_allowed: boolean;
  /** Card total for `athletes` athletes: what Checkout charges. */
  card: FeeBreakdown;
};

export type CampSignupAthlete = {
  first_name: string;
  last_name: string;
  birth_year: number;
  group_id: string;
  note?: string;
};

export type CampSignupInput = {
  campId: string;
  src: "link" | null;
  payMethod: "card" | "direct";
  parent: { name: string; email: string; phone?: string | null };
  /** "Only <coach> sees this". */
  note?: string | null;
  waiver: boolean;
  photoConsent: boolean;
  athletes: CampSignupAthlete[];
};

export type CampSignupResult =
  | {
      status: "pending_payment";
      signup_id: string;
      /** Stripe Checkout. The spots are held until expires_at. */
      url: string;
      session_id: string;
      expires_at: string;
      /** Always true: camps have no platform fee. */
      platform_waived: boolean;
      /** What Checkout charges. */
      fees: FeeBreakdown;
    }
  | {
      status: "held";
      signup_id: string;
      hold_expires_at: string;
      athletes: Array<{ id: string; first_name: string; last_name: string; group_name: string | null; start_time: string | null; end_time: string | null }>;
    };

export type CampSignupStatus = {
  signup_id: string;
  pay_method: "card" | "direct";
  parent_email: string;
  /** False: show "Finish your account" with parent_email filled in. */
  account_exists: boolean;
  camp: {
    id: string;
    name: string;
    starts_on: string | null;
    ends_on: string | null;
    location: string | null;
    slug: string | null;
    included: string[];
    coach_name: string;
    coach_slug: string | null;
  };
  athletes: Array<{
    id: string;
    first_name: string;
    status: "pending_payment" | "held" | "paid" | "cancelled" | "expired";
    group_name: string | null;
    start_time: string | null;
    end_time: string | null;
  }>;
  all_paid: boolean;
  /** Card payment not confirmed yet: poll status() for a few seconds. */
  any_pending: boolean;
};

/** Form errors keyed like the form: "parent.name", "athletes.0.birth_year", "waiver"... */
export class CampSignupError extends Error {
  code: string | null;
  status: number;
  fields: Record<string, string>;
  constructor(message: string, status: number, code: string | null, fields: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

const invoke = async <T>(body: Record<string, unknown>, fallback: string): Promise<T> => {
  const { data, error } = await supabase.functions.invoke("camp-signup", { body });
  if (error) {
    const context = (error as { context?: Response }).context;
    let parsed: { error?: string; code?: string; fields?: Record<string, string> } = {};
    if (context && typeof context.clone === "function") {
      try {
        parsed = (await context.clone().json()) as typeof parsed;
      } catch {
        // body already read
      }
    }
    throw new CampSignupError(parsed.error || fallback, context?.status ?? 500, parsed.code ?? null, parsed.fields ?? {});
  }
  return data as T;
};

export const campSignupAPI = {
  /** Null when the camp is not published, not active, or the link is wrong. */
  async page(coachSlug: string, campSlug: string): Promise<CampPage | null> {
    const { data, error } = await db.rpc("get_camp_page", { p_coach_slug: coachSlug, p_camp_slug: campSlug });
    if (error) throw new CampSignupError(error.message || "Could not open this camp.", 500, error.code ?? null);
    return (data as CampPage | null) ?? null;
  },

  /** Review step: card total for this link and whether "Paying in cash?" is offered. */
  quote(input: { campId: string; src: "link" | null; athletes: number }) {
    return invoke<CampQuote>(
      { action: "quote", camp_id: input.campId, src: input.src, athletes: input.athletes },
      "Could not load the price.",
    );
  },

  signup(input: CampSignupInput) {
    return invoke<CampSignupResult>(
      {
        action: "signup",
        camp_id: input.campId,
        src: input.src,
        pay_method: input.payMethod,
        parent: { name: input.parent.name, email: input.parent.email, phone: input.parent.phone ?? "" },
        note: input.note ?? "",
        waiver: input.waiver,
        photo_consent: input.photoConsent,
        athletes: input.athletes,
      },
      "Could not save your spot. Try again.",
    );
  },

  /** "You're in" page. Confirms a fresh card payment with Stripe when the webhook is late. */
  status(signupId: string, sessionId?: string | null) {
    return invoke<CampSignupStatus>(
      {
        action: "status",
        signup_id: signupId,
        ...(sessionId ? { session_id: sessionId } : {}),
      },
      "Could not load your sign-up.",
    );
  },
};
