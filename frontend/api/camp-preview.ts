/**
 * Link previews for camp links (ATH-121). vercel.json sends only link-preview bots (iMessage,
 * WhatsApp, Slack, Facebook, X, LinkedIn, Discord, Telegram) for /<coach>/<camp> here; people
 * get the app as usual. We serve the app's own index.html with the camp's title, dates, price
 * and cover photo in the preview tags, so a shared camp link shows the camp, not just the logo.
 * Anything that isn't a published camp gets index.html unchanged.
 */
export const config = { runtime: "edge" };

type CampPage = {
  name?: string | null;
  starts_on?: string | null;
  ends_on?: string | null;
  location?: string | null;
  price_cents?: number | null;
  cover_url?: string | null;
  coach?: { name?: string | null } | null;
};

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const day = (iso: string) => {
  const date = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
};

const dates = (starts?: string | null, ends?: string | null) => {
  const from = starts ? day(starts) : "";
  const to = ends ? day(ends) : "";
  return from && to && from !== to ? `${from} to ${to}` : from || to;
};

const loadCamp = async (coach: string, camp: string): Promise<CampPage | null> => {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  const res = await fetch(`${url}/rest/v1/rpc/get_camp_page`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Content-Profile": "public" },
    body: JSON.stringify({ p_coach_slug: coach, p_camp_slug: camp }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as CampPage | null;
  return data?.name ? data : null;
};

/** Replaces the content of one <meta> (by property or name) in index.html. */
const setMeta = (html: string, attr: "property" | "name", key: string, value: string) =>
  // A function, so a "$" in the value (a price) isn't read as a replacement pattern.
  html.replace(new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`), (_, open: string, close: string) => `${open}${escapeHtml(value)}${close}`);

export default async function handler(req: Request) {
  const requestUrl = new URL(req.url);
  const indexRes = await fetch(new URL("/index.html", requestUrl.origin));
  let html = await indexRes.text();
  const headers = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=300" };

  const coach = requestUrl.searchParams.get("coach") ?? "";
  const slug = requestUrl.searchParams.get("camp") ?? "";
  const camp = coach && slug ? await loadCamp(coach, slug).catch(() => null) : null;
  if (!camp?.name) return new Response(html, { headers });

  const title = `${camp.name} · AthaNext`;
  const price = camp.price_cents ? `$${Math.round(camp.price_cents / 100).toLocaleString("en-US")}` : "";
  const description = [
    dates(camp.starts_on, camp.ends_on),
    price,
    camp.location,
    camp.coach?.name ? `With ${camp.coach.name}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const pageUrl = `${requestUrl.origin}/${encodeURIComponent(coach)}/${encodeURIComponent(slug)}`;

  html = html.replace(/<title>[^<]*<\/title>/, () => `<title>${escapeHtml(title)}</title>`);
  html = setMeta(html, "property", "og:title", title);
  html = setMeta(html, "name", "twitter:title", title);
  if (description) {
    html = setMeta(html, "property", "og:description", description);
    html = setMeta(html, "name", "twitter:description", description);
    html = setMeta(html, "name", "description", description);
  }
  if (camp.cover_url) {
    html = setMeta(html, "property", "og:image", camp.cover_url);
    html = setMeta(html, "name", "twitter:image", camp.cover_url);
    html = setMeta(html, "property", "og:image:alt", camp.name);
    // The cover's size isn't known; drop the logo's 1200x630 so apps measure the image themselves.
    html = html.replace(/\s*<meta property="og:image:(width|height)" content="[^"]*" \/>/g, "");
  }
  html = html.replace(
    "</head>",
    () => `  <meta property="og:url" content="${escapeHtml(pageUrl)}" />\n    <meta property="og:site_name" content="AthaNext" />\n  </head>`,
  );
  return new Response(html, { headers });
}
