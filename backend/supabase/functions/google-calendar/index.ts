// Google Calendar for coaches (ATH-71): connect, sync busy times, disconnect.
// Only free/busy is read (calendar.freebusy scope), never event details. Busy times are
// stored in coach_busy_blocks and hide overlapping open sessions from families.
// ATH-85: accepted bookings are added as events (calendar.events.owned, which only reaches
// calendars the coach owns). Events are marked free so they don't block the coach's own slots.
//
// GET  /google-calendar/callback      Google's OAuth redirect (no JWT).
// POST { action: "connect_url", origin }   -> { url }       coach only
// POST { action: "sync", coach_id? }       -> { synced }    own calendar, or any coach's (throttled)
// POST { action: "disconnect" }            -> { ok }        coach only
// POST { action: "add_event", booking_id } -> { added, reason? } coach only
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/google-calendar/callback`;
const EVENTS_SCOPE = "https://www.googleapis.com/auth/calendar.events.owned";
const SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar.freebusy", EVENTS_SCOPE];
const STATE_TTL_MS = 15 * 60 * 1000;
// A family opening a coach's page refreshes that coach's busy times at most this often.
const SYNC_THROTTLE_MS = 15 * 60 * 1000;
const DEFAULT_SITE_URL = Deno.env.get("SITE_URL") ?? "https://athanext-staging.vercel.app";

// Where the callback may send the coach back to. Never an arbitrary caller-supplied origin.
const allowedOrigin = (origin: string | null | undefined): string => {
  if (!origin) return DEFAULT_SITE_URL;
  try {
    const url = new URL(origin);
    const host = url.hostname;
    if (host === "localhost" || host === "127.0.0.1") return url.origin;
    if (host === "athanext.com" || host.endsWith(".athanext.com")) return url.origin;
    if (host === "athanext-staging.vercel.app") return url.origin;
  } catch {
    // fall through
  }
  return DEFAULT_SITE_URL;
};

// ---------- Signed OAuth state ----------

const encoder = new TextEncoder();
const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (value: string) => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
};

const hmac = async (data: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(CLIENT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(data))));
};

type OAuthState = { coachId: string; origin: string; at: number };

const signState = async (state: OAuthState) => {
  const payload = b64url(encoder.encode(JSON.stringify(state)));
  return `${payload}.${await hmac(payload)}`;
};

const readState = async (raw: string | null): Promise<OAuthState | null> => {
  if (!raw) return null;
  const [payload, signature] = raw.split(".");
  if (!payload || !signature || (await hmac(payload)) !== signature) return null;
  try {
    const state = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as OAuthState;
    if (!state.coachId || Date.now() - state.at > STATE_TTL_MS) return null;
    return state;
  } catch {
    return null;
  }
};

// ---------- Google ----------

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  id_token?: string;
  scope?: string;
  error?: string;
};

const tokenRequest = async (params: Record<string, string>): Promise<TokenResponse> => {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...params }),
  });
  return (await res.json()) as TokenResponse;
};

// The id_token comes straight from Google's token endpoint over TLS, so its claims are read as-is.
const emailFromIdToken = (idToken?: string): string | null => {
  if (!idToken) return null;
  try {
    const claims = JSON.parse(new TextDecoder().decode(fromB64url(idToken.split(".")[1])));
    return typeof claims.email === "string" ? claims.email : null;
  } catch {
    return null;
  }
};

type Connection = {
  coach_id: string;
  refresh_token: string;
  access_token: string | null;
  access_token_expires_at: string | null;
  last_synced_at: string | null;
};

const accessTokenFor = async (admin: SupabaseClient, conn: Connection): Promise<string> => {
  const expiresAt = conn.access_token_expires_at ? Date.parse(conn.access_token_expires_at) : 0;
  if (conn.access_token && expiresAt - Date.now() > 60_000) return conn.access_token;

  const token = await tokenRequest({ grant_type: "refresh_token", refresh_token: conn.refresh_token });
  if (!token.access_token) {
    throw new Error(token.error === "invalid_grant" ? "reconnect" : "Google didn't return an access token");
  }
  await admin
    .from("coach_calendar_connections")
    .update({
      access_token: token.access_token,
      access_token_expires_at: new Date(Date.now() + (token.expires_in ?? 3600) * 1000).toISOString(),
    })
    .eq("coach_id", conn.coach_id);
  return token.access_token;
};

// Replaces the coach's busy blocks with Google's free/busy for now..booking window.
const syncCoach = async (admin: SupabaseClient, coachId: string): Promise<boolean> => {
  const { data: conn } = await admin
    .from("coach_calendar_connections")
    .select("coach_id, refresh_token, access_token, access_token_expires_at, last_synced_at")
    .eq("coach_id", coachId)
    .maybeSingle();
  if (!conn) return false;

  const { data: coach } = await admin.from("coaches").select("booking_window_weeks").eq("id", coachId).maybeSingle();
  const weeks = Math.min(Math.max(Number(coach?.booking_window_weeks) || 4, 1), 12);
  const timeMin = new Date();
  const timeMax = new Date(timeMin.getTime() + (weeks * 7 + 1) * 24 * 60 * 60 * 1000);

  try {
    const accessToken = await accessTokenFor(admin, conn as Connection);
    const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(), items: [{ id: "primary" }] }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || `Google returned ${res.status}`);
    const busy: { start: string; end: string }[] = body?.calendars?.primary?.busy ?? [];

    const { error: delErr } = await admin.from("coach_busy_blocks").delete().eq("coach_id", coachId);
    if (delErr) throw delErr;
    if (busy.length) {
      const { error: insErr } = await admin.from("coach_busy_blocks").insert(
        busy.map((b) => ({ coach_id: coachId, starts_at: b.start, ends_at: b.end, source: "google" })),
      );
      if (insErr) throw insErr;
    }
    await admin
      .from("coach_calendar_connections")
      .update({ last_synced_at: new Date().toISOString(), sync_error: null })
      .eq("coach_id", coachId);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Calendar sync failed for coach ${coachId}:`, message);
    await admin
      .from("coach_calendar_connections")
      .update({ last_synced_at: new Date().toISOString(), sync_error: message.slice(0, 300) })
      .eq("coach_id", coachId);
    return false;
  }
};

// ---------- Handlers ----------

const handleCallback = async (url: URL, admin: SupabaseClient) => {
  const state = await readState(url.searchParams.get("state"));
  const origin = allowedOrigin(state?.origin);
  const back = (result: string) =>
    new Response(null, { status: 302, headers: { Location: `${origin}/schedule?calendar=${result}` } });

  const code = url.searchParams.get("code");
  if (!state || !code) return back(url.searchParams.get("error") === "access_denied" ? "cancelled" : "error");

  const token = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI });
  if (!token.access_token) {
    console.error("Token exchange failed:", token.error);
    return back("error");
  }

  const { data: existing } = await admin
    .from("coach_calendar_connections")
    .select("refresh_token")
    .eq("coach_id", state.coachId)
    .maybeSingle();
  const refreshToken = token.refresh_token ?? existing?.refresh_token;
  if (!refreshToken) return back("error");

  const { error } = await admin.from("coach_calendar_connections").upsert({
    coach_id: state.coachId,
    provider: "google",
    account_email: emailFromIdToken(token.id_token),
    refresh_token: refreshToken,
    access_token: token.access_token,
    access_token_expires_at: new Date(Date.now() + (token.expires_in ?? 3600) * 1000).toISOString(),
    sync_error: null,
    can_write: (token.scope ?? "").split(" ").includes(EVENTS_SCOPE),
    connected_at: new Date().toISOString(),
  });
  if (error) {
    console.error("Saving the connection failed:", error.message);
    return back("error");
  }
  await syncCoach(admin, state.coachId);
  return back("connected");
};

const callerCoachId = async (req: Request, admin: SupabaseClient) => {
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (!token) return { userId: null, coachId: null };
  const { data } = await admin.auth.getUser(token);
  const userId = data.user?.id ?? null;
  if (!userId) return { userId: null, coachId: null };
  const { data: profile } = await admin.from("user_profiles").select("coach_id").eq("id", userId).maybeSingle();
  return { userId, coachId: (profile?.coach_id as string | null) ?? null };
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/callback")) {
    return handleCallback(url, admin);
  }
  if (req.method !== "POST") return json({ error: "Not found" }, 404);
  if (!CLIENT_ID || !CLIENT_SECRET) return json({ error: "Google Calendar isn't set up yet" }, 503);

  const { userId, coachId } = await callerCoachId(req, admin);
  if (!userId) return json({ error: "Sign in first" }, 401);

  let body: { action?: string; origin?: string; coach_id?: string; booking_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request" }, 400);
  }

  if (body.action === "connect_url") {
    if (!coachId) return json({ error: "Only coaches can connect a calendar" }, 403);
    const state = await signState({ coachId, origin: allowedOrigin(body.origin), at: Date.now() });
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: SCOPES.join(" "),
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
    });
    return json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
  }

  if (body.action === "sync") {
    const target = body.coach_id || coachId;
    if (!target) return json({ synced: false });
    if (target !== coachId) {
      const { data: conn } = await admin
        .from("coach_calendar_connections")
        .select("last_synced_at")
        .eq("coach_id", target)
        .maybeSingle();
      if (!conn) return json({ synced: false });
      if (conn.last_synced_at && Date.now() - Date.parse(conn.last_synced_at) < SYNC_THROTTLE_MS) {
        return json({ synced: false, fresh: true });
      }
    }
    return json({ synced: await syncCoach(admin, target) });
  }

  if (body.action === "disconnect") {
    if (!coachId) return json({ error: "Only coaches can disconnect a calendar" }, 403);
    const { data: conn } = await admin
      .from("coach_calendar_connections")
      .select("refresh_token")
      .eq("coach_id", coachId)
      .maybeSingle();
    if (conn?.refresh_token) {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(conn.refresh_token)}`, {
        method: "POST",
      }).catch(() => undefined);
    }
    await admin.from("coach_busy_blocks").delete().eq("coach_id", coachId);
    await admin.from("coach_calendar_connections").delete().eq("coach_id", coachId);
    return json({ ok: true });
  }

  if (body.action === "add_event") {
    if (!coachId) return json({ error: "Only coaches can add events" }, 403);
    if (!body.booking_id) return json({ error: "booking_id is required" }, 400);
    return json(await addEvent(admin, coachId, body.booking_id));
  }

  return json({ error: "Unknown action" }, 400);
});

// Adds one of the coach's bookings to their primary calendar, once.
const addEvent = async (
  admin: SupabaseClient,
  coachId: string,
  bookingId: string,
): Promise<{ added: boolean; reason?: string }> => {
  const { data: booking } = await admin
    .from("coach_slot_bookings")
    .select("id, status, google_event_id, athlete_id, occurrence_id")
    .eq("id", bookingId)
    .eq("coach_id", coachId)
    .maybeSingle();
  if (!booking) return { added: false, reason: "not_found" };
  if (booking.google_event_id) return { added: true };
  if (!["pending_payment", "booked"].includes(booking.status)) return { added: false, reason: "not_confirmed" };

  const { data: conn } = await admin
    .from("coach_calendar_connections")
    .select("coach_id, refresh_token, access_token, access_token_expires_at, last_synced_at, can_write")
    .eq("coach_id", coachId)
    .maybeSingle();
  if (!conn) return { added: false, reason: "not_connected" };
  if (!conn.can_write) return { added: false, reason: "reconnect" };

  const [{ data: occ }, { data: athlete }] = await Promise.all([
    admin
      .from("coach_availability_slot_occurrences")
      .select("occurrence_date, start_time, end_time, session_name, session_type, place, location")
      .eq("id", booking.occurrence_id)
      .maybeSingle(),
    admin.from("athlete_profiles").select("full_name").eq("id", booking.athlete_id).maybeSingle(),
  ]);
  if (!occ) return { added: false, reason: "not_found" };

  const who = athlete?.full_name || "an athlete";
  const what = occ.session_type === "group" ? occ.session_name || "Group session" : "1-on-1";
  try {
    const accessToken = await accessTokenFor(admin, conn as Connection);
    const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: `${what} with ${who}`,
        location: occ.location === "online" ? "Video call" : occ.place || undefined,
        description: "Booked on AthaNext.",
        // Session times are stored on the Eastern clock.
        start: { dateTime: `${occ.occurrence_date}T${occ.start_time}`, timeZone: "America/New_York" },
        end: { dateTime: `${occ.occurrence_date}T${occ.end_time}`, timeZone: "America/New_York" },
        transparency: "transparent",
      }),
    });
    const event = await res.json();
    if (!res.ok) {
      if (res.status === 403) {
        await admin.from("coach_calendar_connections").update({ can_write: false }).eq("coach_id", coachId);
        return { added: false, reason: "reconnect" };
      }
      throw new Error(event?.error?.message || `Google returned ${res.status}`);
    }
    await admin.from("coach_slot_bookings").update({ google_event_id: event.id }).eq("id", booking.id);
    return { added: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Adding event failed for booking ${bookingId}:`, message);
    return { added: false, reason: message === "reconnect" ? "reconnect" : "error" };
  }
};
