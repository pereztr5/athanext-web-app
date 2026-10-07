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

  async removeCoach(coachId: string) {
    const { error } = await supabase.rpc("remove_organization_coach", { p_coach_id: coachId });
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
