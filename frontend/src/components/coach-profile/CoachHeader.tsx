import {
    EditableField,
    EditableFieldGroup,
} from "./editable";
import { Carousel } from "./Carousel";
import { Button } from "@/components/ui/button";
import { GenderPill } from "@/components/form/GenderPill";
import { MultiSelect } from "@/components/ui/multi-select";
import { GenderSelect } from "@/components/form/GenderSelect";
import { ProfileStrengthMeter } from "./ProfileStrengthMeter";
import { CoachProfileChip } from "./CoachProfileCard";
import { BrandPill, BrandStar } from "@/components/brand";
import { PathwayTagChips } from "@/components/common/PathwayTagChips";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatLocationDisplay, type LocationInfo } from "@/utils/geolocation";
import { BadgeCheck, MapPin, Instagram, Camera, Plus, Trash2, X, Loader2 } from "@/components/icons";
import type { CoachHeaderProps } from "@/types/coachProfile";
import { SPORTS_OPTIONS, normalizePosition } from "@/utils/db";
import { createPortal } from "react-dom";
import Cropper, { type Area } from "react-easy-crop";
import { Label } from "@/components/ui/label";
import { ZipCodeInput } from "@/components/form/ZipCodeInput";
import { COVER_BG_COLORS } from "@/config/colors";
import { createCroppedPreview, fileToDataUrl, getCroppedFile } from "@/utils/imageUtils";
import { detectCoachSport, normalizeCoachSport } from "@/utils/coachSport";
import { isPublicCoachRatingVisible, publicCoachRatingLabel } from "@/utils/publicRating";
import { getInitials } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { CommunityChannelButton } from "@/components/chat/CommunityChannelButton";

const MAX_COVER_IMAGES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_PROFILE_IMAGE_SIZE = 8 * 1024 * 1024; // 8MB

/* Small helper to manage object URLs */
function useObjectUrl() {
    const urlsRef = useRef<Set<string>>(new Set());
    const create = useCallback((file: File) => {
        const url = URL.createObjectURL(file);
        urlsRef.current.add(url);
        return url;
    }, []);
    const revoke = useCallback((url?: string) => {
        if (!url) return;
        if (urlsRef.current.has(url)) {
            try { URL.revokeObjectURL(url); } catch { /* ignore */ }
            urlsRef.current.delete(url);
        }
    }, []);
    useEffect(() => {
        return () => {
            urlsRef.current.forEach(u => {
                try { URL.revokeObjectURL(u); } catch { /* ignore */ }
            });
            urlsRef.current.clear();
        };
    }, []);
    return { create, revoke };
}

/* Shared brand-kit classes for the header, its edit form and image dialogs */
const fieldLabelClass = "text-label-sm text-dark";
const requiredMarkClass = "ml-1 text-error-700";
const modalSurfaceClass =
    "w-full rounded-card border border-light-525 bg-light-300 font-sans tracking-[-0.03em] text-dark shadow-overlay";
const modalTitleClass = "text-section text-dark";
const rangeClass = "h-[5px] w-full cursor-pointer accent-primary";

/* Avatar area:  uses a real <button> when interactive to satisfy ARIA/axe rules */
function AvatarArea({
    name,
    imageUrl,
    isEditMode,
    onClick,
    previewUrl,
    isLoading,
}: {
    name: string;
    imageUrl?: string | null;
    isEditMode?: boolean;
    onClick?: () => void;
    previewUrl?: string | null;
    isLoading?: boolean;
}) {
    const initials = useMemo(() => getInitials(name), [name]);
    const isInteractive = Boolean(onClick);

    const commonClasses =
        "relative flex size-28 items-center justify-center overflow-hidden rounded-full border border-light-550 bg-light-600 p-0";

    const editOverlay = isEditMode ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 bg-dark/50 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <Camera className="size-5 text-light" strokeWidth={1.5} aria-hidden="true" />
            <span className="text-label-xsm text-light">Change photo</span>
        </div>
    ) : null;

    const avatarContent = (
        <>
            {previewUrl || imageUrl ? (
                <img
                    loading="eager"
                    alt={`${name}'s avatar`}
                    src={previewUrl || imageUrl || undefined}
                    className="size-full object-cover"
                    // React 18 only passes the lowercase attribute through to the DOM.
                    {...({ fetchpriority: "high" } as Record<string, string>)}
                />
            ) : (
                <span className="text-card-title text-dark-400">{initials}</span>
            )}
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-light-300/70">
                    <Loader2 className="size-5 animate-spin text-dark-300" strokeWidth={1.5} aria-hidden="true" />
                </div>
            )}
            {editOverlay}
        </>
    );

    return (
        <div className="relative flex-shrink-0">
            {isInteractive ? (
                <button
                    type="button"
                    onClick={onClick}
                    aria-label={isEditMode ? `Change ${name}'s photo` : `View ${name}'s photo`}
                    className={`${commonClasses} group cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}
                >
                    {avatarContent}
                </button>
            ) : (
                <div className={commonClasses} aria-label={`${name} avatar`}>
                    {avatarContent}
                </div>
            )}
        </div>
    );
}

/* Cover carousel + manager */
function CoverCarouselManager({
    coachName,
    coverPreviews,
    isEditMode,
    coverImagesInputRef,
    onCoverImagesSelect,
    onCoverImageRemove,
    toast,
}: {
    coachName: string;
    coverPreviews: string[];
    isEditMode: boolean;
    coverImagesInputRef: React.RefObject<HTMLInputElement | null>;
    onCoverImagesSelect?: (files: File[]) => void;
    onCoverImageRemove?: (urlOrIndex: string | number) => void;
    toast: ReturnType<typeof useToast>["toast"];
}) {
    const handleCoverImagesClick = useCallback(() => {
        if (isEditMode && coverImagesInputRef.current) coverImagesInputRef.current.click();
    }, [isEditMode, coverImagesInputRef]);

    const handleCoverImagesChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        const validFiles: File[] = [];
        for (const file of files) {
            if (!file.type.startsWith("image/")) {
                toast({
                    title: "Invalid file type",
                    description: `${file.name} is not an image file.`,
                    variant: "destructive",
                });
                continue;
            }
            if (file.size > MAX_FILE_SIZE) {
                toast({
                    title: "Image too large",
                    description: `${file.name} is too large. Maximum size is 10MB.`,
                    variant: "destructive",
                });
                continue;
            }
            validFiles.push(file);
        }
        if (validFiles.length === 0) return;
        onCoverImagesSelect?.(validFiles);
        if (coverImagesInputRef.current) coverImagesInputRef.current.value = "";
    }, [onCoverImagesSelect, coverImagesInputRef]);

    return (
        <div className="flex flex-col gap-[10px]">
            <div className="relative">
                <Carousel
                    photos={coverPreviews}
                    altTextPrefix={coachName}
                    enablePreview={!isEditMode}
                    aspect="cover3x1"
                    containUntilLg
                />

                {isEditMode && (
                    <div className="absolute right-3 top-3 z-10 flex gap-2">
                        <input
                            ref={coverImagesInputRef}
                            type="file"
                            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                            multiple
                            onChange={handleCoverImagesChange}
                            className="hidden"
                            aria-label="Upload cover images"
                        />

                        <Button type="button" variant="outline" size="sm" onClick={handleCoverImagesClick}>
                            <Plus strokeWidth={1.5} aria-hidden="true" />
                            Add cover photos
                        </Button>
                    </div>
                )}
            </div>

            {isEditMode && coverPreviews.length > 0 && (
                <div className="flex gap-[10px] overflow-x-auto pb-1">
                    {coverPreviews.map((preview, index) => (
                        <div key={index} className="relative flex-shrink-0">
                            <img
                                src={preview}
                                alt={`Cover ${index + 1}`}
                                className="h-16 w-24 rounded-control border border-light-525 object-cover"
                            />

                            <button
                                type="button"
                                onClick={() => onCoverImageRemove?.(index)}
                                className="absolute right-1 top-1 inline-flex size-6 items-center justify-center rounded-control border border-light-525 bg-light-300 text-error-600 transition-colors hover:bg-light-525"
                                aria-label={`Remove cover image ${index + 1}`}
                            >
                                <Trash2 className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/* Action buttons for profile owner */
function ProfileActions({
    isCoachProfile,
    isEditMode,
    isSaving,
    disableSave = false,
    onEdit,
    onCancelEdit,
    onSaveEdit,
}: {
    isCoachProfile?: boolean;
    isEditMode?: boolean;
    isSaving?: boolean;
    disableSave?: boolean;
    onEdit?: () => void;
    onCancelEdit?: () => void;
    onSaveEdit?: () => void;
}) {
    if (!isCoachProfile) return null;

    return (
        <div className="flex items-center gap-[10px]">
            {isEditMode ? (
                <>
                    <Button onClick={onCancelEdit} variant="outline" disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button onClick={onSaveEdit} disabled={isSaving || disableSave}>
                        {isSaving ? (
                            <>
                                <Loader2 className="animate-spin" strokeWidth={1.5} aria-hidden="true" />
                                Saving…
                            </>
                        ) : (
                            "Save changes"
                        )}
                    </Button>
                </>
            ) : (
                <Button onClick={onEdit} variant="outline">
                    Edit profile
                </Button>
            )}
        </div>
    );
}

/* ============================================================================
   Main component
   ============================================================================
*/
export function CoachHeader({
    sport,
    coach,
    onBook,
    bookAction,
    sportTheme,
    onSendMessage,
    onFieldChange,
    onImageSelect,
    className = "",
    onViewPackages,
    isEditMode = false,
    coachPillarOptions,
    onCoverImageRemove,
    onCoverImagesSelect,
    isCoachProfile = false,
    showStrengthMeter = true,
    onEdit,
    onCancelEdit,
    onSaveEdit,
    isSaving = false,
    editedCoach,
    canSendMessage = true,
    isSendingMessage = false,
}: CoachHeaderProps) {
    const { toast } = useToast();
    const initialCoverUrls = coach.cover_image_urls && coach.cover_image_urls.length > 0
        ? coach.cover_image_urls
        : [];

    const [positionInput, setPositionInput] = useState<string>(coach.coach_position ?? coach.position ?? "");
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [avatarDisplayUrl, setAvatarDisplayUrl] = useState<string | null>(coach.image_url ?? null);
    const [isAvatarLoading, setIsAvatarLoading] = useState(false);
    const [coverPreviews, setCoverPreviews] = useState<string[]>(initialCoverUrls);
    const [zipCode, setZipCode] = useState<string>(coach.zip_code ?? "");
    const [locationInfo, setLocationInfo] = useState<LocationInfo | null>(null);
    const [isLocationValid, setIsLocationValid] = useState<boolean>(() => {
        const hasZip = Boolean((coach.zip_code ?? "").trim());
        const hasLocation = Boolean(coach.locations?.[0]);
        return !hasZip || hasLocation;
    });

    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const coverImagesInputRef = useRef<HTMLInputElement | null>(null);

    // Cropping state variables
    const [showProfileCropper, setShowProfileCropper] = useState(false);
    const [cropProfileFile, setCropProfileFile] = useState<File | null>(null);
    const [showCoverCropper, setShowCoverCropper] = useState(false);
    const [cropCoverFile, setCropCoverFile] = useState<File | null>(null);
    const [pendingCoverFiles, setPendingCoverFiles] = useState<File[]>([]);
    const [currentCoverFile, setCurrentCoverFile] = useState<File | null>(null);
    const [profileZoom, setProfileZoom] = useState(1);
    const [profileCroppedArea, setProfileCroppedArea] = useState<Area | null>(null);
    const [profileCropPosition, setProfileCropPosition] = useState({ x: 0, y: 0 });
    const [profileCropSize, setProfileCropSize] = useState<{ width: number; height: number } | null>(null);
    const [profileMinZoom, setProfileMinZoom] = useState(1);
    const profileCropContainerRef = useRef<HTMLDivElement | null>(null);
    const profileMediaSizeRef = useRef<{ width: number; height: number } | null>(null);
    const profileZoomInitializedRef = useRef(false);
    const [coverZoom, setCoverZoom] = useState(1);
    const [coverMinZoom, setCoverMinZoom] = useState(1);
    const [coverCroppedArea, setCoverCroppedArea] = useState<Area | null>(null);
    const [coverCropPosition, setCoverCropPosition] = useState({ x: 0, y: 0 });
    const [coverCropSize, setCoverCropSize] = useState<{ width: number; height: number } | null>(null);
    const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
    const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);
    const [coverBgColor, setCoverBgColor] = useState("#f1f5f9");
    const coverCropperRef = useRef<HTMLDivElement | null>(null);
    const coverMediaSizeRef = useRef<{ width: number; height: number } | null>(null);
    const coverZoomInitializedRef = useRef(false);
    const portalTarget = typeof document !== "undefined" ? document.body : null;
    const scrollLockRef = useRef<{ bodyOverflow: string; htmlOverflow: string } | null>(null);
    const handleAvatarClick = useCallback(() => {
        if (isEditMode) {
            if (fileInputRef.current) fileInputRef.current.click();
            return;
        }
        if (avatarDisplayUrl) {
            setAvatarPreviewOpen(true);
        }
    }, [avatarDisplayUrl, isEditMode]);

    const { create: createObjectUrl, revoke: revokeObjectUrl } = useObjectUrl();

    // Cropper object URLs
    const profileObjectUrl = useMemo(
        () => (cropProfileFile ? URL.createObjectURL(cropProfileFile) : null),
        [cropProfileFile]
    );
    const coverObjectUrl = useMemo(
        () => (cropCoverFile ? URL.createObjectURL(cropCoverFile) : null),
        [cropCoverFile]
    );

    useEffect(() => {
        if (!profileObjectUrl) return;
        return () => URL.revokeObjectURL(profileObjectUrl);
    }, [profileObjectUrl]);

    useEffect(() => {
        if (!coverObjectUrl) return;
        return () => URL.revokeObjectURL(coverObjectUrl);
    }, [coverObjectUrl]);

    useEffect(() => {
        if (!portalTarget) return;
        const shouldLock = showProfileCropper || showCoverCropper;
        if (shouldLock) {
            if (!scrollLockRef.current) {
                scrollLockRef.current = {
                    bodyOverflow: document.body.style.overflow,
                    htmlOverflow: document.documentElement.style.overflow,
                };
            }
            document.body.style.overflow = "hidden";
            document.documentElement.style.overflow = "hidden";
            return;
        }
        if (scrollLockRef.current) {
            document.body.style.overflow = scrollLockRef.current.bodyOverflow;
            document.documentElement.style.overflow = scrollLockRef.current.htmlOverflow;
            scrollLockRef.current = null;
        }
    }, [portalTarget, showProfileCropper, showCoverCropper]);

    useEffect(() => {
        return () => {
            if (scrollLockRef.current) {
                document.body.style.overflow = scrollLockRef.current.bodyOverflow;
                document.documentElement.style.overflow = scrollLockRef.current.htmlOverflow;
                scrollLockRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (showCoverCropper && cropCoverFile) {
            setCoverCropPosition({ x: 0, y: 0 });
            setCoverZoom(1);
            setCoverCroppedArea(null);
            setCoverPreviewUrl(null);
            setCoverBgColor("#f1f5f9");
            coverZoomInitializedRef.current = false;
        }
    }, [showCoverCropper, cropCoverFile]);

    useEffect(() => {
        if (showProfileCropper && cropProfileFile) {
            setProfileCropPosition({ x: 0, y: 0 });
            setProfileZoom(1);
            setProfileCroppedArea(null);
            profileZoomInitializedRef.current = false;
        }
    }, [showProfileCropper, cropProfileFile]);

    useEffect(() => {
        if (!showCoverCropper) return;
        const container = coverCropperRef.current;
        if (!container) return;
        const updateSize = () => {
            const { width, height } = container.getBoundingClientRect();
            if (!width || !height) return;
            let cropWidth = width;
            let cropHeight = width / 3;
            if (cropHeight > height) {
                cropHeight = height;
                cropWidth = height * 3;
            }
            setCoverCropSize({ width: Math.floor(cropWidth), height: Math.floor(cropHeight) });
        };
        updateSize();
        const observer = new ResizeObserver(updateSize);
        observer.observe(container);
        return () => observer.disconnect();
    }, [showCoverCropper]);

    useEffect(() => {
        if (!showProfileCropper) return;
        const container = profileCropContainerRef.current;
        if (!container) return;
        const updateSize = () => {
            const { width, height } = container.getBoundingClientRect();
            if (!width || !height) return;
            const size = Math.min(width, height);
            setProfileCropSize({ width: Math.floor(size), height: Math.floor(size) });
        };
        updateSize();
        const observer = new ResizeObserver(updateSize);
        observer.observe(container);
        return () => observer.disconnect();
    }, [showProfileCropper]);

    useEffect(() => {
        if (!coverCropSize || !coverMediaSizeRef.current) return;
        const mediaSize = coverMediaSizeRef.current;
        const minZoom = Math.min(
            coverCropSize.width / mediaSize.width,
            coverCropSize.height / mediaSize.height
        );
        setCoverMinZoom(minZoom);
        if (!coverZoomInitializedRef.current) {
            setCoverZoom(minZoom);
            coverZoomInitializedRef.current = true;
        }
    }, [coverCropSize]);

    useEffect(() => {
        if (!profileCropSize || !profileMediaSizeRef.current) return;
        const mediaSize = profileMediaSizeRef.current;
        const minZoom = Math.min(
            profileCropSize.width / mediaSize.width,
            profileCropSize.height / mediaSize.height
        );
        setProfileMinZoom(minZoom);
        if (!profileZoomInitializedRef.current) {
            setProfileZoom(minZoom);
            profileZoomInitializedRef.current = true;
        }
    }, [profileCropSize]);

    useEffect(() => {
        let isActive = true;
        if (!coverObjectUrl || !coverCroppedArea) return;
        createCroppedPreview(coverObjectUrl, coverCroppedArea, coverBgColor)
            .then((preview) => {
                if (isActive) {
                    setCoverPreviewUrl(preview);
                }
            })
            .catch(() => {});
        return () => {
            isActive = false;
        };
    }, [coverObjectUrl, coverCroppedArea, coverBgColor]);

    useEffect(() => {
        setPositionInput(coach.coach_position ?? coach.position ?? "");
    }, [coach.coach_position, coach.position]);

    useEffect(() => {
        if (coach.cover_image_urls && coach.cover_image_urls.length > 0) {
            setCoverPreviews(coach.cover_image_urls);
        } else {
            setCoverPreviews([]);
        }
    }, [coach.cover_image_urls]);

    useEffect(() => {
        const nextSrc = previewUrl || coach.image_url || null;
        // If there's no candidate source, don't clear the currently-displayed
        // avatar immediately — keep the existing image until a new one loads.
        if (!nextSrc) {
            setIsAvatarLoading(false);
            return;
        }
        if (nextSrc === avatarDisplayUrl) {
            setIsAvatarLoading(false);
            return;
        }
        setIsAvatarLoading(true);
        const img = new Image();
        img.onload = () => {
            setAvatarDisplayUrl(nextSrc);
            setIsAvatarLoading(false);
        };
        img.onerror = () => {
            setIsAvatarLoading(false);
        };
        img.src = nextSrc;
    }, [previewUrl, coach.image_url, avatarDisplayUrl]);

    useEffect(() => {
        if (isEditMode) return;
        const nextZip = coach.zip_code ?? "";
        setZipCode(nextZip);
        setLocationInfo(null);
        const hasZip = Boolean(nextZip.trim());
        const hasLocation = Boolean(coach.locations?.[0]);
        setIsLocationValid(!hasZip || hasLocation);
    }, [coach.zip_code, coach.locations, isEditMode]);

    useEffect(() => {
        return () => {
            if (previewUrl && previewUrl.startsWith("blob:")) revokeObjectUrl(previewUrl);
        };
    }, [previewUrl, revokeObjectUrl]);

    const displayedPosition = coach.coach_position ?? coach.position ?? coach.specialties?.[0] ?? "Coach";
    const resolvedSport = useMemo(
        () => detectCoachSport(coach as any, sport),
        [coach, sport]
    );
    const isRowingSport = resolvedSport === "rowing";
    const rawFavoritePositions =
        (editedCoach as any)?.favourite_positions ??
        (editedCoach as any)?.favorite_positions ??
        (coach as any)?.favourite_positions ??
        (coach as any)?.favorite_positions ??
        [];
    const favoritePositions = Array.isArray(rawFavoritePositions)
        ? rawFavoritePositions.filter((position): position is string => Boolean(position && position.trim()))
        : typeof rawFavoritePositions === "string"
            ? rawFavoritePositions.split(",").map((position) => position.trim()).filter(Boolean)
            : [];

    const favoritePositionOptions = useMemo(() => {
        const sportOption = SPORTS_OPTIONS.find(
            (option) => normalizeCoachSport(option.value) === resolvedSport
        );
        return (sportOption?.positions ?? []).map((position) => ({
            id: position.value,
            title: position.label,
        }));
    }, [resolvedSport]);

    const favoritePositionLabelMap = useMemo(() => {
        const map = new Map<string, string>();
        favoritePositionOptions.forEach((option) => map.set(option.id, option.title));
        return map;
    }, [favoritePositionOptions]);

    const commitPosition = useCallback(() => {
        const trimmed = positionInput.trim();
        onFieldChange?.("coach_position", trimmed);
        setPositionInput(trimmed);
    }, [positionInput, onFieldChange]);

    const handlePositionKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            commitPosition();
            (e.target as HTMLInputElement).blur();
        }
    }, [commitPosition]);

    const handleLocalImageSelect = useCallback((file: File) => {
        if (previewUrl && previewUrl.startsWith("blob:")) revokeObjectUrl(previewUrl);
        const url = createObjectUrl(file);
        setPreviewUrl(url);
        onImageSelect?.(file);
    }, [onImageSelect, previewUrl, createObjectUrl, revokeObjectUrl]);

    const handleCoverFilesSelected = useCallback((files: File[]) => {
        const currentCount = coverPreviews.length;
        if (currentCount + files.length > MAX_COVER_IMAGES) {
            alert(`You can upload a maximum of ${MAX_COVER_IMAGES} cover images`);
            return;
        }
        const newPreviews = files.map(f => createObjectUrl(f));
        setCoverPreviews(prev => [...prev, ...newPreviews]);
        onCoverImagesSelect?.(files);
    }, [coverPreviews.length, createObjectUrl, onCoverImagesSelect]);

    const handleRemoveCoverImage = useCallback((index: number) => {
        const urlToRemove = coverPreviews[index];
        if (urlToRemove && urlToRemove.startsWith("blob:")) revokeObjectUrl(urlToRemove);
        setCoverPreviews(prev => prev.filter((_, i) => i !== index));
        // Pass the actual URL to parent for proper tracking
        onCoverImageRemove?.(urlToRemove);
    }, [coverPreviews, revokeObjectUrl, onCoverImageRemove]);

    // Memoize location display to prevent unnecessary re-renders
    const locationDisplay = useMemo(() => {
        if (locationInfo) {
            return formatLocationDisplay(locationInfo);
        }
        return coach.locations?.[0] || null;
    }, [locationInfo, coach.locations]);

    const handleProfileCropComplete = useCallback((_: any, croppedAreaPixels: Area) => {
        setProfileCroppedArea(croppedAreaPixels);
    }, []);

    const handleCoverCropComplete = useCallback((_: any, croppedAreaPixels: Area) => {
        setCoverCroppedArea(croppedAreaPixels);
    }, []);

    const handleCoverMediaLoaded = useCallback((mediaSize: { width: number; height: number }) => {
        coverMediaSizeRef.current = mediaSize;
        if (!coverCropSize) return;
        const minZoom = Math.min(
            coverCropSize.width / mediaSize.width,
            coverCropSize.height / mediaSize.height
        );
        setCoverMinZoom(minZoom);
        if (!coverZoomInitializedRef.current) {
            setCoverZoom(minZoom);
            coverZoomInitializedRef.current = true;
        }
    }, [coverCropSize]);

    const handleProfileMediaLoaded = useCallback((mediaSize: { width: number; height: number }) => {
        profileMediaSizeRef.current = mediaSize;
        if (!profileCropSize) return;
        const minZoom = Math.min(
            profileCropSize.width / mediaSize.width,
            profileCropSize.height / mediaSize.height
        );
        setProfileMinZoom(minZoom);
        if (!profileZoomInitializedRef.current) {
            setProfileZoom(minZoom);
            // Center the image
            const centeredX = -(mediaSize.width * minZoom - profileCropSize.width) / 2;
            const centeredY = -(mediaSize.height * minZoom - profileCropSize.height) / 2;
            setProfileCropPosition({ x: centeredX, y: centeredY });
            profileZoomInitializedRef.current = true;
        }
    }, [profileCropSize]);

    const closeProfileCropper = () => {
        setShowProfileCropper(false);
        setCropProfileFile(null);
        setProfileCroppedArea(null);
        setProfileZoom(1);
        setProfileCropPosition({ x: 0, y: 0 });
        setProfileCropSize(null);
        setProfileMinZoom(1);
        profileZoomInitializedRef.current = false;
    };

    const closeCoverCropper = () => {
        setShowCoverCropper(false);
        setCropCoverFile(null);
        setCoverCroppedArea(null);
        setCoverZoom(1);
        setCoverMinZoom(1);
        setCoverCropPosition({ x: 0, y: 0 });
        setCoverCropSize(null);
        setCoverPreviewUrl(null);
        setCoverBgColor("#f1f5f9");
        setPendingCoverFiles([]);
        setCurrentCoverFile(null);
        coverZoomInitializedRef.current = false;
    };

    const advanceCoverQueue = () => {
        setPendingCoverFiles((prev) => {
            const [, ...rest] = prev;
            const next = rest[0] || null;
            setCurrentCoverFile(next);
            if (!next) {
                setShowCoverCropper(false);
                setCropCoverFile(null);
                setCoverCroppedArea(null);
                setCoverZoom(1);
                setCoverMinZoom(1);
                setCoverCropPosition({ x: 0, y: 0 });
                setCoverCropSize(null);
                setCoverPreviewUrl(null);
                setCoverBgColor("#f1f5f9");
                coverZoomInitializedRef.current = false;
            } else {
                setCropCoverFile(next);
                setCoverCroppedArea(null);
                setCoverZoom(1);
                setCoverMinZoom(1);
                setCoverCropPosition({ x: 0, y: 0 });
                setCoverPreviewUrl(null);
                setCoverBgColor("#f1f5f9");
                coverZoomInitializedRef.current = false;
            }
            return rest;
        });
    };

    const handleProfileCropSave = async () => {
        try {
            if (!cropProfileFile || !profileCroppedArea) {
                alert('Please adjust the crop before saving.');
                return;
            }
            const croppedFile = await getCroppedFile(cropProfileFile, profileCroppedArea, '-profile');
            const preview = await fileToDataUrl(croppedFile);
            if (previewUrl && previewUrl.startsWith("blob:")) revokeObjectUrl(previewUrl);
            const url = createObjectUrl(croppedFile);
            setPreviewUrl(url);
            onImageSelect?.(croppedFile);
            closeProfileCropper();
        } catch (err) {
            console.error('Profile crop failed', err);
            alert('Could not crop profile image.');
        }
    };

    const handleProfileCropCancel = () => {
        closeProfileCropper();
    };

    const handleCoverCropSave = async () => {
        try {
            if (!currentCoverFile || !coverCroppedArea) {
                alert('Please adjust the crop before saving.');
                return;
            }
            const croppedFile = await getCroppedFile(currentCoverFile, coverCroppedArea, '-cover', coverBgColor);
            const preview = createObjectUrl(croppedFile);
            setCoverPreviews((prev) => [...prev, preview]);
            onCoverImagesSelect?.([croppedFile]);
            advanceCoverQueue();
        } catch (err) {
            console.error('Cover crop failed', err);
            alert('Could not crop cover image.');
            advanceCoverQueue();
        }
    };

    const handleCoverCropSkip = () => {
        advanceCoverQueue();
    };

    const handleUseFullProfileImage = async () => {
        try {
            if (!cropProfileFile) return;
            const preview = await fileToDataUrl(cropProfileFile);
            if (previewUrl && previewUrl.startsWith("blob:")) revokeObjectUrl(previewUrl);
            const url = createObjectUrl(cropProfileFile);
            setPreviewUrl(url);
            onImageSelect?.(cropProfileFile);
            closeProfileCropper();
        } catch (err) {
            console.error('Use full profile image failed', err);
            alert('Could not load the full image.');
        }
    };

    const handleUseFullCoverImage = async () => {
        try {
            if (!currentCoverFile) return;
            const preview = createObjectUrl(currentCoverFile);
            setCoverPreviews((prev) => [...prev, preview]);
            onCoverImagesSelect?.([currentCoverFile]);
            advanceCoverQueue();
        } catch (err) {
            console.error('Use full cover image failed', err);
            alert('Could not load the full image.');
            advanceCoverQueue();
        }
    };

    // Crop modal overlays
    const cropActive = (showProfileCropper && cropProfileFile) || (showCoverCropper && cropCoverFile);

    const profileCropperOverlay =
        portalTarget && showProfileCropper && cropProfileFile
            ? createPortal(
                <div className="pointer-events-auto fixed inset-0 z-[2000] flex items-center justify-center bg-dark/50 px-4">
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="crop-profile-title"
                        className={`${modalSurfaceClass} max-w-3xl`}
                    >
                        <h3 id="crop-profile-title" className={`${modalTitleClass} px-[25px] py-5`}>Crop profile photo</h3>
                        <div className="h-px bg-light-525" />
                        <div className="flex flex-col gap-5 px-[25px] py-5">
                            <div
                                ref={profileCropContainerRef}
                                className="relative h-[200px] w-full overflow-hidden rounded-control bg-light sm:h-[250px] lg:h-[300px]"
                            >
                                {profileObjectUrl && profileCropSize && (
                                    <Cropper
                                        image={profileObjectUrl}
                                        crop={profileCropPosition}
                                        zoom={profileZoom}
                                        aspect={1}
                                        cropShape="rect"
                                        cropSize={profileCropSize}
                                        minZoom={profileMinZoom}
                                        maxZoom={3}
                                        onCropChange={setProfileCropPosition}
                                        onCropComplete={handleProfileCropComplete}
                                        onZoomChange={setProfileZoom}
                                        onMediaLoaded={handleProfileMediaLoaded}
                                        restrictPosition={true}
                                        objectFit="contain"
                                    />
                                )}
                            </div>
                            <div className="flex items-center gap-4">
                                <Label htmlFor="crop-profile-zoom" className="text-label-sm text-dark-400">Zoom</Label>
                                <input
                                    id="crop-profile-zoom"
                                    type="range"
                                    min={profileMinZoom}
                                    max={3}
                                    step={0.1}
                                    value={profileZoom}
                                    onChange={(e) => setProfileZoom(Number(e.target.value))}
                                    className={rangeClass}
                                />
                            </div>
                        </div>
                        <div className="h-px bg-light-525" />
                        <div className="flex flex-col-reverse gap-[10px] px-[25px] py-5 sm:flex-row sm:justify-end">
                            <Button variant="outline" onClick={handleUseFullProfileImage}>Use full image</Button>
                            <Button variant="outline" onClick={handleProfileCropCancel}>Cancel</Button>
                            <Button onClick={handleProfileCropSave}>Save crop</Button>
                        </div>
                    </div>
                </div>,
                portalTarget
            )
            : null;

    const coverCropperOverlay =
        portalTarget && showCoverCropper && cropCoverFile
            ? createPortal(
                <div className="pointer-events-auto fixed inset-0 z-[2000] flex items-center justify-center bg-dark/50 px-4">
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="crop-cover-title"
                        className={`${modalSurfaceClass} max-h-[90vh] max-w-5xl overflow-y-auto`}
                    >
                        <div className="flex flex-wrap items-center justify-between gap-2 px-[25px] py-5">
                            <h3 id="crop-cover-title" className={modalTitleClass}>Crop cover photo</h3>
                            {pendingCoverFiles.length > 0 && (
                                <span className="text-body-m text-dark-300">
                                    {pendingCoverFiles.length} {pendingCoverFiles.length === 1 ? "photo" : "photos"} left
                                </span>
                            )}
                        </div>
                        <div className="h-px bg-light-525" />
                        <div className="flex flex-col gap-5 px-[25px] py-5">
                            <div className="flex flex-col gap-4 lg:flex-row">
                                <div
                                    ref={coverCropperRef}
                                    className="relative h-[200px] w-full overflow-hidden rounded-control sm:h-[250px] lg:h-[300px]"
                                    style={{ backgroundColor: coverBgColor }}
                                >
                                    {coverObjectUrl && coverCropSize && (
                                        <Cropper
                                            image={coverObjectUrl}
                                            crop={coverCropPosition}
                                            zoom={coverZoom}
                                            aspect={3 / 1}
                                            cropSize={coverCropSize}
                                            minZoom={coverMinZoom}
                                            maxZoom={3}
                                            onMediaLoaded={handleCoverMediaLoaded}
                                            onCropChange={setCoverCropPosition}
                                            onZoomChange={setCoverZoom}
                                            onCropComplete={handleCoverCropComplete}
                                            objectFit="contain"
                                            restrictPosition={false}
                                        />
                                    )}
                                </div>
                                <div className="flex w-full shrink-0 flex-col gap-2 lg:w-56">
                                    <p className="text-label-xsm text-dark-300">Preview</p>
                                    <div
                                        className="aspect-[3/1] w-full overflow-hidden rounded-control border border-light-525"
                                        style={{ backgroundColor: coverBgColor }}
                                    >
                                        {coverPreviewUrl ? (
                                            <img src={coverPreviewUrl} alt="Cover preview" className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="h-full w-full" />
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col gap-4">
                                <div className="flex flex-wrap items-center gap-3">
                                    <span className="text-label-sm text-dark-400">Background</span>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {COVER_BG_COLORS.map((color) => (
                                            <button
                                                key={color}
                                                type="button"
                                                onClick={() => setCoverBgColor(color)}
                                                aria-pressed={coverBgColor === color}
                                                className={`size-6 rounded-control border border-light-525 transition-shadow ${coverBgColor === color ? "ring-2 ring-primary ring-offset-2 ring-offset-light-300" : "hover:ring-1 hover:ring-light-600"}`}
                                                style={{ backgroundColor: color }}
                                                aria-label={`Select ${color} background`}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Label htmlFor="crop-cover-zoom" className="text-label-sm text-dark-400">Zoom</Label>
                                    <input
                                        id="crop-cover-zoom"
                                        type="range"
                                        min={coverMinZoom}
                                        max={3}
                                        step={0.01}
                                        value={coverZoom}
                                        onChange={(e) => setCoverZoom(Number(e.target.value))}
                                        className={rangeClass}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="h-px bg-light-525" />
                        <div className="flex flex-col-reverse gap-[10px] px-[25px] py-5 sm:flex-row sm:justify-end">
                            <Button variant="outline" onClick={handleUseFullCoverImage}>Use full image</Button>
                            <Button variant="outline" onClick={handleCoverCropSkip}>Skip</Button>
                            <Button onClick={handleCoverCropSave}>Save crop</Button>
                        </div>
                    </div>
                </div>,
                portalTarget
            )
            : null;

    const instagramHandle = editedCoach?.instagram_handle ?? coach.instagram_handle;
    const specialties = coach.specialties ?? [];
    const sportLabel = resolvedSport === "rowing" ? "Rowing" : resolvedSport === "soccer" ? "Soccer" : null;
    const showRating = isPublicCoachRatingVisible(coach.total_reviews, coach.rating);
    const ratingLabel = showRating
        ? `${publicCoachRatingLabel(coach.rating, coach.total_reviews)} (${coach.total_reviews})`
        : publicCoachRatingLabel(coach.rating, coach.total_reviews);
    const metaLabel = "text-caption text-dark-300";

    return (
        <>
        <div
            className={`flex w-full min-w-0 flex-col gap-6 rounded-card border border-light-525 bg-light-300 px-[25px] pb-[25px] pt-[30px] font-sans tracking-[-0.03em] text-dark ${className}`}
        >
            {/* Profile Strength Meter */}
            {showStrengthMeter && (
                <ProfileStrengthMeter coach={coach} onEdit={isEditMode ? undefined : onEdit} />
            )}

            {/* Cover carousel hidden (ATH-46); cover_image_urls column retained */}
            {null}

            <div className="flex flex-col items-start gap-5 md:flex-row md:gap-6">
                <div className="relative flex-shrink-0">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (!file.type.startsWith("image/")) {
                                toast({
                                    title: "Invalid file type",
                                    description: "Choose an image file.",
                                    variant: "destructive",
                                });
                                return;
                            }
                            if (file.size > MAX_PROFILE_IMAGE_SIZE) {
                                toast({
                                    title: "Image too large",
                                    description: "Profile images must be under 8MB.",
                                    variant: "destructive",
                                });
                                return;
                            }
                            // Trigger cropper
                            setCropProfileFile(file);
                            setShowProfileCropper(true);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        className="hidden"
                        disabled={!isEditMode}
                        aria-label="Upload profile image"
                    />

                    <AvatarArea
                        name={coach.name}
                        imageUrl={avatarDisplayUrl}
                        isEditMode={isEditMode}
                        onClick={!isEditMode && !avatarDisplayUrl ? undefined : handleAvatarClick}
                        previewUrl={previewUrl}
                        isLoading={isAvatarLoading}
                    />
                </div>

                {isEditMode ? (
                    /* ---------------- Edit form ---------------- */
                    <div className="flex w-full min-w-0 flex-1 flex-col gap-5">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="flex flex-col gap-1.5">
                                <h2 className="text-card-title text-dark">Edit profile</h2>
                                <p className={metaLabel}>
                                    Fields marked <span className="text-error-700">*</span> are required
                                </p>
                            </div>
                            <div className="hidden md:flex">
                                <ProfileActions
                                    isCoachProfile={isCoachProfile}
                                    isEditMode={isEditMode}
                                    isSaving={isSaving}
                                    disableSave={!isLocationValid}
                                    onEdit={onEdit}
                                    onCancelEdit={onCancelEdit}
                                    onSaveEdit={onSaveEdit}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <EditableField
                                isEditMode={isEditMode}
                                value={editedCoach?.name ?? coach.name}
                                onChange={(value) => {
                                    // Allow typing freely, validation happens on save
                                    onFieldChange?.("name", value);
                                }}
                                inputClassName="w-full"
                                placeholder="Coach name"
                                label="Name"
                                required
                            />

                            <EditableField
                                isEditMode={isEditMode}
                                value={editedCoach?.instagram_handle ?? coach.instagram_handle ?? ""}
                                onChange={(value) => onFieldChange?.("instagram_handle", value)}
                                inputClassName="w-full"
                                placeholder="Instagram username"
                                label="Instagram username"
                                required
                            />
                        </div>

                        <EditableFieldGroup isEditMode={isEditMode}>
                            <div className="flex flex-col gap-1.5">
                                <Label className={fieldLabelClass}>
                                    Development pillars
                                    <span className={requiredMarkClass}>*</span>
                                </Label>
                                <MultiSelect
                                    options={(coachPillarOptions || []).map((option) => ({
                                        id: option.id,
                                        title: option.title || "",
                                    }))}
                                    selected={(editedCoach?.specialties ?? coach.specialties ?? [])
                                        .map(title => coachPillarOptions?.find(opt => opt.title === title)?.id)
                                        .filter(Boolean) as string[]}
                                    onChange={(selectedIds) => {
                                        const titles = selectedIds
                                            .map(id => coachPillarOptions?.find(opt => opt.id === id)?.title)
                                            .filter(Boolean) as string[];
                                        onFieldChange?.("specialties", titles);
                                    }}
                                    placeholder="Select development pillars"
                                    className="w-full"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label className={fieldLabelClass}>Pathway tags</Label>
                                <PathwayTagChips
                                    selected={editedCoach?.pathway_tags ?? coach.pathway_tags ?? []}
                                    onChange={(tags) => onFieldChange?.("pathway_tags", tags)}
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label className={fieldLabelClass}>
                                    Positions coached
                                    <span className={requiredMarkClass}>*</span>
                                </Label>
                                <MultiSelect
                                    options={favoritePositionOptions}
                                    selected={favoritePositions}
                                    onChange={(selectedIds) => {
                                        onFieldChange?.("favourite_positions", selectedIds);
                                    }}
                                    placeholder="Select positions coached"
                                    className="w-full"
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                <EditableField
                                    isEditMode={isEditMode}
                                    value={editedCoach?.company ?? coach.company ?? ""}
                                    onChange={(value) => onFieldChange?.("company", value)}
                                    inputClassName="w-full"
                                    placeholder="Company name"
                                    label="Company"
                                    renderDisplay={() => null}
                                />

                                <ZipCodeInput
                                    value={zipCode}
                                    onChange={(value) => {
                                        const nextValue = value ?? "";
                                        setZipCode(nextValue);
                                        setIsLocationValid(!nextValue.trim());
                                        onFieldChange?.("zip_code", nextValue);
                                        if (!nextValue.trim()) {
                                            // Clearing the zip keeps the saved location; a new zip replaces it.
                                            setLocationInfo(null);
                                        }
                                    }}
                                    onLocationResolved={(info, isValid) => {
                                        setLocationInfo(info);
                                        if (isValid && info) {
                                            setIsLocationValid(true);
                                            const formatted = formatLocationDisplay(info)?.trim();
                                            if (formatted) {
                                                onFieldChange?.("locations", [formatted]);
                                            }
                                            return;
                                        }
                                        if (isValid && !info) {
                                            // Empty zip (no failed lookup) — allow Save if a location already exists.
                                            const hasExisting = Boolean(
                                                (editedCoach as { locations?: string[] } | undefined)
                                                    ?.locations?.[0] || coach.locations?.[0]
                                            );
                                            setIsLocationValid(hasExisting);
                                            return;
                                        }
                                        setIsLocationValid(false);
                                    }}
                                    disabled={isSaving}
                                    id="coach-zipCode"
                                    label="Zip code"
                                    required
                                />

                                <div className="flex flex-col gap-1.5">
                                    <Label className={fieldLabelClass}>
                                        Gender
                                        <span className={requiredMarkClass}>*</span>
                                    </Label>
                                    <GenderSelect
                                        value={editedCoach?.gender ?? coach.gender ?? ""}
                                        onChange={(value) => onFieldChange?.("gender", value)}
                                        disabled={false}
                                        showLabel={false}
                                        label="Gender"
                                        placeholder="Select gender"
                                        required
                                    />
                                </div>
                            </div>
                        </EditableFieldGroup>

                        <div className="flex justify-end md:hidden">
                            <ProfileActions
                                isCoachProfile={isCoachProfile}
                                isEditMode={isEditMode}
                                isSaving={isSaving}
                                disableSave={!isLocationValid}
                                onEdit={onEdit}
                                onCancelEdit={onCancelEdit}
                                onSaveEdit={onSaveEdit}
                            />
                        </div>
                    </div>
                ) : (
                    /* ---------------- Display ---------------- */
                    <div className="flex w-full min-w-0 flex-1 flex-col gap-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex min-w-0 flex-col gap-[10px]">
                                <div className="flex flex-wrap items-end gap-[6px]">
                                    <h1 className="text-page-title-phone text-dark md:text-page-title">
                                        {editedCoach?.name ?? coach.name}
                                    </h1>
                                    {coach?.is_verified && (
                                        <BadgeCheck className="size-5 shrink-0 fill-primary text-light-300" aria-label="Verified" />
                                    )}
                                    {instagramHandle ? (
                                        <a
                                            href={`https://instagram.com/${instagramHandle}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex size-[26px] items-center justify-center rounded-control border border-light-525 bg-light-400 text-dark-400 transition-colors hover:bg-light-525"
                                            aria-label={`View ${coach.name}'s Instagram profile`}
                                        >
                                            <Instagram className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
                                        </a>
                                    ) : null}
                                </div>
                                <div className="flex flex-col gap-[2px] text-caption text-dark-300">
                                    {locationDisplay ? (
                                        <p className="inline-flex items-center gap-1">
                                            <MapPin className="size-3" strokeWidth={1.5} aria-hidden="true" />
                                            {locationDisplay}
                                        </p>
                                    ) : null}
                                    <p className="text-label-xsm">{displayedPosition}</p>
                                </div>
                            </div>

                            <ProfileActions
                                isCoachProfile={isCoachProfile}
                                isEditMode={isEditMode}
                                isSaving={isSaving}
                                disableSave={!isLocationValid}
                                onEdit={onEdit}
                                onCancelEdit={onCancelEdit}
                                onSaveEdit={onSaveEdit}
                            />
                        </div>

                        <div className="flex flex-wrap items-center gap-[10px]">
                            <span className={`inline-flex items-center gap-[3px] ${metaLabel}`}>
                                <BrandStar size={10} />
                                {ratingLabel}
                            </span>
                            {sportLabel ? <BrandPill tone="teal">{sportLabel}</BrandPill> : null}
                            {coach.gender ? <GenderPill gender={coach.gender} showLabel={false} /> : null}
                        </div>

                        {(specialties.length > 0 || favoritePositions.length > 0 || coach.company || (coach.pathway_tags?.length ?? 0) > 0) && (
                            <div className="flex flex-col gap-[10px]">
                                {specialties.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {specialties.map((specialty, index) => (
                                            <CoachProfileChip key={`${specialty}-${index}`} label={specialty} />
                                        ))}
                                    </div>
                                )}
                                <PathwayTagChips selected={coach.pathway_tags} readOnly />
                                {(favoritePositions.length > 0 || coach.company) && (
                                    <div className="flex flex-wrap gap-[6px]">
                                        {favoritePositions.map((position, index) => (
                                            <BrandPill key={`${position}-${index}`} tone="neutral">
                                                {favoritePositionLabelMap.get(normalizePosition(resolvedSport || coach.sport || sport || "", position)) ?? normalizePosition(resolvedSport || coach.sport || sport || "", position)}
                                            </BrandPill>
                                        ))}
                                        {coach.company && <BrandPill tone="muted">{coach.company}</BrandPill>}
                                    </div>
                                )}
                            </div>
                        )}

                        {!isCoachProfile && (
                            <div className="flex flex-wrap gap-[10px]">
                                {bookAction ?? <Button onClick={onBook}>Book a session</Button>}
                                <Button variant="outline" onClick={onViewPackages}>
                                    View packages
                                </Button>
                                <Button
                                    variant="outline"
                                    disabled={!canSendMessage || isSendingMessage}
                                    onClick={onSendMessage}
                                >
                                    {isSendingMessage ? (
                                        <>
                                            <Loader2 className="animate-spin" strokeWidth={1.5} aria-hidden="true" />
                                            Starting chat…
                                        </>
                                    ) : (
                                        "Send a message"
                                    )}
                                </Button>
                                {/* Signed-out visitors get "Sign in to join community" here (ATH-53). */}
                                {coach?.id ? <CommunityChannelButton coachId={coach.id} /> : null}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
        
        {/* Crop modals */}
        {profileCropperOverlay}
        {coverCropperOverlay}
        {!isEditMode && avatarPreviewOpen && avatarDisplayUrl && portalTarget && createPortal(
            <div className="fixed inset-0 z-[2100] flex items-center justify-center bg-dark/80 px-4">
                <div className="absolute inset-0" onClick={() => setAvatarPreviewOpen(false)} />
                <div className="relative z-[2101] flex max-h-[90vh] w-full max-w-3xl flex-col gap-3">
                    <button
                        type="button"
                        aria-label="Close preview"
                        className="absolute -top-10 right-0 inline-flex size-[34px] items-center justify-center rounded-control text-light/90 transition-colors hover:text-light"
                        onClick={() => setAvatarPreviewOpen(false)}
                    >
                        <X className="size-5" strokeWidth={1.5} />
                    </button>
                    <div className="relative flex h-full max-h-[80vh] w-full items-center justify-center overflow-hidden rounded-card bg-dark/30">
                        <img
                            src={avatarDisplayUrl}
                            alt={`${coach.name} profile`}
                            className="max-h-[80vh] w-auto object-contain"
                        />
                    </div>
                </div>
            </div>,
            portalTarget
        )}
        </>
    );
}
