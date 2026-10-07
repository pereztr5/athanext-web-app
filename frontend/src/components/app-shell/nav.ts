import { Building2, Calendar, CreditCard, CalendarDays, CalendarPlus, House, Search, ShoppingBag, Store, Users } from "lucide-react";
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

// Business section: My Organization shows only for org owners (ATH-90).
export const ORG_NAV: NavItem = { title: "My Organization", short: "Organization", url: ROUTES.MY_ORGANIZATION, icon: Building2 };
// Payments (ATH-89): hidden in booking only mode.
export const PAYMENTS_NAV: NavItem = { title: "Payments", short: "Payments", url: ROUTES.PAYMENTS, icon: CreditCard };

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
