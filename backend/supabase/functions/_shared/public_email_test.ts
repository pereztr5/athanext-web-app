import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import {
  buildPublicEmails,
  CONFIRMATION_TEXT,
  escapeHtml,
  isServiceCaller,
  jwtRole,
  validEmail,
} from "./public_email.ts";
import { EMAIL_CREAM } from "./email_shell.ts";

const b64url = (value: unknown) =>
  btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const jwt = (payload: unknown) => `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.sig`;

const options = { supportEmail: "support@athanext.com", from: "AthaNext <support@athanext.com>", origin: "https://app.athanext.com" };

Deno.test("caller role: only the service role is a service caller", () => {
  assertEquals(jwtRole(jwt({ role: "anon" })), "anon");
  assertEquals(jwtRole("not-a-jwt"), "");
  assertEquals(jwtRole("a.%%%.c"), "");
  assert(isServiceCaller(`Bearer ${jwt({ role: "service_role" })}`, "other"));
  assert(isServiceCaller("Bearer sb_secret_abc", "sb_secret_abc"));
  assert(!isServiceCaller(`Bearer ${jwt({ role: "anon" })}`, "sb_secret_abc"));
  assert(!isServiceCaller(`Bearer ${jwt({ role: "authenticated", sub: "u1" })}`, "sb_secret_abc"));
  assert(!isServiceCaller(null, "sb_secret_abc"));
  assert(!isServiceCaller("Bearer ", ""));
  assert(!isServiceCaller("Basic sb_secret_abc", "sb_secret_abc"));
});

Deno.test("escapeHtml and validEmail", () => {
  assertEquals(escapeHtml(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  assertEquals(validEmail(" Pat@Example.COM "), "pat@example.com");
  assertEquals(validEmail("Pat <pat@example.com>"), "");
  assertEquals(validEmail("pat@example.com\nBcc: x@y.com"), "");
  assertEquals(validEmail("nope"), "");
  assertEquals(validEmail(42), "");
});

Deno.test("unknown or missing kind is refused (403)", () => {
  for (const body of [null, {}, { kind: "raw" }, { to: "x@y.com", subject: "s", html: "<b>hi</b>" }, []]) {
    const r = buildPublicEmails(body, options);
    assertEquals(r.ok, false);
    if (!r.ok) assertEquals(r.status, 403);
  }
});

Deno.test("contact goes to support with escaped fields, Reply-To the visitor, plus a confirmation", () => {
  const r = buildPublicEmails(
    {
      kind: "contact",
      name: "Pat <script>",
      email: "Pat@Example.com",
      phone: "+1 555 123 4567",
      topic: "Billing\r\nBcc: evil@x.com",
      message: `<img src=x onerror="alert(1)">`,
      // ignored: callers can't pick these
      to: "victim@example.com",
      subject: "Win",
      html: "<h1>spam</h1>",
    },
    options,
  );
  assert(r.ok);
  if (!r.ok) return;
  assertEquals(r.kind, "contact");
  assertEquals(r.rateEmail, "pat@example.com");
  assertEquals(r.emails.length, 2);
  const [admin, visitor] = r.emails;
  assertEquals(admin.to, "support@athanext.com");
  assertEquals(admin.replyTo, "pat@example.com");
  assertEquals(admin.subject, "Contact form: Billing Bcc: evil@x.com");
  assert(!admin.html.includes("<script>"));
  assert(!admin.html.includes("<img"));
  assertStringIncludes(admin.html, "Pat &lt;script&gt;");
  assertStringIncludes(admin.html, "+1 555 123 4567");
  assert(!admin.html.includes("spam"));
  assertEquals(visitor.to, "pat@example.com");
  assertEquals(visitor.replyTo, "support@athanext.com");
  assertStringIncludes(visitor.text, CONFIRMATION_TEXT);
  assert(!visitor.html.includes("onerror"));
});

Deno.test("contact uses SUPPORT_EMAIL and validates lengths, email and phone", () => {
  const custom = buildPublicEmails(
    { kind: "contact", name: "Pat", email: "pat@example.com", topic: "Hi", message: "Hello" },
    { ...options, supportEmail: "help@athanext.com" },
  );
  assert(custom.ok && custom.emails[0].to === "help@athanext.com");

  const r = buildPublicEmails(
    { kind: "contact", name: "x".repeat(101), email: "bad", phone: "call me", topic: "", message: "m".repeat(5001) },
    options,
  );
  assertEquals(r.ok, false);
  if (r.ok) return;
  assertEquals(r.status, 400);
  assertEquals(Object.keys(r.fields ?? {}).sort(), ["email", "message", "name", "phone", "topic"]);

  const ok = buildPublicEmails(
    { kind: "contact", name: "x".repeat(100), email: "pat@example.com", topic: "t", message: "m".repeat(5000) },
    options,
  );
  assert(ok.ok);

  const wrongType = buildPublicEmails({ kind: "contact", name: ["Pat"], email: "pat@example.com", topic: "t", message: "m" }, options);
  assert(!wrongType.ok && wrongType.fields?.name);
});

Deno.test("partnership goes to support with the organization in the subject", () => {
  const r = buildPublicEmails(
    { kind: "partnership", name: "Sam", organization: "Club <FC>", email: "sam@club.org", message: "Let's <b>talk</b>" },
    options,
  );
  assert(r.ok);
  if (!r.ok) return;
  assertEquals(r.emails[0].to, "support@athanext.com");
  assertEquals(r.emails[0].replyTo, "sam@club.org");
  assertEquals(r.emails[0].subject, "Partnership inquiry: Club <FC>");
  assertStringIncludes(r.emails[0].html, "Club &lt;FC&gt;");
  assertStringIncludes(r.emails[0].html, "Let&#39;s &lt;b&gt;talk&lt;/b&gt;");
  assertEquals(r.emails[1].to, "sam@club.org");

  const bad = buildPublicEmails({ kind: "partnership", name: "", organization: "o".repeat(101), email: "x", message: "" }, options);
  assert(!bad.ok && Object.keys(bad.fields ?? {}).length === 4);
});

Deno.test("parent_invite goes to the parent with a fixed body and no links from the caller", () => {
  const r = buildPublicEmails(
    {
      kind: "parent_invite",
      email: "Parent@Example.com",
      sport: "Soccer",
      position: "Winger",
      level: "Club <b>",
      pillars: ["First touch", "Visit evil.example.com/login", "Speed", "Fourth"],
      age: "12",
      zip: "02139",
      html: "<a href='https://evil.example'>x</a>",
    },
    options,
  );
  assert(r.ok);
  if (!r.ok) return;
  assertEquals(r.emails.length, 1);
  const [mail] = r.emails;
  assertEquals(mail.to, "parent@example.com");
  assertEquals(mail.subject, "Finish your athlete's AthaNext account");
  assertStringIncludes(mail.html, `href="https://app.athanext.com/auth?mode=signup"`);
  assertStringIncludes(mail.html, "Soccer · Winger · Club b · First touch, Visit evilexamplecom/login, Speed · Age 12 · ZIP 02139");
  assert(!mail.html.includes("evil.example"));
  assert(!mail.html.includes("Fourth"));

  const under9 = buildPublicEmails({ kind: "parent_invite", email: "p@example.com", age: "u9" }, options);
  assert(under9.ok && under9.emails[0].html.includes("Under 9"));

  const bad = buildPublicEmails({ kind: "parent_invite", email: "nope" }, options);
  assert(!bad.ok && bad.status === 400);
});

Deno.test("every public email uses the cream shell", () => {
  const bodies = [
    { kind: "contact", name: "Pat", email: "pat@example.com", topic: "Hi", message: "Hello" },
    { kind: "partnership", name: "Pat", organization: "Northside FC", email: "pat@example.com", message: "Hello" },
    { kind: "parent_invite", email: "p@example.com" },
  ];
  for (const body of bodies) {
    const r = buildPublicEmails(body, options);
    assert(r.ok);
    for (const mail of r.emails) assertStringIncludes(mail.html, EMAIL_CREAM);
  }
});
