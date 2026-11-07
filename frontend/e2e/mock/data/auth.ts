import type { Page, Route } from "@playwright/test";
import { MOCK_SUPABASE_URL, MockError, mockId, type FunctionHandler, type MockBackend, type MockUser, type RpcHandler } from "../backend";
import { IDS, coachRow } from "../personas";

// Fixtures for the sign-in, sign-up and password flows (e2e/mock/auth.spec.ts).

export const TERMS_VERSION = "2026-10-01";
export const PRIVACY_VERSION = "2026-09-15";
export const STRONG_PASSWORD = "Fresh-Start-42";

/** Published Terms and Privacy rows, so sign-up records real versions (legalAcceptanceFields). */
export const seedLegal = (backend: MockBackend) => {
  backend.seed("terms_and_conditions", [
    {
      id: mockId(),
      title: "Terms and Conditions",
      content: "<p>Be kind.</p>",
      version: TERMS_VERSION,
      is_active: true,
      last_updated: TERMS_VERSION,
      created_at: "2026-10-01T00:00:00Z",
      updated_at: "2026-10-01T00:00:00Z",
    },
  ]);
  backend.seed("privacy_policy", [
    {
      id: mockId(),
      title: "Privacy Policy",
      content: "<p>We keep it safe.</p>",
      is_published: true,
      last_updated: PRIVACY_VERSION,
      created_at: "2026-09-15T00:00:00Z",
      updated_at: "2026-09-15T00:00:00Z",
    },
  ]);
};

export const SOCCER_PILLARS = [
  { id: "00000000-0000-4000-8000-00000000a001", title: "On-field training" },
  { id: "00000000-0000-4000-8000-00000000a002", title: "Video analysis" },
  { id: "00000000-0000-4000-8000-00000000a003", title: "Mentorship" },
];

/** sport_pillars rows for soccer (the sign-up pillar step and the coach's pillar links). */
export const seedPillars = (backend: MockBackend) => {
  backend.seed(
    "sport_pillars",
    SOCCER_PILLARS.map((p, i) => ({ ...p, sport: "soccer", description: null, created_at: `2025-01-0${i + 1}T00:00:00Z` }))
  );
};

/** Everything a sign-up touches: legal versions, pillars and the email check. */
export const seedSignup = (backend: MockBackend) => {
  seedLegal(backend);
  seedPillars(backend);
  backend.functions["validate-email"] = { valid: true };
};

const fulfillJson = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) });

/**
 * Real GoTrue answers for sign-up and the 6-digit code. The shared mock answers sign-up with
 * `identities: []` (which the app reads as "this email already has an account") and answers
 * every verify with the first seeded user, so these are modelled here: a new user gets one
 * email identity, and verify signs in the user the email belongs to and confirms them.
 * Writes are still recorded in backend.writes.
 */
export const installSignupAuth = async (page: Page, backend: MockBackend) => {
  const record = (route: Route, name: string, body: unknown) =>
    backend.writes.push({ method: route.request().method(), kind: "auth", name, url: route.request().url(), body });

  await page.route(`${MOCK_SUPABASE_URL}/auth/v1/signup*`, async (route) => {
    if (route.request().method() === "OPTIONS") return route.fallback();
    const body = (route.request().postDataJSON() ?? {}) as { email?: string; password?: string; data?: Record<string, unknown> };
    record(route, "signup", body);
    const email = String(body.email ?? "").toLowerCase();
    if (backend.users.some((u) => u.email.toLowerCase() === email)) {
      return fulfillJson(route, 422, { code: 422, error_code: "user_already_exists", msg: "User already registered" });
    }
    const user = backend.addUser({ id: mockId(), email, password: String(body.password ?? ""), user_metadata: body.data ?? {}, email_confirmed_at: null });
    const authUser = backend.authUser(user);
    return fulfillJson(route, 200, {
      ...authUser,
      identities: [{ id: user.id, user_id: user.id, provider: "email", identity_data: { email, sub: user.id }, created_at: authUser.created_at }],
      confirmation_sent_at: new Date().toISOString(),
    });
  });

  await page.route(`${MOCK_SUPABASE_URL}/auth/v1/verify*`, async (route) => {
    if (route.request().method() === "OPTIONS") return route.fallback();
    const body = (route.request().postDataJSON() ?? {}) as { email?: string; token?: string; token_hash?: string; type?: string };
    record(route, "verify", body);
    const user: MockUser | undefined = body.email ? backend.users.find((u) => u.email.toLowerCase() === String(body.email).toLowerCase()) : undefined;
    if (!user || body.token === "000000") {
      return fulfillJson(route, 403, { code: 403, error_code: "otp_expired", msg: "Token has expired or is invalid" });
    }
    user.email_confirmed_at = new Date().toISOString();
    return fulfillJson(route, 200, backend.sessionFor(user));
  });
};

/** Answers the next password sign-in with GoTrue's "Email not confirmed". */
export const failSignInUnconfirmed = async (page: Page) => {
  await page.route(`${MOCK_SUPABASE_URL}/auth/v1/token?grant_type=password`, (route) =>
    route.request().method() === "OPTIONS"
      ? route.fallback()
      : fulfillJson(route, 400, { code: 400, error_code: "email_not_confirmed", msg: "Email not confirmed" })
  );
};

/** The hash a password-recovery email link opens /reset-password with (implicit flow). */
export const recoveryHash = (backend: MockBackend, user: MockUser) => {
  const session = backend.sessionFor(user);
  const params = new URLSearchParams({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: String(session.expires_in),
    expires_at: String(session.expires_at),
    token_type: "bearer",
    type: "recovery",
  });
  return `#${params.toString()}`;
};

// ---------- Coach invites (/invite/:token) ----------

export const INVITE_TOKEN = "11111111-2222-4333-8444-555555555555";
export const DEAD_TOKEN = "99999999-2222-4333-8444-555555555555";

export type ReferralInviteRow = {
  coach_id: string;
  coach_name: string;
  coach_slug: string | null;
  client_name: string | null;
  masked_email: string;
  state: "valid" | "expired" | "used";
  email_matches: boolean;
  is_athlete: boolean;
};

/** A row of get_referral_invite (returns table, so the RPC answers a list). */
export const referralInvite = (overrides: Partial<ReferralInviteRow> = {}): ReferralInviteRow => ({
  coach_id: IDS.coach,
  coach_name: coachRow.name,
  coach_slug: IDS.coachSlug,
  client_name: "Jamie",
  masked_email: "j***@family.test",
  state: "valid",
  email_matches: false,
  is_athlete: false,
  ...overrides,
});

export const INVITED_EMAIL = "jamie@family.test";

/**
 * get_referral_invite for INVITE_TOKEN (an unknown token returns no rows, like the SQL), with
 * email_matches and is_athlete worked out for the caller as the SQL does. And the invite-signup
 * function's lookup / create (src/api/inviteSignup.ts, backend/supabase/functions/invite-signup).
 */
export const seedInvite = (backend: MockBackend, row: Partial<ReferralInviteRow> = {}) => {
  const lookup: RpcHandler = (args, { backend: b, user }) => {
    if (args._token !== INVITE_TOKEN) return [];
    const profile = user ? b.table("user_profiles").find((p) => p.id === user.id) : undefined;
    return [
      referralInvite({
        email_matches: user?.email.toLowerCase() === INVITED_EMAIL,
        is_athlete: Boolean(profile?.athlete_id),
        ...row,
      }),
    ];
  };
  backend.rpc.get_referral_invite = lookup;
  const inviteSignup: FunctionHandler = (body, { backend: b }) => {
    const req = (body ?? {}) as { action?: string; token?: string; password?: string };
    if (req.token !== INVITE_TOKEN) return new MockError("This invite has expired or was already used", 410);
    if (req.action === "lookup") {
      return { email: INVITED_EMAIL, parent_name: "Jamie Rivera", athlete_first: "", coach_name: coachRow.name, sport: "Soccer" };
    }
    if (req.action === "create") {
      b.addUser({ id: mockId(), email: INVITED_EMAIL, password: String(req.password ?? ""), user_metadata: { name: "Jamie Rivera" } });
      return { created: true };
    }
    return new MockError("Unknown action", 400);
  };
  backend.functions["invite-signup"] = inviteSignup;
};
