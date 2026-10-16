import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";
import { strings } from "@/config/strings";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/common/UserMenu";
import { Menu, ChevronDown, MessageCircle } from "lucide-react";
import footballIcon from "@/assets/images/colored-soccer.png";
import rowerIcon from "@/assets/images/colored-rowing.png";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import logo from "@/assets/AthaNext-Logo.svg";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect, useRef, forwardRef, type ButtonHTMLAttributes } from "react";
import { useProfile } from "@/contexts/ProfileContext";
import { useRole } from "@/hooks/useRole";
import { useNavigate, useLocation } from "react-router-dom";
import { ProfileIncompleteBanner } from "@/components/common/ProfileIncompleteBanner";
import { PROFILE_TYPE } from "@/utils/db";
import type { Role } from "@/utils/role";
import { sportFromText } from "@/utils/coachSport";

// Brand-kit class strings shared by the desktop nav, dropdowns and mobile menu.
const NAV_ITEM =
  "flex h-7 items-center gap-[5px] whitespace-nowrap rounded-[8px] px-2 lg:px-2.5 text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#767980] transition-colors hover:bg-[#F9F9F5] hover:text-[#1A202C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2]";
const NAV_ITEM_ACTIVE = "bg-[#F9F9F5] text-[#0054B4] hover:text-[#0054B4]";
const MENU_CONTENT =
  "z-50 flex flex-col gap-[5px] rounded-[10px] border-[#EAEADF] bg-[#F4F4EB] p-[10px] text-[#767980] shadow-[0px_0px_15px_0px_rgba(0,0,0,0.05)]";
const MENU_ITEM =
  "cursor-pointer rounded-[5px] p-[5px] text-[14px] font-normal leading-[18px] tracking-[-0.03em] text-[#767980] focus:bg-[#F9F9F5] focus:text-[#1A202C]";
const MENU_ITEM_ACTIVE = "text-[#0054B4] focus:text-[#0054B4]";
const MOBILE_ITEM =
  "rounded-[8px] px-3 py-2 text-left text-[16px] font-medium leading-[20px] tracking-[-0.03em] text-[#1A202C] transition-colors hover:bg-[#F9F9F5]";
const MOBILE_SECTION_LABEL =
  "mb-2 text-[12px] font-medium leading-[14px] tracking-[-0.03em] text-[#A3A6AB]";
const PRIMARY_BUTTON =
  "h-[34px] rounded-[8px] border border-[#6698D2] bg-[#0054B4] px-3 text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#F1F1E6] hover:bg-[#004390] hover:text-[#F1F1E6]";
const SECONDARY_BUTTON =
  "h-[34px] rounded-[8px] border border-[#EAEADF] bg-[#F4F4EB] px-3 text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C] hover:bg-[#EAEADF] hover:text-[#1A202C]";
const CHAT_BUTTON =
  "relative inline-flex size-[34px] shrink-0 items-center justify-center rounded-[8px] border border-[#EAEADF] bg-[#F4F4EB] text-[#1A202C] transition-colors hover:bg-[#EAEADF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2]";
const AVATAR_SKELETON = "size-7 rounded-full bg-[#EAEADF] animate-pulse";

const ROLE_PILLS: Record<Role, { label: string; tone: string }> = {
  athlete: { label: "Athlete", tone: "bg-[#E7F4F8] text-[#1599BC]" },
  coach: { label: "Coach", tone: "bg-[#E5EDF7] text-[#0054B4]" },
  parent: { label: "Parent", tone: "bg-[#F1F1E6] text-[#484D56]" },
};

/** Messages button with a count-less unread badge (the app only tracks a boolean). */
const ChatButton = forwardRef<
  HTMLButtonElement,
  { hasNew: boolean } & ButtonHTMLAttributes<HTMLButtonElement>
>(({ hasNew, className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className={cn(CHAT_BUTTON, className)}
    aria-label={hasNew ? "Messages, new messages" : "Messages"}
    {...props}
  >
    <MessageCircle className="size-4" strokeWidth={1.5} aria-hidden="true" />
    {hasNew && (
      <span
        aria-hidden="true"
        className="absolute -right-1 -top-1 size-2.5 rounded-[4px] bg-[#0054B4] ring-2 ring-[#F7F7F0]"
      />
    )}
  </button>
));
ChatButton.displayName = "ChatButton";

const AvatarSkeleton = () => (
  <div className="flex items-center justify-center">
    <div className={AVATAR_SKELETON}></div>
  </div>
);

interface HeaderProps {
  onSportClick: (sport: string) => void;
}

export const Header = ({ onSportClick }: HeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const { user: userData, loading: authLoading, hasNewMessage, setHasNewMessage, userImg, profileReady } = useAuth();
  const { profile, loading, profileProgress } = useProfile();
  const { role: personaType } = useRole();

  const profileCompletion = profileProgress.completion;

  const isMobile = useIsMobile();
  const isHoveringRef = useRef(false);
  const hoverTimeoutRef = useRef<any>(null);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sportsDropdownOpen, setSportsDropdownOpen] = useState(false);

  useEffect(() => {
    const timeoutRef = hoverTimeoutRef.current;
    return () => {
      if (timeoutRef) {
        clearTimeout(timeoutRef);
      }
    };
  }, []);

  // Determine active states based on current route
  const isOnSoccerPage = location.pathname.includes('/soccer');
  const isOnRowingPage = location.pathname.includes('/rowing');
  const isOnCoachesPage = location.pathname.includes('/coaches');
  const isOnGearPage = location.pathname === ROUTES.GEAR || location.pathname.startsWith(`${ROUTES.GEAR}/`);
  const isOnResourcesPage = location.pathname === '/partnerships';
  const isOnHomePage = location.pathname === '/';
  const isOnHowItWorksPage = location.pathname === '/why-athalink';
  const isOnBecomeACoachPage = location.pathname === '/become-a-coach';
  const isOnSportsPage = isOnSoccerPage || isOnRowingPage;
  const isOnAboutPage = location.pathname === '/about';
  const isOnContactPage = location.pathname === ROUTES.CONTACT_US;
  const isOnCompleteProfile =
    location.pathname === ROUTES.AUTH &&
    new URLSearchParams(location.search).get("mode") === "complete-profile";
  const completeProfileLogoUrl =
    "https://znrdabzydvulagmlepxr.supabase.co/storage/v1/object/public/athalink-images/assets/AthaNext-Logo.svg";
  const logoSrc = isOnCompleteProfile ? completeProfileLogoUrl : logo;

  // For coaches, profile.data might be null if coach record doesn't exist yet
  // But userProfile should still exist for authenticated users

  // Helper to get user display info with persistent image caching
  const getUserInfo = () => {
    // Always prioritize profile.userProfile when available
    if (profile?.userProfile) {
      const profileImage = profile.userProfile.image_url;
      // Prefer immediate AuthContext image when available (setUserImg is updated immediately on save)
      // Fall back to profile.userProfile.image_url when auth image isn't set
      const platformImg = userImg && userImg.trim() !== '' ? userImg : (profileImage || null);
      const googleImg = userData?.user_metadata?.avatar_url || null;
      return {
        name: profile.userProfile.name || userData?.user_metadata?.full_name || '',
        email: profile.userProfile.email || userData?.email || '',
        img: profileReady ? platformImg : null,
        fallbackImg: googleImg,
        personaType,
      };
    }
    // Fallback to userData if profile not loaded yet
    const googleImg = userData?.user_metadata?.avatar_url || null;
    return {
      name: userData?.user_metadata?.full_name || '',
      email: userData?.email || '',
      img: profileReady ? userImg : null,
      fallbackImg: googleImg,
      personaType,
    };
  };
  
  const userInfo = getUserInfo();
  const personaSport = sportFromText(
    profile?.data?.sport || profile?.userProfile?.sport || userData?.user_metadata?.sport
  );
  const personaSportIcon = personaSport === "rowing" ? rowerIcon : personaSport === "soccer" ? footballIcon : null;

  const handleLogoClick = () => {
    navigate("/");
    setMobileMenuOpen(false);
  };

  const handleHomeClick = () => {
    if (location.pathname === "/") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      navigate("/");
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 100);
    }
    setMobileMenuOpen(false);
  };

  const handleNavClick = (action: () => void) => {
    action();
    setMobileMenuOpen(false);
  };

  const handleMessagesClick = () => {
    setHasNewMessage(false);
    setMobileMenuOpen(false);
    navigate(ROUTES.CHAT);
  };

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobile && mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobile, mobileMenuOpen]);

  useEffect(() => {
    if (isMobile && mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  }, [isMobile, location.pathname, location.search]);

  const bannerOffset = "var(--network-banner-height, 0px)";


  const rolePill = personaType ? ROLE_PILLS[personaType] : null;

  const signedOutButtons = (
    <div className="flex gap-2">
      <Button
        onClick={() => navigate("/auth?mode=signin")}
        variant="outline"
        size="sm"
        className={SECONDARY_BUTTON}
      >
        Sign in
      </Button>
      <Button
        onClick={() => navigate("/auth?mode=signup")}
        variant="default"
        size="sm"
        className={PRIMARY_BUTTON}
      >
        Sign up
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <>
        <header
          className="fixed w-full z-50 bg-[#F7F7F0] border-b border-[#EAEADF] h-[3.8rem] px-4"
          style={{ top: bannerOffset }}
        >
          <div className="mx-auto h-full flex justify-between items-center">
            {/* Mobile Logo */}
            <button
              type="button"
              onClick={handleLogoClick}
              className="flex items-center hover:opacity-80 transition-opacity duration-200"
            >
              <img src={logoSrc} alt={strings.brand.name} className="h-7 w-auto" />
              <span className="sr-only">{strings.brand.name}</span>
            </button>

            {/* Mobile Right Side */}
            <div className="flex items-center gap-3">
              {authLoading ? (
                <AvatarSkeleton />
              ) : userData ? (
                loading ? (
                  <AvatarSkeleton />
                ) : personaType ? (
                  <>
                    <ChatButton hasNew={hasNewMessage} onClick={handleMessagesClick} />
                    <UserMenu
                      name={userInfo.name}
                      email={userInfo.email}
                      img={userInfo.img}
                      fallbackImg={(userInfo as any).fallbackImg}
                      useFallbackDelay
                      avatarReady={profileReady}
                      variant="header"
                    />
                  </>
                ) : (
                  <AvatarSkeleton />
                )
              ) : (
                signedOutButtons
              )}
              <button
                type="button"
                className="inline-flex size-[34px] items-center justify-center rounded-[8px] text-[#1A202C] transition-colors hover:bg-[#F4F4EB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2]"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileMenuOpen}
              >
                <Menu className="size-5" strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Mobile Menu Dropdown */}
          {mobileMenuOpen && (
            <div className="h-screen overflow-auto px-2 pb-4 border-t border-[#EAEADF] bg-[#F7F7F0] fixed inset-0 top-[3.5rem] !z-[100]">
              <nav className="flex flex-col gap-1 pt-4">
                <button
                  type="button"
                  onClick={handleHomeClick}
                  className={cn(MOBILE_ITEM, isOnHomePage && "text-[#0054B4]")}
                >
                  {strings.navigation.home}
                </button>
                <button
                  type="button"
                  onClick={() => handleNavClick(() => navigate("/why-athalink"))}
                  className={cn(MOBILE_ITEM, isOnHowItWorksPage && "text-[#0054B4]")}
                >
                  {strings.titles.whyMyKonnect}
                </button>
                <div className="px-3 py-2">
                  <div className={MOBILE_SECTION_LABEL}>Sports</div>
                  <div className="flex flex-col gap-1 pl-1">
                    <button
                      type="button"
                      onClick={() => handleNavClick(() => onSportClick("soccer"))}
                      className={cn(MOBILE_ITEM, isOnSoccerPage && "text-[#0054B4]")}
                    >
                      Soccer
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavClick(() => onSportClick("rowing"))}
                      className={cn(MOBILE_ITEM, isOnRowingPage && "text-[#0054B4]")}
                    >
                      Rowing
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleNavClick(() => navigate("/coaches"))}
                  className={cn(MOBILE_ITEM, isOnCoachesPage && "text-[#0054B4]")}
                >
                  Coaches
                </button>
                <button
                  type="button"
                  onClick={() => handleNavClick(() => navigate(ROUTES.GEAR))}
                  className={cn(MOBILE_ITEM, isOnGearPage && "text-[#0054B4]")}
                >
                  Gear
                </button>
                <button
                  type="button"
                  onClick={() => handleNavClick(() => navigate("/partnerships"))}
                  className={cn(MOBILE_ITEM, isOnResourcesPage && "text-[#0054B4]")}
                >
                  Resources
                </button>
                {personaType !== "coach" && (
                  <button
                    type="button"
                    onClick={() => handleNavClick(() => navigate("/become-a-coach"))}
                    className={cn(MOBILE_ITEM, isOnBecomeACoachPage && "text-[#0054B4]")}
                  >
                    Become a coach
                  </button>
                )}
                <div className="px-3 py-2">
                  <div className={MOBILE_SECTION_LABEL}>Get in touch</div>
                  <div className="flex flex-col gap-1 pl-1">
                    <button
                      type="button"
                      onClick={() => handleNavClick(() => navigate("/about"))}
                      className={cn(MOBILE_ITEM, isOnAboutPage && "text-[#0054B4]")}
                    >
                      About us
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavClick(() => navigate(ROUTES.CONTACT_US))}
                      className={cn(MOBILE_ITEM, isOnContactPage && "text-[#0054B4]")}
                    >
                      Contact us
                    </button>
                  </div>
                </div>
                {profile && profile?.data && Object.keys(profile.data).length > 0 && (
                  <Button
                    onClick={() => handleNavClick(() => navigate("/coaches"))}
                    className={cn(SECONDARY_BUTTON, "mt-2 self-start ml-3")}
                    size="sm"
                    variant="outline"
                  >
                    Find a coach
                  </Button>
                )}
              </nav>
            </div>
          )}
        </header>
        {userData && personaType && (
          <ProfileIncompleteBanner
            profileCompletion={profileCompletion}
          />
        )}
      </>
    );
  }

  return (
    <>
      <header
        className="fixed w-full z-50 bg-[#F7F7F0] border-b border-[#EAEADF] h-[3.8rem] mx-auto px-5 overflow-hidden"
        style={{ top: bannerOffset }}
      >
        <div className="max-w-8xl mx-auto h-full flex justify-between items-center gap-3">
          {/* Logo Section */}
          <button
            type="button"
            onClick={handleLogoClick}
            className="flex shrink-0 items-center hover:opacity-90 transition-opacity duration-200"
          >
            <img src={logoSrc} alt={strings.brand.name} className="h-7 w-auto" />
            <span className="sr-only">{strings.brand.name}</span>
          </button>

          {/* Main Navigation */}
          <NavigationMenu>
            <NavigationMenuList className="gap-1 space-x-0">
              {/* Home */}
              <NavigationMenuItem>
                <NavigationMenuLink asChild>
                  <button
                    type="button"
                    onClick={handleHomeClick}
                    className={cn(NAV_ITEM, isOnHomePage && NAV_ITEM_ACTIVE)}
                  >
                    Home
                  </button>
                </NavigationMenuLink>
              </NavigationMenuItem>

              {/* Why AthaLink */}
              <NavigationMenuItem>
                <NavigationMenuLink asChild>
                  <button
                    type="button"
                    onClick={() => navigate("/why-athalink")}
                    className={cn(NAV_ITEM, isOnHowItWorksPage && NAV_ITEM_ACTIVE)}
                  >
                    <span className="hidden xl:inline">Why {strings.brand.name}</span>
                    <span className="inline xl:hidden">{strings.brand.name}</span>
                  </button>
                </NavigationMenuLink>
              </NavigationMenuItem>

              {/* Sports Dropdown */}
              <NavigationMenuItem>
                <DropdownMenu
                  open={sportsDropdownOpen}
                  onOpenChange={(next) => {
                    if (next) {
                      setSportsDropdownOpen(true);
                    } else {
                      if (!isHoveringRef.current) setSportsDropdownOpen(false);
                    }
                  }}
                >
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={cn(NAV_ITEM, isOnSportsPage && NAV_ITEM_ACTIVE)}
                    >
                      Sports
                      <ChevronDown className="size-4" strokeWidth={1.5} aria-hidden="true" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className={cn(MENU_CONTENT, "w-[200px]")}
                    sideOffset={8}
                  >
                    <DropdownMenuItem
                      onClick={() => { onSportClick("soccer"); setSportsDropdownOpen(false); }}
                      className={cn(MENU_ITEM, isOnSoccerPage && MENU_ITEM_ACTIVE)}
                    >
                      Soccer
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => { onSportClick("rowing"); setSportsDropdownOpen(false); }}
                      className={cn(MENU_ITEM, isOnRowingPage && MENU_ITEM_ACTIVE)}
                    >
                      Rowing
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </NavigationMenuItem>

              {/* Coaches */}
              <NavigationMenuItem>
                <NavigationMenuLink asChild>
                  <button
                    type="button"
                    onClick={() => navigate("/coaches")}
                    className={cn(NAV_ITEM, isOnCoachesPage && NAV_ITEM_ACTIVE)}
                  >
                    Coaches
                  </button>
                </NavigationMenuLink>
              </NavigationMenuItem>

              {/* Gear */}
              <NavigationMenuItem>
                <NavigationMenuLink asChild>
                  <button
                    type="button"
                    onClick={() => navigate(ROUTES.GEAR)}
                    className={cn(NAV_ITEM, isOnGearPage && NAV_ITEM_ACTIVE)}
                  >
                    Gear
                  </button>
                </NavigationMenuLink>
              </NavigationMenuItem>

              {/* Resources */}
              <NavigationMenuItem>
                <NavigationMenuLink asChild>
                  <button
                    type="button"
                    onClick={() => navigate("/partnerships")}
                    className={cn(NAV_ITEM, isOnResourcesPage && NAV_ITEM_ACTIVE)}
                  >
                    Resources
                  </button>
                </NavigationMenuLink>
              </NavigationMenuItem>

              {personaType !== "coach" && (
                <NavigationMenuItem className="hidden xl:flex">
                  <NavigationMenuLink asChild>
                    <button
                      type="button"
                      onClick={() => navigate("/become-a-coach")}
                      className={cn(NAV_ITEM, isOnBecomeACoachPage && NAV_ITEM_ACTIVE)}
                    >
                      Become a coach
                    </button>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              )}

              {/* About Dropdown */}
              <NavigationMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={cn(NAV_ITEM, (isOnAboutPage || isOnContactPage) && NAV_ITEM_ACTIVE)}
                    >
                      <span className="hidden lg:inline">Get in touch</span>
                      <span className="inline lg:hidden">Contact</span>
                      <ChevronDown className="size-4" strokeWidth={1.5} aria-hidden="true" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className={cn(MENU_CONTENT, "w-[180px]")}
                    sideOffset={8}
                  >
                    <DropdownMenuItem
                      onClick={() => navigate("/about")}
                      className={cn(MENU_ITEM, isOnAboutPage && MENU_ITEM_ACTIVE)}
                    >
                      About us
                    </DropdownMenuItem>
                    {personaType !== "coach" && (
                      <DropdownMenuItem
                        onClick={() => navigate("/become-a-coach")}
                        className={cn(MENU_ITEM, "xl:hidden", isOnBecomeACoachPage && MENU_ITEM_ACTIVE)}
                      >
                        Become a coach
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => navigate(ROUTES.CONTACT_US)}
                      className={cn(MENU_ITEM, isOnContactPage && MENU_ITEM_ACTIVE)}
                    >
                      Contact us
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>

          {/* Right Side Actions */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Role pill (athlete teal, coach blue, parent neutral); opens the profile */}
            {rolePill && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => handleNavClick(() => navigate(ROUTES.PROFILE))}
                    className={cn(
                      "hidden lg:inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-[14px] font-medium leading-[18px] tracking-[-0.03em] whitespace-nowrap shrink-0 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2]",
                      rolePill.tone
                    )}
                    aria-label="Go to profile"
                  >
                    {personaSportIcon && (
                      <img src={personaSportIcon} alt="" aria-hidden="true" className="h-3.5 w-3.5" />
                    )}
                    {rolePill.label}
                  </button>
                </TooltipTrigger>
                <TooltipContent>Click to open profile</TooltipContent>
              </Tooltip>
            )}
            {userData && personaType && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <ChatButton hasNew={hasNewMessage} onClick={handleMessagesClick} />
                </TooltipTrigger>
                <TooltipContent>
                  Messages
                </TooltipContent>
              </Tooltip>
            )}
            {authLoading ? (
              <AvatarSkeleton />
            ) : userData ? (
              loading ? (
                <AvatarSkeleton />
              ) : personaType ? (
                <UserMenu
                  name={userInfo.name}
                  email={userInfo.email}
                  img={userInfo.img}
                  fallbackImg={(userInfo as any).fallbackImg}
                  useFallbackDelay
                  avatarReady={profileReady}
                  variant="header"
                />
              ) : (
                <AvatarSkeleton />
              )
            ) : (
              signedOutButtons
            )}
          </div>
        </div>
      </header>
      {!(location.pathname === ROUTES.PROFILE || location.pathname === ROUTES.AUTH) &&
        userData && personaType && (
          <ProfileIncompleteBanner
            profileCompletion={profileCompletion}
          />
        )}
    </>
  );
};
