/** Rows for the Privacy and safety PDF. Callers pass already-readable strings. */

export type PdfSection = {
  title: string;
  columns: string[];
  rows: string[][];
};

const cell = (value: unknown): string => {
  if (value == null || value === "") return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(cell).filter(Boolean).join(", ");
  return "";
};

/** One section. An empty list stays empty so the PDF can say there is nothing saved. */
export const pdfSection = (title: string, rows: Record<string, unknown>[]): PdfSection => {
  const columns = rows[0] ? Object.keys(rows[0]) : [];
  return {
    title,
    columns,
    rows: rows.map((row) => columns.map((column) => cell(row[column]))),
  };
};

export const dollarsFromCents = (cents: unknown) =>
  typeof cents === "number" && Number.isFinite(cents) ? `$${(cents / 100).toFixed(2)}` : "";
