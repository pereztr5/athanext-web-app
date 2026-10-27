// What send-email will send for callers that aren't the service role. Pure, so it is tested.
//
// The service role (our own functions) sends any to/subject/html, as before. Everyone else
// (the anon key, a signed-in user) only picks a kind and fills in fields; the recipient,
// subject and HTML are built here and every field is escaped:
//   { kind: "contact", name, email, phone?, topic, message }
//       -> to support@ (Reply-To the visitor) + a short "we got your message" to the visitor
//   { kind: "partnership", name, organization, email, message }
//       -> to support@ (Reply-To the visitor) + the same short note to the visitor
//   { kind: "parent_invite", email, sport?, position?, level?, pillars?, age?, zip? }
//       -> "finish your athlete's account" to the parent, with a link to sign-up

import { SUPPORT_EMAIL } from "./email_sender.ts";
import { EMAIL_MUTED, emailButton, emailShell } from "./email_shell.ts";

export const PUBLIC_EMAIL_KINDS = ["contact", "partnership", "parent_invite"] as const;
export type PublicEmailKind = typeof PUBLIC_EMAIL_KINDS[number];

/** Per device (hashed IP) and per email address, for every public kind. */
export const PUBLIC_EMAIL_RATE_LIMITS = {
  perIp: 5,
  ipWindowMinutes: 10,
  perEmail: 3,
  emailWindowMinutes: 60,
} as const;

export const CONFIRMATION_TEXT = "Thanks, we got your message and will reply within one business day.";

export interface OutgoingEmail {
  to: string;
  from: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
}

export type PublicEmailResult =
  | { ok: true; kind: PublicEmailKind; rateEmail: string; emails: OutgoingEmail[] }
  | { ok: false; status: 400 | 403; error: string; fields?: Record<string, string> };

export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** A plain address, lowercased; "" when it isn't one. No names, no brackets, no line breaks. */
export const validEmail = (value: unknown): string => {
  if (typeof value !== "string") return "";
  const address = value.trim().toLowerCase();
  if (address.length > 254) return "";
  return /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(address) ? address : "";
};

/** Header-safe one line: line breaks and control characters become spaces. */
// deno-lint-ignore no-control-regex
const oneLine = (value: string) => value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();

/** The JWT's role claim, or "" when the token isn't a readable JWT. */
export const jwtRole = (token: string): string => {
  const part = token.split(".")[1];
  if (!part) return "";
  try {
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)));
    return typeof payload?.role === "string" ? payload.role : "";
  } catch {
    return "";
  }
};

/**
 * True for our own functions: the bearer is the service role key, or a JWT whose role is
 * service_role. verify_jwt is on for send-email, so the gateway has already checked the
 * signature before the claim is read here.
 */
export const isServiceCaller = (authorization: string | null | undefined, serviceKey: string | null | undefined) => {
  const match = /^Bearer\s+(\S+)$/i.exec((authorization ?? "").trim());
  if (!match) return false;
  const token = match[1];
  if (serviceKey && token === serviceKey) return true;
  return jwtRole(token) === "service_role";
};

type Fields = Record<string, string>;

/** A trimmed string field; records an error when it is missing (if required) or too long. */
const text = (body: Record<string, unknown>, key: string, label: string, max: number, required: boolean, errors: Fields) => {
  const raw = body[key];
  if (raw !== undefined && raw !== null && typeof raw !== "string") {
    errors[key] = `${label} must be text`;
    return "";
  }
  const value = (raw ?? "").trim();
  if (required && !value) errors[key] = `Add ${label.toLowerCase()}`;
  else if (value.length > max) errors[key] = `Keep ${label.toLowerCase()} under ${max} characters`;
  return value;
};

const emailField = (body: Record<string, unknown>, key: string, errors: Fields) => {
  const address = validEmail(body[key]);
  if (!address) errors[key] = "Enter a valid email";
  return address;
};

/** Short pick from the sign-up questions: letters, digits and a few joiners only, so no links. */
const pick = (value: unknown, max = 40): string =>
  typeof value === "string"
    ? value.replace(/[^\p{L}\p{N} &'+\-/(),]/gu, "").replace(/\s+/g, " ").trim().slice(0, max)
    : "";

const row = (label: string, value: string) =>
  `<tr><td style="padding:4px 12px 4px 0;color:${EMAIL_MUTED};vertical-align:top"><strong>${escapeHtml(label)}</strong></td>` +
  `<td style="padding:4px 0;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`;

/** A form submission for support, in the cream shell; replying answers the visitor. */
const supportNote = (title: string, intro: string, lines: [string, string][], name: string) =>
  emailShell(
    title,
    [`<p>${escapeHtml(intro)}</p>`, `<table role="presentation" style="border-collapse:collapse;">${lines.map(([l, v]) => row(l, v)).join("")}</table>`],
    `<p style="color:${EMAIL_MUTED};font-size:13px;margin:24px 0 0;">Reply to this email to answer ${escapeHtml(name)}.</p>`,
  );

const confirmation = (to: string, from: string, supportEmail: string): OutgoingEmail => ({
  to,
  from,
  replyTo: supportEmail,
  subject: "We got your message",
  html: emailShell("We got your message", [`<p>${escapeHtml(CONFIRMATION_TEXT)}</p>`]),
  text: `${CONFIRMATION_TEXT}\n\nAthaNext`,
});

export interface PublicEmailOptions {
  /** Where contact and partnership messages go (SUPPORT_EMAIL env). */
  supportEmail: string;
  /** The From line, e.g. "AthaNext <support@athanext.com>". */
  from: string;
  /** App origin for links. */
  origin: string;
}

const fail = (fields: Fields): PublicEmailResult => ({
  ok: false,
  status: 400,
  error: Object.values(fields)[0] ?? "Check the form",
  fields,
});

export const buildPublicEmails = (input: unknown, options: PublicEmailOptions): PublicEmailResult => {
  const body = (input && typeof input === "object" && !Array.isArray(input) ? input : {}) as Record<string, unknown>;
  const kind = body.kind;
  if (typeof kind !== "string" || !(PUBLIC_EMAIL_KINDS as readonly string[]).includes(kind)) {
    return { ok: false, status: 403, error: "Not allowed" };
  }
  const supportEmail = validEmail(options.supportEmail) || SUPPORT_EMAIL;
  const errors: Fields = {};

  if (kind === "contact") {
    const name = text(body, "name", "Name", 100, true, errors);
    const email = emailField(body, "email", errors);
    const phone = text(body, "phone", "Phone", 40, false, errors);
    if (phone && !/^[0-9+().\-\s]+$/.test(phone)) errors.phone = "Enter a valid phone number";
    const topic = text(body, "topic", "Topic", 200, true, errors);
    const message = text(body, "message", "Message", 5000, true, errors);
    if (Object.keys(errors).length) return fail(errors);

    const lines: [string, string][] = [["Name", name], ["Email", email], ["Phone", phone], ["Topic", topic], ["Message", message]];
    const shown = lines.filter(([, v]) => v);
    return {
      ok: true,
      kind,
      rateEmail: email,
      emails: [
        {
          to: supportEmail,
          from: options.from,
          replyTo: email,
          subject: `Contact form: ${oneLine(topic)}`,
          html: supportNote("Contact form", "New message from the contact form.", shown, name),
          text: shown.map(([l, v]) => `${l}: ${v}`).join("\n"),
        },
        confirmation(email, options.from, supportEmail),
      ],
    };
  }

  if (kind === "partnership") {
    const name = text(body, "name", "Name", 100, true, errors);
    const organization = text(body, "organization", "Organization", 100, true, errors);
    const email = emailField(body, "email", errors);
    const message = text(body, "message", "Message", 5000, true, errors);
    if (Object.keys(errors).length) return fail(errors);

    const lines: [string, string][] = [["Name", name], ["Organization", organization], ["Email", email], ["Message", message]];
    return {
      ok: true,
      kind,
      rateEmail: email,
      emails: [
        {
          to: supportEmail,
          from: options.from,
          replyTo: email,
          subject: `Partnership inquiry: ${oneLine(organization)}`,
          html: supportNote("Partnership inquiry", "New partnership inquiry.", lines, name),
          text: lines.map(([l, v]) => `${l}: ${v}`).join("\n"),
        },
        confirmation(email, options.from, supportEmail),
      ],
    };
  }

  // parent_invite
  const email = emailField(body, "email", errors);
  if (Object.keys(errors).length) return fail(errors);
  const pillars = Array.isArray(body.pillars) ? body.pillars.slice(0, 3).map((p) => pick(p)).filter(Boolean) : [];
  const age = pick(body.age, 10);
  const zip = pick(body.zip, 10);
  const summary = [
    pick(body.sport),
    pick(body.position),
    pick(body.level),
    pillars.join(", "),
    age.toLowerCase() === "u9" ? "Under 9" : /^\d{1,2}$/.test(age) ? `Age ${age}` : "",
    /^[A-Za-z0-9 -]{3,10}$/.test(zip) ? `ZIP ${zip}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const link = `${options.origin}/auth?mode=signup`;
  return {
    ok: true,
    kind: "parent_invite",
    rateEmail: email,
    emails: [
      {
        to: email,
        from: options.from,
        replyTo: supportEmail,
        subject: "Finish your athlete's AthaNext account",
        html: emailShell("Finish your athlete's account", [
          `<p>Your athlete started signing up for AthaNext and needs a parent or guardian to finish the account.</p>`,
          `<p><strong>What they chose:</strong> ${escapeHtml(summary || "Their preferences are ready.")}</p>`,
          emailButton(link, "Create the parent account"),
          `<p>Then you can see coach matches and manage bookings.</p>`,
        ]),
        text: `Your athlete started signing up for AthaNext. Open ${link} to finish as a parent.`,
      },
    ],
  };
};
