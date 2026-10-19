/**
 * Organizations (ATH-90). Reads go through security definer functions; the owner's changes
 * are checked in the database. Invites and rate changes are emailed by organization-email.
 */
import { supabase } from "@/integrations/supabase/client";
import type { MyOrganization, OrgPricing, OrgSession } from "@/utils/organizations";

type Row = Record<string, any>;

export interface PublicOrganization {
  id: string;
  name: string;
  slug: string;
  line: string;
  about: string;
  logoUrl: string | null;
  pricing: OrgPricing[];
  /** Coaches shown on the page, in the owner's order. */
  coachIds: string[];
  /** Everyone in the org, shown or not. */
  memberIds: string[];
}

/** Academy package (Working Copy): credits with some of the org's coaches, paid per session used. */
export interface OrgPackage {
  id: string;
  name: string;
  kind: "individual" | "group";
  sessionCount: number;
  /** Dollars. */
  price: number;
  validityDays: number;
  renewsMonthly: boolean;
  coachIds: string[];
  orgName?: string;
  orgSlug?: string;
  /** On coach profiles: single prices to work out the saving. */
  coachPrices?: Record<string, number>;
  groupPrices?: number[];
}

export interface OrgGroupSession {
  id: string;
  coachId: string;
  coachName: string;
  title: string;
  date: string;
  startTime: string;
  price: number;
  capacity: number;
  booked: number;
}

export interface OrgPageExtras {
  ownerId: string | null;
  ownerName: string;
  packages: OrgPackage[];
  /** Each coach's single 1-on-1 price, to work out savings. */
  coachPrices: Record<string, number>;
  groups: OrgGroupSession[];
}

const orgPackage = (p: Row): OrgPackage => ({
  id: p.id,
  name: p.name,
  kind: p.kind === "group" ? "group" : "individual",
  sessionCount: Number(p.session_count) || 1,
  price: Number(p.price) || 0,
  validityDays: Number(p.validity_days) || 90,
  renewsMonthly: Boolean(p.renews_monthly),
  coachIds: (p.coach_ids as string[]) ?? [],
  orgName: p.org_name ?? undefined,
  orgSlug: p.org_slug ?? undefined,
  coachPrices: p.coach_prices ? Object.fromEntries(Object.entries(p.coach_prices as Record<string, unknown>).map(([k, v]) => [k, Number(v) || 0])) : undefined,
  groupPrices: p.group_prices ? (p.group_prices as unknown[]).map(Number) : undefined,
});

// Functions added after the generated types; not in frontend/src/integrations/supabase/types.ts yet.
const rpc = (name: string, args?: Record<string, unknown>) =>
  supabase.rpc(name as never, args as never) as unknown as Promise<{ data: unknown; error: { code?: string; message: string } | null }>;

const missingRpc = (error: { code?: string; message: string }) =>
  error.code === "PGRST202" || error.code === "42883" || /could not find the function|schema cache/i.test(error.message);

export interface OrgRemovalRequest {
  id: string;
  coachId: string;
  reason: string | null;
  createdAt: string;
}

export interface OrganizationInvite {
  kind: "join" | "rate";
  status: "pending" | "accepted" | "declined" | "cancelled";
  rate: number;
  currentRate: number | null;
  organization: string;
  owner: string;
  isCoach: boolean;
  inOtherOrg: boolean;
}

const pricing = (raw: unknown): OrgPricing[] =>
  ((raw as Row[]) ?? []).map((p) => ({ name: p.name ?? "", who: p.who ?? "", price: p.price ?? "", unit: p.unit ?? "" }));

const num = (v: unknown) => (v == null ? null : Number(v));

const email = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke<{ link: string | null; emailed: boolean; error?: string }>(
    "organization-email",
    { body }
  );
  if (error) {
    const message = await (error as { context?: Response }).context?.json?.().then((b: Row) => b?.error).catch(() => null);
    throw new Error(message || error.message);
  }
  return data!;
};

export const orgPackagesAPI = {
  async mine(): Promise<OrgPackage[]> {
    const { data, error } = await rpc("get_my_org_packages");
    if (error) throw error;
    return ((data as Row[]) ?? []).map(orgPackage);
  },

  async save(input: Pick<OrgPackage, "name" | "kind" | "sessionCount" | "price" | "validityDays" | "coachIds"> & { id?: string }): Promise<OrgPackage> {
    const { data, error } = await rpc("save_org_package", {
      p_id: input.id ?? null,
      p_name: input.name,
      p_kind: input.kind,
      p_session_count: input.sessionCount,
      p_price: input.price,
      p_validity_days: input.validityDays,
      p_coach_ids: input.coachIds,
    });
    if (error) throw error;
    return orgPackage(data as Row);
  },

  async remove(id: string) {
    const { error } = await rpc("remove_org_package", { p_id: id });
    if (error) throw error;
  },

  async restore(id: string) {
    const { error } = await rpc("restore_org_package", { p_id: id });
    if (error) throw error;
  },

  async pageExtras(slug: string): Promise<OrgPageExtras> {
    const { data, error } = await rpc("get_org_page_extras", { p_slug: slug });
    if (error) throw error;
    const raw = (data as Row) ?? {};
    return {
      ownerId: raw.owner_id ?? null,
      ownerName: raw.owner_name ?? "",
      packages: ((raw.packages as Row[]) ?? []).map(orgPackage),
      coachPrices: Object.fromEntries(Object.entries((raw.coach_prices as Record<string, unknown>) ?? {}).map(([k, v]) => [k, Number(v) || 0])),
      groups: ((raw.groups as Row[]) ?? []).map((g) => ({
        id: g.id,
        coachId: g.coach_id,
        coachName: g.coach_name ?? "Coach",
        title: g.title || "Group session",
        date: g.date,
        startTime: g.start_time,
        price: Number(g.price) || 0,
        capacity: Number(g.capacity) || 0,
        booked: Number(g.booked) || 0,
      })),
    };
  },

  async forCoach(coachId: string): Promise<OrgPackage[]> {
    const { data, error } = await rpc("get_coach_org_packages", { p_coach_id: coachId });
    if (error) return [];
    return ((data as Row[]) ?? []).map(orgPackage);
  },

  /** Opens Stripe's page for an academy package. */
  async buy(orgPackageId: string): Promise<string> {
    const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>("create-package-payment", {
      body: { org_package_id: orgPackageId },
    });
    if (error || !data?.url) throw new Error(data?.error || error?.message || "Couldn't open checkout");
    return data.url;
  },
};

export const organizationsAPI = {
  async mine(): Promise<MyOrganization | null> {
    const { data, error } = await supabase.rpc("get_my_organization");
    if (error) throw error;
    const raw = data as Row | null;
    if (!raw) return null;
    return {
      id: raw.id,
      name: raw.name,
      slug: raw.slug,
      line: raw.line ?? "",
      about: raw.about ?? "",
      logoUrl: raw.logo_url ?? null,
      pricing: pricing(raw.pricing),
      coaches: ((raw.coaches as Row[]) ?? []).map((c) => ({
        coachId: c.coach_id,
        name: c.name || "Coach",
        slug: c.slug ?? null,
        photo: c.photo ?? null,
        hourlyRate: Number(c.hourly_rate) || 0,
        isOwner: Boolean(c.is_owner),
        rate: num(c.rate),
        pendingRate: num(c.pending_rate),
        shown: Boolean(c.shown),
        joinedAt: c.joined_at,
        pillars: (c.pillars as string[]) ?? [],
      })),
      invites: ((raw.invites as Row[]) ?? []).map((i) => ({ id: i.id, email: i.email, rate: Number(i.rate), sentAt: i.sent_at })),
    };
  },

  async sessions(from: string, to: string): Promise<OrgSession[]> {
    const { data, error } = await supabase.rpc("get_organization_sessions", { p_from: from, p_to: to });
    if (error) throw error;
    return ((data as Row[]) ?? []).map((s) => ({
      id: s.id,
      coachId: s.coach_id,
      date: s.date,
      startTime: s.start_time,
      endTime: s.end_time,
      type: s.session_type === "group" ? "group" : "individual",
      name: s.session_name || (s.session_type === "group" ? "Group session" : "1-on-1"),
      pillar: s.pillar ?? null,
      capacity: Number(s.capacity) || 1,
      price: Number(s.price) || 0,
      athletes: Number(s.athletes) || 0,
      came: Number(s.came) || 0,
      marked: Boolean(s.marked),
      noShow: Boolean(s.no_show),
      paid: Number(s.paid) || 0,
      toOrg: Number(s.to_org) || 0,
    }));
  },

  async savePage(input: {
    name: string;
    line: string;
    about: string;
    logoUrl: string | null;
    pricing: OrgPricing[];
    coaches: { coachId: string; shown: boolean }[];
  }): Promise<string> {
    const { data, error } = await supabase.rpc("save_organization_page", {
      p_name: input.name,
      p_line: input.line,
      p_about: input.about,
      p_logo_url: input.logoUrl ?? "",
      p_pricing: input.pricing as unknown as Row[],
      p_coaches: input.coaches.map((c) => ({ coach_id: c.coachId, shown: c.shown })),
    });
    if (error) throw error;
    return data as string;
  },

  async uploadLogo(file: File): Promise<string> {
    const ext = file.type === "image/svg+xml" ? "svg" : file.name.split(".").pop() || "png";
    const path = `organizations/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("athalink-images")
      .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
    if (error) throw new Error(error.message);
    return supabase.storage.from("athalink-images").getPublicUrl(path).data.publicUrl;
  },

  invite: (emailAddress: string, rate: number) => email({ action: "invite", email: emailAddress, rate }),
  resend: (inviteId: string) => email({ action: "resend", invite_id: inviteId }),
  changeRate: (coachId: string, rate: number) => email({ action: "rate", coach_id: coachId, rate }),

  async cancelInvite(inviteId: string) {
    const { error } = await supabase.rpc("cancel_organization_invite", { p_invite_id: inviteId });
    if (error) throw error;
  },

  /**
   * Open removal requests for the owner's org.
   * Until types are regenerated after the migration is applied.
   * A missing function (42883 / PGRST202) means the migration is not applied yet.
   */
  async listRemovals(): Promise<OrgRemovalRequest[]> {
    const { data, error } = await rpc("get_my_org_coach_removals");
    if (error) {
      if (missingRpc(error)) return [];
      throw error;
    }
    return ((data as Row[]) ?? []).map((row) => ({
      id: row.id,
      coachId: row.coach_id,
      reason: row.reason ?? null,
      createdAt: row.created_at,
    }));
  },

  /** Saves the request, then emails AthaNext support. Does not remove the coach. */
  async requestRemoval(coachId: string, reason: string): Promise<{ id: string; emailed: boolean }> {
    const { data, error } = await supabase.functions.invoke<{ id?: string; emailed?: boolean; error?: string }>(
      "org-coach-removal",
      { body: { coach_id: coachId, reason } },
    );
    if (error) {
      const message = await (error as { context?: Response }).context?.json?.().then((b: Row) => b?.error).catch(() => null);
      throw new Error(message || error.message);
    }
    if (!data?.id) throw new Error(data?.error || "Couldn't send the request");
    return { id: data.id, emailed: Boolean(data.emailed) };
  },

  async cancelRemoval(coachId: string) {
    const { error } = await rpc("cancel_org_coach_removal", { p_coach_id: coachId });
    if (error) throw error;
  },

  async getInvite(token: string): Promise<OrganizationInvite | null> {
    const { data, error } = await supabase.rpc("get_organization_invite", { p_token: token });
    if (error) throw error;
    const raw = data as Row | null;
    if (!raw) return null;
    return {
      kind: raw.kind,
      status: raw.status,
      rate: Number(raw.rate),
      currentRate: num(raw.current_rate),
      organization: raw.organization,
      owner: raw.owner,
      isCoach: Boolean(raw.is_coach),
      inOtherOrg: Boolean(raw.in_other_org),
    };
  },

  async respond(token: string, accept: boolean) {
    const { error } = await supabase.rpc("respond_organization_invite", { p_token: token, p_accept: accept });
    if (error) throw error;
  },

  async listPublic(): Promise<PublicOrganization[]> {
    const { data, error } = await supabase.rpc("get_organizations_public");
    if (error) throw error;
    return ((data as Row[]) ?? []).map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      line: o.line ?? "",
      about: o.about ?? "",
      logoUrl: o.logo_url ?? null,
      pricing: pricing(o.pricing),
      coachIds: (o.coach_ids as string[]) ?? [],
      memberIds: (o.member_ids as string[]) ?? [],
    }));
  },

  async adminOwnerIds(): Promise<string[]> {
    const { data, error } = await supabase.rpc("admin_org_owner_ids");
    if (error) throw error;
    return (data as string[]) ?? [];
  },

  async adminSetOwner(coachId: string, enabled: boolean) {
    const { error } = await supabase.rpc("admin_set_org_owner", { p_coach_id: coachId, p_enabled: enabled });
    if (error) throw error;
  },
};
