import type { ReactNode } from "react";

import Index from "./pages/Index";
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
import About from "./pages/About";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsAndConditions from "./pages/TermsAndConditions";
import ContactUs from "./pages/ContactUs";
import SignupConfirmation from "./pages/SignupConfirmation";
import AthleteProfile from "./pages/AthleteProfile";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import { AuthGuard } from "./components/common/AuthGuard";
import CoachSessionFeedback from "./pages/CoachSessionFeedback";
import MySessions from "./pages/MySessions";
import ChatPage from "./pages/ChatPage";
import BookingConfirmation from "./pages/BookingConfirmation";
import PackageConfirmation from "./pages/PackageConfirmation";
import CreateAthleteProfile from "./pages/CreateAthleteProfile";

export const ROUTES = {
  HOME: "/",
  WHY_ATHALINK: "/why-athalink",
  BECOME_COACH: "/become-a-coach",
  AUTH: "/auth",
  SIGN_UP_CONFIRMATION: "/signupconfirmation",
  FORGOT_PASSWORD: "/forgot-password",
  RESET_PASSWORD: "/reset-password",
  COACHES: "/coaches",
  PARTNERSHIPS: "/partnerships",
  PARTNERSHIP_SUCCESS: "/partnership-success",
  SOCCER: "/soccer",
  ROWING: "/rowing",
  COACH_PROFILE: "/coach/:id",
  BOOKING_CONFIRMATION: "/booking-confirmation",
  PACKAGE_CONFIRMATION: "/package-confirmation",
  COACH_SESSION_FEEDBACK: "/coach-session-feedback",
  MY_SESSIONS: "/my-sessions",
  CREATE_ATHLETE_PROFILE: "/athlete-profile/create",
  SETTINGS: "/settings",
  ABOUT: "/about",
  PRIVACY_POLICY: "/privacy-policy",
  TERMS_AND_CONDITIONS: "/terms-and-conditions",
  CONTACT_US: "/contact",
  PROFILE: "/profile",
  CHAT: "/chat",
  NOT_FOUND: "*",
} as const;

interface AppRoute {
  path: string;
  element: ReactNode;
}

export const APP_ROUTES: AppRoute[] = [
  { path: ROUTES.HOME, element: <Index /> },
  { path: ROUTES.WHY_ATHALINK, element: <WhyMyKonnect /> },
  { path: ROUTES.BECOME_COACH, element: <BecomeACoach /> },
  { path: ROUTES.AUTH, element: <Auth /> },
  { path: ROUTES.FORGOT_PASSWORD, element: <ForgotPassword /> },
  { path: ROUTES.RESET_PASSWORD, element: <ResetPassword /> },
  { path: ROUTES.COACHES, element: <AllCoaches /> },
  { path: ROUTES.PARTNERSHIPS, element: <Partnerships /> },
  { path: ROUTES.PARTNERSHIP_SUCCESS, element: <PartnershipSuccess /> },
  { path: ROUTES.SOCCER, element: <SoccerPillars /> },
  { path: ROUTES.ROWING, element: <RowingPillars /> },
  { path: ROUTES.COACH_PROFILE, element: <CoachProfile /> },
  { path: ROUTES.BOOKING_CONFIRMATION, element: <AuthGuard><BookingConfirmation /></AuthGuard> },
  { path: ROUTES.PACKAGE_CONFIRMATION, element: <PackageConfirmation /> },
  { path: ROUTES.COACH_SESSION_FEEDBACK, element: <CoachSessionFeedback /> },
  { path: ROUTES.MY_SESSIONS, element: <MySessions /> },
  { path: ROUTES.CREATE_ATHLETE_PROFILE, element: <AuthGuard><CreateAthleteProfile /></AuthGuard> },
  { path: ROUTES.SETTINGS, element: <ChangePassword /> },
  { path: ROUTES.ABOUT, element: <About /> },
  { path: ROUTES.SIGN_UP_CONFIRMATION, element: <SignupConfirmation /> },
  { path: ROUTES.PRIVACY_POLICY, element: <PrivacyPolicy /> },
  { path: ROUTES.TERMS_AND_CONDITIONS, element: <TermsAndConditions /> },
  { path: ROUTES.CONTACT_US, element: <ContactUs /> },
  { path: ROUTES.CHAT, element: <ChatPage /> },
  { path: ROUTES.PROFILE, element: <AuthGuard><Profile /></AuthGuard> },
];

export const NOT_FOUND_ROUTE: AppRoute = {
  path: ROUTES.NOT_FOUND,
  element: <NotFound />,
};
