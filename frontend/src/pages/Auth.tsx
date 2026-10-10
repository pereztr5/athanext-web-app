import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { authAPI, userProfilesAPI } from "@/api";
import { useToast } from "@/hooks/use-toast";
import { set, z } from "zod";
import { cn } from "@/lib/utils";
import { strings } from "@/config/strings";
import { PERSONA_TYPES, SPORTS_OPTIONS, ATHLETE_SPORTS_OPTIONS, PROFILE_TYPE } from "@/utils/db";
import { authSchema, signupSchema, profileCompletionSchema } from "@/utils/validations";
import { PhoneInput } from "@/components/common/PhoneInput";
import { isValidE164, normalizeStoredPhone } from "@/utils/phone";
import { Loader2, Eye, EyeOff, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { usePasswordValidation, PASSWORD_RULE_MESSAGE } from "@/hooks/usePasswordValidation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSportPillars } from "@/api/sport-pillars";
import type { Enums } from "@/integrations/supabase/types";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useCoachProfileActions } from "@/hooks/useCoachProfileActions";
import { useAthleteProfileActions } from "@/hooks/useAthleteProfileActions";
import { useCoaches } from "@/hooks/useCoaches";
import { createAthleteInitiatedReferral, getCoachName } from "@/api/referrals";
import { useReferralInvite } from "@/hooks/useReferrals";
import { INVITE_TOKEN_STORAGE_KEY, clearJoinCoach, readJoinCoach } from "@/utils/referralHelpers";
import { readSignupRole } from "@/utils/signup";
import { SignUpFlow } from "@/components/auth/SignUpFlow";
import { ROUTES } from "@/routes";

import { fetchLocationFromZipCode, formatLocationDisplay, hasValidLocationData, type LocationInfo } from "@/utils/geolocation";
import { isCompleteProfileReady as checkCompleteProfileReady } from "@/utils/completeProfile";
import {
  ACADEMIC_YEAR_OPTIONS,
  getAcademicYearGraduationOffset,
  normalizeAcademicYear,
} from "@/utils/academicYear";
import { GenderSelect } from "@/components/form/GenderSelect";
import FavoritePositionsField from "@/components/form/FavoritePositionsField";
import { getTodayISODate } from "@/utils/dateHelpers";
import logo from "@/assets/AthaNext-Logo.svg";

const fieldLabel = "text-[12px] font-medium leading-[14px] tracking-[-0.03em] text-[#767980]";
const fieldError = "text-[12px] leading-[14px] tracking-[-0.03em] text-destructive";
const helperText = "text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]";
const titleText = "text-[24px] font-semibold leading-[30px] tracking-[-0.05em] text-[#1A202C]";
const descriptionText = "text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]";
const pageShell = "min-h-screen bg-background pt-20";
const pageCentre = "flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-10";

/** Selectable tile (role choice, checkbox rows): blue tint when chosen, neutral otherwise. */
const choiceTile = (selected: boolean) =>
  cn(
    "rounded-[8px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2]",
    selected
      ? "border-[#6698D2] bg-[#E5EDF7] text-[#0054B4]"
      : "border-[#EAEADF] bg-[#F1F1E6] text-[#1A202C] hover:bg-[#F4F4EB]"
  );

const BrandLogo = () => <img src={logo} alt="AthaNext" className="h-7 w-auto" />;

type PersonaType = typeof PERSONA_TYPES[number];

const isPersonaType = (value: unknown): value is PersonaType =>
  typeof value === "string" && PERSONA_TYPES.includes(value as PersonaType);

const requiresDateOfBirth = (personaValue?: PersonaType | null) =>
  personaValue === PROFILE_TYPE.athlete || personaValue === PROFILE_TYPE.parent;

const formatDateForInput = (value?: string | null) => {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return "";
  return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
};

const formatDateForDb = (value: string) => {
  const [day, month, year] = value.split("/");
  if (!day || !month || !year) return null;
  return `${year}-${month}-${day}`;
};

const findSportOption = (value?: string | null, options = SPORTS_OPTIONS) => {
  if (!value) return undefined;
  const normalizedValue = value.trim().toLowerCase();
  return options.find((option) => option.value.toLowerCase() === normalizedValue);
};

const normalizeSportValue = (value?: string | null, options = SPORTS_OPTIONS) => {
  return findSportOption(value, options)?.value ?? "";
};

const normalizePositionValue = (
  sportValue?: string | null,
  positionValue?: string | null,
  options = SPORTS_OPTIONS
) => {
  if (!sportValue || !positionValue) return "";
  const sportOption = findSportOption(sportValue, options);
  if (!sportOption) return "";

  const normalizedPosition = positionValue.trim().toLowerCase();
  return sportOption.positions.find(
    (position) => position.value.toLowerCase() === normalizedPosition
  )?.value ?? "";
};

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showSigninPassword, setShowSigninPassword] = useState(false);
  const [name, setName] = useState("");
  const [persona, setPersona] = useState<PersonaType | null>(null);
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [sport, setSport] = useState("");
  const [position, setPosition] = useState("");
  const [coachSpecializations, setCoachSpecializations] = useState<string[]>([]);
  const [coachFavoritePositions, setCoachFavoritePositions] = useState<string[]>([]);
  const [sportPillarOptions, setSportPillarOptions] = useState<string[]>([]);
  const [isLoadingPillars, setIsLoadingPillars] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPersonaLocked, setIsPersonaLocked] = useState(false);
  const [activeTab, setActiveTab] = useState("signin");
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);
  const [isCheckingProfile, setIsCheckingProfile] = useState(false);
  const [hasShownGoogleWarning, setHasShownGoogleWarning] = useState(false);
  const [gender, setGender] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [locationInfo, setLocationInfo] = useState<LocationInfo | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [hasAttemptedLocationFetch, setHasAttemptedLocationFetch] = useState(false);
  const [graduationYear, setGraduationYear] = useState("2025");
  const [isCurrentlyStudying, setIsCurrentlyStudying] = useState(false);
  const [currentYearLevel, setCurrentYearLevel] = useState("");
  const [existingCoachId, setExistingCoachId] = useState<string | null>(null);
  const { user, signIn, refreshUserProfile } = useAuth();
  const isGoogleUser = useMemo(() => {
    const provider = user?.app_metadata?.provider;
    const hasGoogleIdentity = Array.isArray((user as any)?.identities)
      ? (user as any).identities.some((identity: any) => identity?.provider === "google")
      : false;
    return provider === "google" || hasGoogleIdentity;
  }, [user]);
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const inviteParam = searchParams.get('invite');
  useEffect(() => {
    if (inviteParam) sessionStorage.setItem(INVITE_TOKEN_STORAGE_KEY, inviteParam);
  }, [inviteParam]);
  const inviteToken = inviteParam ?? sessionStorage.getItem(INVITE_TOKEN_STORAGE_KEY);
  const { invite: pendingInvite } = useReferralInvite(inviteToken);
  const inviteCoachName = pendingInvite?.state === "valid" ? pendingInvite.coach_name : null;
  // An invited athlete accepts on the invite page once signed in (email must match there).
  const invitePath = inviteToken ? `/invite/${inviteToken}` : null;
  // A coach's share link (ATH-78): the sign-up asks to join that coach's athletes.
  const coachParam = searchParams.get("coach");
  const joinCoachId = useMemo(() => (inviteToken ? null : readJoinCoach(coachParam)), [inviteToken, coachParam]);
  const { data: joinCoachName } = useQuery({
    queryKey: ["join-coach-name", joinCoachId],
    queryFn: () => getCoachName(joinCoachId!),
    enabled: Boolean(joinCoachId),
    staleTime: Infinity,
  });
  const sportOptions = useMemo(
    () => (persona === PROFILE_TYPE.coach ? SPORTS_OPTIONS : ATHLETE_SPORTS_OPTIONS),
    [persona]
  );
  const selectedSportOption = useMemo(
    () => findSportOption(sport, sportOptions),
    [sport, sportOptions]
  );
  const availablePositions = selectedSportOption?.positions ?? [] as const;
  const coachSpecializationOptions = sportPillarOptions;
  // const coachSpecializationOptions = useMemo(() => getCoachSpecializationOptions(sport),[sport]);
  const { updateProfile } = useUserProfile();
  const { createCoach, updateCoach } = useCoachProfileActions();
  const { createAthleteProfile, updateAthleteProfile } = useAthleteProfileActions();
  const { coaches, coachesLoading } = useCoaches(
    needsProfileCompletion && persona === PROFILE_TYPE.athlete && !inviteToken
  );
  const justCompletedProfileRef = useRef(false);
  const clearFieldError = (field: string) => {
    if (!errors[field]) return;
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const toggleCoachSpecialization = (value: string) => {
    setCoachSpecializations((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
    clearFieldError("position");
  };

  const toggleCoachFavoritePosition = (value: string) => {
    setCoachFavoritePositions((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
    clearFieldError("favoritePositions");
  };

  const handlePhoneChange = (value: string) => {
    setPhone(value);
    clearFieldError("phone");
  };

  const fetchAndSetLocation = async (zip: string) => {
    // Safety checks: ensure zip is a valid string
    if (!zip || typeof zip !== 'string' || zip.trim().length < 3) {
      setLocationInfo(null);
      setHasAttemptedLocationFetch(false);
      return;
    }

    setIsLoadingLocation(true);
    setHasAttemptedLocationFetch(false);
    try {
      // Safety check: ensure fetchLocationFromZipCode is available
      if (typeof fetchLocationFromZipCode !== 'function') {
        throw new Error('Location fetch function is not available');
      }
      
      const location = await fetchLocationFromZipCode(zip);
      
      // Safety check: validate location response
      if (location && typeof location === 'object') {
        setLocationInfo(location);
      } else {
        setLocationInfo(null);
      }
      setHasAttemptedLocationFetch(true);
    } catch (error) {
      console.error('Error fetching location:', error);
      setLocationInfo(null);
      setHasAttemptedLocationFetch(true);
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handleZipCodeChange = (value: string) => {
    setZipCode(value);
    setHasAttemptedLocationFetch(false);
    // Clear zipCode error when user starts typing
    if (value) {
      clearFieldError("zipCode");
    }
  };

  // Debounce zip code changes to fetch location
  useEffect(() => {
    const timer = setTimeout(() => {
      // Safety checks: ensure zipCode is valid before processing
      if (zipCode && typeof zipCode === 'string' && zipCode.trim().length >= 3) {
        fetchAndSetLocation(zipCode);
      } else if (!zipCode || typeof zipCode !== 'string' || zipCode.trim() === '') {
        setLocationInfo(null);
        setIsLoadingLocation(false);
        setHasAttemptedLocationFetch(false);
      }
    }, 500);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [zipCode]);

  const handleCurrentlyStudyingChange = (checked: boolean) => {
    setIsCurrentlyStudying(checked);
    if (checked) {
      // When checked, set graduation year to current year and disable it
      const currentYear = new Date().getFullYear().toString();
      setGraduationYear(currentYear);
      setCurrentYearLevel(""); // Reset year level selection
    } else {
      // When unchecked, clear the year level
      setCurrentYearLevel("");
    }
  };

  const handleYearLevelChange = (value: string) => {
    const normalizedYearLevel = normalizeAcademicYear(value) || "";
    setCurrentYearLevel(normalizedYearLevel);
    if (value) {
      clearFieldError("graduationYear");
    }
    
    // Calculate graduation year based on current year level
    const currentYear = new Date().getFullYear();
    const graduationOffset = getAcademicYearGraduationOffset(normalizedYearLevel) ?? 0;
    const calculatedGradYear = currentYear + graduationOffset;
    
    setGraduationYear(calculatedGradYear.toString());
  };

  

  const handleSportChange = (value: string) => {
    const normalizedSport = normalizeSportValue(value, sportOptions);
    setSport(normalizedSport);
    setCoachSpecializations([]); // reset when sport changes
    setCoachFavoritePositions([]); // reset when sport changes
    if (normalizedSport) {
      clearFieldError("sport");
    }
    clearFieldError("position");
    clearFieldError("favoritePositions");

    const matchingSport = findSportOption(normalizedSport, sportOptions);
    const isPositionValid = matchingSport?.positions.some((pos) => pos.value === position);

    if (!isPositionValid) {
      setPosition("");
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadPillars = async () => {
      if (persona !== PROFILE_TYPE.coach || !sport) {
        return;
      }

      const sportEnum = sport.toLowerCase() as Enums<"sport_type">;
      setIsLoadingPillars(true);

      const { data } = await getSportPillars(sportEnum);

      if (!isMounted) return;

      setSportPillarOptions(
        data?.sportPillars
          ?.filter((p) => p?.title)
          .map((p) => p.title as string) ?? []
      );
      setIsLoadingPillars(false);
    };

    loadPillars();
    return () => {
      isMounted = false;
    };
  }, [sport, persona]);

  useEffect(() => {
    let isMounted = true;

    const checkUserProfile = async () => {
      if (!user) {
        if (isMounted) {
          setNeedsProfileCompletion(false);
          setIsCheckingProfile(false);
          setHasShownGoogleWarning(false);
        }
        return;
      }

      // Don't check if we just completed the profile, or while the new sign-up is
      // finishing its profile step (ATH-93).
      if (justCompletedProfileRef.current || readSignupRole()) {
        return;
      }

      setIsCheckingProfile(true);

      try {
        const { data, error } = await userProfilesAPI.getUserProfile(user.id);

        if (!isMounted) return;

        if (error) {
          console.error("Failed to load user profile:", error);
        }

        const personaFromProfile = (data?.persona_type as PersonaType | null) || null;
        const hasCompleteProfile = data?.is_profile_completed === true;
        const modeParam = searchParams.get('mode');

        if (!hasCompleteProfile) {
          if (modeParam !== 'complete-profile') {
            if (!hasShownGoogleWarning) {
              toast({
                title: "Finish signing up",
                description: "We need a few more details before you can continue.",
                variant: "destructive",
              });
              setHasShownGoogleWarning(true);
            }
            navigate(`${ROUTES.AUTH}?mode=complete-profile`, { replace: true, state: location.state });
          }

          const metadataPersona = user.user_metadata?.persona_type;
          const queryPersona = searchParams.get("persona");
          const defaultPersona =
            (isPersonaType(personaFromProfile) ? personaFromProfile : null) ||
            (isPersonaType(metadataPersona) ? metadataPersona : null) ||
            (isPersonaType(queryPersona) ? queryPersona : null);
          const defaultEmail = user.email || "";
          const defaultName = "";
          const defaultPhone =
            data?.phone_number ||
            (user.user_metadata?.phone_number as string) ||
            "";
          const defaultSport =
            data?.sport || (user.user_metadata?.sport as string) || "";
          const defaultPosition =
            data?.position || (user.user_metadata?.position as string) || "";
          const defaultDob =
            data?.date_of_birth ||
            (user.user_metadata?.date_of_birth as string) ||
            "";
          const defaultFavoritePositions =
            (data as any)?.favourite_positions ||
            (user.user_metadata as any)?.favourite_positions ||
            [];
          const defaultGender =
            (data as any)?.gender ||
            (user.user_metadata?.gender as string) ||
            "";
          const defaultZipCode =
            (data as any)?.zip_code ||
            (user.user_metadata?.zip_code as string) ||
            "";
          const personaOptions =
            defaultPersona === PROFILE_TYPE.coach ? SPORTS_OPTIONS : ATHLETE_SPORTS_OPTIONS;
          const normalizedSport = normalizeSportValue(defaultSport, personaOptions);
          const normalizedPosition = normalizePositionValue(
            normalizedSport,
            defaultPosition,
            personaOptions
          );

          setEmail(defaultEmail);
          setPersona(defaultPersona);
          setName(defaultName);
          // Signup stored free text with its country code, so a missing "+" is restored, not assumed US.
          setPhone(normalizeStoredPhone(defaultPhone && !defaultPhone.trim().startsWith("+") ? `+${defaultPhone}` : defaultPhone));
          setSport(normalizedSport);
          setPosition(normalizedPosition);
          setCoachSpecializations(
            defaultPersona === PROFILE_TYPE.coach && defaultPosition
              ? defaultPosition.split(",").map((s) => s.trim()).filter(Boolean)
              : []
          );
          setCoachFavoritePositions(
            defaultPersona === PROFILE_TYPE.coach
              ? (Array.isArray(defaultFavoritePositions)
                ? defaultFavoritePositions
                : typeof defaultFavoritePositions === "string"
                  ? defaultFavoritePositions.split(",").map((s) => s.trim()).filter(Boolean)
                  : [])
              : []
          );
          setIsPersonaLocked(Boolean(personaFromProfile));
          setDateOfBirth(formatDateForInput(defaultDob));
          setGender(defaultGender);
          setZipCode(defaultZipCode);
          if (defaultZipCode) {
            await fetchAndSetLocation(defaultZipCode);
          }
          setNeedsProfileCompletion(true);
          setActiveTab("signup");
          return;
        } else {
          setNeedsProfileCompletion(false);
          setHasShownGoogleWarning(false);
          const from = (location.state as { from?: { pathname: string; search?: string } } | null)?.from;
          navigate(from ? `${from.pathname}${from.search ?? ""}` : invitePath ?? ROUTES.DASHBOARD, { replace: true });
        }
      } finally {
        if (isMounted) {
          setIsCheckingProfile(false);
        }
      }
    };

    checkUserProfile();

    return () => {
      isMounted = false;
    };
  }, [user, navigate, searchParams, toast, hasShownGoogleWarning, location.state]);

  useEffect(() => {
    const emailParam = searchParams.get('email');
    const modeParam = searchParams.get('mode');
    const personaParam = searchParams.get('persona');

    if (emailParam) {
      setEmail(emailParam);
    }

    // Set persona based on persona parameter
    if (personaParam && PERSONA_TYPES.includes(personaParam as PersonaType)) {
      setPersona(personaParam as PersonaType);
    }

    // Set active tab based on mode parameter
    // If user is authenticated and no mode is set, automatically trigger profile completion
    if (modeParam === 'signup' || modeParam === 'complete-profile') {
      setActiveTab('signup');
    } else if (user && !modeParam) {
      // User is authenticated via email confirmation but no explicit mode - show profile completion
      setActiveTab('signup');
    } else {
      // Default to signin for any other case including no mode parameter
      setActiveTab('signin');
    }
  }, [searchParams, user]);

  const validateForm = (includeNameOptional = false) => {
    try {
      const data = includeNameOptional ? { email, password, name } : { email, password };
      authSchema.parse(data);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.issues.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    const { error } = await signIn(email, password);
    if (
      error &&
      (error.code === "email_not_confirmed" ||
        error.message?.toLowerCase?.().includes("confirm"))
    ) {
      const confirmationUrl = `${ROUTES.SIGN_UP_CONFIRMATION}?email=${encodeURIComponent(email)}`;
      navigate(confirmationUrl, { replace: true });
    }
    setIsLoading(false);
  };

  const validateProfileCompletion = () => {
    try {
      const dataToValidate: { persona?: PersonaType | null; name: string; sport: string; position?: string | null; phone: string; gender: string; zipCode: string; dateOfBirth?: string } = {
        persona,
        name,
        sport,
        position: persona === PROFILE_TYPE.coach ? undefined : position,
        phone,
        gender,
        zipCode,
      };

      if (persona === PROFILE_TYPE.athlete || persona === PROFILE_TYPE.parent) {
        dataToValidate.dateOfBirth = dateOfBirth;
      }

      const stepSchema = z.object({
        persona: signupSchema.shape.persona,
        name: signupSchema.shape.name,
        dateOfBirth: signupSchema.shape.dateOfBirth,
        sport: signupSchema.shape.sport,
        position: persona === PROFILE_TYPE.coach ? z.string().optional() : signupSchema.shape.position,
        phone: signupSchema.shape.phone,
        gender: z.string().min(1, "Gender is required"),
        zipCode: z
          .string()
          .max(20, "Zip code is too long")
          .refine((value) => value.trim() === "" || value.trim().length >= 3, {
            message: "Zip code must be at least 3 characters",
          }),
      });

      stepSchema.parse(dataToValidate);
      const newErrors: Record<string, string> = {};
      const isSportValid = Boolean(selectedSportOption);

      if (!isSportValid) {
        newErrors.sport = "Please select a sport";
      }

      if (persona === PROFILE_TYPE.coach) {
        if (coachSpecializations.length === 0) {
          newErrors.position = "Please select at least one specialization";
        }
        if (coachFavoritePositions.length === 0) {
          newErrors.favoritePositions = "Please select at least one favorite position";
        }
      } else {
        if (!position) {
          newErrors.position = "Please select a position";
        } else if (
          availablePositions.length > 0 &&
          !availablePositions.some((option) => option.value === position)
        ) {
          newErrors.position = "Please select a position";
        }
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return false;
      }

      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.issues.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const isCompleteProfileReady = useMemo(
    () =>
      checkCompleteProfileReady({
        persona,
        name,
        phone,
        zipCode,
        gender,
        selectedSportOption,
        dateOfBirth,
        coachSpecializations,
        coachFavoritePositions,
        position,
        availablePositions,
      }),
    [
      availablePositions,
      coachFavoritePositions,
      coachSpecializations,
      dateOfBirth,
      gender,
      hasAttemptedLocationFetch,
      isLoadingLocation,
      locationInfo,
      name,
      persona,
      phone,
      position,
      selectedSportOption,
      zipCode,
    ]
  );

  const handleGoogleSignIn = async (mode: 'signin' | 'signup' = 'signin') => {
    setIsLoading(true);
    try {
      const redirectTo =
        mode === 'signup'
          ? `${window.location.origin}/auth?mode=complete-profile${inviteToken ? `&invite=${inviteToken}` : ""}`
          : `${window.location.origin}${invitePath ?? "/"}`;

      const { error } = await authAPI.signInWithOAuth('google', { redirectTo });

      if (error) {
        toast({
          title: "Google sign in failed",
          description: error.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Google signin error:', error);
      toast({
        title: "Something went wrong",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!validateProfileCompletion()) return;
    if (!persona) return;

    setIsLoading(true);

    try {
      const formattedDob =
        persona === PROFILE_TYPE.athlete || persona === PROFILE_TYPE.parent
          ? dateOfBirth
          : "";

      const dateForDb = formattedDob ? formatDateForDb(formattedDob) : null;
      const coachPositionValue =
        persona === PROFILE_TYPE.coach ? coachSpecializations.join(", ") : position;
      const normalizedZipCode = zipCode.trim() || null;
      const locationDisplay = formatLocationDisplay(locationInfo || null);
      const normalizedLocation = locationDisplay?.trim() || null;

      const profilePayload = {
        email: user.email ?? email,
        name: name || user.email?.split("@")[0] || "",
        persona_type: persona,
        phone_number: phone,
        sport,
        position: coachPositionValue,
        date_of_birth: dateForDb,
        // Comes from the gender picker, whose options match the gender_type enum.
        gender: gender as Enums<"gender_type">,
        zip_code: normalizedZipCode,
        is_profile_completed: true,
      };

      const updatedProfile = await updateProfile(profilePayload);

      if (!updatedProfile) {
        throw new Error("Failed to update user profile.");
      }

      // For coaches and athletes, ensure respective rows exist and link them to the user profile
      let coachId = updatedProfile?.coach_id ?? null;
      const existingAthleteId = updatedProfile?.athlete_id ?? null;
      let athleteId = existingAthleteId;

      if (persona === PROFILE_TYPE.coach && !coachId) {
        const { data: coachInsert, error: coachInsertError } = await createCoach({
          name: profilePayload.name,
          specialties: persona === PROFILE_TYPE.coach
            ? coachSpecializations
            : profilePayload.sport
              ? [profilePayload.sport]
              : [],
          locations: normalizedLocation ? [normalizedLocation] : [],
          position: coachPositionValue ?? null,
          positions: persona === PROFILE_TYPE.coach
            ? coachFavoritePositions
            : profilePayload.position
              ? [profilePayload.position]
              : [],
          favourite_positions: coachFavoritePositions as any,
        });

        if (coachInsertError) {
          throw coachInsertError;
        }

        coachId = coachInsert?.id ?? null;

        if (coachId) {
          const linkedProfile = await updateProfile({ coach_id: coachId });
          if (!linkedProfile) {
            throw new Error("Failed to link coach profile to user.");
          }
        }
      }

      if ((persona === PROFILE_TYPE.athlete || persona === PROFILE_TYPE.parent) && !existingAthleteId) {
        const { data: athleteInsert, error: athleteInsertError } = await createAthleteProfile({
          full_name: profilePayload.name,
          sport: profilePayload.sport,
          position: profilePayload.position ?? null,
          date_of_birth: dateForDb,
          phone_number: profilePayload.phone_number,
          tags: [],
          user_id: user.id,
          graduation_year: isCurrentlyStudying ? null : (graduationYear ? String(parseInt(graduationYear, 10)) : null),
          current_year: isCurrentlyStudying ? currentYearLevel : null as any,
          location: normalizedLocation,
        });

        if (athleteInsertError) {
          throw athleteInsertError;
        }

        const newAthleteId = athleteInsert?.id ?? null;

        if (newAthleteId) {
          const linkedProfile = await updateProfile({ athlete_id: newAthleteId });
          athleteId = linkedProfile?.athlete_id ?? newAthleteId;
          if (!linkedProfile) {
            throw new Error("Failed to link athlete profile to user.");
          }

          // Coach referral fee-waiver: invited athletes accept on the invite page
          // after this; otherwise record an athlete-initiated referral for the coach
          // whose share link they came through (athlete or parent), or the coach an
          // athlete picked. The coach approves it on My Clients.
          const referralCoachId = joinCoachId ?? (persona === PROFILE_TYPE.athlete ? existingCoachId : null);
          if (!inviteToken && referralCoachId) {
            const { error: referralError } = await createAthleteInitiatedReferral(referralCoachId);
            if (referralError) console.error("create athlete-initiated referral failed", referralError);
            else clearJoinCoach();
          }
        }
      }

      // If profiles already exist, keep their location in sync
      if (persona === PROFILE_TYPE.coach && coachId) {
        const { error: updateCoachError } = await updateCoach(coachId, {
          locations: normalizedLocation ? [normalizedLocation] : undefined,
          favourite_positions: coachFavoritePositions as any,
          positions: coachFavoritePositions,
        });
        if (updateCoachError) {
          throw updateCoachError;
        }
      }
      if ((persona === PROFILE_TYPE.athlete || persona === PROFILE_TYPE.parent) && athleteId) {
        const athleteUpdates = {
          location: normalizedLocation || undefined,
          current_year: isCurrentlyStudying ? (currentYearLevel || null) : null,
          graduation_year: isCurrentlyStudying
            ? null
            : (graduationYear ? String(parseInt(graduationYear, 10)) : null),
        };

        const { error: updateAthleteError } = await updateAthleteProfile(
          athleteId,
          athleteUpdates
        );
        if (updateAthleteError) {
          throw updateAthleteError;
        }
      }

      const { error: authError } = await authAPI.updateUserMetadata({
        name: profilePayload.name,
        persona_type: persona,
        phone_number: phone,
        sport,
        position: coachPositionValue,
        favourite_positions: coachFavoritePositions,
        date_of_birth: dateForDb ?? undefined,
        coach_id: coachId ?? undefined,
        gender,
        zip_code: normalizedZipCode ?? undefined,
        athlete_id: athleteId ?? undefined,
      });

      if (authError) {
        throw authError;
      }

      toast({
        title: "Profile completed",
        description: "Your account is ready to use.",
      });

      justCompletedProfileRef.current = true;

      // Refresh cached user profile so downstream checks see the completed data
      await refreshUserProfile();

      setTimeout(() => {
        const destination =
          persona === PROFILE_TYPE.coach
            ? `${ROUTES.INVITES}?onboarding=1`
            : invitePath ?? ROUTES.PROFILE;
        navigate(destination, { replace: true });
      }, 500);

      setNeedsProfileCompletion(false);
    } catch (error) {
      console.error("Complete profile error:", error);
      toast({
        title: "Could not save your profile",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getNameLabel = () => {
    if (persona === PROFILE_TYPE.parent) return "Child's name";
    return "Your name";
  };

  const getDateOfBirthLabel = () => {
    if (persona === PROFILE_TYPE.parent) return "Child's date of birth";
    return "Your date of birth";
  };

  const getSportLabel = () => {
    if (persona === PROFILE_TYPE.parent) return "Child's sport";
    if (persona === PROFILE_TYPE.coach) return "Sport you coach";
    return "Your sport";
  };

  const getPositionLabel = () => {
    if (persona === PROFILE_TYPE.parent) return "Child's position";
    if (persona === PROFILE_TYPE.coach) return "Coaching specialization pillars";
    return "Your position";
  };

  if (user && isCheckingProfile) {
    return (
      <div className={pageShell}>
        <div className={pageCentre}>
          <Card className="w-full max-w-[440px]">
            <CardContent className="flex flex-col items-center gap-4 px-[25px] py-10">
              <BrandLogo />
              <Loader2 strokeWidth={1.5} className="h-6 w-6 animate-spin text-[#0054B4]" />
              <p className={cn(descriptionText, "text-center")}>
                Checking your account details…
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (needsProfileCompletion && user) {
    const personaSelectionDisabled = isPersonaLocked || (!isGoogleUser && Boolean(user));

    return (
      <div className={pageShell}>
        <div className={pageCentre}>
          <Card className="w-full max-w-[560px]">
            <CardHeader className="items-center gap-2.5 space-y-0 text-center">
              <BrandLogo />
              <CardTitle className={cn(titleText, "pt-2")}>Complete your profile</CardTitle>
              <CardDescription className={descriptionText}>
                A few more details and your account is ready.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCompleteProfile} className="space-y-5">
                <div className="max-h-[500px] space-y-4 overflow-y-auto pb-2 pl-1 pr-3">
                <div className="space-y-1.5">
                  <Label className={fieldLabel}>I am a</Label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {PERSONA_TYPES.map((type) => (
                      <div
                        key={type}
                        className={cn(
                          choiceTile(persona === type),
                          "flex h-[38px] items-center justify-center px-2 text-center",
                          personaSelectionDisabled && "hover:bg-inherit"
                        )}
                        role="button"
                        aria-pressed={persona === type}
                        tabIndex={personaSelectionDisabled ? -1 : 0}
                        aria-disabled={personaSelectionDisabled}
                        onClick={() => {
                          if (personaSelectionDisabled) return;
                          setPersona(type);
                          clearFieldError("persona");
                        }}
                        onKeyDown={(e) => {
                          if (personaSelectionDisabled) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setPersona(type);
                            clearFieldError("persona");
                          }
                        }}
                        style={{ cursor: personaSelectionDisabled ? "not-allowed" : "pointer", opacity: personaSelectionDisabled ? 0.6 : 1 }}
                      >
                        <span className="block text-[14px] font-medium capitalize tracking-[-0.03em]">
                          {type}
                        </span>
                      </div>
                    ))}
                  </div>
                  {errors.persona && (
                    <p className={fieldError}>{errors.persona}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="complete-name" className={fieldLabel}>{getNameLabel()}</Label>
                  <Input
                    id="complete-name"
                    type="text"
                    placeholder={`Enter ${getNameLabel().toLowerCase()}`}
                    value={name}
                      onChange={(e) => {
                        const nextValue = e.target.value;
                        setName(nextValue);
                        if (nextValue) {
                          clearFieldError("name");
                        }
                      }}
                    disabled={isLoading}
                  />
                  {errors.name && (
                    <p className={fieldError}>{errors.name}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="complete-email" className={fieldLabel}>{strings.form.labels.email}</Label>
                  <Input
                    id="complete-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={true}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="complete-phone" className={fieldLabel}>Phone number</Label>
                  <PhoneInput
                    id="complete-phone"
                    value={phone}
                    onChange={handlePhoneChange}
                    invalid={Boolean(errors.phone)}
                    // Unlock a stored number that no longer passes validation, or the profile can't be saved.
                    disabled={isLoading || (!isGoogleUser && Boolean(user) && isValidE164(phone))}
                  />
                  {errors.phone && (
                    <p className={fieldError}>{errors.phone}</p>
                  )}
                </div>

                {(persona === PROFILE_TYPE.athlete || persona === PROFILE_TYPE.parent) && (
                  <div className="space-y-1.5">
                    <Label htmlFor="complete-dateOfBirth" className={fieldLabel}>{getDateOfBirthLabel()}</Label>
                    <Input
                      id="complete-dateOfBirth"
                      type="date"
                      value={dateOfBirth ? formatDateForDb(dateOfBirth) || '' : ''}
                      onChange={(e) => {
                        const dateValue = e.target.value;
                        if (dateValue) {
                          // Convert YYYY-MM-DD to DD/MM/YYYY
                          const [year, month, day] = dateValue.split('-');
                          setDateOfBirth(`${day}/${month}/${year}`);
                          clearFieldError("dateOfBirth");
                        } else {
                          setDateOfBirth('');
                        }
                      }}
                      max={getTodayISODate()}
                      disabled={isLoading}
                    />
                    {errors.dateOfBirth && (
                      <p className={fieldError}>{errors.dateOfBirth}</p>
                    )}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="complete-sport" className={fieldLabel}>{getSportLabel()}</Label>
                  <Select
                    value={sport || undefined}
                    onValueChange={handleSportChange}
                    disabled={isLoading}
                  >
                    <SelectTrigger id="complete-sport">
                      <SelectValue placeholder={`Select ${getSportLabel().toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {sportOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.sport && (
                    <p className={fieldError}>{errors.sport}</p>
                  )}
                </div>

                {persona && (
                <div className="space-y-1.5">
                  <Label htmlFor="complete-position" className={fieldLabel}>{getPositionLabel()}</Label>
                  {persona === PROFILE_TYPE.coach ? (
                    <>
                      {isLoadingPillars ? (
                        <p className={helperText}>Loading specializations…</p>
                      ) : sport && coachSpecializationOptions.length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                          {coachSpecializationOptions.map((option) => {
                            const checked = coachSpecializations.includes(option);
                            return (
                              <label
                                key={option}
                                className={cn(
                                  choiceTile(checked),
                                  "flex min-h-[38px] cursor-pointer items-center gap-3 px-3 py-2"
                                )}
                              >
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 accent-[#0054B4]"
                                  checked={checked}
                                  onChange={() => toggleCoachSpecialization(option)}
                                />
                                <span className="text-[14px] tracking-[-0.03em] text-[#1A202C]">{option}</span>
                              </label>
                            );
                          })}
                        </div>
                      ) : sport ? (
                        <p className={helperText}>
                          Loading specializations for {sport}…
                        </p>
                      ) : (
                        <p className={helperText}>
                          Choose a sport first to pick coaching specializations.
                        </p>
                      )}
                    </>
                  ) : (
                    <Select
                      value={position || undefined}
                      onValueChange={(value) => {
                        setPosition(value);
                        if (value) {
                          clearFieldError("position");
                        }
                      }}
                      disabled={isLoading || !sport}
                    >
                      <SelectTrigger id="position">
                        <SelectValue
                          placeholder={
                            sport
                              ? `Select ${getPositionLabel().toLowerCase()}`
                              : "Select a sport first"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {availablePositions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {errors.position && (
                    <p className={fieldError}>{errors.position}</p>
                  )}
                </div>
                )}

                <FavoritePositionsField
                  persona={persona ?? ""}
                  sport={sport}
                  availablePositions={availablePositions as unknown as { value: string; label: string }[]}
                  selectedPositions={coachFavoritePositions}
                  onToggle={toggleCoachFavoritePosition}
                  error={errors.favoritePositions}
                />

                <div className="space-y-1.5">
                  <Label htmlFor="complete-zipCode" className={fieldLabel}>Zip or postal code (optional)</Label>
                  <Input
                    id="complete-zipCode"
                    type="text"
                    placeholder="Enter your zip/postal code"
                    value={zipCode}
                    onChange={(e) => handleZipCodeChange(e.target.value)}
                    disabled={isLoading}
                  />
                  {isLoadingLocation && (
                    <p className={helperText}>Finding location…</p>
                  )}
                  {!isLoadingLocation && hasAttemptedLocationFetch && zipCode && typeof zipCode === 'string' && zipCode.length >= 3 && locationInfo && typeof hasValidLocationData === 'function' && hasValidLocationData(locationInfo) && (
                    <div className="flex items-center gap-2 rounded-[8px] bg-[#F4F4EB] px-3 py-2.5">
                      <MapPin strokeWidth={1.5} className="h-4 w-4 flex-none text-[#767980]" aria-hidden="true" />
                      <p className="text-[12px] leading-[14px] tracking-[-0.03em] text-[#484D56]">
                        {typeof formatLocationDisplay === 'function' ? formatLocationDisplay(locationInfo) : 'Location found'}
                      </p>
                    </div>
                  )}
                  {!isLoadingLocation && hasAttemptedLocationFetch && zipCode && typeof zipCode === 'string' && zipCode.length >= 3 && (!locationInfo || (typeof hasValidLocationData === 'function' && !hasValidLocationData(locationInfo))) && (
                    <div className="rounded-[8px] bg-[#FDF7EC] px-3 py-2.5">
                      <p className="text-[12px] leading-[14px] tracking-[-0.03em] text-[#906A29]">
                        We couldn't find a location for this zip code. Check it and try again.
                      </p>
                    </div>
                  )}
                  {errors.zipCode && (
                    <p className={fieldError}>{errors.zipCode}</p>
                  )}
                </div>

                <GenderSelect
                  value={gender}
                  onChange={(value) => {
                    setGender(value);
                    if (value) {
                      clearFieldError("gender");
                    }
                  }}
                  disabled={isLoading}
                  error={errors.gender}
                  id="complete-gender"
                  label={persona === PROFILE_TYPE.parent ? "Child's gender" : "Gender"}
                />

                {(persona === PROFILE_TYPE.athlete || persona === PROFILE_TYPE.parent) && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="complete-graduationYear" className={fieldLabel}>High school graduation year (if applicable)</Label>
                    </div>
                    
                    <Input
                      id="complete-graduationYear"
                      type="number"
                      placeholder="2025"
                      value={graduationYear}
                      onChange={(e) => {
                        const nextValue = e.target.value;
                        setGraduationYear(nextValue);
                        if (nextValue) {
                          clearFieldError("graduationYear");
                        }
                      }}
                      disabled={isLoading || isCurrentlyStudying}
                      className={isCurrentlyStudying ? "bg-muted text-muted-foreground" : ""}
                    />

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="currently-studying"
                        checked={isCurrentlyStudying}
                        onCheckedChange={handleCurrentlyStudyingChange}
                        disabled={isLoading}
                      />
                      <Label
                        htmlFor="currently-studying"
                        className="cursor-pointer text-[14px] font-normal tracking-[-0.03em] text-[#1A202C]"
                      >
                        Currently studying
                      </Label>
                    </div>

                    {isCurrentlyStudying && (
                      <div className="space-y-1.5 pl-6">
                        <Label htmlFor="year-level" className={fieldLabel}>Current year level</Label>
                        <Select
                          value={currentYearLevel}
                          onValueChange={handleYearLevelChange}
                          disabled={isLoading}
                        >
                          <SelectTrigger id="year-level">
                            <SelectValue placeholder="Select your current year" />
                          </SelectTrigger>
                          <SelectContent>
                            {ACADEMIC_YEAR_OPTIONS.map((yearOption) => (
                              <SelectItem key={yearOption.value} value={yearOption.value}>
                                {yearOption.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {errors.graduationYear && (
                      <p className={fieldError}>{errors.graduationYear}</p>
                    )}
                  </div>
                )}

                {joinCoachId && joinCoachName && (
                  <p className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
                    You'll join <span className="font-medium">Coach {joinCoachName}</span>'s athletes once they approve.
                  </p>
                )}

                {persona === PROFILE_TYPE.athlete && !inviteToken && !joinCoachId && (
                  <div className="space-y-2">
                    <Label htmlFor="complete-existing-coach">Already working with a coach? (optional)</Label>
                    <Select
                      value={existingCoachId ?? undefined}
                      onValueChange={setExistingCoachId}
                      disabled={isLoading || coachesLoading}
                    >
                      <SelectTrigger id="complete-existing-coach">
                        <SelectValue placeholder={coachesLoading ? "Loading coaches..." : "Select your coach"} />
                      </SelectTrigger>
                      <SelectContent>
                        {coaches.map((coachOption) => (
                          <SelectItem key={coachOption.id} value={coachOption.id}>
                            {coachOption.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={
                    isLoading ||
                    !isCompleteProfileReady
                  }
                >
                  {isLoading ? "Saving profile…" : "Save profile"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className={pageShell}>
      <div className={pageCentre}>
        <Card className="w-full max-w-[440px]">
          <CardHeader className="items-center gap-2.5 space-y-0 text-center">
            <BrandLogo />
            <CardTitle className={cn(titleText, "pt-2")}>
              {activeTab === "signup" ? "Create your account" : "Welcome back"}
            </CardTitle>
            <CardDescription className={descriptionText}>
              {activeTab === "signup"
                ? "Join AthaNext to book sessions with coaches."
                : "Sign in to book and manage your sessions."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {joinCoachName && !inviteCoachName && (
              <div className="mb-4 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
                <span className="font-medium">Coach {joinCoachName}</span> invited you to {strings.brand.name}.
                Sign up as a parent or athlete, and they'll approve you as their client.
              </div>
            )}
            {inviteCoachName && (
              <div className="mb-4 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
                <span className="font-medium">Coach {inviteCoachName}</span>{" "}
                invited you to {strings.brand.name}. Use the email the invite was sent to
                ({pendingInvite?.masked_email}) to book with them with no platform service fee.
              </div>
            )}
            <Tabs value={activeTab} onValueChange={(value) => {
              setActiveTab(value);
              navigate(`/auth?mode=${value}`, { replace: true, state: location.state });
            }} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="mt-5 space-y-4">
                <div className="space-y-4">
                  {/* Google Sign In Button */}
                  <Button
                    type="button"
                    variant="outline"
                    className="flex w-full items-center gap-2"
                    onClick={() => handleGoogleSignIn('signin')}
                    disabled={isLoading}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    {isLoading ? "Signing in…" : "Continue with Google"}
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-[#EAEADF]" />
                    </div>
                    <div className="relative flex justify-center text-[12px] leading-[14px] tracking-[-0.03em]">
                      <span className="bg-card px-2 text-[#767980]">
                        or sign in with email
                      </span>
                    </div>
                  </div>

                  {/* Email/Password Form */}
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="signin-email" className={fieldLabel}>{strings.form.labels.email}</Label>
                      <Input
                        id="signin-email"
                        type="email"
                        value={email}
                        onChange={(e) => {
                          const nextValue = e.target.value;
                          setEmail(nextValue);
                          if (nextValue) {
                            clearFieldError("email");
                          }
                        }}
                        placeholder="Enter your email"
                        required
                      />
                      {errors.email && (
                        <p className={fieldError}>{errors.email}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="signin-password" className={fieldLabel}>{strings.form.labels.password}</Label>
                      <div className="relative">
                        <Input
                          id="signin-password"
                          type={showSigninPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => {
                            const nextValue = e.target.value;
                            setPassword(nextValue);
                            if (nextValue) {
                              clearFieldError("password");
                            }
                          }}
                          placeholder="Enter your password"
                          required
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSigninPassword((prev) => !prev)}
                          className="absolute inset-y-0 right-2 flex items-center rounded-[4px] text-[#767980] hover:text-[#1A202C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2]"
                          aria-label={showSigninPassword ? "Hide password" : "Show password"}
                        >
                          {showSigninPassword ? <EyeOff strokeWidth={1.5} className="h-4 w-4" /> : <Eye strokeWidth={1.5} className="h-4 w-4" />}
                        </button>
                      </div>
                      {errors.password && (
                        <p className={fieldError}>{errors.password}</p>
                      )}
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        className="rounded-[4px] text-[12px] font-medium leading-[14px] tracking-[-0.03em] text-[#0054B4] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2]"
                        onClick={() => navigate("/forgot-password")}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
                      {isLoading ? "Signing in…" : "Sign in"}
                    </Button>
                  </form>
                </div>
              </TabsContent>

              <TabsContent value="signup" className="mt-5 space-y-4">
                <div className="space-y-4">
                  {/* Google Sign Up Button */}
                  <Button
                    type="button"
                    variant="outline"
                    className="flex w-full items-center gap-2"
                    onClick={() => handleGoogleSignIn('signup')}
                    disabled={isLoading}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    {isLoading ? "Creating account…" : "Sign up with Google"}
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-[#EAEADF]" />
                    </div>
                    <div className="relative flex justify-center text-[12px] leading-[14px] tracking-[-0.03em]">
                      <span className="bg-card px-2 text-[#767980]">
                        or sign up with email
                      </span>
                    </div>
                  </div>

                  <SignUpFlow inviteToken={inviteToken} joinCoachId={joinCoachId} />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
