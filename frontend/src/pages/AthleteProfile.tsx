/* eslint-disable react-hooks/rules-of-hooks */
import {
  Calendar,
  Clock,
  Trophy,
  Star,
  Pencil,
  MessageCircle,
  Clock3,
  MapPin,
  CalendarX,
  MessageSquareOff,
  UserX,
  Activity,
  Loader2,
  X,
  type LucideIcon,
} from "lucide-react";
import { fetchLocationFromZipCode, formatLocationDisplay, type LocationInfo } from "@/utils/geolocation";
import { GenderPill } from "@/components/form/GenderPill";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  emptyProfileData,
  deriveInitials,
  mapDbProfileToForm,
  mapFormToDbPayload
} from "@/utils/athleteProfileHelpers";

import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandPill, type BrandPillTone } from "@/components/brand";
import { formatTimeSpan } from "@/utils/sessionFormatting";
import { Button } from "@/components/ui/button";
import { capitalizeFirst, cn } from "@/lib/utils";
import { parseISODateLocal } from "@/utils/dateHelpers";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { differenceInMonths, format, formatDistanceToNowStrict, isValid, parseISO } from "date-fns";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/routes";
import type { SessionUIModel } from "@/types/sessions-api";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import footballCover from "@/assets/images/footballs.png";
import type { ProfileData } from "@/utils/profileCompletion";
import footballIcon from "@/assets/images/colored-soccer.png";
import rowingIcon from "@/assets/images/colored-rowing.png";
import { Carousel } from "@/components/coach-profile/Carousel";
import { calculateProfileCompletion } from "@/utils/profileCompletion";
import { ProfileStrengthMeter } from "@/components/coach-profile/ProfileStrengthMeter";
import { EditProfileDialog, ProfileSkeleton } from "@/components/athlete-profile";
import type { AthleteProfileFormData } from "@/types/athleteProfile";
import { type AthleteProfile as DbAthleteProfile } from "@/hooks/useProfile";
import { athletesAPI, chatAPI } from "@/api";
import { getAthleteSessions } from "@/api/sessions";
import { supabase } from "@/integrations/supabase/client";
import { ATHLETE_PROFILE_BASE_STATS, ATHLETE_PROFILE_CONSTANTS, ATHLETE_IMAGE_LIMITS } from "@/utils/db";
import { getAcademicYearLabel } from "@/utils/academicYear";
import { getStoragePathFromPublicUrl } from "@/utils/storage";
import type { AthleteProfileProps, AthleteStatMetrics, ConversationCardItem, ViewAllSection } from "@/types/athlete-profile";

const { MAX_COVER_IMAGES } = ATHLETE_PROFILE_CONSTANTS;

const cardClass =
  "flex w-full min-w-0 flex-col gap-5 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-[25px] pb-[25px] pt-[30px]";
const cardTitleClass =
  "flex items-center gap-2 text-[20px] font-medium leading-[24px] tracking-[-0.05em] text-[#1A202C]";
const linkButtonClass =
  "shrink-0 text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#0054B4] transition-colors hover:text-[#004390]";
const rowClass = "rounded-[8px] bg-[#F4F4EB] px-4 py-3";
const rowTitleClass = "text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C]";
const rowMetaClass = "text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]";
const mutedTextClass = "text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]";

const AVATAR_TINTS = ["bg-[#E5EDF7] text-[#0054B4]", "bg-[#E7F4F8] text-[#1599BC]"];

/** Brand copy and icon tile for each training stat (labels in sentence case). */
const STAT_META: Record<string, { label: string; subtitle: string; icon: LucideIcon; tint: string }> = {
  sessions_completed: {
    label: "Sessions completed",
    subtitle: "Training sessions",
    icon: Calendar,
    tint: "bg-[#E5EDF7] text-[#0054B4]",
  },
  hours_trained: {
    label: "Hours trained",
    subtitle: "Total training time",
    icon: Clock,
    tint: "bg-[#E7F4F8] text-[#1599BC]",
  },
  coaches_worked_with: {
    label: "Coaches worked with",
    subtitle: "Different coaches",
    icon: Trophy,
    tint: "bg-[#F4F4EB] text-[#484D56]",
  },
  average_rating: {
    label: "Average rating",
    subtitle: "Coach feedback",
    icon: Star,
    tint: "bg-[#FDF7EC] text-[#906A29]",
  },
};

const STATUS_TONES: Record<string, BrandPillTone> = {
  "in-progress": "green",
  upcoming: "blue",
  completed: "teal",
  past: "neutral",
  canceled: "muted",
};

const StatusPill = ({ status }: { status: string }) => (
  <BrandPill tone={STATUS_TONES[status] ?? "neutral"} className="shrink-0">
    {capitalizeFirst(status.replace("-", " "))}
  </BrandPill>
);

const formatSessionDay = (dateOnly: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
    parseISODateLocal(dateOnly)
  );

const formatSessionWhen = (session: SessionUIModel) =>
  `${formatSessionDay(session.dateOnly)}, ${formatTimeSpan(session.start, session.end) || session.timeRange}`;

const SectionCard = ({
  icon: Icon,
  title,
  action,
  className,
  children,
}: {
  icon: LucideIcon;
  title: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) => (
  <section className={cn(cardClass, className)}>
    <div className="flex min-h-[30px] items-center justify-between gap-3">
      <h2 className={cardTitleClass}>
        <Icon className="size-5 flex-none text-[#0054B4]" strokeWidth={1.5} aria-hidden="true" />
        {title}
      </h2>
      {action}
    </div>
    {children}
  </section>
);

const EmptyNote = ({ icon: Icon, tone = "muted", children }: { icon: LucideIcon; tone?: "muted" | "error"; children: ReactNode }) => (
  <div className="flex flex-col items-center justify-center gap-[10px] py-6 text-center">
    <span className="inline-flex size-8 items-center justify-center rounded-[8px] bg-[#F4F4EB] text-[#A3A6AB]">
      <Icon className="size-4" strokeWidth={1.5} aria-hidden="true" />
    </span>
    <p className={tone === "error" ? "text-[14px] leading-[18px] tracking-[-0.03em] text-destructive" : mutedTextClass}>
      {children}
    </p>
  </div>
);

/** Full-page notice used when the profile can't be shown (signed out, wrong persona, no profile yet). */
const ProfileNotice = ({ title, description, children }: { title: string; description: string; children: ReactNode }) => (
  <div className="mb-20 mt-[3.8rem] flex min-h-[70vh] flex-col items-center justify-center px-4">
    <div className={cn(cardClass, "max-w-md items-center text-center")}>
      <div className="flex flex-col gap-[10px]">
        <h1 className="text-[24px] font-semibold leading-[30px] tracking-[-0.05em] text-[#1A202C]">{title}</h1>
        <p className={mutedTextClass}>{description}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-[10px]">{children}</div>
    </div>
  </div>
);

const AthleteProfile = ({ profile: profileState, loading: profileLoading, error: profileError, saveAthleteProfile, refetchProfile, user, authLoading, upcomingSessions = [], sessionsLoading = false, sessionsError = null }: AthleteProfileProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { updateProfile } = useUserProfile();
  const { setUserImg, setUserName, refreshUserProfile, userProfile: authUserProfile } = useAuth();
  const { role } = useRole();
  const navigate = useNavigate();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [viewAllSection, setViewAllSection] = useState<ViewAllSection | null>(null);
  const [locationInfo, setLocationInfo] = useState<LocationInfo | null>(null);
  const [conversationItems, setConversationItems] = useState<ConversationCardItem[]>([]);
  const [pastSessions, setPastSessions] = useState<SessionUIModel[]>([]);
  const [selectedProfileImageFile, setSelectedProfileImageFile] = useState<File | null>(null);
  const [coverImagesToUpload, setCoverImagesToUpload] = useState<File[]>([]);
  const [coverImageUrlsToRemove, setCoverImageUrlsToRemove] = useState<string[]>([]);
  const [isAvatarLoading, setIsAvatarLoading] = useState(false);
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);
  const loadedAvatarCacheRef = useRef<Set<string>>(new Set());
  const [statMetrics, setStatMetrics] = useState<AthleteStatMetrics>({
    sessions_completed: 0,
    hours_trained: 0,
    coaches_worked_with: 0,
    average_rating: 0,
  });
  const [statsLoading, setStatsLoading] = useState(false);

  // Show loading state IMMEDIATELY before any other logic
  if (authLoading || profileLoading) {
    return <ProfileSkeleton />;
  }

  const hasAthleteData = profileState.type === "athlete" && Boolean(profileState.data);
  const awaitingAthleteData = profileState.type === "athlete" && !profileState.data;

  // Compute the base profile directly without intermediate state
  const baseProfile = useMemo(() => {
    if (hasAthleteData) {
      return mapDbProfileToForm(profileState.data as DbAthleteProfile, profileState.userProfile);
    }
    return emptyProfileData;
  }, [hasAthleteData, profileState.data, profileState.userProfile]);

  const [overrideProfile, setOverrideProfile] = useState(baseProfile);
  const activeProfile = overrideProfile || baseProfile;

  useEffect(() => {
    if (!overrideProfile) return;

    const baseMatchesOverride =
      baseProfile.graduationYear === overrideProfile.graduationYear &&
      baseProfile.currentYear === overrideProfile.currentYear &&
      baseProfile.gender === overrideProfile.gender &&
      baseProfile.zipCode === overrideProfile.zipCode &&
      baseProfile.profileImageUrl === overrideProfile.profileImageUrl &&
      Array.isArray(baseProfile.coverImageUrls) &&
      Array.isArray(overrideProfile.coverImageUrls) &&
      baseProfile.coverImageUrls.join("|") === overrideProfile.coverImageUrls.join("|");

    if (baseMatchesOverride) {
      setOverrideProfile(null);
    }
  }, [baseProfile, overrideProfile]);

  useEffect(() => {
    if (profileError) {
      toast({
        title: "Unable to load profile",
        description: profileError,
        variant: "destructive",
      });
    }
  }, [profileError, toast]);

  useEffect(() => {
    const loadLocation = async () => {
      if (activeProfile.zipCode) {
        try {
          const location = await fetchLocationFromZipCode(activeProfile.zipCode);
          if (location) {
            setLocationInfo(location);
          }
        } catch (error) {
          console.error("Failed to fetch location:", error);
        }
      }
    };
    loadLocation();
  }, [activeProfile.zipCode, activeProfile]);

  useEffect(() => {
    const zip = authUserProfile?.zip_code;
    if (!zip) return;
    // If active profile already reflects this zip, nothing to do
    if (zip === activeProfile.zipCode) return;

    let isMounted = true;
    (async () => {
      try {
        const location = await fetchLocationFromZipCode(zip);
        if (!isMounted) return;
        if (location) {
          setLocationInfo(location);
        } else {
          setLocationInfo(null);
        }

        const optimisticProfile = mapDbProfileToForm(profileState.data as DbAthleteProfile | null, {
          ...(profileState.userProfile || {}),
          zip_code: zip,
        });

        setOverrideProfile((prev) => ({
          ...optimisticProfile,
          zipCode: zip,
          location: location ? formatLocationDisplay(location) : prev?.location ?? optimisticProfile.location,
        }));
      } catch (err) {
        console.error("Failed to fetch location from auth user profile:", err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [authUserProfile?.zip_code, activeProfile.zipCode]);

  useEffect(() => {
    const newGender = authUserProfile?.gender;
    if (!newGender) return;

    // If the active profile already shows this gender, nothing to do
    if (newGender === activeProfile.gender) return;

    // Build a transient profile view merging athlete data with the updated user profile
    const optimisticProfile = mapDbProfileToForm(profileState.data as DbAthleteProfile | null, {
      ...(profileState.userProfile || {}),
      gender: newGender,
    });

    setOverrideProfile((prev) => ({
      ...optimisticProfile,
      // preserve any local overrides for location/zip if present
      location: prev?.location ?? optimisticProfile.location,
      zipCode: prev?.zipCode ?? optimisticProfile.zipCode,
    }));
  }, [authUserProfile?.gender, activeProfile.gender, profileState.data, profileState.userProfile]);

  useEffect(() => {
    let isMounted = true;
    const athleteProfileId =
      profileState.userProfile?.athlete_id || profileState.userProfile?.id || user?.id;

    // If we don't have an id yet, clear and wait
    if (!athleteProfileId) {
      setConversationItems([]);
      setPastSessions([]);
      return () => {
        isMounted = false;
      };
    }

    const loadStats = async () => {
      if (!athleteProfileId) return;
      setStatsLoading(true);
      try {
        const { data, error } = await athletesAPI.getProfileStats(athleteProfileId);

        if (!isMounted) return;

        if (error || !data) {
          console.error("Failed to load athlete stats", error);
          setStatMetrics({
            sessions_completed: 0,
            hours_trained: 0,
            coaches_worked_with: 0,
            average_rating: 0,
          });
          return;
        }

        setStatMetrics(data);
      } catch (err) {
        console.error("Unexpected error loading athlete stats", err);
        if (!isMounted) return;
        setStatMetrics({
          sessions_completed: 0,
          hours_trained: 0,
          coaches_worked_with: 0,
          average_rating: 0,
        });
      } finally {
        if (isMounted) setStatsLoading(false);
      }
    };

    const loadConversations = async () => {
      const { data, error } = await chatAPI.getUserConversations(user.id);
      if (!isMounted) return;
      if (error) {
        console.error("Failed to load conversations", error);
        setConversationItems([]);
        return;
      }

      const mapped = (Array.isArray(data) ? data : [])
        .map((conv) => {
          const participants = Array.isArray(conv.conversation_participants) ? conv.conversation_participants : [];
          const other = participants.find((p) => p.user_id !== user.id) || null;
          return {
            id: conv.id,
            sender: other?.user_profiles?.name || other?.user_id || "Conversation",
            message: conv.last_message_text || "No messages yet",
            time: conv.last_message_at || conv.created_at || new Date().toISOString(),
          } satisfies ConversationCardItem;
        })
        .sort((a, b) => Date.parse(b.time) - Date.parse(a.time))
        .slice(0, 3);

      setConversationItems(mapped);
    };

    const loadPastSessions = async () => {
      // The sessions RPC expects the athlete persona/profile id (from athlete_profiles table)
      // NOT the auth user id or user_profiles id
      const athleteId = profileState?.userProfile?.athlete_id;
      if (!athleteId) {
        console.warn('AthleteProfile: No athlete_id found for past sessions', { 
          athlete_id: profileState?.userProfile?.athlete_id,
          user_id: user?.id 
        });
        setPastSessions([]);
        return;
      }

      const { data, error } = await getAthleteSessions(athleteId);
      if (!isMounted) return;
      if (error) {
        console.error("Failed to load past sessions", error);
        setPastSessions([]);
        return;
      }

      // Filter only past/completed sessions and take the 3 most recent
      const pastSessionsList = (Array.isArray(data) ? data : [])
        .filter((session) => session.computedStatus === 'completed' || session.computedStatus === 'past')
        .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime())
        .slice(0, 3);

      setPastSessions(pastSessionsList);
    };

    void loadConversations();
    void loadPastSessions();
    void loadStats();

    return () => {
      isMounted = false;
    };
  }, [user?.id, profileState?.userProfile?.id, profileState?.userProfile?.athlete_id]);


  const safeStats = ATHLETE_PROFILE_BASE_STATS;
  const statsForDisplay = safeStats.filter((stat) => stat.key !== "average_rating");
  const safeUpcomingSessions = Array.isArray(upcomingSessions) ? upcomingSessions : [];
  const safePastSessions = Array.isArray(pastSessions) ? pastSessions : [];
  const displayedMessages: ConversationCardItem[] = conversationItems;

  // Derive coaches from upcoming booked sessions (not completed)
  const coachesFromSessions = useMemo(() => {
    const bookedSessions = safeUpcomingSessions.filter(
      (session) => session.computedStatus !== 'completed' && session.computedStatus !== 'canceled'
    );
    const uniqueCoaches = Array.from(
      new Map(
        bookedSessions.map((session) => [
          session.coachName,
          {
            initials: session.coachName
              ?.split(' ')
              .map((word) => word[0])
              .join('')
              .toUpperCase() || 'C',
            name: session.coachName || 'Coach',
            specialty: session.type || 'Training',
          },
        ])
      ).values()
    );
    return uniqueCoaches;
  }, [safeUpcomingSessions]);

  const displayCoaches = coachesFromSessions;

  const formatStatValue = (key: keyof AthleteStatMetrics, value: number) => {
    if (key === "average_rating") {
      return value > 0 ? value.toFixed(1) : "0";
    }
    if (key === "hours_trained") {
      const rounded = Number.isInteger(value) ? value.toString() : value.toFixed(1);
      return rounded.replace(/\.0$/, "");
    }
    return Math.max(0, Math.floor(value)).toString();
  };

  const updatedStats = statsForDisplay.map((stat) => {
    const metricValue = statMetrics[stat.key] ?? 0;
    const coachCount = stat.key === "coaches_worked_with"
      ? Math.max(metricValue, displayCoaches.length)
      : metricValue;

    return {
      ...stat,
      value: statsLoading ? "…" : formatStatValue(stat.key, coachCount),
    };
  });

  const getAgeFromDate = (dateString?: string | null) => {
    if (!dateString) return null;
    const birthDate = new Date(dateString);
    if (Number.isNaN(birthDate.getTime())) return null;
    const age = Math.floor(
      (Date.now() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
    );
    return Math.max(age, 0);
  };

  const getFormattedDate = (dateString?: string | null) => {
    if (!dateString) return null;
    const birthDate = new Date(dateString);
    if (Number.isNaN(birthDate.getTime())) return null;
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(birthDate);
  };

  const formatRelativeTime = (value?: string | null) => {
    if (!value) return "Just now";
    const parsed = parseISO(value);
    const date = isValid(parsed) ? parsed : new Date(value);
    if (!isValid(date)) return "Just now";
    if (differenceInMonths(new Date(), date) >= 2) {
      return format(date, "MMM d, yyyy");
    }
    return formatDistanceToNowStrict(date, {
      addSuffix: true,
      roundingMethod: "floor",
    });
  };



  const handleProfileSave = async (updatedProfile: AthleteProfileFormData) => {
    if (!updatedProfile.fullName.trim() || !updatedProfile.sport.trim() || !updatedProfile.dateOfBirth) {
      toast({
        title: "Missing details",
        description: "Full name, sport, and date of birth are required.",
        variant: "destructive",
      });
      throw new Error("Missing required profile fields.");
    }

    let uploadedImageUrl: string | null = null;
    const uploadedCoverUrls: string[] = [];
    let profilePathToDelete: string | null = null;
    let uploadFailed = false;

    const profileMarkedForDeletion =
      !selectedProfileImageFile &&
      updatedProfile.profileImageUrl === null &&
      Boolean(activeProfile.profileImageUrl);

    try {
      // Ensure user is authenticated
      // Use the user from props/context first (works for OAuth), fallback to getUser()
      let authUser = user;
      if (!authUser) {
        const { data: { user: fetchedUser } } = await supabase.auth.getUser();
        authUser = fetchedUser;
      }
      
      if (!authUser) {
        toast({
          title: "Not logged in",
          description: "Please sign in again to upload your images.",
          variant: "destructive",
        });
        throw new Error("User not authenticated");
      }

      // Upload profile image if selected
      if (selectedProfileImageFile) {
        try {
          if (selectedProfileImageFile.size > ATHLETE_IMAGE_LIMITS.MAX_PROFILE_IMAGE_SIZE) {
            toast({
              title: "Image too large",
              description: "Profile image must be less than 8MB.",
              variant: "destructive",
            });
            throw new Error("Image size exceeds 8MB limit");
          }

          // Upload to Supabase Storage
          const fileExt = selectedProfileImageFile.name.split('.').pop();
          const fileName = `${authUser.id}-${Date.now()}.${fileExt}`;
          const filePath = `athlete-profiles/${fileName}`;

          const { error: uploadError } = await supabase
            .storage
            .from('athalink-images')
            .upload(filePath, selectedProfileImageFile, {
              cacheControl: '3600',
              upsert: true,
            });

          if (uploadError) {
            console.error("Upload error:", uploadError);
            toast({
              title: "Upload failed",
              description: "Something went wrong while uploading your profile image. Please try again.",
              variant: "destructive",
            });
            throw new Error(uploadError.message);
          }

          // Get public URL
          const { data: publicUrlData } = supabase
            .storage
            .from('athalink-images')
            .getPublicUrl(filePath);

          // Add cache-busting parameter to force browser reload of new image
          uploadedImageUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

          // Capture old profile image path for deletion once upload succeeds
          profilePathToDelete = getStoragePathFromPublicUrl(activeProfile.profileImageUrl);

          // Reset the selected file after successful upload
          setSelectedProfileImageFile(null);
        } catch (error) {
          console.error("Profile image upload failed:", error);
          uploadFailed = true;
          throw error;
        }
      }

      // Upload cover images if selected (in parallel, keep successes, continue on failures)
      if (coverImagesToUpload.length > 0) {
        const coverUploadResults = await Promise.allSettled(
          coverImagesToUpload.map(async (file) => {
            if (file.size > ATHLETE_IMAGE_LIMITS.MAX_COVER_IMAGE_SIZE) {
              toast({
                title: "Image too large",
                description: `${file.name} is over 10MB. Skipping.`,
                variant: "destructive",
              });
              throw new Error("Cover image too large");
            }

            const fileExt = file.name.split('.').pop();
            const fileName = `${authUser.id}-cover-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `athlete-profiles/covers/${fileName}`;

            const { error: uploadError } = await supabase
              .storage
              .from('athalink-images')
              .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false,
              });

            if (uploadError) {
              throw uploadError;
            }

            const { data: publicUrlData } = supabase
              .storage
              .from('athalink-images')
              .getPublicUrl(filePath);

            return publicUrlData.publicUrl;
          })
        );

        coverUploadResults.forEach((result) => {
          if (result.status === "fulfilled" && result.value) {
            uploadedCoverUrls.push(result.value);
          } else {
            uploadFailed = true;
          }
        });
      }

      // Delete removed cover images from storage (match by URL)
      const pathsToDelete = coverImageUrlsToRemove
        .map((url) => getStoragePathFromPublicUrl(url))
        .filter((path): path is string => typeof path === "string" && path.trim() !== "");

      if (pathsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .storage
          .from('athalink-images')
          .remove(pathsToDelete);

        if (deleteError) {
          console.error('[Delete Covers] Failed:', deleteError);
          uploadFailed = true;
        }
      }

      // Always capture profile path from activeProfile if clearing (even without new upload)
      if (profileMarkedForDeletion && !profilePathToDelete) {
        profilePathToDelete = getStoragePathFromPublicUrl(activeProfile.profileImageUrl);
      }

      // Delete previous profile image from storage if replaced or explicitly cleared
      if (profilePathToDelete || profileMarkedForDeletion) {
        const paths = profilePathToDelete
          ? [profilePathToDelete]
          : [getStoragePathFromPublicUrl(activeProfile.profileImageUrl)].filter((p): p is string => Boolean(p));

        if (paths.length > 0) {
          const { error: deleteProfileError } = await supabase
            .storage
            .from('athalink-images')
            .remove(paths);

          if (deleteProfileError) {
            console.error('Failed to delete previous profile image:', deleteProfileError);
            uploadFailed = true;
          }
        }
      }

      // Reset cover images to upload after successful upload
      setCoverImagesToUpload([]);

    } catch (error) {
      console.error("Image upload failed:", error);
      uploadFailed = true;
    }

    if (uploadFailed) {
      toast({
        title: "Failed to save",
        description: "Please try again.",
        variant: "destructive",
      });
      setCoverImagesToUpload([]);
      setCoverImageUrlsToRemove([]);
      return;
    }

    const payload = mapFormToDbPayload(updatedProfile);
    
    // Use uploaded profile URL if available
    if (uploadedImageUrl) {
      payload.profile_image_url = uploadedImageUrl;
    }

    // Merge with existing cover images (removing the ones marked for deletion by URL)
    const existingUrls = Array.isArray(updatedProfile.coverImageUrls) ? updatedProfile.coverImageUrls : [];
    const filteredUrls = existingUrls
      .filter((url) => typeof url === "string" && url.trim() !== "" && !url.startsWith("data:image"))
      .filter((url) => !coverImageUrlsToRemove.includes(url));


    const mergedCoverUrls = [...filteredUrls, ...uploadedCoverUrls];
    const finalCoverUrls = mergedCoverUrls.slice(0, MAX_COVER_IMAGES);



    payload.cover_image_urls = finalCoverUrls;
    setCoverImageUrlsToRemove([]);

    // Optimistically reflect new values in the UI to avoid a brief flash of stale data
    const optimisticProfile: AthleteProfileFormData = {
      ...updatedProfile,
      coverImageUrls: finalCoverUrls,
      profileImageUrl: uploadedImageUrl || updatedProfile.profileImageUrl,
    };
    setOverrideProfile(optimisticProfile);

    try {
      const savedProfile = await saveAthleteProfile(payload);

      // Update user_profiles table to keep persona and identifiers in sync
      if (user?.id) {
        const updates: { 
          name?: string; 
          image_url?: string | null;
          gender?: string | null;
          zip_code?: string | null;
          persona_type?: string | null;
          athlete_id?: string | null;
          sport?: string | null;
          position?: string | null;
          date_of_birth?: string | null;
        } = {
          persona_type: 'athlete',
          athlete_id: savedProfile?.id ?? profileState.userProfile?.athlete_id ?? null,
          sport: updatedProfile.sport || null,
          position: updatedProfile.position || null,
          date_of_birth: updatedProfile.dateOfBirth || null,
        };

        if (updatedProfile.fullName !== activeProfile.fullName) {
          updates.name = updatedProfile.fullName;
          setUserName(updatedProfile.fullName);
        }

        if (uploadedImageUrl || updatedProfile.profileImageUrl !== activeProfile.profileImageUrl) {
          const finalImageUrl = uploadedImageUrl || updatedProfile.profileImageUrl;
          updates.image_url = finalImageUrl;
          setUserImg(finalImageUrl);
        }

        if (updatedProfile.gender !== activeProfile.gender) {
          updates.gender = updatedProfile.gender;
        }

        if (updatedProfile.zipCode !== activeProfile.zipCode) {
          updates.zip_code = updatedProfile.zipCode;
        }

        // Only persist when we have something to update (persona + identifiers are always present)
        if (Object.keys(updates).length > 0) {
          await updateProfile(updates);
          // Invalidate profile query to force fresh fetch from database
          queryClient.invalidateQueries({ queryKey: ["user-profile", user?.id] });
          // Refresh AuthContext userProfile, which will trigger ProfileContext to refetch
          await refreshUserProfile();
        }
      }

      // Refetch profile to ensure UI is updated with any image changes (especially removals)
      await refetchProfile();

      toast({
        title: "Profile updated",
        description: "Your profile changes have been saved successfully.",
      });
    } catch (error) {
      console.error("Failed to save athlete profile", error);
      toast({
        title: "Save failed",
        description: "We couldn't save your profile. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleViewAll = (section: ViewAllSection) => {
    if (section === 'sessions') {
      navigate(ROUTES.MY_SESSIONS);
      return;
    }

    const hasMessages = displayedMessages.length > 0;
    if (!hasMessages) {
      toast({
        title: "Nothing to show yet",
        description: "You do not have any new messages.",
      });
      return;
    }
    setViewAllSection('messages');
  };

  const closeViewAll = () => setViewAllSection(null);

  const isViewAllOpen = Boolean(viewAllSection);
  const viewAllTitle = viewAllSection === "sessions" ? "All upcoming sessions" : "All messages";
  const viewAllDescription =
    viewAllSection === "sessions"
      ? "Every confirmed and pending session."
      : "Your recent conversations in one place.";

  const profileCompletion = useMemo(() => {
    if (profileState.type === "athlete" && profileState.data) {
      return calculateProfileCompletion(profileState.data as ProfileData);
    }
    return 0;
  }, [profileState]);

  const isParentPersona = role === "parent";

  const isProfileIncomplete = profileCompletion < 100;

  // Helper to get academic year display
  const getAcademicYearDisplay = () => {
    if (activeProfile.currentYear) {
      // Show current year level
      const yearLabel = getAcademicYearLabel(activeProfile.currentYear) || activeProfile.currentYear;
      return yearLabel;
    } else if (activeProfile.graduationYear) {
      // Has graduation year
      return `Class of ${activeProfile.graduationYear}`;
    }
    return null;
  };

  if (hasAthleteData && awaitingAthleteData) {
    return <ProfileSkeleton />;
  }

  if (!user) {
    return (
      <ProfileNotice
        title="Athlete profile unavailable"
        description="Sign in as an athlete to view and update your profile."
      >
        <Button onClick={() => window.location.assign("/auth")}>Sign in</Button>
      </ProfileNotice>
    );
  }

  // Check if user is NOT an athlete (they are a coach or other persona type)
  // Only show this after loading is complete
  if (profileState.type !== null && profileState.type !== "athlete") {
    return (
      <ProfileNotice
        title="Athlete profile unavailable"
        description={`This page is only for athletes. You're signed in as a ${profileState.type}.`}
      >
        <Button onClick={() => window.location.assign("/")}>Go to home</Button>
      </ProfileNotice>
    );
  }

  if (!profileState.data) {
    return (
      <ProfileNotice
        title="No athlete profile yet"
        description="Create your athlete profile to book sessions and track your progress."
      >
        <Button variant="outline" onClick={() => navigate(-1)}>
          Go back
        </Button>
        <Button onClick={() => navigate(ROUTES.CREATE_ATHLETE_PROFILE)}>Create profile</Button>
      </ProfileNotice>
    );
  }

  const profileTags = Array.isArray(activeProfile.tags) ? activeProfile.tags.filter(Boolean) : [];
  const coverPhotos = activeProfile.coverImageUrls?.length ? activeProfile.coverImageUrls : [];
  const computedAge = getAgeFromDate(activeProfile.dateOfBirth);
  const formattedDob = getFormattedDate(activeProfile.dateOfBirth);
  const portalTarget = typeof document !== "undefined" ? document.body : null;
  const sportIcon = useMemo(() => {
    const sportValue = (activeProfile.sport || "").toLowerCase();
    if (sportValue.includes("rowing")) return rowingIcon;
    return footballIcon;
  }, [activeProfile.sport]);

  useEffect(() => {
    const avatarUrl = activeProfile.profileImageUrl;
    if (!avatarUrl) {
      setIsAvatarLoading(false);
      return;
    }
    if (loadedAvatarCacheRef.current.has(avatarUrl)) {
      setIsAvatarLoading(false);
      return;
    }
    setIsAvatarLoading(true);
    const img = new Image();
    img.onload = () => {
      loadedAvatarCacheRef.current.add(avatarUrl);
      setIsAvatarLoading(false);
    };
    img.onerror = () => setIsAvatarLoading(false);
    img.src = avatarUrl;
  }, [activeProfile.profileImageUrl]);


  const academicYearDisplay = getAcademicYearDisplay();
  const sportBadge = (
    <span className="absolute -bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-[#EAEADF] bg-[#F7F7F0] p-1">
      <img src={sportIcon} alt="sport" className="size-7" />
    </span>
  );
  const avatarLoadingOverlay = isAvatarLoading ? (
    <div className="absolute inset-0 flex items-center justify-center bg-[#F7F7F0]/70">
      <Loader2 className="size-5 animate-spin text-[#767980]" strokeWidth={1.5} aria-hidden="true" />
    </div>
  ) : null;

  return (
    <div className="mb-20 mt-[3.8rem] px-4 pt-6 md:px-10">
      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6">
        {/* Header Section */}
        <section className={cardClass}>
          <ProfileStrengthMeter
            athlete={profileState.data as ProfileData}
            onEdit={() => setIsEditOpen(true)}
            className="pb-0"
          />
          {/* Photo Carousel */}
          <Carousel
            photos={coverPhotos}
            altTextPrefix={activeProfile.fullName}
            enablePreview
            aspect="cover3x1"
            containUntilLg
          />

          <div className="flex flex-col items-start gap-5 md:flex-row md:items-center">
            {/* Athlete Avatar */}
            {activeProfile.profileImageUrl ? (
              <button
                type="button"
                onClick={() => setAvatarPreviewOpen(true)}
                className="relative mb-3 size-24 flex-shrink-0 rounded-full bg-transparent p-0 md:mb-0"
                aria-label="Open profile image preview"
              >
                <div className="relative size-full overflow-hidden rounded-full border border-[#EAEADF]">
                  <img
                    src={activeProfile.profileImageUrl}
                    alt={activeProfile.fullName || "Athlete"}
                    className="aspect-square size-full rounded-full object-cover"
                    onLoad={() => {
                      if (activeProfile.profileImageUrl) {
                        loadedAvatarCacheRef.current.add(activeProfile.profileImageUrl);
                      }
                      setIsAvatarLoading(false);
                    }}
                    onError={() => setIsAvatarLoading(false)}
                  />
                  {avatarLoadingOverlay}
                </div>
                {sportBadge}
              </button>
            ) : (
              <div className="relative mb-3 size-24 flex-shrink-0 rounded-full md:mb-0">
                <div className="relative flex size-full items-center justify-center overflow-hidden rounded-full border border-[#EAEADF] bg-[#E5EDF7]">
                  <span className="text-[32px] font-medium leading-[30px] tracking-[-0.05em] text-[#0054B4]">
                    {activeProfile.initials}
                  </span>
                  {avatarLoadingOverlay}
                </div>
                {sportBadge}
              </div>
            )}

            {/* Athlete Info */}
            <div className="flex w-full min-w-0 flex-1 flex-col gap-[10px]">
              <h1 className="break-words text-[32px] font-bold leading-[34px] tracking-[-0.05em] text-[#1A202C]">
                {activeProfile.fullName}
              </h1>
              {locationInfo && (
                <p className={cn(mutedTextClass, "flex items-center gap-1.5")}>
                  <MapPin className="size-4 flex-none" strokeWidth={1.5} aria-hidden="true" />
                  <span>{formatLocationDisplay(locationInfo)}</span>
                </p>
              )}
              <p className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#484D56]">
                Track your progress and manage your training sessions.
              </p>
              {(activeProfile.position || academicYearDisplay || activeProfile.gender) && (
                <div className="flex flex-wrap items-center gap-2">
                  {activeProfile.position && <BrandPill tone="blue">{activeProfile.position}</BrandPill>}
                  {academicYearDisplay && <BrandPill tone="neutral">{academicYearDisplay}</BrandPill>}
                  {activeProfile.gender && <GenderPill gender={activeProfile.gender} showLabel={false} />}
                </div>
              )}
            </div>

            {/* Edit Profile Button */}
            <Button className="shrink-0 gap-1.5" onClick={() => setIsEditOpen(true)}>
              <Pencil className="size-4" strokeWidth={1.5} aria-hidden="true" />
              Edit profile
            </Button>
          </div>
        </section>

        {/* Training Statistics */}
        <section className="flex flex-col gap-[14px]">
          <h2 className="text-[20px] font-medium leading-[24px] tracking-[-0.05em] text-[#1A202C]">Training stats</h2>
          <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2 lg:grid-cols-3">
            {updatedStats.length > 0 ? (
              updatedStats.map((stat) => {
                const meta = STAT_META[stat.key] ?? STAT_META.sessions_completed;
                const Icon = meta.icon;
                return (
                  <div key={stat.key} className={cn(cardClass, "gap-4")}>
                    <span
                      className={cn("inline-flex size-8 items-center justify-center rounded-[8px]", meta.tint)}
                      aria-hidden="true"
                    >
                      <Icon className="size-4" strokeWidth={1.5} />
                    </span>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[32px] font-bold leading-[30px] tracking-[-0.03em] text-[#1A202C]">
                        {stat.value}
                      </span>
                      <span className={rowTitleClass}>{meta.label}</span>
                      <span className={rowMetaClass}>{meta.subtitle}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className={cn(cardClass, "col-span-full")}>
                <EmptyNote icon={Activity}>No training stats yet.</EmptyNote>
              </div>
            )}
          </div>
        </section>

        {/* Grid Layout for Dashboard Cards */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Row 1: Upcoming Sessions & Messages */}
          <SectionCard
            icon={Calendar}
            title="Upcoming sessions"
            className="h-full lg:col-span-2"
            action={
              <button type="button" className={linkButtonClass} onClick={() => handleViewAll("sessions")}>
                View all
              </button>
            }
          >
            {sessionsLoading ? (
              <div className="flex flex-col gap-[10px]" aria-label="Loading upcoming sessions">
                <Skeleton className="h-[58px] w-full rounded-[8px]" />
                <Skeleton className="h-[58px] w-full rounded-[8px]" />
              </div>
            ) : safeUpcomingSessions.length > 0 ? (
              <div className="flex max-h-[320px] flex-col gap-[10px] overflow-y-auto pr-1">
                {safeUpcomingSessions.map((session) => (
                  <div key={`${session.bookingId}`} className={cn(rowClass, "flex items-center justify-between gap-3")}>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <p className={rowTitleClass}>{formatSessionWhen(session)}</p>
                      <p className={cn(rowMetaClass, "truncate")}>
                        {session.coachName || "Coach"}, {capitalizeFirst(session.type)}
                      </p>
                    </div>
                    <StatusPill status={session.computedStatus} />
                  </div>
                ))}
              </div>
            ) : sessionsError ? (
              <EmptyNote icon={CalendarX} tone="error">
                {sessionsError}
              </EmptyNote>
            ) : (
              <EmptyNote icon={CalendarX}>No upcoming sessions.</EmptyNote>
            )}
          </SectionCard>

          <SectionCard
            icon={MessageCircle}
            title="Messages"
            className="h-full lg:col-span-1"
            action={
              <button type="button" className={linkButtonClass} onClick={() => handleViewAll("messages")}>
                View all
              </button>
            }
          >
            {displayedMessages.length > 0 ? (
              <div className="flex flex-col gap-[10px]">
                {displayedMessages.map((message) => (
                  <button
                    type="button"
                    key={message.id}
                    onClick={() => navigate(ROUTES.CHAT)}
                    className={cn(rowClass, "flex w-full flex-col gap-1.5 text-left transition-colors hover:bg-[#EAEADF]")}
                  >
                    <div className="flex w-full items-start justify-between gap-3">
                      <span className={cn(rowTitleClass, "min-w-0 truncate")}>{message.sender}</span>
                      <span className={cn(rowMetaClass, "shrink-0")}>{formatRelativeTime(message.time)}</span>
                    </div>
                    <p className={cn(rowMetaClass, "line-clamp-2")}>{message.message}</p>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyNote icon={MessageSquareOff}>No new messages.</EmptyNote>
            )}
          </SectionCard>

          {/* Row 2: Recent Activity & Coaches */}
          <SectionCard icon={Clock3} title="Recent activity" className="h-full lg:col-span-2">
            {safePastSessions.length > 0 ? (
              <ScrollArea className={safePastSessions.length > 3 ? "max-h-64 pr-2" : ""}>
                <div className="flex flex-col gap-[10px]">
                  {safePastSessions.map((session) => (
                    <div key={session.bookingId} className={cn(rowClass, "flex items-start justify-between gap-3")}>
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <p className={cn(rowTitleClass, "truncate")}>{session.title}</p>
                        <p className={cn(rowMetaClass, "truncate")}>
                          {session.coachName ? `With ${session.coachName}` : capitalizeFirst(session.type)}
                        </p>
                      </div>
                      <span className={cn(rowMetaClass, "whitespace-nowrap")}>
                        {new Date(session.start).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <EmptyNote icon={Activity}>No completed sessions yet.</EmptyNote>
            )}
          </SectionCard>

          <SectionCard icon={Trophy} title="Your coaches" className="h-full lg:col-span-1">
            {displayCoaches.length > 0 ? (
              <div className="flex flex-col gap-[14px]">
                {displayCoaches.map((coach, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-full text-[14px] font-medium",
                        AVATAR_TINTS[index % AVATAR_TINTS.length]
                      )}
                    >
                      {coach.initials}
                    </span>
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className={cn(rowTitleClass, "truncate")}>{coach.name}</span>
                      <span className={rowMetaClass}>{capitalizeFirst(coach.specialty)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyNote icon={UserX}>No coaches yet.</EmptyNote>
            )}
          </SectionCard>
        </div>
      </div>

      <EditProfileDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        profile={activeProfile}
        onSave={handleProfileSave}
        onImageSelect={setSelectedProfileImageFile}
        onCoverImagesSelect={(files) => setCoverImagesToUpload((prev) => [...prev, ...files])}
        onCoverImageRemove={(url) => setCoverImageUrlsToRemove(prev => [...prev, url])}
        genderLabel={isParentPersona ? "Child's gender" : "Gender"}
      />

      <Dialog
        open={isViewAllOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeViewAll();
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto p-[25px] sm:max-w-[560px]">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle>{viewAllTitle}</DialogTitle>
            <DialogDescription className={mutedTextClass}>{viewAllDescription}</DialogDescription>
          </DialogHeader>

          {viewAllSection === "sessions" ? (
            <ScrollArea className="max-h-[60vh] pr-2">
              <div className="flex flex-col gap-[10px]">
                {safeUpcomingSessions.length > 0 ? (
                  safeUpcomingSessions.map((session) => (
                    <div key={`${session.bookingId}`} className={cn(rowClass, "flex flex-col gap-1.5")}>
                      <div className="flex items-center justify-between gap-3">
                        <p className={rowTitleClass}>{session.coachName || "Coach"}</p>
                        <StatusPill status={session.computedStatus} />
                      </div>
                      <p className={rowMetaClass}>{capitalizeFirst(session.type)}</p>
                      <p className={cn(rowMetaClass, "flex items-center gap-1.5")}>
                        <Calendar className="size-3.5 flex-none" strokeWidth={1.5} aria-hidden="true" />
                        <span>{formatSessionWhen(session)}</span>
                      </p>
                    </div>
                  ))
                ) : (
                  <p className={mutedTextClass}>No upcoming sessions.</p>
                )}
              </div>
            </ScrollArea>
          ) : (
            <ScrollArea className="max-h-[60vh] pr-2">
              <div className="flex flex-col gap-[10px]">
                {displayedMessages.length > 0 ? (
                  displayedMessages.map((message) => (
                    <div key={message.id} className={cn(rowClass, "flex flex-col gap-1.5")}>
                      <div className="flex items-center justify-between gap-3">
                        <p className={cn(rowTitleClass, "min-w-0 truncate")}>{message.sender}</p>
                        <span className={cn(rowMetaClass, "shrink-0")}>{formatRelativeTime(message.time)}</span>
                      </div>
                      <p className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#484D56]">{message.message}</p>
                    </div>
                  ))
                ) : (
                  <p className={mutedTextClass}>No messages to show.</p>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
      {portalTarget && avatarPreviewOpen && activeProfile.profileImageUrl && createPortal(
        <div className="fixed inset-0 z-[2100] flex items-center justify-center bg-black/80 px-4">
          <div className="absolute inset-0" onClick={() => setAvatarPreviewOpen(false)} />
          <div className="relative z-[2101] flex max-h-[90vh] w-full max-w-3xl flex-col gap-3">
            <button
              type="button"
              aria-label="Close preview"
              className="absolute -top-10 right-0 text-[#F1F1E6]/90 hover:text-[#F1F1E6]"
              onClick={() => setAvatarPreviewOpen(false)}
            >
              <X className="size-6" strokeWidth={1.5} />
            </button>
            <div className="relative flex h-full max-h-[80vh] w-full items-center justify-center overflow-hidden rounded-[10px] bg-black/30">
              <img
                src={activeProfile.profileImageUrl}
                alt={`${activeProfile.fullName || "Athlete"} profile`}
                className="max-h-[80vh] w-auto object-contain"
              />
            </div>
          </div>
        </div>,
        portalTarget
      )}
    </div>
  );
};

export default AthleteProfile;
