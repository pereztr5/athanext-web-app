import { coachesAPI } from "@/api";
import {
    QuickInfo,
    FAQSection,
    CoachHeader,
    AboutSection,
    ReviewsSection,
    CertificationsSection,
    TrainingSpecialization,
} from "@/components/coach-profile";
import { CoachAvailabilitySection } from "@/components/coach-profile/CoachAvailabilitySection";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import { ProfileSkeleton } from "@/components/athlete-profile";
import { PROFILE_TYPE } from "@/utils/db";
import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { COACH_PROFILE_THEMES } from "@/config/colors";
import AthleteProfile from "./AthleteProfile";
import { useMySessions } from "@/hooks/useMySessions";
import { useReviews } from "@/hooks/useReviews";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfile } from '@/contexts/ProfileContext';
import { useAuth } from "@/contexts/AuthContext";
import { ReviewModal } from "@/components/reviews/ReviewModal";
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/integrations/supabase/client";
import { PackagesModal } from "@/components/coach/PackagesModal";
import { useCoachPackages } from "@/hooks/useCoachPackages";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useCoachDetails } from "@/hooks/useCoachDetails";
import { useQueryClient } from "@tanstack/react-query";
import { detectCoachSport } from "@/utils/coachSport";
import { Plus, X } from "lucide-react";
import { CoachingPackages } from "@/components/coach-profile/CoachingPackages";
import { CoachProfileView } from "@/components/coach-profile/CoachProfileView";
import { useSportPillars } from "@/hooks/useSportPillars";
import { ROUTES } from "@/routes";

const Profile = () => {
    const { toast } = useToast();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const { user, loading: authLoading, setUserImg, setUserName, refreshUserProfile } = useAuth();

    const { profile, loading: profileLoading, error, saveAthleteProfile, refetchProfile } = useProfile();
    const { updateProfile } = useUserProfile();
    const coachId = profile?.userProfile?.coach_id;

    // Fetch athlete sessions for athlete profiles
    const { grouped: athleteSessionGrouped, isLoading: athleteSessionsLoading, error: athleteSessionsError } = useMySessions('athlete');

    // Refetch trigger for data updates
    const queryClient = useQueryClient();

    // Call all hooks unconditionally
    const { coach, loading } = useCoachDetails(coachId || '');

    // Refetch coach data when availability changes
    const refetchCoachData = () => {
        if (coachId) {
            queryClient.invalidateQueries({ queryKey: ["coach-details", coachId] });
        }
    };

    const { data: packages = [] } = useCoachPackages(coachId || '');
    const { averageRating, reviews, ratingDistribution, totalReviews, submitReview } = useReviews(coachId || '');

    const [showReviewModal, setShowReviewModal] = useState(false);
    const [showPackagesModal, setShowPackagesModal] = useState(false);

    // Edit mode state
    const [isSaving, setIsSaving] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editedCoach, setEditedCoach] = useState<any>(null);
    const [coverImagesToUpload, setCoverImagesToUpload] = useState<File[]>([]);
    const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
    const [coverImageUrlsToRemove, setCoverImageUrlsToRemove] = useState<string[]>([]);
    const [certDialogOpen, setCertDialogOpen] = useState(false);
    const [savingCerts, setSavingCerts] = useState(false);
    const [certificationsDraft, setCertificationsDraft] = useState<
        { id?: string; certification_name: string; issuing_organization?: string | null }[]
    >([]);
    const normalizedCoachSport = useMemo(() => detectCoachSport(coach as any), [coach]);
    const { sportPillars: coachPillarOptions } = useSportPillars({
        sport: normalizedCoachSport,
    });

    // Check URL params for edit mode
    useEffect(() => {
        if (searchParams.get('mode') === 'edit') {
            setIsEditMode(true);
        }
    }, [searchParams]);

    // Initialize edited coach data when coach data loads or edit mode changes
    useEffect(() => {
        if (coach && isEditMode) {
            setEditedCoach({ ...coach });
        }
    }, [coach, isEditMode]);

    useEffect(() => {
        if (coach?.certifications) {
            setCertificationsDraft(
                coach.certifications.map((cert) => ({
                    id: cert.id,
                    certification_name: cert.certification_name || "",
                    issuing_organization: cert.issuing_organization || "",
                }))
            );
        } else {
            setCertificationsDraft([]);
        }
    }, [coach?.certifications]);

    // Show loading state while determining profile type
    if (authLoading || profileLoading || loading) {
        return <ProfileSkeleton />;
    }

    // Early returns AFTER all hooks have been called and loading is complete
    if (profile?.type === PROFILE_TYPE.athlete) {
        return <AthleteProfile profile={profile} loading={false} error={error} saveAthleteProfile={saveAthleteProfile} refetchProfile={refetchProfile} user={user} authLoading={false} upcomingSessions={athleteSessionGrouped?.upcoming || []} sessionsLoading={athleteSessionsLoading} sessionsError={athleteSessionsError} />;
    }

    // Sport detection for dynamic theming
    const getSportTheme = () => {
        if (normalizedCoachSport === "soccer") {
            return COACH_PROFILE_THEMES.soccer;
        }

        if (normalizedCoachSport === "rowing") {
            return COACH_PROFILE_THEMES.rowing;
        }

        // Default theme - Blue
        return COACH_PROFILE_THEMES.default;
    };

    const sportTheme = getSportTheme();

    const handleEdit = () => {
        if (coach) {
            setEditedCoach({ ...coach });
        }
        setIsEditMode(true);
        setSearchParams({ mode: 'edit' });
    };

    const handleCancelEdit = () => {
        setIsEditMode(false);
        setSearchParams({});
        setEditedCoach(null);
    };

    const handleSaveEdit = async () => {
        if (!coach || !editedCoach) return;

        if (editedCoach.name.trim().length < 3) {
            toast({
                title: 'Invalid name',
                description: 'Coach name must be at least 3 characters long.',
                variant: 'destructive',
                duration: 2000,
            });
            return;
        }

        if (!editedCoach.specialties || editedCoach.specialties.length === 0) {
            toast({
                title: 'Development pillars required',
                description: 'Please select at least one development pillar.',
                variant: 'destructive',
                duration: 2000,
            });
            return;
        }

        try {
            setIsSaving(true);

            // Ensure user is authenticated before storage/db writes
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!authUser) {
                toast({
                    title: 'Not logged in',
                    description: 'Please sign in again to save changes.',
                    variant: 'destructive',
                });
                setIsSaving(false);
                return;
            }

            // If there's a selected profile image, upload it first
            let uploadedImageUrl: string | null = null;
            if (selectedImageFile) {
                // Enforce 8MB bucket limit
                if (selectedImageFile.size > 8 * 1024 * 1024) {
                    toast({
                        title: 'Image too large',
                        description: 'Please select a profile image under 8MB.',
                        variant: 'destructive',
                    });
                    setIsSaving(false);
                    return;
                }

                const fileExt = selectedImageFile.name.split('.').pop();
                const fileName = `${coach.id}-${Date.now()}.${fileExt}`;
                const filePath = `coach-profiles/${fileName}`;

                const { error: uploadError } = await supabase
                    .storage
                    .from('athalink-images')
                    .upload(filePath, selectedImageFile, {
                        cacheControl: '3600',
                        upsert: true,
                    });

                if (uploadError) {
                    throw new Error(uploadError.message);
                }

                const { data: publicUrlData } = supabase
                    .storage
                    .from('athalink-images')
                    .getPublicUrl(filePath);

                // Add cache-busting parameter to force browser reload of new image
                uploadedImageUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;
            }

            // Upload new cover images
            const uploadedCoverUrls: string[] = [];
            for (const file of coverImagesToUpload) {
                if (file.size > 10 * 1024 * 1024) {
                    toast({
                        title: 'File too large',
                        description: `${file.name} is over 10MB. Skipping.`,
                        variant: 'destructive',
                    });
                    continue;
                }

                const fileExt = file.name.split('.').pop();
                const fileName = `${coach.id}-cover-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
                const filePath = `coach-profiles/covers/${fileName}`;

                const { error: uploadError } = await supabase
                    .storage
                    .from('athalink-images')
                    .upload(filePath, file, {
                        cacheControl: '3600',
                        upsert: false,
                    });

                if (uploadError) {
                    console.error('Failed to upload cover image:', uploadError);
                    continue;
                }

                const { data: publicUrlData } = supabase
                    .storage
                    .from('athalink-images')
                    .getPublicUrl(filePath);

                uploadedCoverUrls.push(publicUrlData.publicUrl);
            }

            // Merge with existing cover images (removing the ones marked for deletion)
            const existingUrls = coach.cover_image_urls || [];
            const filteredUrls = existingUrls.filter((url) =>
                !coverImageUrlsToRemove.includes(url)
            );
            const newCoverUrls = [...filteredUrls, ...uploadedCoverUrls];

            // Determine if cover_image_urls should be updated
            const shouldUpdateCoverUrls = coverImageUrlsToRemove.length > 0 || uploadedCoverUrls.length > 0;

            // Update coach profile
            // Note: Database column is 'position', not 'coach_position' (which is an alias in get_coaches_public)
            const response = await coachesAPI.updateCoach(coach.id, {
                name: editedCoach.name,
                position: editedCoach.coach_position,
                company: editedCoach.company,
                bio: editedCoach.bio,
                specialties: editedCoach.specialties,
                positions: editedCoach.favourite_positions ?? coach.favourite_positions,
                favourite_positions: editedCoach.favourite_positions ?? coach.favourite_positions,
                locations: editedCoach.locations,
                instagram_handle: editedCoach.instagram_handle,
                hourly_rate: editedCoach.hourly_rate,
                years_experience: editedCoach.years_experience,
                ...(uploadedImageUrl ? { image_url: uploadedImageUrl } : {}),
                ...(shouldUpdateCoverUrls ? { cover_image_urls: newCoverUrls } : {}),
            });

            if (response.error) {
                throw new Error(response.error.message);
            }

            // Update user_profiles with user-specific fields
            if (user?.id) {
                const userProfileUpdates: Record<string, any> = {};

                if (uploadedImageUrl) {
                    userProfileUpdates.image_url = uploadedImageUrl;
                }

                if (editedCoach.name !== coach.name) {
                    userProfileUpdates.name = editedCoach.name;
                }

                if (editedCoach.gender !== coach.gender) {
                    userProfileUpdates.gender = editedCoach.gender;
                }

                if (editedCoach.zip_code !== coach.zip_code) {
                    userProfileUpdates.zip_code = editedCoach.zip_code;
                }

                if (Object.keys(userProfileUpdates).length > 0) {
                    await updateProfile(userProfileUpdates);
                }

                // Update auth context AFTER database update completes
                if (uploadedImageUrl) {
                    setUserImg(uploadedImageUrl);
                }

                if (editedCoach.name !== coach.name) {
                    setUserName(editedCoach.name);
                }
            }

            toast({
                title: "Profile updated",
                description: "Your coach profile is saved.",
            });

            setIsEditMode(false);
            setSearchParams({});
            setCoverImagesToUpload([]);
            setCoverImageUrlsToRemove([]);

            // Invalidate coach details and refresh profile data
            queryClient.invalidateQueries({ queryKey: ["coach-details"] });

            // Refresh user profile from database to ensure header gets updated with new image
            await refreshUserProfile();

            // Refresh coach data without page reload - this updates the profile page with new image
            refetchCoachData();
        } catch (error) {
            console.error('Error updating profile:', error);
            toast({
                title: 'Update failed',
                description: error instanceof Error ? error.message : 'Failed to update profile. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleFieldChange = (field: string, value: any) => {
        setEditedCoach((prev: any) => {
            if (!prev) {
                // If editedCoach is null, initialize it with coach data
                return {
                    ...coach,
                    [field]: value
                };
            }
            return {
                ...prev,
                [field]: value
            };
        });
    };

    const handleImageSelect = (file: File) => {
        setSelectedImageFile(file);
    };

    const handleCoverImagesSelect = (files: File[]) => {
        setCoverImagesToUpload(prev => [...prev, ...files]);
    };

    const handleCoverImageRemove = (urlOrIndex: string | number) => {
        // If it's a number (index), get the URL from coverPreviews in CoachHeader
        // But we need to pass the actual URL to track removal properly
        if (typeof urlOrIndex === 'string') {
            setCoverImageUrlsToRemove(prev => [...prev, urlOrIndex]);
        } else {
            // Fallback for index-based (convert to URL)
            const existingUrls = coach.cover_image_urls || [];
            if (existingUrls[urlOrIndex]) {
                setCoverImageUrlsToRemove(prev => [...prev, existingUrls[urlOrIndex]]);
            }
        }
    };

    const handleAddCertificationRow = () => {
        setCertificationsDraft((prev) => [
            ...prev,
            { id: crypto.randomUUID(), certification_name: "", issuing_organization: "" },
        ]);
    };

    const handleUpdateCertification = (
        index: number,
        key: "certification_name" | "issuing_organization",
        value: string
    ) => {
        setCertificationsDraft((prev) =>
            prev.map((item, idx) => (idx === index ? { ...item, [key]: value } : item))
        );
    };

    const handleRemoveCertification = (index: number) => {
        setCertificationsDraft((prev) => prev.filter((_, idx) => idx !== index));
    };

    const handleSaveCertifications = async () => {
        if (!coach?.id) return;

        const sanitized = certificationsDraft
            .map((cert) => ({
                id: cert.id || crypto.randomUUID(),
                certification_name: cert.certification_name.trim(),
                issuing_organization: cert.issuing_organization?.trim() || null,
            }))
            .filter((cert) => cert.certification_name.length > 0);

        setSavingCerts(true);
        try {
            if (sanitized.length > 0) {
                const upsertPayload = sanitized.map((cert) => ({
                    ...cert,
                    coach_id: coach.id,
                }));

                const { error: upsertError } = await supabase
                    .from("coach_certifications")
                    .upsert(upsertPayload, { onConflict: "id" });
                if (upsertError) throw upsertError;
            }

            const existingIds = (coach.certifications || []).map((c: any) => c.id);
            const keepIds = sanitized
                .map((cert) => cert.id)
                .filter((id): id is string => Boolean(id));
            const toDelete = existingIds.filter((id: string) => !keepIds.includes(id));

            if (toDelete.length > 0) {
                const { error: deleteError } = await supabase
                    .from("coach_certifications")
                    .delete()
                    .in("id", toDelete);
                if (deleteError) throw deleteError;
            }

            refetchCoachData();
            toast({
                title: "Certifications updated",
                description: "Your certifications have been saved.",
            });
            setCertDialogOpen(false);
        } catch (err) {
            console.error("Failed to save certifications", err);
            toast({
                title: "Save failed",
                description: "We couldn't update your certifications. Please try again.",
                variant: "destructive",
            });
        } finally {
            setSavingCerts(false);
        }
    };

    const handleSendMessage = () => {
        toast({
            title: "Messaging",
            description: "Messaging is coming soon.",
        });
    };

    if (!coach && (profileLoading || !profile?.type)) {
        return <ProfileSkeleton />;
    }

    if (!profileLoading && profile?.type === PROFILE_TYPE.coach) {
        if (!coach) {
            return (
                <div className="flex min-h-[50vh] items-center justify-center px-4">
                    <div className="flex max-w-[420px] flex-col items-center gap-3 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-[25px] py-[30px] text-center">
                        <h1 className="text-[24px] font-semibold leading-[30px] tracking-[-0.05em] text-[#1A202C]">No coach profile yet</h1>
                        <p className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">Create your coach profile to get started.</p>
                        <Button onClick={() => navigate("/become-a-coach")}>
                            Become a coach
                        </Button>
                    </div>
                </div>
            );
        }
    }

    if (!(coach && Object.entries(coach).length)) {
        return null;
    }

    const modals = (
        <>
            <ReviewModal
                open={showReviewModal}
                onOpenChange={setShowReviewModal}
                coachName={coach.name}
                onSubmit={submitReview}
            />

            <PackagesModal
                isOpen={showPackagesModal}
                onClose={() => setShowPackagesModal(false)}
                packages={packages}
                coachName={coach.name}
            />

            <Dialog open={certDialogOpen} onOpenChange={setCertDialogOpen}>
                <DialogContent className="max-h-[90vh] max-w-2xl gap-0 overflow-hidden p-0 font-sans tracking-[-0.03em] text-[#1A202C] [&>button]:right-[17px] [&>button]:top-[19px]">
                    <DialogHeader className="space-y-1.5 px-[25px] py-5 pr-14 text-left">
                        <DialogTitle className="text-[24px] font-semibold leading-[30px] tracking-[-0.05em] text-[#1A202C]">
                            Edit certifications
                        </DialogTitle>
                        <DialogDescription className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">
                            Update the certifications that appear on your profile.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="h-px bg-[#EAEADF]" />

                    <div className="flex max-h-[60vh] flex-col gap-[10px] overflow-y-auto px-[25px] py-5">
                        {certificationsDraft.length === 0 && (
                            <div className="rounded-[8px] bg-[#F4F4EB] p-[15px] text-[14px] leading-[18px] text-[#767980]">
                                Add your first certification to show your credentials.
                            </div>
                        )}

                        {certificationsDraft.map((cert, index) => (
                            <div
                                key={cert.id ?? `new-${index}`}
                                className="flex flex-col gap-3 rounded-[10px] border border-[#EAEADF] bg-[#F4F4EB] p-[15px]"
                            >
                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="flex flex-col gap-1.5">
                                        <Label
                                            htmlFor={`cert-name-${index}`}
                                            className="text-[12px] font-medium leading-[13px] text-[#767980]"
                                        >
                                            Certification name
                                        </Label>
                                        <Input
                                            id={`cert-name-${index}`}
                                            value={cert.certification_name}
                                            onChange={(event) =>
                                                handleUpdateCertification(index, "certification_name", event.target.value)
                                            }
                                            placeholder="e.g. UEFA B License"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <Label
                                            htmlFor={`cert-org-${index}`}
                                            className="text-[12px] font-medium leading-[13px] text-[#767980]"
                                        >
                                            Issuing organization
                                        </Label>
                                        <Input
                                            id={`cert-org-${index}`}
                                            value={cert.issuing_organization || ""}
                                            onChange={(event) =>
                                                handleUpdateCertification(index, "issuing_organization", event.target.value)
                                            }
                                            placeholder="e.g. U.S. Soccer"
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRemoveCertification(index)}
                                        className="text-destructive hover:text-destructive"
                                    >
                                        <X strokeWidth={1.5} aria-hidden="true" />
                                        Remove
                                    </Button>
                                </div>
                            </div>
                        ))}

                        <Button type="button" variant="outline" className="w-fit" onClick={handleAddCertificationRow}>
                            <Plus strokeWidth={1.5} aria-hidden="true" />
                            Add certification
                        </Button>
                    </div>

                    <div className="h-px bg-[#EAEADF]" />

                    <DialogFooter className="flex-col-reverse gap-[10px] px-[25px] py-5 sm:flex-row sm:space-x-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setCertDialogOpen(false)}
                            disabled={savingCerts}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleSaveCertifications} disabled={savingCerts}>
                            {savingCerts ? "Saving..." : "Save changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );

    // Figma WIP view (default). Edit mode keeps the existing rich editor chrome.
    if (!isEditMode) {
        return (
            <>
                <ErrorBoundary>
                    <CoachProfileView
                        coach={coach}
                        packages={packages}
                        averageRating={averageRating}
                        totalReviews={totalReviews}
                        ratingDistribution={ratingDistribution}
                        reviews={reviews}
                        onEdit={handleEdit}
                        onEditPackages={() => setShowPackagesModal(true)}
                        onEditCertifications={() => setCertDialogOpen(true)}
                        onLeaveReview={() => setShowReviewModal(true)}
                    />
                </ErrorBoundary>
                {modals}
            </>
        );
    }

    return (
        <div className="overflow-x-hidden px-4 pb-16 md:px-10">
            <div className="mx-auto flex w-full max-w-[1000px] min-w-0 flex-col gap-6">
                <section className="flex w-full min-w-0 flex-col">
                    <CoachHeader
                        isCoachProfile
                        isEditMode={isEditMode}
                        sportTheme={sportTheme}
                        onSendMessage={handleSendMessage}
                        onFieldChange={handleFieldChange}
                        onImageSelect={handleImageSelect}
                        sport={normalizedCoachSport ?? (profile?.userProfile?.sport || "")}
                        onCoverImageRemove={handleCoverImageRemove}
                        onCoverImagesSelect={handleCoverImagesSelect}
                        onViewPackages={() => setShowPackagesModal(true)}
                        coach={coach}
                        coachPillarOptions={coachPillarOptions}
                        editedCoach={isEditMode ? editedCoach : undefined}
                        onBook={() => {
                            toast({
                                title: "This is your profile",
                                description: "Share your profile link with athletes so they can book you.",
                            });
                        }}
                        onEdit={handleEdit}
                        onCancelEdit={handleCancelEdit}
                        onSaveEdit={handleSaveEdit}
                        isSaving={isSaving}
                    />
                </section>

                <ErrorBoundary>
                    <div className="flex min-w-0 flex-col gap-[10px]">
                        <div className="flex justify-end">
                            <Button variant="outline" size="sm" asChild>
                                <Link to={ROUTES.AVAILABILITY}>Manage availability</Link>
                            </Button>
                        </div>
                        <div className="min-w-0 overflow-x-auto">
                            <CoachAvailabilitySection coachId={coach.id} allowEditing={false} />
                        </div>
                    </div>
                </ErrorBoundary>

                <div className="grid w-full min-w-0 grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_317px]">
                    <div className="flex min-w-0 flex-col gap-6">
                        <ErrorBoundary>
                            <CoachingPackages
                                packages={packages}
                                coachId={coach.id}
                                coachName={coach.name}
                                coachSport={coach.sport}
                                showSharePricing
                            />
                        </ErrorBoundary>

                        <AboutSection
                            coachName={coach.name}
                            bio={editedCoach ? editedCoach.bio : coach.bio}
                            isEditMode
                            onBioChange={(bio) => handleFieldChange('bio', bio)}
                        />

                        <CertificationsSection
                            certifications={coach.certifications}
                            actions={
                                <Button size="sm" variant="outline" onClick={() => setCertDialogOpen(true)}>
                                    Edit
                                </Button>
                            }
                        />

                        <TrainingSpecialization
                            specializations={coach.specialties}
                            sessionTypes={coach.session_types}
                            locations={coach.locations}
                        />

                        <ReviewsSection
                            averageRating={averageRating}
                            totalReviews={totalReviews}
                            distribution={ratingDistribution}
                            reviews={reviews}
                            iconColor={sportTheme.iconColor}
                            onLeaveReview={() => setShowReviewModal(true)}
                        />
                    </div>

                    <div className="flex min-w-0 flex-col gap-6">
                        <QuickInfo
                            responseTime={coach.response_time_hours}
                            sessionTypes={coach.session_types}
                            languages={coach.languages}
                            locations={coach.locations}
                            zipCode={coach.zip_code}
                            cancellationPolicy={coach.cancellation_policy}
                        />

                        <FAQSection />
                    </div>
                </div>
            </div>
            {modals}
        </div>
    );
};

export default Profile;
