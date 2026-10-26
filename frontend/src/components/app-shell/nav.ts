import { Briefcase, Building2, Calendar, CalendarDays, CalendarPlus, Flag, House, Search, ShoppingBag, Store, Users } from "@/components/icons";
import { ROUTES } from "@/routes";

export type NavItem = { title: string; short: string; url: string; icon: typeof House; also?: string[] };

// Coach navigation (ATH-75, Working Copy): Home, Sessions, Athletes, Schedule, Camps and My Business.
export const COACH_NAV: NavItem[] = [
  { title: "Home", short: "Home", url: ROUTES.DASHBOARD, icon: House },
  { title: "My sessions", short: "Sessions", url: ROUTES.MY_SESSIONS, icon: Calendar },
  { title: "My athletes", short: "Athletes", url: ROUTES.ATHLETES, icon: Users },
  { title: "My schedule", short: "Schedule", url: ROUTES.SCHEDULE, icon: CalendarDays },
  { title: "Camps", short: "Camps", url: ROUTES.CAMPS, icon: Flag },
  { title: "My Business", short: "My Business", url: ROUTES.PAYMENTS, icon: Briefcase, also: [ROUTES.BUSINESS] },
];

// Phone tab bar: keep five tabs. Camps is reached from Home, Business, or the desktop sidebar.
export const COACH_TABS: NavItem[] = [
  ...COACH_NAV.slice(0, 4),
  { title: "My Business", short: "My Business", url: ROUTES.BUSINESS, icon: Briefcase, also: [ROUTES.PAYMENTS, ROUTES.MY_ORGANIZATION, ROUTES.CAMPS] },
];

// "Public pages": My Profile, and the Organization page for org owners (ATH-90).
export const PROFILE_NAV: NavItem = { title: "My profile", short: "Profile", url: ROUTES.PROFILE, icon: Store };
export const ORG_NAV: NavItem = { title: "Organization page", short: "Organization", url: ROUTES.MY_ORGANIZATION, icon: Building2 };

// Athlete navigation (ATH-91): Home, Book, Sessions, Coaches, Gear on web and phone.
export const ATHLETE_NAV: NavItem[] = [
  { title: "Home", short: "Home", url: ROUTES.DASHBOARD, icon: House },
  { title: "Book a session", short: "Book", url: ROUTES.BOOK, icon: CalendarPlus, also: [ROUTES.BOOKING_CONFIRMATION] },
  { title: "My sessions", short: "Sessions", url: ROUTES.MY_SESSIONS, icon: Calendar },
  { title: "View All Coaches", short: "Coaches", url: ROUTES.COACHES, icon: Search, also: [ROUTES.MY_COACHES, "/coach/", "/organizations/"] },
  { title: "Gear", short: "Gear", url: ROUTES.GEAR, icon: ShoppingBag },
];

export const isNavActive = (item: NavItem, pathname: string) =>
  pathname === item.url ||
  (item.url !== ROUTES.DASHBOARD && pathname.startsWith(item.url)) ||
  Boolean(item.also?.some((prefix) => pathname.startsWith(prefix)));
