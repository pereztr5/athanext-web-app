/**
 * Coach profile extras (Working Copy c-profile): the session types listed under Sessions and
 * pricing, most booked package and academy. RPCs from
 * 20261010220000_coach_profile.sql.
 */
import { supabase } from "@/integrations/supabase/client";

export type ProfileServiceFormat = "individual" | "group";

export interface ProfileService {
  id: string;
  name: string;
  format: ProfileServiceFormat;
  minutes: number;
  where: string;
  /** Dollars. Ignored for the base "individual" row, which uses coaches.hourly_rate. */
  price: number;
  on: boolean;
}

export interface CoachProfileExtras {
  services: ProfileService[];
  mostBookedPackageId: string | null;
  organization: { name: string; slug: string; isOwner: boolean } | null;
  /** Only known for the signed-in coach's own profile. */
  hasAvailability: boolean | null;
}

/** id of the base 1-on-1 row, priced from hourly_rate. */
export const BASE_SERVICE_ID = "individual";

type Row = Record<string, unknown>;

const rpc = (name: string, args?: Record<string, unknown>) =>
  supabase.rpc(name as never, args as never) as unknown as Promise<{ data: unknown; error: Error | null }>;

const toService = (raw: Row): ProfileService | null => {
  const id = typeof raw.id === "string" ? raw.id : "";
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!id || !name) return null;
  return {
    id,
    name,
    format: raw.format === "group" ? "group" : "individual",
    minutes: Number(raw.minutes) || 60,
    where: typeof raw.where === "string" && raw.where.trim() ? raw.where.trim() : "In person",
    price: Number(raw.price) || 0,
    on: raw.on !== false,
  };
};

export const coachProfileAPI = {
  async extras(coachId: string): Promise<CoachProfileExtras> {
    const { data, error } = await rpc("get_coach_profile_extras", { p_coach_id: coachId });
    if (error) throw error;
    const raw = (data ?? {}) as Row;
    const org = raw.organization as Row | null;
    return {
      services: ((raw.services as Row[]) ?? []).map(toService).filter((s): s is ProfileService => s !== null),
      mostBookedPackageId: typeof raw.most_booked_package_id === "string" ? raw.most_booked_package_id : null,
      organization: org && typeof org.name === "string" ? { name: org.name, slug: String(org.slug ?? ""), isOwner: Boolean(org.is_owner) } : null,
      hasAvailability: typeof raw.has_availability === "boolean" ? raw.has_availability : null,
    };
  },

  async setServices(services: ProfileService[]): Promise<void> {
    const { error } = await rpc("set_coach_profile_services", { p_services: services });
    if (error) throw error;
  },
};
