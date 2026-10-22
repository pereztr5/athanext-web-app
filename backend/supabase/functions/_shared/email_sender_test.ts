import { assertEquals } from "jsr:@std/assert@1";
import { allowedReplyTo, bookingEmailSender, emailAddress } from "./email_sender.ts";

Deno.test("emailAddress reads bare and named addresses", () => {
  assertEquals(emailAddress("Support@AthaNext.com"), "support@athanext.com");
  assertEquals(emailAddress("AthaNext <support@athanext.com>"), "support@athanext.com");
  assertEquals(emailAddress("not an email"), "");
  assertEquals(emailAddress(null), "");
});

Deno.test("booking emails come from support@ when that is the mailbox", () => {
  assertEquals(bookingEmailSender("support@athanext.com"), { from: "AthaNext <support@athanext.com>" });
  assertEquals(bookingEmailSender("noreply@athanext.com"), {
    from: "AthaNext <noreply@athanext.com>",
    replyTo: "support@athanext.com",
  });
  assertEquals(bookingEmailSender(""), null);
});

Deno.test("send-email only accepts support@ or the sender as Reply-To", () => {
  assertEquals(allowedReplyTo("support@athanext.com", "mailbox@athanext.com"), "support@athanext.com");
  assertEquals(allowedReplyTo("Mailbox@AthaNext.com", "mailbox@athanext.com"), "mailbox@athanext.com");
  assertEquals(allowedReplyTo("attacker@example.com", "mailbox@athanext.com"), undefined);
  assertEquals(allowedReplyTo("support@athanext.com.evil.com", ""), undefined);
  assertEquals(allowedReplyTo(undefined, "mailbox@athanext.com"), undefined);
  assertEquals(allowedReplyTo(["support@athanext.com"], ""), undefined);
});
