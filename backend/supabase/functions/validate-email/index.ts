import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const AUTHENTIC_EMAIL_MESSAGE = "Please use a real, non-temporary email address.";

const normalizeEmail = (email: unknown): string => {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
};

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "10minutemail.com",
  "10minutemail.net",
  "10minutemail.org",
  "dispostable.com",
  "getairmail.com",
  "getnada.com",
  "guerrillamail.com",
  "guerrillamail.de",
  "guerrillamail.net",
  "guerrillamail.org",
  "inboxkitten.com",
  "maildrop.cc",
  "mailinator.com",
  "mailinator.net",
  "mailinator.org",
  "mailnesia.com",
  "mailpoof.com",
  "mail.tm",
  "mintemail.com",
  "moakt.cc",
  "mohmal.com",
  "mytemp.email",
  "sharklasers.com",
  "spamgourmet.com",
  "spambog.com",
  "spambox.org",
  "tempmail.com",
  "tempmail.net",
  "temp-mail.org",
  "tempr.email",
  "throwawaymail.com",
  "trashmail.com",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
]);

const DISPOSABLE_EMAIL_KEYWORDS = [
  "10minutemail",
  "disposablemail",
  "guerrillamail",
  "mailinator",
  "mailtemp",
  "moakt",
  "sharklasers",
  "tempmail",
  "throwaway",
  "trashmail",
  "yopmail",
];

const PLACEHOLDER_EMAIL_DOMAINS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "example.edu",
  "test.com",
  "test.org",
  "test.net",
  "invalid",
  "invalid.com",
  "localhost",
  "localdomain",
  "dummy.com",
  "fake.com",
  "sample.com",
]);

const PLACEHOLDER_EMAIL_LOCAL_PARTS = [
  "abc",
  "asdf",
  "demo",
  "dummy",
  "email",
  "fake",
  "noreply",
  "no-reply",
  "noemail",
  "none",
  "notreal",
  "null",
  "placeholder",
  "qwerty",
  "sample",
  "temp",
  "test",
  "tester",
  "testing",
  "throwaway",
];

const isValidEmailFormat = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
};

const isDisposableEmail = (email: string): boolean => {
  const [, domain = ""] = email.split("@");
  if (!domain) return false;

  if (DISPOSABLE_EMAIL_DOMAINS.has(domain) || [...DISPOSABLE_EMAIL_DOMAINS].some((d) => domain.endsWith(`.${d}`))) {
    return true;
  }

  return DISPOSABLE_EMAIL_KEYWORDS.some((keyword) => domain.includes(keyword));
};

const isPlaceholderEmail = (email: string): boolean => {
  const [local = "", domain = ""] = email.split("@");
  if (!local || !domain) return false;

  const normalizedLocal = local.replace(/[._-]/g, "");
  const localWithoutDigits = normalizedLocal.replace(/\d+/g, "");

  if (
    domain.endsWith(".invalid") ||
    domain.endsWith(".test") ||
    PLACEHOLDER_EMAIL_DOMAINS.has(domain) ||
    [...PLACEHOLDER_EMAIL_DOMAINS].some((d) => domain.endsWith(`.${d}`))
  ) {
    return true;
  }

  return PLACEHOLDER_EMAIL_LOCAL_PARTS.some(
    (placeholder) => normalizedLocal === placeholder || localWithoutDigits === placeholder,
  );
};

const isAuthenticEmail = (email: string): boolean => {
  if (!isValidEmailFormat(email)) return false;
  return !isDisposableEmail(email) && !isPlaceholderEmail(email);
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !isValidEmailFormat(normalizedEmail)) {
      return new Response(JSON.stringify({ valid: false, message: AUTHENTIC_EMAIL_MESSAGE }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isAuthenticEmail(normalizedEmail)) {
      return new Response(JSON.stringify({ valid: false, message: AUTHENTIC_EMAIL_MESSAGE }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ valid: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("validate-email error", error);
    return new Response(JSON.stringify({ valid: false, message: "Unable to validate email" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
