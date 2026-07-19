/* eslint-disable react-hooks/rules-of-hooks */
import {
  Calendar,
  Clock,
  Trophy,
  Star,
  Edit,
  MessageCircle,
  Clock3,
  MapPin,
  CalendarX,
  MessageSquareOff,
  UserX,
  Activity,
  ChevronDown,
  Loader2,
  X
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { capitalizeFirst } from "@/lib/utils";
import { colors } from "@/config/colors";
import { parseISODateLocal } from "@/utils/dateHelpers";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useMemo, useRef, useState } from "react";
import { differenceInMonths, format, formatDistanceToNowStrict, isValid, parseISO } from "date-fns";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/routes";
import type { SessionUIModel } from "@/types/sessions-api";
import { useUserProfile, clearUserProfileCache } from "@/hooks/useUserProfile";
import { ScrollArea } from "@/components/ui/scroll-area";
import footballCover from "@/assets/images/footballs.png";
import type { ProfileData } from "@/utils/profileCompletion";
import footballIcon from "@/assets/images/colored-soccer.png";
import rowingIcon from "@/assets/images/colored-rowing.png";
import { Carousel } from "@/components/coach-profile/Carousel";
import { calculateProfileCompletion } from "@/utils/profileCompletion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileStrengthMeter } from "@/components/coach-profile/ProfileStrengthMeter";
import { EditProfileDialog, ProfileSkeleton } from "@/components/athlete-profile";
import type { AthleteProfileFormData } from "@/types/athleteProfile";
import { type AthleteProfile as DbAthleteProfile } from "@/hooks/useProfile";
import { athletesAPI, chatAPI } from "@/api";
import { getAthleteSessions } from "@/api/sessions";
import { supabase } from "@/integrations/supabase/client";
import { clearGlobalImageCache } from "@/contexts/ProfileContext";
import { ATHLETE_PROFILE_BASE_STATS, ATHLETE_PROFILE_CONSTANTS, PROFILE_TYPE, ATHLETE_IMAGE_LIMITS } from "@/utils/db";
import { getAcademicYearLabel } from "@/utils/academicYear";
import { getStoragePathFromPublicUrl } from "@/utils/storage";
import type { AthleteProfileProps, AthleteStatMetrics, ConversationCardItem, ViewAllSection } from "@/types/athlete-profile";

const { MAX_COVER_IMAGES } = ATHLETE_PROFILE_CONSTANTS;

const AthleteProfile = ({ profile: profileState, loading: profileLoading, error: profileError, saveAthleteProfile, refetchProfile, user, authLoading, upcomingSessions = [], sessionsLoading = false, sessionsError = null }: AthleteProfileProps) => {
  const { toast } = useToast();
  const { updateProfile } = useUserProfile();
  const { setUserImg, setUserName, refreshUserProfile, userProfile: authUserProfile } = useAuth();
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

  const iconMap: Record<string, typeof Calendar> = {
    Calendar,
    Clock,
    Trophy,
    Star,
  };

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

  const interactiveCardClass =
    "transition-all duration-300 hover:-translate-y-1 hover:shadow-lg/30";
  const listItemClass =
    "transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md/20";


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
      // Invalidate cache BEFORE saving so ProfileContext refetch gets fresh data
      clearGlobalImageCache();
      
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
          // Clear profile cache to force fresh fetch from database
          clearUserProfileCache(user?.id);
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
  const viewAllTitle = viewAllSection === "sessions" ? "All Upcoming Sessions" : "All Messages";
  const viewAllDescription =
    viewAllSection === "sessions"
      ? "Review your complete list of confirmed and pending sessions."
      : "Catch up on every conversation in one place.";

  const profileCompletion = useMemo(() => {
    if (profileState.type === "athlete" && profileState.data) {
      return calculateProfileCompletion(profileState.data as ProfileData);
    }
    return 0;
  }, [profileState]);

  const isParentPersona =
    (profileState.userProfile?.persona_type || user?.user_metadata?.persona_type) === PROFILE_TYPE.parent;

  const isProfileIncomplete = profileCompletion < 100;

  // Helper to get academic year display
  const getAcademicYearDisplay = () => {
    if (activeProfile.currentYear) {
      // Show current year level
      const yearLabel = getAcademicYearLabel(activeProfile.currentYear) || activeProfile.currentYear;
      return yearLabel;
    } else if (activeProfile.graduationYear) {
      // Has graduation year
      return `High School Grad Year ${activeProfile.graduationYear}`;
    }
    return null;
  };

  if (hasAthleteData && awaitingAthleteData) {
    return <ProfileSkeleton />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50/30 to-slate-100/20 dark:from-slate-900 dark:via-slate-950/30 dark:to-slate-950/20 mt-[3.8rem] mb-20 flex flex-col items-center justify-center px-4 text-center">
        <div className="max-w-md space-y-4">
          <h1 className="text-2xl font-semibold text-slate-900">Athlete profile unavailable</h1>
          <p className="text-sm text-slate-600">
            Please sign in as an athlete to view and update your profile.
          </p>
          <Button
            variant="default"
            onClick={() => window.location.assign("/auth")}
            className="px-8"
          >
            Go to Sign In
          </Button>
        </div>
      </div>
    );
  }

  // Check if user is NOT an athlete (they are a coach or other persona type)
  // Only show this after loading is complete
  if (profileState.type !== null && profileState.type !== "athlete") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50/30 to-slate-100/20 dark:from-slate-900 dark:via-slate-950/30 dark:to-slate-950/20 mt-[3.8rem] mb-20 flex flex-col items-center justify-center px-4 text-center">
        <div className="max-w-md space-y-4">
          <h1 className="text-2xl font-semibold text-slate-900">Athlete profile unavailable</h1>
          <p className="text-sm text-slate-600">
            This page is only available for athletes. You are signed in as a {profileState.type}.
          </p>
          <Button
            variant="default"
            onClick={() => window.location.assign("/")}
            className="px-8"
          >
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  if (!profileState.data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50/30 to-slate-100/20 dark:from-slate-900 dark:via-slate-950/30 dark:to-slate-950/20 mt-[3.8rem] mb-20 flex flex-col items-center justify-center px-4 text-center">
        <div className="max-w-md space-y-4">
          <h1 className="text-2xl font-semibold text-slate-900">No athlete profile yet</h1>
          <p className="text-sm text-slate-600">
            Create your athlete profile to start booking sessions and track your progress.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" onClick={() => navigate(-1)} className="px-6">
              Go Back
            </Button>
            <Button
              variant="default"
              onClick={() => navigate(ROUTES.CREATE_ATHLETE_PROFILE)}
              className="px-6"
            >
              Create Profile
            </Button>
          </div>
        </div>
      </div>
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

  const getBgColor = (index: number) => {
    if (index === 0) {
      return 'bg-blue-500 text-white';
    } else if (index === 1) {
      return 'bg-red-500 text-white';
    } else if (index === 2) {
      return 'bg-green-500 text-white';
    }
    return 'bg-blue-500 text-white';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50/30 to-slate-100/20 dark:from-slate-900 dark:via-slate-950/30 dark:to-slate-950/20 mt-[3.8rem] mb-20 px-4">
      <div className="max-w-8xl mx-auto space-y-6">
        {/* Header Section */}
        <Card className={`w-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm overflow-hidden px-4 py-6 rounded-none border-t-0 rounded-b-md border-slate-200 ${interactiveCardClass}`}>
          <ProfileStrengthMeter athlete={profileState.data as ProfileData} />
          {/* Photo Carousel */}
          <Carousel
            photos={coverPhotos}
            altTextPrefix={activeProfile.fullName}
            enablePreview
            aspect="cover3x1"
            containUntilLg
          />

          <CardContent className="p-4 md:p-6 !px-0">
            <div className="flex flex-col md:flex-row items-start gap-4 md:gap-6">
              {/* Athlete Avatar */}
              {activeProfile.profileImageUrl ? (
                <button
                  type="button"
                  onClick={() => setAvatarPreviewOpen(true)}
                  className="relative w-28 h-28 rounded-full flex items-center justify-center flex-shrink-0 border-2 bg-transparent p-0"
                  aria-label="Open profile image preview"
                >
                  <div className="relative w-full h-full rounded-full overflow-hidden">
                    <img
                      src={activeProfile.profileImageUrl}
                      alt={activeProfile.fullName || "Athlete"}
                      className="w-full h-full rounded-full aspect-square border-2 border-[#D6D9E2] object-cover"
                      onLoad={() => {
                        if (activeProfile.profileImageUrl) {
                          loadedAvatarCacheRef.current.add(activeProfile.profileImageUrl);
                        }
                        setIsAvatarLoading(false);
                      }}
                      onError={() => setIsAvatarLoading(false)}
                    />
                    {isAvatarLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                        <Loader2 className="h-5 w-5 text-slate-500 animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 rounded-full p-1 bg-white z-10">
                    <img src={sportIcon} alt="sport" className="w-8 h-8" />
                  </div>
                </button>
              ) : (
                <div className="relative w-28 h-28 rounded-full flex items-center justify-center flex-shrink-0 border-2">
                  <div className="relative w-full h-full rounded-full overflow-hidden">
                    <div className="relative w-full h-full bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center aspect-square p-1 border-2 border-[#D6D9E2] dark:border-slate-800">
                      <div className="w-full h-full bg-primary/30 rounded-full flex items-center justify-center">
                        <span className="text-primary font-bold text-xl md:text-4xl">{activeProfile.initials}</span>
                      </div>
                    </div>
                    {isAvatarLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                        <Loader2 className="h-5 w-5 text-slate-500 animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 rounded-full p-1 bg-white z-10">
                    <img src={sportIcon} alt="sport" className="w-8 h-8" />
                  </div>
                </div>
              )}

              {/* Athlete Info */}
              <div className="flex-1 w-full flex flex-col gap-2 justify-center">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex gap-2 flex-col justify-center">
                    <div className="space-y-1">
                      <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                        {activeProfile.fullName} {" "}
                        👋
                      </h1>
                      {locationInfo && (
                        <div className="flex items-center gap-1 text-base md:text-lg text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          <span>{formatLocationDisplay(locationInfo)}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-sm font-normal text-[#4A5565]">
                      Track your progress and manage your training sessions
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-[#1B8A3B1A] text-[#1B8A3B] font-semibold w-fit rounded-sm">
                        {activeProfile.position}
                      </Badge>
                      {getAcademicYearDisplay() && (
                        <span className="text-sm text-muted-foreground">
                          {getAcademicYearDisplay()}
                        </span>
                      )}
                      {activeProfile.gender && (
                        <GenderPill gender={activeProfile.gender} showLabel={false} />
                      )}
                    </div>
                  </div>

                  {/* Edit Profile Button */}
                  <div className="flex items-center gap-3">
                    <Button
                      className="text-white gap-2 rounded-full"
                      style={{ backgroundColor: '#0D7FF2' }}
                      onClick={() => setIsEditOpen(true)}
                    >
                      <Edit className="h-4 w-4" />
                      Edit Profile
                    </Button>
                  </div>
                </div>

                {/* Position badge moved above filters within the header block */}

                {/* <p className="text-base md:text-lg text-muted-foreground">
                  {activeProfile.position || "Position N/A"}
                </p> */}

                {/* Tags Badges */}
                {/* <div className="flex flex-wrap gap-1.5 md:gap-2">
                  {profileTags.length > 0 ? (
                    profileTags.map((tag, index) => (
                      <Badge key={`${tag}-${index}`} className="text-xs bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 rounded-sm">
                        {tag}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">Add tags from edit profile to highlight skills.</span>
                  )}
                </div> */}

                {/* <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  {formattedDob && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-blue-500" />
                      <span>{formattedDob}</span>
                    </span>
                  )}
                  {computedAge !== null && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4 text-blue-500" />
                      <span>Age {computedAge}</span>
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4 text-blue-500" />
                    <span>{activeProfile.location || "Location not provided"}</span>
                  </span>
                  {activeProfile.phoneNumber && (
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-4 w-4 text-blue-500" />
                      <span>{activeProfile.phoneNumber}</span>
                    </span>
                  )}
                </div> */}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Training Statistics */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Training Statistics</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {updatedStats.length > 0 ? (
              updatedStats.map((stat, index) => {
                const Icon = iconMap[stat.iconType] || Calendar;
                return (
                  <Card key={index} className={`border border-slate-200 rounded-md ${interactiveCardClass}`}>
                    <CardContent className="p-6">
                      <div className={`${stat.bgColor} w-12 h-12 rounded-md flex items-center justify-center mb-4`}>
                        <Icon className={`h-6 w-6 ${stat.iconColor}`} />
                      </div>
                      <div className="text-3xl font-bold text-slate-900 mb-1">{stat.value}</div>
                      <div className="text-sm font-semibold text-slate-700">{stat.label}</div>
                      <div className="text-xs text-slate-500 mt-1">{stat.subtitle}</div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="col-span-full text-center py-8 text-slate-500 bg-slate-50 rounded-md border border-dashed border-slate-200">
                No statistics available yet.
              </div>
            )}
          </div>
        </div>

        {/* Grid Layout for Dashboard Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Row 1: Upcoming Sessions & Messages */}
          <div className="lg:col-span-2">
            <Card className={`border border-slate-200 rounded-md h-full ${interactiveCardClass}`}>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  Upcoming Sessions
                </CardTitle>
                <Button
                  variant="link"
                  className="text-sm font-semibold text-[#0D7FF2] hover:text-[#0b6ad1]"
                  onClick={() => handleViewAll("sessions")}
                >
                  View All
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {sessionsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Loading upcoming sessions...
                  </div>
                ) : safeUpcomingSessions.length > 0 ? (
                  <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                    {safeUpcomingSessions.map((session) => {
                      const statusColor = session.computedStatus === 'in-progress'
                        ? 'bg-green-600'
                        : session.computedStatus === 'upcoming'
                          ? 'bg-blue-600'
                          : session.computedStatus === 'completed'
                            ? 'bg-emerald-600'
                            : session.computedStatus === 'canceled'
                              ? 'bg-red-600'
                              : 'bg-slate-500';

                      const formattedDate = new Intl.DateTimeFormat('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      }).format(parseISODateLocal(session.dateOnly));

                      return (
                        <div
                          key={`${session.bookingId}`}
                          className={`flex items-center justify-between p-4 bg-slate-50 rounded-md hover:bg-slate-100 transition-colors ${listItemClass}`}
                        >
                          <div className="flex-1">
                            <div className="font-medium text-slate-900">{formattedDate} • {session.timeRange}</div>
                            <div className="text-sm text-slate-600">{session.coachName || 'Coach'} • {capitalizeFirst(session.type)}</div>
                          </div>
                          <Badge
                            className="text-white border-0 rounded-sm"
                            style={{ backgroundColor: colors.primary.main }}
                          >
                            {capitalizeFirst(session.computedStatus.replace('-', ' '))}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                ) : sessionsError ? (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                    <CalendarX className="h-8 w-8 mb-2 text-slate-300" />
                    <p className="text-sm">{sessionsError}</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                    <CalendarX className="h-8 w-8 mb-2 text-slate-300" />
                    <p className="text-sm">No upcoming sessions</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card className={`border border-slate-200 rounded-md h-full ${interactiveCardClass}`}>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-green-600" />
                  Messages
                </CardTitle>
                <Button
                  variant="link"
                  className="text-sm font-semibold text-[#0D7FF2] hover:text-[#0b6ad1]"
                  onClick={() => handleViewAll("messages")}
                >
                  View All
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {displayedMessages.length > 0 ? (
                  displayedMessages.map((message) => (
                    <button
                      type="button"
                      key={message.id}
                      onClick={() => navigate(ROUTES.CHAT)}
                      className={`w-full text-left p-3 bg-slate-50 rounded-md hover:bg-slate-100 transition-colors cursor-pointer ${listItemClass}`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div className="font-medium text-sm text-slate-900 flex items-center gap-2">
                          {message.sender}
                        </div>
                        <span className="text-xs text-slate-500">{formatRelativeTime(message.time)}</span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2">{message.message}</p>
                    </button>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                    <MessageSquareOff className="h-8 w-8 mb-2 text-slate-300" />
                    <p className="text-sm">No new messages</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Row 2: Recent Activity & Coaches */}
          <div className="lg:col-span-2">
            <Card className={`border border-slate-200 rounded-md h-full ${interactiveCardClass}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Clock3 className="h-5 w-5 text-orange-600" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {safePastSessions.length > 0 ? (
                  <ScrollArea className={safePastSessions.length > 3 ? "max-h-64 pr-2" : ""}>
                    <div className="space-y-3">
                      {safePastSessions.map((session) => (
                        <div
                          key={session.bookingId}
                          className={`flex items-center gap-3 rounded-lg border border-slate-200/70 bg-slate-50/70 px-3 py-3 ${listItemClass}`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                  Session
                                </div>
                                <p className="text-sm font-semibold text-slate-900 truncate">
                                  {session.title}
                                </p>
                              </div>
                              <span className="text-xs text-slate-500 whitespace-nowrap">
                                {new Date(session.start).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-1 truncate">
                              {session.coachName ? `with ${session.coachName}` : session.type}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                    <Activity className="h-8 w-8 mb-2 text-slate-300" />
                    <p className="text-sm">No Activity Found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card className={`border border-slate-200 rounded-md h-full ${interactiveCardClass}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-purple-600" />
                  Coach Working With
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {displayCoaches.length > 0 ? (
                  displayCoaches.map((coach, index) => (
                    <div key={index} className={`flex items-center gap-3 ${listItemClass}`}>
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm ${getBgColor(index)}`}>
                        {coach.initials}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900 text-sm">{coach.name}</div>
                        <div className="text-xs text-slate-600">{capitalizeFirst(coach.specialty)}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                    <UserX className="h-8 w-8 mb-2 text-slate-300" />
                    <p className="text-sm">No coaches yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

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
        genderLabel={isParentPersona ? "Child's Gender" : "Gender"}
      />

      <Dialog
        open={isViewAllOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeViewAll();
          }
        }}
      >
        <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewAllTitle}</DialogTitle>
            <DialogDescription>{viewAllDescription}</DialogDescription>
          </DialogHeader>

          {viewAllSection === "sessions" ? (
            <ScrollArea className="max-h-[60vh] pr-2">
              <div className="space-y-3">
                {safeUpcomingSessions.length > 0 ? (
                  safeUpcomingSessions.map((session) => (
                    <div
                      key={`${session.bookingId}`}
                      className={`rounded-md border border-slate-200 p-4 flex flex-col gap-1 ${listItemClass}`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-slate-900">{session.coachName || 'Coach'}</p>
                        <Badge
                          className="text-white border-0 rounded-sm"
                          style={{ backgroundColor: colors.primary.main }}
                        >
                          {capitalizeFirst(session.computedStatus.replace('-', ' '))}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600">{capitalizeFirst(session.type)}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Calendar className="h-4 w-4 text-blue-500" />
                        <span>{new Intl.DateTimeFormat('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        }).format(parseISODateLocal(session.dateOnly))} • {session.timeRange}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No upcoming sessions.</p>
                )}
              </div>
            </ScrollArea>
          ) : (
            <ScrollArea className="max-h-[60vh] pr-2">
              <div className="space-y-3">
                {displayedMessages.length > 0 ? (
                  displayedMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`rounded-md border border-slate-200 p-4 ${listItemClass}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-semibold text-slate-900 flex items-center gap-2 text-sm">
                          {message.sender}
                        </p>
                        <span className="text-xs text-slate-500">{formatRelativeTime(message.time)}</span>
                      </div>
                      <p className="text-sm text-slate-700">{message.message}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No messages to display.</p>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
      {portalTarget && avatarPreviewOpen && activeProfile.profileImageUrl && createPortal(
        <div className="fixed inset-0 z-[2100] bg-black/80 flex items-center justify-center px-4">
          <div className="absolute inset-0" onClick={() => setAvatarPreviewOpen(false)} />
          <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col gap-3 z-[2101]">
            <button
              aria-label="Close preview"
              className="absolute -top-10 right-0 text-white/90 hover:text-white"
              onClick={() => setAvatarPreviewOpen(false)}
            >
              <X className="h-6 w-6" />
            </button>
            <div className="relative w-full h-full max-h-[80vh] bg-black/30 rounded-md overflow-hidden flex items-center justify-center">
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
