/**
 * Add athlete (ATH-78): checks for invite rows and the Import a list parser.
 */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface FamilyInvite {
  name: string;
  email: string;
  athleteFirstName: string;
}

export interface SkippedRow {
  line: number;
  text: string;
  reason: string;
}

export const emptyFamily = (): FamilyInvite => ({ name: "", email: "", athleteFirstName: "" });

export const cleanFamily = (row: FamilyInvite): FamilyInvite => ({
  name: row.name.trim(),
  email: row.email.trim().toLowerCase(),
  athleteFirstName: row.athleteFirstName.trim(),
});

/** A row that can be sent: a name and a valid email. */
export const isReadyFamily = (row: FamilyInvite) => {
  const clean = cleanFamily(row);
  return Boolean(clean.name) && EMAIL_RE.test(clean.email);
};

/** Splits one CSV or pasted line, honoring double quotes. Tabs work too (pasted from a sheet). */
const splitLine = (line: string): string[] => {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === "," || ch === "\t" || ch === ";") { cells.push(cell); cell = ""; }
    else cell += ch;
  }
  cells.push(cell);
  return cells.map((c) => c.trim());
};

/**
 * Reads rows of "parent name, parent email, athlete first name". A header row is ignored.
 * Rows with a missing name, a bad email, or an email that is already a client or invited
 * (or repeated in the list) are skipped with a reason.
 */
export const parseInviteList = (text: string, knownEmails: Iterable<string> = []) => {
  const known = new Set([...knownEmails].map((e) => e.trim().toLowerCase()));
  const seen = new Set<string>();
  const rows: FamilyInvite[] = [];
  const skipped: SkippedRow[] = [];

  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return;
    const [name = "", email = "", athleteFirstName = ""] = splitLine(line);
    const lowerEmail = email.toLowerCase();
    if (index === 0 && !EMAIL_RE.test(lowerEmail) && /e-?mail/i.test(line)) return;

    const skip = (reason: string) => skipped.push({ line: index + 1, text: line, reason });
    if (!name) return skip("Missing name");
    if (!EMAIL_RE.test(lowerEmail)) return skip(email ? "Email doesn't look right" : "Missing email");
    if (known.has(lowerEmail)) return skip("Already a client or invited");
    if (seen.has(lowerEmail)) return skip("Listed twice");
    seen.add(lowerEmail);
    rows.push({ name, email: lowerEmail, athleteFirstName });
  });

  return { rows, skipped };
};

/** "Send invite", or "Send 3 invites" when there are several. */
export const sendLabel = (count: number) => (count > 1 ? `Send ${count} invites` : "Send invite");
