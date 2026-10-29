import { sanitizeHtml } from "@/config/security";
import { sanitizeHTML } from "@/utils/sanitize";

const HTML_TAG_PATTERN = /<\/?[a-z][\s\S]*>/i;
const BLOCK_TAG_CLOSE_PATTERN = /<\/(p|div|h[1-6]|li|blockquote|section|article|pre)>/gi;
// eslint-disable-next-line no-misleading-character-class
const INVISIBLE_BREAK_CHAR_PATTERN = /[\u00ad\u200b\u200c\u200d\u2060\ufeff]/gi;
const INVISIBLE_BREAK_ENTITY_PATTERN =
  /&(nbsp|shy|ZeroWidthSpace);|&#(?:173|8203|8204|8205|8288|65279);/gi;

const stripInvisibleBreaks = (value: string): string => {
  return value
    .replace(INVISIBLE_BREAK_ENTITY_PATTERN, (match) =>
      /nbsp/i.test(match) ? " " : ""
    )
    .replace(INVISIBLE_BREAK_CHAR_PATTERN, "");
};

// Line breaks the writer typed are kept: a single break stays a line break, two or more make a new
// paragraph.
const normalizePlainTextSpacing = (value: string): string => {
  return stripInvisibleBreaks(value)
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
};

const normalizeRichTextMarkup = (value: string): string => stripInvisibleBreaks(value);

const decodeHtmlEntities = (value: string): string => {
  if (typeof document === "undefined") {
    return value
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#x27;/gi, "'")
      .replace(/&#x2F;/gi, "/")
      .replace(/&#(\d{1,6});/g, (_, n) => String.fromCodePoint(Number(n)))
      .replace(/&#x([0-9a-f]{1,6});/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
  }

  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
};

const plainTextToHtml = (value: string): string => {
  const normalizedValue = normalizePlainTextSpacing(value);

  if (!normalizedValue) {
    return "";
  }

  return normalizedValue
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph.split("\n").map((line) => sanitizeHtml(line)).join("<br />")}</p>`)
    .join("");
};

export function hasRichTextMarkup(value?: string | null): boolean {
  return HTML_TAG_PATTERN.test(value ?? "");
}

export function stripRichTextToPlainText(value?: string | null): string {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return "";
  }

  if (!hasRichTextMarkup(normalizedValue)) {
    return normalizePlainTextSpacing(decodeHtmlEntities(normalizedValue));
  }

  return decodeHtmlEntities(
    normalizeRichTextMarkup(normalizedValue)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<li>/gi, "- ")
      .replace(BLOCK_TAG_CLOSE_PATTERN, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\u00a0/g, " ")
  )
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function normalizeRichTextValue(value?: string | null): string {
  const normalizedValue = value?.trim() ?? "";

  if (!normalizedValue) {
    return "";
  }

  const cleanedValue = hasRichTextMarkup(normalizedValue)
    ? normalizeRichTextMarkup(normalizedValue)
    : normalizePlainTextSpacing(normalizedValue);

  return stripRichTextToPlainText(cleanedValue) ? cleanedValue : "";
}

export function prepareRichTextForEditor(value?: string | null): string {
  const normalizedValue = normalizeRichTextValue(value);

  if (!normalizedValue) {
    return "";
  }

  return hasRichTextMarkup(normalizedValue)
    ? sanitizeHTML(normalizedValue)
    : plainTextToHtml(normalizedValue);
}

export function formatRichTextForRender(value?: string | null): string {
  const normalizedValue = normalizeRichTextValue(value);

  if (!normalizedValue) {
    return "";
  }

  return hasRichTextMarkup(normalizedValue)
    ? sanitizeHTML(normalizedValue)
    : plainTextToHtml(normalizedValue);
}
