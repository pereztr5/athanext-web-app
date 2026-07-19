export type Athlete = {
  id: string;
  name: string;
  avatar?: string;
};

export type SessionStatus = "in-progress" | "upcoming" | "past" | "draft";

export type SessionType = "Group" | "Individual";

export type Session = {
  id: string;
  title: string;
  type: SessionType;
  status: SessionStatus;
  start: string;
  end: string;
  location: string;
  rate: number;
  athletes: Athlete[];
  totalAthletes: number;
  sportPillars?: string[];
};
