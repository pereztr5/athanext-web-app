
import {
    EditableField,
    EditableFieldGroup,
    EditableNumberField,
} from "./editable";
import { Carousel } from "./Carousel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import starIcon from "@/assets/images/star.png";
import { Card, CardContent } from "@/components/ui/card";
import { GenderPill } from "@/components/form/GenderPill";
import { MultiSelect } from "@/components/ui/multi-select";
import rowerIcon from "@/assets/images/colored-rowing.png";
import { GenderSelect } from "@/components/form/GenderSelect";
import { ProfileStrengthMeter } from "./ProfileStrengthMeter";
import footballIcon from "@/assets/images/colored-soccer.png";
import { CoachVerificationBadge } from "@/components/coach/CoachVerificationBadge";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatLocationDisplay, type LocationInfo } from "@/utils/geolocation";
import { MapPin, Clock, Instagram, ExternalLink, Camera, Plus, Trash2, X, Save, Edit, Loader2 } from "lucide-react";
import type { Coach, SportTheme, CoachHeaderProps } from "@/types/coachProfile";
import { SPORTS_OPTIONS, normalizePosition } from "@/utils/db";
import { createPortal } from "react-dom";
import Cropper, { type Area } from "react-easy-crop";
import { Label } from "@/components/ui/label";
import { ZipCodeInput } from "@/components/form/ZipCodeInput";
import { COACH_PROFILE_THEMES, colors, COVER_BG_COLORS } from "@/config/colors";
import { createCroppedPreview, fileToDataUrl, getCroppedFile } from "@/utils/imageUtils";
import { detectCoachSport, normalizeCoachSport } from "@/utils/coachSport";
import { getInitials } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

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

/* Avatar area:  uses a real <button> when interactive to satisfy ARIA/axe rules */
function AvatarArea({
    name,
    imageUrl,
    isEditMode,
    onClick,
    previewUrl,
    sportIcon,
    isLoading,
}: {
    name: string;
    imageUrl?: string | null;
    isEditMode?: boolean;
    onClick?: () => void;
    previewUrl?: string | null;
    sportIcon?: string;
    isLoading?: boolean;
}) {
    const initials = useMemo(() => getInitials(name), [name]);
    const isInteractive = Boolean(onClick);

    const commonClasses = "w-28 h-28 relative flex items-center justify-center";

    const avatarContent = (
        <>
            {previewUrl || imageUrl ? (
                <>
                    <img
                        loading="eager"
                        alt={`${name}'s avatar`}
                        src={previewUrl || imageUrl || undefined}
                        className="w-28 h-28 rounded-full aspect-square border-2 border-[#D6D9E2] object-cover"
                        {...({ fetchPriority: "high" } as any)}
                    />
                    {isLoading && (
                        <div className="absolute inset-0 bg-white/70 rounded-full flex items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
                        </div>
                    )}
                    {isEditMode && (
                        <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            <Camera className="h-8 w-8 text-white" />
                        </div>
                    )}
                </>
            ) : (
                <div className="relative w-28 h-28 bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center p-1 border-4 border-white dark:border-slate-800">
                    <div className="w-full h-full bg-primary/30 rounded-full flex items-center justify-center">
                        <span className="text-primary font-bold text-xl md:text-4xl">{initials}</span>
                    </div>
                    {isEditMode && (
                        <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            <Camera className="h-8 w-8 text-white" />
                        </div>
                    )}
                </div>
            )}

            <div className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 rounded-full p-1 bg-white">
                <img src={sportIcon} alt="sport" className="w-8 h-8" />
            </div>
        </>
    );

    return (
        <div className="relative flex-shrink-0">
            {isInteractive ? (
                <button
                    type="button"
                    onClick={onClick}
                    aria-label={`${name} avatar`}
                    className={`${commonClasses} cursor-pointer group rounded-full p-0 border-none bg-transparent`}
                >
                    {avatarContent}
                </button>
            ) : (
                <div className={`${commonClasses} rounded-full p-0`} aria-label={`${name} avatar`}>
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
        <div className="relative">
            <Carousel
                photos={coverPreviews}
                altTextPrefix={coachName}
                enablePreview={!isEditMode}
                aspect="cover3x1"
                containUntilLg
            />

            {isEditMode && (
                <div className="absolute top-4 right-4 flex gap-2 z-10">
                    <input
                        ref={coverImagesInputRef}
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                        multiple
                        onChange={handleCoverImagesChange}
                        className="hidden"
                        aria-label="Upload cover images"
                    />

                    <Button
                        type="button"
                        size="sm"
                        onClick={handleCoverImagesClick}
                        className="bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm"
                    >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Cover Images
                    </Button>
                </div>
            )}

            {isEditMode && coverPreviews.length > 0 && (
                <div className="absolute bottom-4 left-4 right-4 flex gap-2 overflow-x-auto z-10 pb-2">
                    {coverPreviews.map((preview, index) => (
                        <div key={index} className="relative group flex-shrink-0">
                            <img
                                src={preview}
                                alt={`Cover ${index + 1}`}
                                className="w-20 h-20 object-cover rounded-lg border-2 border-white"
                            />

                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onCoverImageRemove?.(index)}
                                className="absolute top-0 right-0"
                                aria-label={`Remove cover image ${index + 1}`}
                            >
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
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
        <div className="flex items-center gap-2">
            {isEditMode ? (
                <>
                    <Button onClick={onCancelEdit} variant="outline" size="sm" className="gap-2" disabled={isSaving}>
                        <X className="h-4 w-4" />
                        Cancel
                    </Button>
                    <Button
                        onClick={onSaveEdit}
                        size="sm"
                        className="gap-2 bg-green-600 hover:bg-green-700"
                        disabled={isSaving || disableSave}
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="h-4 w-4" />
                                Save Changes
                            </>
                        )}
                    </Button>
                </>
            ) : (
                <Button onClick={onEdit} variant="default" size="sm" className="gap-2">
                    <Edit className="h-4 w-4" />
                    Edit Profile
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

    const displayedPosition = coach.coach_position ?? coach.position ?? coach.specialties?.[0] ?? "Professional Coach";
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

    const sportIcon = useMemo(
        () => (resolvedSport === "rowing" ? rowerIcon : footballIcon),
        [resolvedSport]
    );

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
                <div className="fixed inset-0 z-[2000] bg-black/60 flex items-center justify-center px-4 pointer-events-auto">
                    <div className="bg-white rounded-md shadow-xl w-full max-w-3xl p-4 space-y-4">
                        <h3 className="text-lg font-semibold">Crop Profile Photo</h3>
                        <div
                            ref={profileCropContainerRef}
                            className="relative w-full h-[200px] sm:h-[250px] lg:h-[300px] rounded-md overflow-hidden bg-slate-100"
                        >
                            {profileObjectUrl && profileCropSize && (
                                <Cropper
                                    image={profileObjectUrl}
                                    crop={profileCropPosition}
                                    zoom={profileZoom}
                                    aspect={1}
                                    cropShape="round"
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
                            <Label className="text-sm">Zoom</Label>
                            <input
                                type="range"
                                min={profileMinZoom}
                                max={3}
                                step={0.1}
                                value={profileZoom}
                                onChange={(e) => setProfileZoom(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={handleUseFullProfileImage}>Use Full Image</Button>
                            <Button variant="outline" onClick={handleProfileCropCancel}>Cancel</Button>
                            <Button onClick={handleProfileCropSave}>Save Crop</Button>
                        </div>
                    </div>
                </div>,
                portalTarget
            )
            : null;

    const coverCropperOverlay =
        portalTarget && showCoverCropper && cropCoverFile
            ? createPortal(
                <div className="fixed inset-0 z-[2000] bg-black/60 flex items-center justify-center px-4 pointer-events-auto">
                    <div className="bg-white rounded-md shadow-xl w-full max-w-5xl p-4 space-y-4">
                        <h3 className="text-lg font-semibold">Crop Cover Image</h3>
                        <div className="flex flex-col lg:flex-row gap-4">
                            <div
                                ref={coverCropperRef}
                                className="relative w-full h-[200px] sm:h-[250px] lg:h-[300px] rounded-md overflow-hidden"
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
                            <div className="w-full lg:w-56 shrink-0 space-y-2">
                                <p className="text-sm text-muted-foreground">Preview</p>
                                <div
                                    className="w-full aspect-[3/1] rounded-md overflow-hidden border"
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
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm text-muted-foreground">Background</span>
                                <div className="flex flex-wrap items-center gap-2">
                                    {COVER_BG_COLORS.map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setCoverBgColor(color)}
                                            className={`h-6 w-6 rounded-full border transition-transform ${coverBgColor === color ? "ring-2 ring-slate-400 scale-110" : "hover:scale-105"}`}
                                            style={{ backgroundColor: color }}
                                            aria-label={`Select ${color} background`}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <Label className="text-sm">Zoom</Label>
                                <input
                                    type="range"
                                    min={coverMinZoom}
                                    max={3}
                                    step={0.01}
                                    value={coverZoom}
                                    onChange={(e) => setCoverZoom(Number(e.target.value))}
                                    className="w-full"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={handleUseFullCoverImage}>Use Full Image</Button>
                            <Button variant="outline" onClick={handleCoverCropSkip}>Skip</Button>
                            <Button onClick={handleCoverCropSave}>Save Crop</Button>
                        </div>
                        {pendingCoverFiles.length > 0 && (
                            <p className="text-xs text-muted-foreground">Pending images: {pendingCoverFiles.length}</p>
                        )}
                    </div>
                </div>,
                portalTarget
            )
            : null;

    return (
        <>
        <Card
            className={`w-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm overflow-hidden px-4 ! py-6 rounded-none border-t-0 rounded-b-md ${className}`}
        >
            {/* Profile Strength Meter */}
            {showStrengthMeter && (
                <div className="mb-4">
                    <ProfileStrengthMeter coach={coach} />
                </div>
            )}

            <CoverCarouselManager
                coachName={coach.name}
                coverPreviews={coverPreviews}
                isEditMode={isEditMode}
                coverImagesInputRef={coverImagesInputRef}
                toast={toast}
                onCoverImagesSelect={(files) => {
                    // validate files
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
                    
                    // Check current count + new files
                    const currentCount = coverPreviews.length;
                    if (currentCount + validFiles.length > MAX_COVER_IMAGES) {
                        toast({
                            title: "Too many cover images",
                            description: `You can upload a maximum of ${MAX_COVER_IMAGES} cover images.`,
                            variant: "destructive",
                        });
                        return;
                    }
                    
                    // Trigger cropper for sequential processing
                    setPendingCoverFiles(validFiles);
                    setCurrentCoverFile(validFiles[0]);
                    setCropCoverFile(validFiles[0]);
                    setShowCoverCropper(true);
                }}
                onCoverImageRemove={handleRemoveCoverImage}
            />

            <CardContent className="p-4 md:p-6 !px-0">
                <div className="flex flex-col md:flex-row items-start gap-4 md:gap-6">
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
                                        description: "Please select a valid image file.",
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
                            sportIcon={sportIcon}
                            isLoading={isAvatarLoading}
                        />
                    </div>

                    <div className="flex-1 w-full flex flex-col gap-2">
                        <div className={isEditMode ? "flex flex-col md:flex-row md:items-center md:justify-between gap-2" : "flex items-center justify-between gap-2"}>
                            <div className="flex flex-wrap items-center gap-2 w-full">
                                <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                                    <EditableField
                                        isEditMode={isEditMode}
                                        value={editedCoach?.name ?? coach.name}
                                        onChange={(value) => {
                                            // Allow typing freely, validation happens on save
                                            onFieldChange?.("name", value);
                                        }}
                                        inputClassName="text-2xl md:text-3xl font-bold w-full md:max-w-md"
                                        placeholder="Coach name"
                                        renderDisplay={(value) => (
                                            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                                                {value}
                                            </h1>
                                        )}
                                    />

                                    {isEditMode && (
                                        <span className="text-lg font-semibold leading-none text-destructive shrink-0" aria-label="Name is required">
                                            *
                                        </span>
                                    )}

                                    {coach?.is_verified && <CoachVerificationBadge className="w-6 h-5 md:w-6 md:h-6" />}

                                    {!isEditMode && (editedCoach?.instagram_handle ?? coach.instagram_handle) ? (
                                        <a
                                            href={`https://instagram.com/${editedCoach?.instagram_handle ?? coach.instagram_handle}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center justify-center w-6 h-6 bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 rounded-full hover:opacity-80 transition-opacity"
                                            aria-label={`View ${coach.name}'s Instagram profile`}
                                        >
                                            <Instagram className="h-3.5 w-3.5 text-white" />
                                        </a>
                                    ) : null}
                                </div>

                                {isEditMode && (
                                    <div className="flex items-center gap-2 flex-1 min-w-[160px]">
                                        <span className="text-lg font-semibold leading-none text-destructive shrink-0" aria-label="Required field">
                                            *
                                        </span>
                                        <EditableField
                                            isEditMode={isEditMode}
                                            value={editedCoach?.instagram_handle ?? coach.instagram_handle ?? ""}
                                            onChange={(value) => onFieldChange?.("instagram_handle", value)}
                                            inputClassName="w-full md:max-w-xs"
                                            placeholder="Instagram Username"
                                            renderDisplay={(value) =>
                                                value ? (
                                                    <a
                                                        href={`https://instagram.com/${value}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center justify-center w-6 h-6 bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 rounded-full hover:opacity-80 transition-opacity"
                                                        aria-label={`View ${coach.name}'s Instagram profile`}
                                                    >
                                                        <Instagram className="h-3. 5 w-3.5 text-white" />
                                                    </a>
                                                ) : null
                                            }
                                        />
                                    </div>
                                )}
                            </div>

                            <div className={`${isEditMode ? "hidden md:flex" : "flex"} items-center`}>
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

                        {/* Bio Field */}
                        {/* <div className="">
                            {isEditMode ? (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-foreground">Bio</label>
                                    <textarea
                                        value={editedCoach?.bio ?? coach.bio ?? ""}
                                        onChange={(e) => onFieldChange?.("bio", e.target.value)}
                                        placeholder="Write a short bio about yourself"
                                        className="w-full min-h-[80px] px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 resize-none"
                                    />
                                </div>
                            ) : coach.bio ? (
                                <div className="flex items-center gap-1 text-base md:text-lg text-muted-foreground">
                                   <span> {coach.bio}</span>
                                </div>
                            ) : null}
                        </div> */}

                        <EditableFieldGroup isEditMode={isEditMode}>
                            {isEditMode ? (
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">
                                        Development Pillars
                                        <span className="ml-1 text-destructive">*</span>
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
                                        placeholder="Select development pillars..."
                                        className="max-w-2xl"
                                    />
                                </div>
                            ) : (
                                <>
                                    <div className="flex  flex-wrap gap-1.5 md:gap-2">
                                        {(coach.specialties ?? []).map((specialty, index) => (
                                            <Badge
                                                key={index}
                                                variant="outline"
                                                className={isRowingSport ? "text-xs border" : `text-xs ${COACH_PROFILE_THEMES.default.badgeClass}`}
                                                style={isRowingSport ? {
                                                    backgroundColor: colors.rowingBlueTheme.badgeBackground,
                                                    color: colors.rowingBlueTheme.badgeText,
                                                    borderColor: colors.rowingBlueTheme.primary,
                                                } : undefined}
                                            >
                                                {specialty}
                                            </Badge>
                                        ))}
                                    </div>
                                    {favoritePositions.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 md:gap-2 mt-2">
                                            {favoritePositions.map((position, index) => (
                                                <Badge
                                                    key={`${position}-${index}`}
                                                    variant="outline"
                                                    className={isRowingSport ? "text-xs border" : `text-xs ${COACH_PROFILE_THEMES.default.badgeClass}`}
                                                    style={isRowingSport ? {
                                                        backgroundColor: colors.rowingBlueTheme.badgeBackground,
                                                        color: colors.rowingBlueTheme.badgeText,
                                                        borderColor: colors.rowingBlueTheme.primary,
                                                    } : undefined}
                                                >
                                                    {favoritePositionLabelMap.get(normalizePosition(resolvedSport || coach.sport || sport || "", position)) ?? normalizePosition(resolvedSport || coach.sport || sport || "", position)}
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                    
                                    <div className="flex flex-wrap gap-1.5 md:gap-2 mt-2">
                                        {coach.company && (
                                            <Badge variant="outline" className="text-xs">
                                                {coach.company}
                                            </Badge>
                                        )}
                                    </div>
                                </>
                            )}

                            {isEditMode && (
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">
                                        Positions Coached
                                        <span className="ml-1 text-destructive">*</span>
                                    </Label>
                                    <MultiSelect
                                        options={favoritePositionOptions}
                                        selected={favoritePositions}
                                        onChange={(selectedIds) => {
                                            onFieldChange?.("favourite_positions", selectedIds);
                                        }}
                                        placeholder="Select Positions Coached..."
                                        className="max-w-2xl"
                                    />
                                </div>
                            )}

                            {isEditMode && (
                                <div className="max-w-sm">
                                    <EditableField
                                        isEditMode={isEditMode}
                                        value={editedCoach?.company ?? coach.company ?? ""}
                                        onChange={(value) => onFieldChange?.("company", value)}
                                        inputClassName="w-full"
                                        placeholder="Company name"
                                        label="Company"
                                        renderDisplay={() => null}
                                    />
                                </div>
                            )}

                        </EditableFieldGroup>

                        {isEditMode && (
                            <div className="max-w-sm">
                                <ZipCodeInput
                                    value={zipCode}
                                    onChange={(value) => {
                                        const nextValue = value ?? "";
                                        setZipCode(nextValue);
                                        setIsLocationValid(!nextValue.trim());
                                        onFieldChange?.("zip_code", nextValue);
                                        if (!nextValue.trim()) {
                                            setLocationInfo(null);
                                            onFieldChange?.("locations", []);
                                        }
                                    }}
                                    onLocationResolved={(info, isValid) => {
                                        setLocationInfo(info);
                                        setIsLocationValid(isValid);
                                        if (!isValid || !info) return;
                                        const formatted = formatLocationDisplay(info)?.trim();
                                        if (formatted) {
                                            onFieldChange?.("locations", [formatted]);
                                        }
                                    }}
                                    disabled={isSaving}
                                    id="coach-zipCode"
                                    label="Zip Code"
                                    required
                                />
                            </div>
                        )}

                        <div className={`flex flex-wrap gap-4 text-sm text-muted-foreground ${isEditMode ? "items-end" : "items-center"}`}>
                            <div className={`bg-[#FFFBEB] rounded-sm flex items-center justify-center gap-2 p-2 ${isEditMode ? "self-end" : ""}`}>
                                <img src={starIcon} alt="Star" className="w-4 h-4" />
                                <span className="font-semibold text-sm">{coach.rating ?? "New"}</span>
                            </div>

                            {/* Location Display */}
                            {!isEditMode && locationDisplay && (
                                <div className="flex items-center gap-1">
                                    <MapPin className="h-4 w-4" />
                                    <span>{locationDisplay}</span>
                                </div>
                            )}

                            <div className={`flex flex-wrap gap-3 ${isEditMode ? "items-center" : "items-center"}`}>
                                {/* Gender Field */}
                                <div className="flex-1 min-w-[20px]">
                                    {isEditMode ? (
                                        <div className="flex items-center gap-2">
                                            <Label className="mb-0 shrink-0">
                                                Gender
                                                <span className="ml-1 text-destructive">*</span>
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
                                    ) : coach.gender ? (
                                        <GenderPill gender={coach.gender} showLabel={false} />
                                    ) : null}
                                </div>
                            </div>

                             {/* <div className="flex items-center gap-1">
                                <EditableNumberField
                                    icon={<Clock className="h-4 w-4" />}
                                    label="Experience"
                                    isEditMode={isEditMode}
                                    value={editedCoach?.years_experience ?? coach.years_experience}
                                    onChange={(value) => onFieldChange?.("years_experience", value)}
                                    inputClassName="h-8 max-w-[100px]"
                                    placeholder="Years"
                                    renderDisplay={(value) => (
                                        <span>{value ?? 15} years experience</span>
                                    )}
                                />
                            </div> */}
                        </div>

                        {isEditMode && (
                            <div className="mt-2 flex md:hidden justify-end">
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
                        )}

                        {!isCoachProfile && (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {/* <Button
                                    onClick={onBook}
                                    className="bg-[#16A34A] hover:bg-[#16A34A]/90 text-white rounded-full px-10 py-2 flex items-center gap-2"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                    Book
                                </Button> */}


                                <Button
                                    onClick={onBook}
                                    className="bg-[#2563EB] hover:bg-[#2563EB]/90 text-white rounded-full px-6 py-2">
                                    Book a Session
                                </Button>
                                
                                <Button
                                    onClick={onViewPackages}
                                    className="bg-[#2563EB] hover:bg-[#2563EB]/90 text-white rounded-full px-6 py-2"
                                >
                                    View Packages
                                </Button>

                                <Button
                                    disabled={!canSendMessage || isSendingMessage}
                                    onClick={onSendMessage}
                                    className="bg-[#1E293B] hover:bg-[#1E293B]/90 text-white rounded-full px-6 py-2 flex items-center gap-2 disabled:opacity-70"
                                >
                                    {isSendingMessage ? "Starting chat..." : "Send a Message"}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
        
        {/* Crop modals */}
        {profileCropperOverlay}
        {coverCropperOverlay}
        {!isEditMode && avatarPreviewOpen && avatarDisplayUrl && portalTarget && createPortal(
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
