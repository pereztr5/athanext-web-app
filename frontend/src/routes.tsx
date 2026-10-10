import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import WhyMyKonnect from "./pages/WhyMyKonnect";
import BecomeACoach from "./pages/BecomeACoach";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AllCoaches from "./pages/AllCoaches";
import Partnerships from "./pages/Partnerships";
import PartnershipSuccess from "./pages/PartnershipSuccess";
import SoccerPillars from "./pages/SoccerPillars";
import RowingPillars from "./pages/RowingPillars";
import CoachProfile from "./pages/CoachProfile";
import ChangePassword from "./pages/ChangePassword";
import AccountSettings from "./pages/AccountSettings";
import MySchedule from "./pages/MySchedule";
import BookSession from "./pages/BookSession";
import PlanGroups from "./pages/PlanGroups";
import ScheduleSettings from "./pages/ScheduleSettings";
import GroupOffer from "./pages/GroupOffer";
import Analytics from "./pages/Analytics";
import About from "./pages/About";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsAndConditions from "./pages/TermsAndConditions";
import ContactUs from "./pages/ContactUs";
import OrganizationProfile from "./pages/OrganizationProfile";
import MyOrganization from "./pages/MyOrganization";
import OrganizationInvite from "./pages/OrganizationInvite";
import Payments from "./pages/Payments";
import Business from "./pages/Business";
import Account from "./pages/Account";
import FamilyInvoice from "./pages/FamilyInvoice";
import SignupConfirmation from "./pages/SignupConfirmation";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/common/ProtectedRoute";
import SessionFeedback from "./pages/SessionFeedback";
import CoachSession from "./pages/CoachSession";
import MySessions from "./pages/MySessions";
import ChatPage from "./pages/ChatPage";
import BookingConfirmation from "./pages/BookingConfirmation";
import PackageConfirmation from "./pages/PackageConfirmation";
import CreateAthleteProfile from "./pages/CreateAthleteProfile";
import Dashboard from "./pages/Dashboard";
import AdminAccounts from "./pages/AdminAccounts";
import { HomeSwitch } from "./layouts/HomeSwitch";
import Invites from "./pages/Invites";
import { MyClientsRedirect } from "./components/invites/MyClientsRedirect";
import MyAthletes from "./pages/MyAthletes";
import AthleteDetail from "./pages/AthleteDetail";
import MyCoaches from "./pages/MyCoaches";
import AdminReferrals from "./pages/AdminReferrals";
import InviteClaim from "./pages/InviteClaim";
import Gear from "./pages/Gear";
import GearProduct from "./pages/GearProduct";

export const ROUTES = {
  HOME: "/",
  DASHBOARD: "/dashboard",
  WHY_ATHALINK: "/why-athalink",
  BECOME_COACH: "/become-a-coach",
  AUTH: "/auth",
  SIGN_UP_CONFIRMATION: "/signupconfirmation",
  FORGOT_PASSWORD: "/forgot-password",
  RESET_PASSWORD: "/reset-password",
  COACHES: "/coaches",
  ORGANIZATION: "/organizations/:slug",
  GEAR: "/gear",
  GEAR_PRODUCT: "/gear/:handle",
  PARTNERSHIPS: "/partnerships",
  PARTNERSHIP_SUCCESS: "/partnership-success",
  SOCCER: "/soccer",
  ROWING: "/rowing",
  COACH_PROFILE: "/coach/:id",
  COACH_PRICING: "/coach/:id/pricing",
  BOOKING_CONFIRMATION: "/booking-confirmation",
  PACKAGE_CONFIRMATION: "/package-confirmation",
  COACH_SESSION_FEEDBACK: "/coach-session-feedback",
  COACH_SESSION: "/sessions/:id",
  MY_SESSIONS: "/my-sessions",
  MY_CLIENTS: "/my-clients",
  INVITES: "/invites",
  ATHLETES: "/athletes",
  ATHLETE: "/athletes/:id",
  MY_COACHES: "/my-coaches",
  CREATE_ATHLETE_PROFILE: "/athlete-profile/create",
  SETTINGS: "/settings",
  ADMIN_ACCOUNTS: "/admin/accounts",
  CHANGE_PASSWORD: "/settings/password",
  BOOK: "/book",
  SCHEDULE: "/schedule",
  SCHEDULE_PLAN: "/schedule/plan",
  SCHEDULE_SETTINGS: "/schedule/settings",
  GROUP_OFFER: "/offers/:id",
  // Older links: /availability opens Schedule settings, /calendar opens My Schedule.
  AVAILABILITY: "/availability",
  CALENDAR: "/calendar",
  ANALYTICS: "/analytics",
  ABOUT: "/about",
  PRIVACY_POLICY: "/privacy-policy",
  TERMS_AND_CONDITIONS: "/terms-and-conditions",
  CONTACT_US: "/contact",
  PROFILE: "/profile",
  CHAT: "/chat",
  ADMIN_REFERRALS: "/admin/referrals",
  INVITE: "/invite/:token",
  MY_ORGANIZATION: "/organization",
  ORG_INVITE: "/org-invite/:token",
  PAYMENTS: "/payments",
  BUSINESS: "/business",
  ACCOUNT: "/account",
  FAMILY_INVOICE: "/invoices/:id",
  NOT_FOUND: "*",
} as const;

interface AppRoute {
  path: string;
  element: ReactNode;
}

export const PUBLIC_ROUTES: AppRoute[] = [
  { path: ROUTES.HOME, element: <HomeSwitch /> },
  { path: ROUTES.WHY_ATHALINK, element: <WhyMyKonnect /> },
  { path: ROUTES.PARTNERSHIPS, element: <Partnerships /> },
  { path: ROUTES.PARTNERSHIP_SUCCESS, element: <PartnershipSuccess /> },
  { path: ROUTES.SOCCER, element: <SoccerPillars /> },
  { path: ROUTES.ROWING, element: <RowingPillars /> },
  { path: ROUTES.ABOUT, element: <About /> },
];

// Public pages that render inside the app shell for signed-in users
export const DUAL_CHROME_ROUTES: AppRoute[] = [
  { path: ROUTES.COACHES, element: <AllCoaches /> },
  { path: ROUTES.GROUP_OFFER, element: <GroupOffer /> },
  { path: ROUTES.COACH_PRICING, element: <CoachProfile /> },
  { path: ROUTES.COACH_PROFILE, element: <CoachProfile /> },
  { path: ROUTES.ORGANIZATION, element: <OrganizationProfile /> },
  { path: ROUTES.INVITE, element: <InviteClaim /> },
  { path: ROUTES.GEAR, element: <Gear /> },
  { path: ROUTES.GEAR_PRODUCT, element: <GearProduct /> },
  // Support and legal pages: reachable from inside the app, so signed-in
  // users must keep the app shell instead of landing in the marketing chrome.
  { path: ROUTES.CONTACT_US, element: <ContactUs /> },
  { path: ROUTES.PRIVACY_POLICY, element: <PrivacyPolicy /> },
  { path: ROUTES.TERMS_AND_CONDITIONS, element: <TermsAndConditions /> },
  { path: ROUTES.BECOME_COACH, element: <BecomeACoach /> },
];

export const AUTH_FLOW_ROUTES: AppRoute[] = [
  { path: ROUTES.AUTH, element: <Auth /> },
  { path: ROUTES.FORGOT_PASSWORD, element: <ForgotPassword /> },
  { path: ROUTES.RESET_PASSWORD, element: <ResetPassword /> },
  { path: ROUTES.SIGN_UP_CONFIRMATION, element: <SignupConfirmation /> },
];

// Authenticated app routes - every element wrapped in ProtectedRoute
export const APP_ROUTES: AppRoute[] = [
  { path: ROUTES.DASHBOARD, element: <ProtectedRoute><Dashboard /></ProtectedRoute> },
  { path: ROUTES.PROFILE, element: <ProtectedRoute><Profile /></ProtectedRoute> },
  { path: ROUTES.MY_SESSIONS, element: <ProtectedRoute><MySessions /></ProtectedRoute> },
  { path: ROUTES.INVITES, element: <ProtectedRoute><Invites /></ProtectedRoute> },
  { path: ROUTES.MY_CLIENTS, element: <MyClientsRedirect /> },
  { path: ROUTES.ATHLETES, element: <ProtectedRoute><MyAthletes /></ProtectedRoute> },
  { path: ROUTES.ATHLETE, element: <ProtectedRoute><AthleteDetail /></ProtectedRoute> },
  { path: ROUTES.MY_COACHES, element: <ProtectedRoute><MyCoaches /></ProtectedRoute> },
  { path: ROUTES.CHAT, element: <ProtectedRoute><ChatPage /></ProtectedRoute> },
  { path: ROUTES.SETTINGS, element: <ProtectedRoute><AccountSettings /></ProtectedRoute> },
  { path: ROUTES.ADMIN_ACCOUNTS, element: <ProtectedRoute><AdminAccounts /></ProtectedRoute> },
  { path: ROUTES.CHANGE_PASSWORD, element: <ProtectedRoute><ChangePassword /></ProtectedRoute> },
  { path: ROUTES.BOOK, element: <ProtectedRoute><BookSession /></ProtectedRoute> },
  { path: ROUTES.SCHEDULE, element: <ProtectedRoute><MySchedule /></ProtectedRoute> },
  { path: ROUTES.SCHEDULE_PLAN, element: <ProtectedRoute><PlanGroups /></ProtectedRoute> },
  { path: ROUTES.SCHEDULE_SETTINGS, element: <ProtectedRoute><ScheduleSettings /></ProtectedRoute> },
  { path: ROUTES.AVAILABILITY, element: <Navigate to={ROUTES.SCHEDULE_SETTINGS} replace /> },
  { path: ROUTES.CALENDAR, element: <Navigate to={ROUTES.SCHEDULE} replace /> },
  { path: ROUTES.ANALYTICS, element: <ProtectedRoute><Analytics /></ProtectedRoute> },
  { path: ROUTES.CREATE_ATHLETE_PROFILE, element: <ProtectedRoute><CreateAthleteProfile /></ProtectedRoute> },
  { path: ROUTES.COACH_SESSION_FEEDBACK, element: <ProtectedRoute><SessionFeedback /></ProtectedRoute> },
  { path: ROUTES.COACH_SESSION, element: <ProtectedRoute><CoachSession /></ProtectedRoute> },
  { path: ROUTES.BOOKING_CONFIRMATION, element: <ProtectedRoute><BookingConfirmation /></ProtectedRoute> },
  { path: ROUTES.PACKAGE_CONFIRMATION, element: <ProtectedRoute><PackageConfirmation /></ProtectedRoute> },
  { path: ROUTES.MY_ORGANIZATION, element: <ProtectedRoute><MyOrganization /></ProtectedRoute> },
  { path: ROUTES.PAYMENTS, element: <ProtectedRoute><Payments /></ProtectedRoute> },
  { path: ROUTES.BUSINESS, element: <ProtectedRoute><Business /></ProtectedRoute> },
  { path: ROUTES.ACCOUNT, element: <ProtectedRoute><Account /></ProtectedRoute> },
  { path: ROUTES.FAMILY_INVOICE, element: <ProtectedRoute><FamilyInvoice /></ProtectedRoute> },
  { path: ROUTES.ORG_INVITE, element: <ProtectedRoute><OrganizationInvite /></ProtectedRoute> },
  { path: ROUTES.ADMIN_REFERRALS, element: <ProtectedRoute requireAdmin><AdminReferrals /></ProtectedRoute> },
];

export const NOT_FOUND_ROUTE: AppRoute = {
  path: ROUTES.NOT_FOUND,
  element: <NotFound />,
};
