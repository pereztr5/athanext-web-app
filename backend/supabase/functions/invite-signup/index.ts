// Sign-up from a coach's invite (sign-up redesign, Oct 31): the invite link went to the family's
// email, so opening it proves the email. No 6-digit code for them.
//   { action: "lookup", token }  -> { email, parent_name, athlete_first, coach_name, sport }
//   { action: "create", token, password, phone }
//        -> { created: true }: the account exists with the email confirmed; the app signs in
//           with the password. 409 when an account already uses the email (sign in instead).
// Only invites a coach sent (not athlete-initiated), still open and not expired, qualify. Anyone
// with the link could create the account, which is the same as anyone with the inbox.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const TOKEN = /^[A-Za-z0-9_-]{8,128}$/;
const E164 = /^\+[1-9]\d{6,14}$/;
// Same rule as the app (usePasswordValidation): 8+ characters, upper and lower case, a number, a symbol.
const strongPassword = (pw: string) =>
  pw.length >= 8 && pw.length <= 72 && /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /\d/.test(pw) && /[^A-Za-z0-9]/.test(pw);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body?.token ?? "");
    if (!TOKEN.test(token)) return json({ error: "This invite link isn't valid" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: invite } = await admin
      .from("coach_client_referrals")
      .select("id, coach_id, client_email, client_name, athlete_first_name, status, expires_at, initiated_by, athlete_id")
      .eq("invite_token", token)
      .maybeSingle();
    const open =
      invite &&
      invite.initiated_by !== "athlete" &&
      ["invited", "pending_confirmation"].includes(invite.status) &&
      !invite.athlete_id &&
      (!invite.expires_at || new Date(invite.expires_at) > new Date());
    if (!open) return json({ error: "This invite has expired or was already used" }, 410);
    const email = String(invite.client_email ?? "").trim().toLowerCase();
    if (!email) return json({ error: "This invite has no email" }, 410);

    if (body?.action === "lookup") {
      const [{ data: coach }, { data: coachAccount }] = await Promise.all([
        admin.from("coaches").select("name").eq("id", invite.coach_id).maybeSingle(),
        admin.from("user_profiles").select("sport").eq("coach_id", invite.coach_id).limit(1).maybeSingle(),
      ]);
      const sport = String(coachAccount?.sport ?? "").toLowerCase();
      return json({
        email,
        parent_name: invite.client_name ?? "",
        athlete_first: invite.athlete_first_name ?? "",
        coach_name: coach?.name ?? "",
        sport: sport === "rowing" ? "Rowing" : sport === "soccer" ? "Soccer" : null,
      });
    }

    if (body?.action !== "create") return json({ error: "Unknown action" }, 400);
    const password = String(body?.password ?? "");
    const phone = String(body?.phone ?? "").trim();
    if (!strongPassword(password)) return json({ error: "Choose a stronger password" }, 400);
    if (phone && !E164.test(phone)) return json({ error: "Add a phone number with the country code" }, 400);

    const name = String(invite.client_name ?? "").trim();
    const { error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        persona_type: invite.athlete_first_name ? "parent" : "athlete",
        phone_number: phone || undefined,
        password_pending: false,
      },
    });
    if (error) {
      const taken = /already|registered|exists/i.test(error.message);
      return json(
        { error: taken ? "An account already uses this email. Sign in instead." : "Couldn't create the account. Try again." },
        taken ? 409 : 500,
      );
    }
    return json({ created: true });
  } catch (error) {
    console.error("invite-signup failed", error);
    return json({ error: "Couldn't create the account. Try again." }, 500);
  }
});
