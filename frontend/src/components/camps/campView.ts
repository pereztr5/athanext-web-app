/** The camp page's view model, shared by the public page and the editor preview. */
import type { CampCoachRef } from "@/api/camps";
import type { CampPage } from "@/api/campSignup";
import { campWaiverUrl, plural } from "@/utils/camps";

export type CampViewGroup = {
  id: string;
  name: string;
  description: string | null;
  start: string;
  end: string;
  /** Null in the editor preview (nobody has signed up yet). */
  spotsLeft: number | null;
  spots: number;
  full: boolean;
};

export type CampView = {
  name: string;
  coverUrl: string | null;
  coachName: string;
  coachPhoto: string | null;
  coachBio: string | null;
  coachSlug: string | null;
  linkedCoach: CampCoachRef | null;
  tags: string[];
  priceCents: number;
  days: number;
  startsOn: string | null;
  endsOn: string | null;
  location: string | null;
  groups: CampViewGroup[];
  included: string[];
  /** Safe https waiver link, or null. */
  waiverUrl: string | null;
};

export const campViewFromPage = (page: CampPage): CampView => ({
  name: page.name,
  coverUrl: page.cover_url,
  coachName: page.coach.name,
  coachPhoto: page.coach.photo_url,
  coachBio: page.coach.bio,
  coachSlug: page.coach.slug,
  linkedCoach: page.linked_coach,
  tags: page.tags,
  priceCents: page.price_cents,
  days: page.days,
  startsOn: page.starts_on,
  endsOn: page.ends_on,
  location: page.location,
  groups: page.groups.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    start: g.start_time,
    end: g.end_time,
    spots: g.spots,
    spotsLeft: g.spots_left,
    full: g.full,
  })),
  included: page.included,
  waiverUrl: campWaiverUrl(page.waiver_url),
});

export const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

export const groupSpotsText = (g: CampViewGroup) =>
  g.full ? "Fully booked" : g.spotsLeft == null ? plural(g.spots, "spot") : `${plural(g.spotsLeft, "spot")} left`;

