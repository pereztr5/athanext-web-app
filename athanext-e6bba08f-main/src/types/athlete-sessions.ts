export type SessionStatus = "in-progress" | "upcoming" | "past";
export type SessionType = "Group" | "Individual";
export type LocationType = "In Person" | "In-Person" | "Online";

export type AthleteSession = {
  id: string;
  athleteId: string;
  title: string;
  status: SessionStatus;
  type: SessionType;
  start: string;
  end: string;
  location: string;
  locationType: LocationType;
  coach: string;
  coachAvatar?: string | null;
  rate: number;
  tags?: string[];
  sportPillars?: string[];
};

export type FiltersState = {
  search: string;
  date: string;
  type: string;
  status: string;
  locationType: string;
  sportPillar: string;
};
