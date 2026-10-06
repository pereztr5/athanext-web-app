import { Calendar, CalendarDays, House, Store, Users } from "lucide-react";
import { ROUTES } from "@/routes";

// Coach navigation (ATH-75): same order as the phone tab bar.
export const COACH_NAV = [
  { title: "Home", short: "Home", url: ROUTES.DASHBOARD, icon: House },
  { title: "My Sessions", short: "Sessions", url: ROUTES.MY_SESSIONS, icon: Calendar },
  { title: "My Athletes", short: "Athletes", url: ROUTES.ATHLETES, icon: Users },
  { title: "My Schedule", short: "Schedule", url: ROUTES.SCHEDULE, icon: CalendarDays },
  { title: "My Profile", short: "Profile", url: ROUTES.PROFILE, icon: Store },
];

