import { coachesAPI } from "@/api";
import { coachLocationAPI } from "@/api/coachLocation";
import { normalizeCoachFaqs } from "@/components/coach-profile/FAQSection";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import { ProfileSkeleton } from "@/components/athlete-profile";
import { PROFILE_TYPE } from "@/utils/db";
import { useState, useEffect, useMemo, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
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
import type { CoachPackage } from "@/hooks/useCoachPackages";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCoachDetails } from "@/hooks/useCoachDetails";
import { useQueryClient } from "@tanstack/react-query";
import { detectCoachSport } from "@/utils/coachSport";
import { Plus, X } from "@/components/icons";
import { CoachOwnProfile } from "@/components/coach-profile/CoachOwnProfile";
import { PackageEditorDialog } from "@/components/coach-profile/PackageEditorDialog";
import { useSportPillars } from "@/hooks/useSportPillars";
import { sanitizePathwayTags } from "@/constants/pathwayTags";
import { ROUTES } from "@/routes";

const Profile = () => {
    const { toast } = useToast();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // Old camp deep links lived on /profile; send them to /camps.
    useEffect(() => {
        if (!searchParams.get("camp")) return;
        const next = new URLSearchParams();
        const camp = searchParams.get("camp");
        const view = searchParams.get("view");
        if (camp) next.set("camp", camp);
        if (view) next.set("view", view);
        navigate(`${ROUTES.CAMPS}?${next.toString()}`, { replace: true });
    }, [navigate, searchParams]);

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

    // Own profile: include inactive packages so the coach can still edit/reactivate them.
    const { data: packages = [] } = useCoachPackages(coachId || '', { includeInactive: true });
    const activePackages = useMemo(() => packages.filter((pkg) => pkg.is_active), [packages]);
    const { averageRating, reviews, ratingDistribution, totalReviews, submitReview } = useReviews(coachId || '');

    const [showReviewModal, setShowReviewModal] = useState(false);
    const [showPackagesModal, setShowPackagesModal] = useState(false);
    const [packageEditorOpen, setPackageEditorOpen] = useState(false);
    const [editingPackage, setEditingPackage] = useState<CoachPackage | null>(null);

    // Edit mode state
    const [isSaving, setIsSaving] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editedCoach, setEditedCoach] = useState<any>(null);
    const editedRef = useRef<any>(null);
    editedRef.current = editedCoach;
    const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
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
        const editedCoach = editedRef.current;
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

            // Update coach profile
            // Note: Database column is 'position', not 'coach_position' (which is an alias in get_coaches_public)
            const response = await coachesAPI.updateCoach(coach.id, {
                name: editedCoach.name,
                position: editedCoach.coach_position,
                company: editedCoach.company,
                bio: editedCoach.bio,
                specialties: editedCoach.specialties,
                pathway_tags: sanitizePathwayTags(editedCoach.pathway_tags),
                positions: editedCoach.favourite_positions ?? coach.favourite_positions,
                favourite_positions: editedCoach.favourite_positions ?? coach.favourite_positions,
                locations: editedCoach.locations,
                instagram_handle: editedCoach.instagram_handle,
                hourly_rate: editedCoach.hourly_rate,
                years_experience: editedCoach.years_experience,
                response_time_hours: editedCoach.response_time_hours ?? coach.response_time_hours,
                languages: editedCoach.languages ?? coach.languages,
                session_types: editedCoach.session_types ?? coach.session_types,
                cancellation_policy: editedCoach.cancellation_policy ?? coach.cancellation_policy,
                deals_enabled: editedCoach.deals_enabled ?? coach.deals_enabled,
                age_min: editedCoach.age_min !== undefined ? editedCoach.age_min : coach.age_min,
                age_max: editedCoach.age_max !== undefined ? editedCoach.age_max : coach.age_max,
                profile_faqs: normalizeCoachFaqs(
                  editedCoach.profile_faqs ?? coach.profile_faqs
                ) as unknown as import("@/integrations/supabase/types").Json,
                ...(uploadedImageUrl ? { image_url: uploadedImageUrl } : {}),
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

                // Store the ZIP's center for distance on View All Coaches. Best effort.
                void coachLocationAPI.saveMine(editedCoach.zip_code ?? coach.zip_code);

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
                description: error instanceof Error ? error.message : "That didn't save. Try again",
                variant: 'destructive',
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleFieldChange = (field: string, value: any) => {
        // The ref is updated here, outside the state updater, so Save right after a change
        // still reads the newest values.
        const next = {
            ...(editedRef.current ?? coach),
            [field]: value,
        };
        editedRef.current = next;
        setEditedCoach(next);
    };

    const handleImageSelect = (file: File) => {
        setSelectedImageFile(file);
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
                description: "Your certifications are saved.",
            });
            setCertDialogOpen(false);
        } catch (err) {
            console.error("Failed to save certifications", err);
            toast({
                title: "Save failed",
                description: "That didn't save. Try again",
                variant: "destructive",
            });
        } finally {
            setSavingCerts(false);
        }
    };

    if (!coach && (profileLoading || !profile?.type)) {
        return <ProfileSkeleton />;
    }

    if (!profileLoading && profile?.type === PROFILE_TYPE.coach) {
        if (!coach) {
            return (
                <div className="flex min-h-[50vh] items-center justify-center px-4">
                    <div className="flex max-w-[420px] flex-col items-center gap-3 rounded-card border border-light-525 bg-light-300 px-[25px] py-[30px] text-center">
                        <h1 className="text-section text-dark">No coach profile yet</h1>
                        <p className="text-body-m text-dark-300">Create your coach profile to get started.</p>
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
                packages={activePackages}
                coachName={coach.name}
            />

            {coachId ? (
                <PackageEditorDialog
                    open={packageEditorOpen}
                    onOpenChange={(open) => {
                        setPackageEditorOpen(open);
                        if (!open) setEditingPackage(null);
                    }}
                    coachId={coachId}
                    packageToEdit={editingPackage}
                />
            ) : null}

            <Dialog open={certDialogOpen} onOpenChange={setCertDialogOpen}>
                <DialogContent className="max-h-[90dvh] max-w-2xl gap-0 overflow-hidden p-0 font-sans tracking-[-0.03em] text-dark [&>button]:right-[17px] [&>button]:top-[19px]">
                    <DialogHeader className="space-y-1.5 px-[25px] py-5 pr-14 text-left">
                        <DialogTitle className="text-section text-dark">
                            Edit certifications
                        </DialogTitle>
                        <DialogDescription className="text-body-m text-dark-300">
                            Update the certifications that appear on your profile.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="h-px bg-light-525" />

                    <div className="flex max-h-[60dvh] flex-col gap-[10px] overflow-y-auto px-[25px] py-5">
                        {certificationsDraft.length === 0 && (
                            <div className="rounded-control bg-light-400 p-[15px] text-body-m text-dark-300">
                                Add your first certification to show your credentials.
                            </div>
                        )}

                        {certificationsDraft.map((cert, index) => (
                            <div
                                key={cert.id ?? `new-${index}`}
                                className="flex flex-col gap-3 rounded-card border border-light-525 bg-light-400 p-[15px]"
                            >
                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="flex flex-col gap-1.5">
                                        <Label
                                            htmlFor={`cert-name-${index}`}
                                            className="text-label-xsm text-dark-300"
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
                                            className="text-label-xsm text-dark-300"
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
                                        className="text-error-700 hover:text-error-700"
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

                    <div className="h-px bg-light-525" />

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
                            {savingCerts ? "Saving…" : "Save changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );

    return (
        <>
            <ErrorBoundary>
                <CoachOwnProfile
                    coach={coach}
                    packages={packages}
                    averageRating={averageRating}
                    totalReviews={totalReviews}
                    ratingDistribution={ratingDistribution}
                    reviews={reviews}
                    pillarOptions={coachPillarOptions}
                    editing={isEditMode}
                    draft={editedCoach}
                    saving={isSaving}
                    onStartEdit={handleEdit}
                    onCancelEdit={handleCancelEdit}
                    onDone={handleSaveEdit}
                    onField={handleFieldChange}
                    onPhotoSelect={handleImageSelect}
                    onEditPackage={(pkg) => {
                        setEditingPackage(pkg);
                        setPackageEditorOpen(true);
                    }}
                    onEditCertifications={() => setCertDialogOpen(true)}
                    onCoachUpdated={refetchCoachData}
                />
            </ErrorBoundary>
            {modals}
        </>
    );
};

export default Profile;
