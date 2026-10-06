// Shopify order webhooks (ATH-74). orders/paid turns a paid order into gear_purchases rows
// for the athlete tagged on the cart (or matched by email), net of discounts. refunds/create
// adds the refunded amount to those rows. Shopify signs the raw body with
// SHOPIFY_WEBHOOK_SECRET. A bad signature is rejected; an order we can't match is
// acknowledged so Shopify does not retry it forever.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const SECRET = Deno.env.get("SHOPIFY_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const hmac = async (secret: string, body: ArrayBuffer) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = new Uint8Array(await crypto.subtle.sign("HMAC", key, body));
  let binary = "";
  signed.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
};

const same = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

interface LineItem {
  id?: number | string;
  title?: string;
  quantity?: number;
  price?: string;
  discount_allocations?: { amount?: string }[];
}

interface Refund {
  order_id?: number | string;
  refund_line_items?: { line_item_id?: number | string; subtotal?: number | string }[];
}

const cents = (n: number) => Math.round(n * 100) / 100;

interface Order {
  id?: number | string;
  email?: string;
  financial_status?: string;
  currency?: string;
  created_at?: string;
  line_items?: LineItem[];
  note_attributes?: { name?: string; value?: string }[];
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!SECRET) return json({ error: "Webhook secret is not set" }, 500);

  const rawBuffer = await req.arrayBuffer();
  const raw = new Uint8Array(rawBuffer);
  const given = req.headers.get("X-Shopify-Hmac-Sha256") ?? "";
  const expected = await hmac(SECRET, rawBuffer);
  if (!given || !same(given, expected)) return json({ error: "Bad signature" }, 401);

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return json({ error: "Bad payload" }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const topic = req.headers.get("X-Shopify-Topic") ?? "orders/paid";

  if (topic === "refunds/create") {
    const refund = payload as Refund;
    if (!refund.order_id) return json({ ok: true, skipped: "no order" });
    let updated = 0;
    for (const line of refund.refund_line_items ?? []) {
      const subtotal = Number(line.subtotal) || 0;
      if (!line.line_item_id || subtotal <= 0) continue;
      const { data: row } = await supabase
        .from("gear_purchases")
        .select("id, amount, refunded_amount")
        .eq("shopify_order_id", String(refund.order_id))
        .eq("shopify_line_id", String(line.line_item_id))
        .maybeSingle();
      if (!row) continue;
      const refunded = Math.min(Number(row.amount), cents(Number(row.refunded_amount) + subtotal));
      const { error } = await supabase.from("gear_purchases").update({ refunded_amount: refunded }).eq("id", row.id);
      if (error) return json({ error: error.message }, 500);
      updated += 1;
    }
    return json({ ok: true, refunded_lines: updated });
  }

  if (topic !== "orders/paid") return json({ ok: true, skipped: topic });
  const order = payload as Order;

  if (order.financial_status && !["paid", "partially_paid"].includes(order.financial_status)) {
    return json({ ok: true, skipped: "not paid" });
  }

  const attr = (name: string) => order.note_attributes?.find((a) => a.name === name)?.value ?? null;
  let athleteId = attr("athlete_id");
  const coachId = attr("coach_id");

  if (!athleteId && order.email) {
    const { data } = await supabase
      .from("user_profiles")
      .select("athlete_id")
      .ilike("email", order.email)
      .not("athlete_id", "is", null)
      .limit(1)
      .maybeSingle();
    athleteId = data?.athlete_id ?? null;
  }

  if (!athleteId || !order.id) return json({ ok: true, skipped: "no athlete" });

  const rows = (order.line_items ?? [])
    .filter((line) => line.title)
    .map((line) => ({
      athlete_id: athleteId,
      coach_id: coachId,
      shopify_order_id: String(order.id),
      shopify_line_id: String(line.id ?? line.title),
      title: line.title as string,
      amount: Math.max(
        0,
        cents(
          (Number(line.price) || 0) * (Number(line.quantity) || 1) -
            (line.discount_allocations ?? []).reduce((n, d) => n + (Number(d.amount) || 0), 0),
        ),
      ),
      currency: order.currency || "USD",
      purchased_at: order.created_at || new Date().toISOString(),
    }));

  if (!rows.length) return json({ ok: true, skipped: "no lines" });

  const { error } = await supabase.from("gear_purchases").upsert(rows, { onConflict: "shopify_order_id,shopify_line_id", ignoreDuplicates: true });
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, lines: rows.length });
});
