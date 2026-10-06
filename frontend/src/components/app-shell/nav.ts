import { Calendar, CalendarDays, CalendarPlus, House, ShoppingBag, Store, UserCheck, Users } from "lucide-react";
import { ROUTES } from "@/routes";

export type NavItem = { title: string; short: string; url: string; icon: typeof House; also?: string[] };

// Coach navigation (ATH-75): same order as the phone tab bar.
export const COACH_NAV: NavItem[] = [
  { title: "Home", short: "Home", url: ROUTES.DASHBOARD, icon: House },
  { title: "My Sessions", short: "Sessions", url: ROUTES.MY_SESSIONS, icon: Calendar },
  { title: "My Athletes", short: "Athletes", url: ROUTES.ATHLETES, icon: Users },
  { title: "My Schedule", short: "Schedule", url: ROUTES.SCHEDULE, icon: CalendarDays },
  { title: "My Profile", short: "Profile", url: ROUTES.PROFILE, icon: Store },
];

// Athlete navigation (ATH-91): Home, Book, Sessions, Coaches, Gear on web and phone.
export const ATHLETE_NAV: NavItem[] = [
  { title: "Home", short: "Home", url: ROUTES.DASHBOARD, icon: House },
  { title: "Book a Session", short: "Book", url: ROUTES.BOOK, icon: CalendarPlus },
  { title: "My Sessions", short: "Sessions", url: ROUTES.MY_SESSIONS, icon: Calendar },
  { title: "Coaches", short: "Coaches", url: ROUTES.MY_COACHES, icon: UserCheck, also: [ROUTES.COACHES, "/coach/"] },
  { title: "Gear", short: "Gear", url: ROUTES.GEAR, icon: ShoppingBag },
];

export const isNavActive = (item: NavItem, pathname: string) =>
  pathname === item.url ||
  (item.url !== ROUTES.DASHBOARD && pathname.startsWith(item.url)) ||
  Boolean(item.also?.some((prefix) => pathname.startsWith(prefix)));
