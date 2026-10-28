import { assertStringIncludes } from "jsr:@std/assert@1";
import { EMAIL_BLUE, EMAIL_CARD, EMAIL_CREAM, EMAIL_LOGO_URL, emailButton, emailShell } from "./email_shell.ts";

Deno.test("email shell shows the PNG logo above the card", () => {
  const html = emailShell("Hello", ["<p>Body</p>"]);
  assertStringIncludes(html, EMAIL_LOGO_URL);
  assertStringIncludes(html, 'alt="AthaNext"');
  // PNG, not SVG: Gmail and Outlook drop SVG images.
  assertStringIncludes(EMAIL_LOGO_URL, ".png");
  // The logo comes before the title card.
  if (html.indexOf(EMAIL_LOGO_URL) > html.indexOf("Hello")) throw new Error("logo should be above the card");
});

Deno.test("email shell uses cream page, cream card, and blue title", () => {
  const html = emailShell("Hello", ["<p>Body</p>"]);
  assertStringIncludes(html, EMAIL_CREAM);
  assertStringIncludes(html, EMAIL_CARD);
  assertStringIncludes(html, EMAIL_BLUE);
  assertStringIncludes(html, "Hello");
  assertStringIncludes(html, "Body");
  assertStringIncludes(html, "support@athanext.com");
});

Deno.test("email button is brand blue", () => {
  const html = emailButton("https://athanext.com/x", "Open");
  assertStringIncludes(html, EMAIL_BLUE);
  assertStringIncludes(html, "https://athanext.com/x");
  assertStringIncludes(html, "Open");
});
