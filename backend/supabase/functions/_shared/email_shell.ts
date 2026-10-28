/**
 * Shared HTML shell for transactional emails: cream page (#F1F1E6), cream card (#F7F7F0),
 * brand-blue title and buttons (#0054B4). Matches the app background in frontend/src/index.css.
 */

export const EMAIL_CREAM = "#F1F1E6";
export const EMAIL_CARD = "#F7F7F0";
export const EMAIL_BLUE = "#0054B4";
export const EMAIL_DARK = "#1A202C";
export const EMAIL_MUTED = "#686B72";

/** Hosted PNG logo (Gmail and Outlook don't show SVG). 390x87, shown at 130px wide. */
export const EMAIL_LOGO_URL =
  "https://znrdabzydvulagmlepxr.supabase.co/storage/v1/object/public/athalink-images/AthaNext-Logo.png";
const EMAIL_LOGO_HREF = "https://app.athanext.com";

export const escapeEmailHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const e = (value: unknown) => escapeEmailHtml(String(value ?? ""));

/** Outer cream page, the logo above the card (as in the auth templates), then the card with blue
 *  title, body parts, and optional footer. */
export const emailShell = (title: string, parts: string[], footer?: string) => {
  const foot =
    footer ??
    `<p style="color:${EMAIL_MUTED};font-size:13px;margin:24px 0 0;">Questions? Reply to this email or write to support@athanext.com.</p>`;
  return `<div style="margin:0;padding:24px 12px;background:${EMAIL_CREAM};font-family:Arial,Helvetica,sans-serif;color:${EMAIL_DARK};">
  <div style="max-width:560px;margin:0 auto;padding:0 4px 20px;">
    <a href="${EMAIL_LOGO_HREF}" style="display:inline-block;border:0;text-decoration:none;"><img src="${EMAIL_LOGO_URL}" alt="AthaNext" width="130" height="29" style="display:block;width:130px;height:auto;border:0;outline:none;" /></a>
  </div>
  <div style="max-width:560px;margin:0 auto;padding:28px 24px;background:${EMAIL_CARD};border-radius:12px;">
    <h2 style="margin:0 0 16px;color:${EMAIL_BLUE};font-size:22px;line-height:1.3;">${e(title)}</h2>
    ${parts.join("\n    ")}
    ${foot}
  </div>
</div>`;
};

/** Primary CTA button (brand blue). */
export const emailButton = (href: string, label: string) =>
  `<p style="margin:20px 0;"><a href="${e(href)}" style="background:${EMAIL_BLUE};color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600;">${e(label)}</a></p>`;
