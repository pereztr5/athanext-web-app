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
import { FiMessageCircle } from "react-icons/fi";
import footballIcon from "@/assets/images/colored-soccer.png";
import rowerIcon from "@/assets/images/colored-rowing.png";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import logo from "@/assets/AthaNext-Logo.svg";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect, useRef } from "react";
import { useProfile } from "@/contexts/ProfileContext";
import { useNavigate, useLocation } from "react-router-dom";
import { ProfileIncompleteBanner } from "@/components/common/ProfileIncompleteBanner";
import { PROFILE_TYPE } from "@/utils/db";
import { calculateProfileProgress } from "@/utils/profileCompletion";

interface HeaderProps {
  onSportClick: (sport: string) => void;
}

export const Header = ({ onSportClick }: HeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const { user: userData, loading: authLoading, profileProgress, hasNewMessage, setHasNewMessage, userImg, profileReady } = useAuth();
  const { profile, loading } = useProfile();

  const contextProfileCompletion = profileProgress.completion;
  const headerProfileCompletion =
    profile?.data ? calculateProfileProgress(profile.data as any).completion : contextProfileCompletion;

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
    "https://nnhmiokeizmfmkvdqrvi.supabase.co/storage/v1/object/public/athalink-images/assets/AthaNext-Logo.svg";
  const logoSrc = isOnCompleteProfile ? completeProfileLogoUrl : logo;

  // For coaches, profile.data might be null if coach record doesn't exist yet
  // But userProfile should still exist for authenticated users

  // Helper to get persona type from either profile or user metadata
  const getPersonaType = () => {
    return profile?.userProfile?.persona_type || userData?.user_metadata?.persona_type || null;
  };
  
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
        personaType: profile.userProfile.persona_type,
      };
    }
    // Fallback to userData if profile not loaded yet
    const googleImg = userData?.user_metadata?.avatar_url || null;
    return {
      name: userData?.user_metadata?.full_name || '',
      email: userData?.email || '',
      img: profileReady ? userImg : null,
      fallbackImg: googleImg,
      personaType: userData?.user_metadata?.persona_type || null,
    };
  };
  
  const personaType = getPersonaType();
  const userInfo = getUserInfo();
  const personaSport = (
    profile?.data?.sport ||
    profile?.userProfile?.sport ||
    userData?.user_metadata?.sport ||
    ""
  )
    .toString()
    .toLowerCase();
  const personaSportIcon = personaSport.includes("row")
    ? rowerIcon
    : ["soccer", "football", "scoccer"].some((s) => personaSport.includes(s))
    ? footballIcon
    : null;

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

  if (isMobile) {
    return (
      <>
        <header
          className="fixed w-full z-50 !bg-white border-b border-border h-[3.8rem] px-4"
          style={{ top: bannerOffset }}
        >
          <div className="mx-auto py-2 !bg-white">
            <div className="flex justify-between items-center">
              {/* Mobile Logo */}
              <button
                onClick={handleLogoClick}
                className="flex items-center hover:opacity-80 hover:scale-105 transition-all duration-200"
              >
                <img src={logoSrc} alt={strings.brand.name} className="h-8 w-auto" />
                <span className="sr-only">{strings.brand.name}</span>
              </button>

              {/* Mobile Right Side */}
              <div className="flex items-center gap-2">
                {authLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-muted animate-pulse"></div>
                  </div>
                ) : userData ? (
                  loading ? (
                    <div className="flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-muted animate-pulse"></div>
                    </div>
                  ) : personaType ? (
                    <>
                      <button
                        type="button"
                        onClick={handleMessagesClick}
                        className="relative inline-flex items-center text-sm font-semibold text-white p-2 rounded-full bg-primary shadow-sm hover:shadow-md transition hover:bg-primary/90"
                        aria-label="Messages"
                      >
                        <FiMessageCircle className="h-4 w-4 text-white" aria-hidden="true" />
                        {hasNewMessage && (
                          <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 ring-2 ring-white"></span>
                          </span>
                        )}
                      </button>
                      <UserMenu
                        name={userInfo.name}
                        email={userInfo.email}
                        img={userInfo.img}
                        fallbackImg={(userInfo as any).fallbackImg}
                        useFallbackDelay
                        avatarReady={profileReady}
                        completionOverride={headerProfileCompletion}
                      />
                    </>
                  ) : (
                    <div className="flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-muted animate-pulse"></div>
                    </div>
                  )
                ) : (
                  <div className="flex gap-2">
                    <Button onClick={() => navigate("/auth?mode=signin")} variant="outline" size="sm">
                      Sign In
                    </Button>
                    <Button onClick={() => navigate("/auth?mode=signup")} variant="default" size="sm">
                      Sign Up
                    </Button>
                  </div>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="p-2"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Mobile Menu Dropdown */}
            {mobileMenuOpen && (
              <div className="h-screen overflow-auto pb-4 border-t border-border bg-white fixed inset-0 top-[3.5rem] !z-[100]">
                <nav className="flex flex-col gap-2 pt-4">
                  <button
                    onClick={handleHomeClick}
                    className="text-left px-3 py-2 text-foreground hover:bg-accent rounded-md transition-colors"
                  >
                    {strings.navigation.home}
                  </button>
                  <button
                    onClick={() => handleNavClick(() => navigate("/why-athalink"))}
                    className="text-left px-3 py-2 text-foreground hover:bg-accent rounded-md transition-colors"
                  >
                    {strings.titles.whyMyKonnect}
                  </button>
                  <div className="px-3 py-2">
                    <div className="text-sm font-medium text-muted-foreground mb-2">Sports</div>
                    <div className="flex flex-col gap-1 pl-3">
                      <button
                        onClick={() => handleNavClick(() => onSportClick("soccer"))}
                        className="text-left px-3 py-2 text-foreground hover:bg-accent rounded-md transition-colors"
                      >
                        Soccer
                      </button>
                      <button
                        onClick={() => handleNavClick(() => onSportClick("rowing"))}
                        className="text-left px-3 py-2 text-foreground hover:bg-accent rounded-md transition-colors"
                      >
                        Rowing
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => handleNavClick(() => navigate("/coaches"))}
                    className="text-left px-3 py-2 text-foreground hover:bg-accent rounded-md transition-colors"
                  >
                    View All Coaches
                  </button>
                  <button
                    onClick={() => handleNavClick(() => navigate("/partnerships"))}
                    className="text-left px-3 py-2 text-foreground hover:bg-accent rounded-md transition-colors"
                  >
                    Specialized Resources
                  </button>
                  {personaType !== "coach" && (
                    <button
                      onClick={() => handleNavClick(() => navigate("/become-a-coach"))}
                      className="text-left px-3 py-2 text-foreground hover:bg-accent rounded-md transition-colors"
                    >
                      Become a Coach
                    </button>
                  )}
                  <div className="px-3 py-2">
                    <div className="text-sm font-medium text-muted-foreground mb-2">Get In Touch</div>
                    <div className="flex flex-col gap-1 pl-3">
                      <button
                        onClick={() => handleNavClick(() => navigate("/about"))}
                        className="text-left px-3 py-2 text-foreground hover:bg-accent rounded-md transition-colors"
                      >
                        {strings.about.navigation.aboutUs}
                      </button>
                      <button
                        onClick={() => handleNavClick(() => navigate(ROUTES.CONTACT_US))}
                        className="text-left px-3 py-2 text-foreground hover:bg-accent rounded-md transition-colors"
                      >
                        {strings.titles.contactUs}
                      </button>
                    </div>
                  </div>
                  {profile && profile?.data && Object.keys(profile.data).length > 0 && (
                    <Button
                      onClick={() => handleNavClick(() => navigate("/coaches"))}
                      className="mt-2 self-start ml-3 px-3 py-2 text-left"
                      size="sm"
                      variant="default"
                    >
                      Find a Coach
                    </Button>
                  )}
                </nav>
              </div>
            )}
          </div>
        </header>
        {userData && personaType && (
          <ProfileIncompleteBanner
            profileCompletion={contextProfileCompletion}
          />
        )}
      </>
    );
  }

  return (
    <>
        <header
          className="fixed w-full z-50 bg-background/95 backdrop-blur-md border-b border-border h-[3.8rem] mx-auto px-4 overflow-hidden"
          style={{ top: bannerOffset }}
        >
        <div className="max-w-8xl py-3 mx-auto">
          <div className="flex justify-between items-center">
            {/* Logo Section */}
            <button
              type="button"
              onClick={handleLogoClick}
              className="flex items-center hover:opacity-90 hover:scale-105 transition-all duration-200"
            >
              <img src={logoSrc} alt={strings.brand.name} className="h-8 lg:h-9 w-auto" />
              <span className="sr-only">{strings.brand.name}</span>
            </button>

            {/* Main Navigation */}
            <NavigationMenu>
              <NavigationMenuList className="gap-1 md:gap-1.5 lg:gap-3">
                {/* Home */}
                <NavigationMenuItem>
                  <NavigationMenuLink asChild>
                    <button
                      onClick={handleHomeClick}
                      className={cn(
                        "px-2 md:px-2.5 lg:px-4 py-2 text-[11px] md:text-xs lg:text-sm font-medium hover:bg-accent rounded-md transition-colors whitespace-nowrap",
                        isOnHomePage && "bg-accent text-accent-foreground"
                      )}
                    >
                      Home
                    </button>
                  </NavigationMenuLink>
                </NavigationMenuItem>

                {/* Why AthaLink */}
                <NavigationMenuItem>
                  <NavigationMenuLink asChild>
                    <button
                      onClick={() => navigate("/why-athalink")}
                      className={cn(
                        "px-2 md:px-2.5 lg:px-4 py-2 text-[11px] md:text-xs lg:text-sm font-medium hover:bg-accent rounded-md transition-colors whitespace-nowrap",
                        isOnHowItWorksPage && "bg-accent text-accent-foreground"
                      )}
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
                        className={cn(
                          "flex items-center gap-1 px-2 md:px-2.5 lg:px-4 py-2 text-[11px] md:text-xs lg:text-sm font-medium hover:bg-accent rounded-md transition-colors whitespace-nowrap",
                          isOnSportsPage && "bg-accent text-accent-foreground"
                        )}
                      >
                        Sports
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="z-50 w-[200px] bg-popover"
                      sideOffset={-2}
                    >
                      <DropdownMenuItem
                        onClick={() => { onSportClick("soccer"); setSportsDropdownOpen(false); }}
                        className={cn(
                          "cursor-pointer",
                          isOnSoccerPage && "bg-accent text-accent-foreground"
                        )}
                      >
                        Soccer
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => { onSportClick("rowing"); setSportsDropdownOpen(false); }}
                        className={cn(
                          "cursor-pointer",
                          isOnRowingPage && "bg-accent text-accent-foreground"
                        )}
                      >
                        Rowing
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </NavigationMenuItem>

                {/* View All Coaches */}
                <NavigationMenuItem>
                  <NavigationMenuLink asChild>
                    <button
                      onClick={() => navigate("/coaches")}
                      className={cn(
                        "px-2 md:px-2.5 lg:px-4 py-2 text-[11px] md:text-xs lg:text-sm font-medium hover:bg-accent rounded-md transition-colors whitespace-nowrap",
                        isOnCoachesPage && "bg-accent text-accent-foreground"
                      )}
                    >
                      <span className="hidden lg:inline">View All Coaches</span>
                      <span className="inline lg:hidden">Coaches</span>
                    </button>
                  </NavigationMenuLink>
                </NavigationMenuItem>

                {/* Resources */}
                <NavigationMenuItem>
                  <NavigationMenuLink asChild>
                    <button
                      onClick={() => navigate("/partnerships")}
                      className={cn(
                        "px-2 md:px-2.5 lg:px-4 py-2 text-[11px] md:text-xs lg:text-sm font-medium hover:bg-accent rounded-md transition-colors whitespace-nowrap",
                        isOnResourcesPage && "bg-accent text-accent-foreground"
                      )}
                    >
                      <span className="hidden lg:inline">Specialized Resources</span>
                      <span className="inline lg:hidden">Resources</span>
                    </button>
                  </NavigationMenuLink>
                </NavigationMenuItem>

                {!userData && (
                  <NavigationMenuItem className="hidden xl:flex">
                    <NavigationMenuLink asChild>
                      <button
                        onClick={() => navigate("/become-a-coach")}
                        className={cn(
                          "px-2 md:px-3 lg:px-4 py-2 text-[11px] md:text-xs lg:text-sm font-medium hover:bg-accent rounded-md transition-colors whitespace-nowrap",
                          isOnBecomeACoachPage && "bg-accent text-accent-foreground"
                        )}
                      >
                        <span className="hidden lg:inline">Become a Coach</span>
                        <span className="inline lg:hidden">Become Coach</span>
                      </button>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                )}

                {/* About Dropdown */}
                <NavigationMenuItem>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                      className={cn(
                        "flex items-center gap-1 px-2 md:px-2.5 lg:px-4 py-2 text-[11px] md:text-xs lg:text-sm font-medium hover:bg-accent rounded-md transition-colors whitespace-nowrap",
                        (isOnAboutPage || isOnContactPage) 
                      )}
                    >
                        <span className="hidden lg:inline">Get In Touch</span>
                        <span className="inline lg:hidden">Contact</span>
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="z-50 w-[180px] bg-popover">
                      <DropdownMenuItem
                        onClick={() => navigate("/about")}
                        className={cn("cursor-pointer", isOnAboutPage )}
                      >
                        {strings.about.navigation.aboutUs}
                      </DropdownMenuItem>
                      {!userData && (
                        <DropdownMenuItem
                          onClick={() => navigate("/become-a-coach")}
                          className={cn("cursor-pointer xl:hidden", isOnBecomeACoachPage)}
                        >
                          Become a Coach
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => navigate(ROUTES.CONTACT_US)}
                        className={cn("cursor-pointer", isOnContactPage )}
                      >
                        {strings.titles.contactUs}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </NavigationMenuItem>

                </NavigationMenuList>
              </NavigationMenu>

              {/* Right Side Actions */}
            <div className="flex items-center gap-1.5 md:gap-2 lg:gap-4 flex-shrink-0">

            

              {/* Show persona type badge for athletes (replace Find a Coach) */}
              {personaType === 'athlete' && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleNavClick(() => navigate(ROUTES.PROFILE))}
                      className="hidden lg:inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-semibold border border-primary/20 hover:bg-primary/20 transition-colors whitespace-nowrap shrink-0"
                      aria-label="Go to profile"
                    >
                      {personaSportIcon && (
                        <img src={personaSportIcon} alt="" aria-hidden="true" className="h-3.5 w-3.5" />
                      )}
                      Athlete
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Click to open profile</TooltipContent>
                </Tooltip>
              )}
              
              {/* Show persona type badge for coaches */}
              {personaType === 'coach' && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleNavClick(() => navigate(ROUTES.PROFILE))}
                      className="hidden lg:inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-semibold border border-primary/20 hover:bg-primary/20 transition-colors whitespace-nowrap shrink-0"
                      aria-label="Go to profile"
                    >
                      {personaSportIcon && (
                        <img src={personaSportIcon} alt="" aria-hidden="true" className="h-3.5 w-3.5" />
                      )}
                      Coach
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Click to open profile</TooltipContent>
                </Tooltip>
              )}
              {/* Show persona type badge for parents */}
              {personaType === 'parent' && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleNavClick(() => navigate(ROUTES.PROFILE))}
                      className="hidden lg:inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-semibold border border-primary/20 hover:bg-primary/20 transition-colors whitespace-nowrap shrink-0"
                      aria-label="Go to profile"
                    >
                      {personaSportIcon && (
                        <img src={personaSportIcon} alt="" aria-hidden="true" className="h-3.5 w-3.5" />
                      )}
                      Parent
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Click to open profile</TooltipContent>
                </Tooltip>
              )}
                {userData && personaType && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={handleMessagesClick}
                      className="relative inline-flex items-center text-sm font-semibold text-white px-3 py-2 rounded-full bg-primary shadow-sm hover:shadow-md transition hover:bg-primary/90"
                      aria-label="Messages"
                    >
                      <FiMessageCircle className="h-4 w-4 text-white" aria-hidden="true" />
                      {hasNewMessage && (
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 ring-2 ring-white"></span>
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Messages
                  </TooltipContent>
                </Tooltip>
              )}
              {authLoading ? (
                <div className="flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-muted animate-pulse"></div>
                </div>
              ) : userData ? (
                loading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-muted animate-pulse"></div>
                  </div>
                ) : personaType ? (
                  <UserMenu
                    name={userInfo.name}
                    email={userInfo.email}
                    img={userInfo.img}
                    fallbackImg={(userInfo as any).fallbackImg}
                    useFallbackDelay
                    avatarReady={profileReady}
                    completionOverride={headerProfileCompletion}
                  />
                ) : (
                  <div className="flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-muted animate-pulse"></div>
                  </div>
                )
              ) : (
                <div className="flex gap-2">
                  <Button onClick={() => navigate("/auth?mode=signin")} variant="outline" size="sm">
                    Sign In
                  </Button>
                  <Button onClick={() => navigate("/auth?mode=signup")} variant="default" size="sm">
                    Sign Up
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      {!(location.pathname === ROUTES.PROFILE || location.pathname === ROUTES.AUTH) &&
        userData && personaType && (
          <ProfileIncompleteBanner
            profileCompletion={contextProfileCompletion}
          />
        )}
    </>
  );
};
