/**
 * Bodies for the send-email edge function from the app. Without the service role, send-email
 * only takes one of these kinds and builds the recipient, subject and HTML itself, so the app
 * sends plain fields (never HTML, an address to send to, or a subject).
 */
export type PublicEmailRequest =
  | { kind: "contact"; name: string; email: string; phone?: string; topic: string; message: string }
  | { kind: "partnership"; name: string; organization: string; email: string; message: string }
  | {
      kind: "parent_invite";
      email: string;
      sport?: string;
      position?: string;
      level?: string;
      pillars?: string[];
      age?: string;
      zip?: string;
    };

export const contactEmailRequest = (data: {
  fullName: string;
  email: string;
  subject: string;
  message: string;
  phone?: string;
}): PublicEmailRequest => ({
  kind: "contact",
  name: data.fullName.trim(),
  email: data.email.trim().toLowerCase(),
  ...(data.phone?.trim() ? { phone: data.phone.trim() } : {}),
  topic: data.subject.trim(),
  message: data.message.trim(),
});

export const partnershipEmailRequest = (data: {
  name: string;
  organization: string;
  email: string;
  partnershipInterest: string;
}): PublicEmailRequest => ({
  kind: "partnership",
  name: data.name.trim(),
  organization: data.organization.trim(),
  email: data.email.trim().toLowerCase(),
  message: data.partnershipInterest.trim(),
});

/** The athlete's sign-up picks, sent as fields; send-email writes the summary line. */
export const parentInviteEmailRequest = (data: {
  email: string;
  sport?: string | null;
  pos?: string | null;
  level?: string | null;
  pillars?: string[];
  age?: string | null;
  zip?: string | null;
}): PublicEmailRequest => {
  const optional = (value: string | null | undefined) => (value && value.trim() ? value.trim() : undefined);
  return {
    kind: "parent_invite",
    email: data.email.trim().toLowerCase(),
    sport: optional(data.sport),
    position: optional(data.pos),
    level: optional(data.level),
    pillars: (data.pillars ?? []).slice(0, 3),
    age: optional(data.age),
    zip: optional(data.zip),
  };
};
