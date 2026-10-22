// Who booking emails come from, and which Reply-To send-email accepts. Pure, so it is tested.
//
// send-email delivers through Gmail SMTP as GMAIL_USER. Gmail only sends as that mailbox or a
// verified alias, so a From of support@athanext.com only works while that is the mailbox.

export const SUPPORT_EMAIL = "support@athanext.com";

/** The bare address in "Name <a@b.c>" or "a@b.c", lowercased; "" when there is none. */
export const emailAddress = (value: unknown): string => {
  if (typeof value !== "string") return "";
  const inBrackets = /<([^<>\s]+@[^<>\s]+)>/.exec(value);
  const address = (inBrackets ? inBrackets[1] : value).trim().toLowerCase();
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address) ? address : "";
};

/**
 * From and Reply-To for booking emails. `configured` is configurations.smtp_email (the mailbox
 * send-email signs in as). When that mailbox is support@, mail is from support@ and needs no
 * Reply-To; otherwise it stays from the mailbox and replies go to support@.
 */
export const bookingEmailSender = (configured: unknown): { from: string; replyTo?: string } | null => {
  const mailbox = emailAddress(configured);
  if (!mailbox) return null;
  if (mailbox === SUPPORT_EMAIL) return { from: `AthaNext <${SUPPORT_EMAIL}>` };
  return { from: `AthaNext <${mailbox}>`, replyTo: SUPPORT_EMAIL };
};

/**
 * send-email only sets a Reply-To that is support@ or the sending mailbox itself. Anything
 * else is dropped, so the function can't be used to point replies at another address.
 */
export const allowedReplyTo = (requested: unknown, senderMailbox: unknown): string | undefined => {
  const address = emailAddress(requested);
  if (!address) return undefined;
  const allowed = new Set([SUPPORT_EMAIL, emailAddress(senderMailbox)].filter(Boolean));
  return allowed.has(address) ? address : undefined;
};
