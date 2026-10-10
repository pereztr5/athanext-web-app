import { Briefcase, Building2, Calendar, CalendarDays, CalendarPlus, House, Search, ShoppingBag, Store, Users } from "lucide-react";
import { ROUTES } from "@/routes";

export type NavItem = { title: string; short: string; url: string; icon: typeof House; also?: string[] };

// Coach navigation (ATH-75, Working Copy): Home, Sessions, Athletes, Schedule and Business.
export const COACH_NAV: NavItem[] = [
  { title: "Home", short: "Home", url: ROUTES.DASHBOARD, icon: House },
  { title: "My Sessions", short: "Sessions", url: ROUTES.MY_SESSIONS, icon: Calendar },
  { title: "My Athletes", short: "Athletes", url: ROUTES.ATHLETES, icon: Users },
  { title: "My Schedule", short: "Schedule", url: ROUTES.SCHEDULE, icon: CalendarDays },
  { title: "Business", short: "Business", url: ROUTES.PAYMENTS, icon: Briefcase, also: [ROUTES.BUSINESS] },
];

// Phone tab bar: the 5th tab opens the Business page with Payments and My Organization.
export const COACH_TABS: NavItem[] = [
  ...COACH_NAV.slice(0, 4),
  { title: "Business", short: "Business", url: ROUTES.BUSINESS, icon: Briefcase, also: [ROUTES.PAYMENTS, ROUTES.MY_ORGANIZATION] },
];

// "Public pages": My Profile, and the Organization page for org owners (ATH-90).
export const PROFILE_NAV: NavItem = { title: "My Profile", short: "Profile", url: ROUTES.PROFILE, icon: Store };
export const ORG_NAV: NavItem = { title: "Organization page", short: "Organization", url: ROUTES.MY_ORGANIZATION, icon: Building2 };

// Athlete navigation (ATH-91): Home, Book, Sessions, Coaches, Gear on web and phone.
export const ATHLETE_NAV: NavItem[] = [
  { title: "Home", short: "Home", url: ROUTES.DASHBOARD, icon: House },
  { title: "Book a Session", short: "Book", url: ROUTES.BOOK, icon: CalendarPlus },
  { title: "My Sessions", short: "Sessions", url: ROUTES.MY_SESSIONS, icon: Calendar },
  { title: "Coaches", short: "Coaches", url: ROUTES.COACHES, icon: Search, also: [ROUTES.MY_COACHES, "/coach/", "/organizations/"] },
  { title: "Gear", short: "Gear", url: ROUTES.GEAR, icon: ShoppingBag },
];

export const isNavActive = (item: NavItem, pathname: string) =>
  pathname === item.url ||
  (item.url !== ROUTES.DASHBOARD && pathname.startsWith(item.url)) ||
  Boolean(item.also?.some((prefix) => pathname.startsWith(prefix)));
