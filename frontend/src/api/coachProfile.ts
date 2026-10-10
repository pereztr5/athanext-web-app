/**
 * Coach profile extras (Working Copy c-profile): coaching video, the session types listed under
 * Sessions and pricing, most booked package, academy and cover photo. RPCs from
 * 20261010220000_coach_profile.sql.
 */
import { supabase } from "@/integrations/supabase/client";
import { coachesAPI } from "@/api/coaches";

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
  coachingVideoUrl: string | null;
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
      coachingVideoUrl: typeof raw.coaching_video_url === "string" ? raw.coaching_video_url : null,
      services: ((raw.services as Row[]) ?? []).map(toService).filter((s): s is ProfileService => s !== null),
      mostBookedPackageId: typeof raw.most_booked_package_id === "string" ? raw.most_booked_package_id : null,
      organization: org && typeof org.name === "string" ? { name: org.name, slug: String(org.slug ?? ""), isOwner: Boolean(org.is_owner) } : null,
      hasAvailability: typeof raw.has_availability === "boolean" ? raw.has_availability : null,
    };
  },

  async setCoachingVideo(url: string | null): Promise<void> {
    const { error } = await rpc("set_coach_coaching_video", { p_url: url });
    if (error) throw error;
  },

  async setServices(services: ProfileService[]): Promise<void> {
    const { error } = await rpc("set_coach_profile_services", { p_services: services });
    if (error) throw error;
  },

  /** Uploads a cover photo and makes it the first of coaches.cover_image_urls. */
  async setCover(coachId: string, file: File, current: string[]): Promise<string[]> {
    if (file.size > 8 * 1024 * 1024) throw new Error("Pick a photo under 8 MB.");
    const ext = file.name.split(".").pop() || "jpg";
    const path = `coach-profiles/covers/${coachId}-cover-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("athalink-images").upload(path, file, { cacheControl: "3600", upsert: false });
    if (uploadError) throw uploadError;
    const url = supabase.storage.from("athalink-images").getPublicUrl(path).data.publicUrl;
    const next = [url, ...current.filter((u) => u !== url)];
    const response = await coachesAPI.updateCoach(coachId, { cover_image_urls: next });
    if (response.error) throw new Error(response.error.message);
    return next;
  },
};
