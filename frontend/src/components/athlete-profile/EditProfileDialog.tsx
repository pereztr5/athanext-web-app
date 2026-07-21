import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Image as ImageIcon, Loader2, X } from "lucide-react";
import Cropper, { type Area } from "react-easy-crop";
import { useToast } from "@/hooks/use-toast";
import imageCompression from 'browser-image-compression';
import { COVER_BG_COLORS } from "@/config/colors";
import { getCroppedFile } from "@/utils/imageUtils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ATHLETE_SPORTS_OPTIONS,
  ATHLETE_IMAGE_LIMITS,
  normalizeAthletePosition,
} from "@/utils/db";
import { GenderSelect } from "@/components/form/GenderSelect";
import type { GenderValue } from "@/components/form/GenderSelect";
import { ZipCodeInput } from "@/components/form/ZipCodeInput";
import {
  sanitizeHtml,
  validateImageMagicBytes,
  INPUT_LIMITS,
  truncateString,
} from "@/config/security";
import { createCroppedPreview, fileToDataUrl, loadImageElement } from "@/utils/imageUtils";
import {
  normalizePhone,
  sanitizeImages,
  sanitizeTagsFromString,
  deriveInitials,
} from "@/utils/helperFunctions";
import {
  validateImageFile,
  profileSchema,
  MAX_FILE_SIZE,
  MAX_COVER_IMAGES,
  MAX_TAGS,
} from "@/utils/validations";
import { formatLocationDisplay, hasValidLocationData, type LocationInfo } from "@/utils/geolocation";
import {
  ACADEMIC_YEAR_OPTIONS,
  getAcademicYearGraduationOffset,
  normalizeAcademicYear,
} from "@/utils/academicYear";
import type {
  AthleteProfileFormData,
  EditProfileDialogProps,
} from "@/types/athleteProfile";

const emptyProfile: AthleteProfileFormData = {
  fullName: "",
  initials: "",
  sport: "",
  position: "",
  dateOfBirth: "",
  phoneNumber: "",
  location: "",
  tags: [],
  profileImageUrl: null,
  coverImageUrls: [],
  graduationYear: null,
  currentYear: null,
  highSchool: null,
  gpa: null,
  height: null,
  weight: null,
  dominantHand: null,
  gender: null,
  zipCode: null,
};

const {
  MAX_PROFILE_IMAGE_SIZE,
  MAX_COVER_IMAGE_SIZE,
} = ATHLETE_IMAGE_LIMITS;

const FieldError = ({ message }: { message?: string }) =>
  message ? <p className="text-xs text-destructive">{message}</p> : null;

const hydrateProfile = (profile: AthleteProfileFormData | null): AthleteProfileFormData => {
  if (!profile) return { ...emptyProfile };
  
  // Safety checks for all fields
  return {
    ...emptyProfile,
    ...profile,
    fullName: typeof profile.fullName === 'string' ? profile.fullName : '',
    initials: profile.initials || deriveInitials(profile.fullName || ""),
    sport: typeof profile.sport === 'string' ? profile.sport : '',
    position: typeof profile.position === 'string'
      ? normalizeAthletePosition(profile.sport, profile.position)
      : '',
    dateOfBirth: typeof profile.dateOfBirth === 'string' ? profile.dateOfBirth : '',
    phoneNumber: typeof profile.phoneNumber === 'string' ? profile.phoneNumber : '',
    location: typeof profile.location === 'string' ? profile.location : '',
    tags: Array.isArray(profile.tags) ? profile.tags.filter((tag) => typeof tag === 'string' && tag.trim() !== '') : [],
    profileImageUrl: typeof profile.profileImageUrl === 'string' ? profile.profileImageUrl : null,
    coverImageUrls: sanitizeImages(Array.isArray(profile.coverImageUrls) ? profile.coverImageUrls : []),
    graduationYear: profile.graduationYear ?? null,
    currentYear: typeof profile.currentYear === 'string' ? profile.currentYear : null,
    highSchool: profile.highSchool ?? null,
    gpa: profile.gpa ?? null,
    height: profile.height ?? null,
    weight: profile.weight ?? null,
    dominantHand: profile.dominantHand ?? null,
    gender: typeof profile.gender === 'string' ? profile.gender : null,
    zipCode: typeof profile.zipCode === 'string' ? profile.zipCode : null,
  };
};

export const EditProfileDialog = ({ open, onOpenChange, profile, onSave, onImageSelect, onCoverImagesSelect, onCoverImageRemove, genderLabel }: EditProfileDialogProps) => {
  const { toast } = useToast();
  const hydratedProfile = useMemo(() => {
    return hydrateProfile(profile);
  }, [profile]);

  const [formData, setFormData] = useState<AthleteProfileFormData>(hydratedProfile);
  const [coverImages, setCoverImages] = useState<string[]>(hydratedProfile.coverImageUrls);
  const [tagsInputValue, setTagsInputValue] = useState(hydratedProfile.tags.join("\n"));
  const [errors, setErrors] = useState<Partial<Record<keyof AthleteProfileFormData | "form", string>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isCurrentlyStudying, setIsCurrentlyStudying] = useState(false);
  const [currentYearLevel, setCurrentYearLevel] = useState<string>("");
  const [resolvedLocation, setResolvedLocation] = useState<string>(hydratedProfile.location || "");
  const [isLocationValid, setIsLocationValid] = useState<boolean>(Boolean(hydratedProfile.location));
  // Phase 2: Cropping state variables
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
  const [coverCroppedArea, setCoverCroppedArea] = useState<Area | null>(null);
  const [coverCropPosition, setCoverCropPosition] = useState({ x: 0, y: 0 });
  const [coverCropSize, setCoverCropSize] = useState<{ width: number; height: number } | null>(null);
  const [coverMinZoom, setCoverMinZoom] = useState(1);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [coverBgColor, setCoverBgColor] = useState("#f1f5f9");
  const coverCropContainerRef = useRef<HTMLDivElement | null>(null);
  const coverMediaSizeRef = useRef<{ width: number; height: number } | null>(null);
  const coverZoomInitializedRef = useRef(false);
  const portalTarget = typeof document !== "undefined" ? document.body : null;
  // Phase 2: Cropper object URLs
  const profileObjectUrl = useMemo(
    () => (cropProfileFile ? URL.createObjectURL(cropProfileFile) : null),
    [cropProfileFile]
  );
  const coverObjectUrl = useMemo(
    () => (cropCoverFile ? URL.createObjectURL(cropCoverFile) : null),
    [cropCoverFile]
  );
  
  const profileImageInputRef = useRef<HTMLInputElement>(null);
  const coverImageInputRef = useRef<HTMLInputElement>(null);

  // Reset cropper state when dialog opens or closes
  useEffect(() => {
    if (!open) {
      // Clean up cropper state when dialog closes
      setShowProfileCropper(false);
      setCropProfileFile(null);
      setShowCoverCropper(false);
      setCropCoverFile(null);
      setPendingCoverFiles([]);
      setCurrentCoverFile(null);
    }
  }, [open]);

  useEffect(() => {
    if (!profileObjectUrl) return;
    return () => URL.revokeObjectURL(profileObjectUrl);
  }, [profileObjectUrl]);

  useEffect(() => {
    if (!coverObjectUrl) return;
    return () => URL.revokeObjectURL(coverObjectUrl);
  }, [coverObjectUrl]);

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
    if (!showCoverCropper) return;
    const container = coverCropContainerRef.current;
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

  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (!open) {
      hasInitializedRef.current = false;
      return;
    }
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;
    
    setFormData(hydratedProfile);
    setCoverImages(hydratedProfile.coverImageUrls);
    setTagsInputValue(hydratedProfile.tags.join("\n"));
    setResolvedLocation(hydratedProfile.location || "");
    setIsLocationValid(Boolean(hydratedProfile.location));
    
    // Set graduation year state based on loaded data
    const normalizedCurrentYear = normalizeAcademicYear(hydratedProfile.currentYear);
    if (normalizedCurrentYear) {
      setIsCurrentlyStudying(true);
      setCurrentYearLevel(normalizedCurrentYear);
      // Calculate graduation year from current year
      const currentDate = new Date();
      const currentActualYear = currentDate.getFullYear();
      const graduationOffset = getAcademicYearGraduationOffset(normalizedCurrentYear) ?? 0;
      const calculatedGradYear = currentActualYear + graduationOffset;
      
      setFormData(prev => ({
        ...prev,
        graduationYear: calculatedGradYear.toString()
      }));
    } else {
      setIsCurrentlyStudying(false);
      setCurrentYearLevel("");
    }
  }, [open, hydratedProfile]);
  
  const selectedSportOption = useMemo(() => {
    // Safety checks: ensure ATHLETE_SPORTS_OPTIONS is available and formData.sport is valid
    if (!formData?.sport || typeof formData.sport !== 'string') return undefined;
    if (!Array.isArray(ATHLETE_SPORTS_OPTIONS) || ATHLETE_SPORTS_OPTIONS.length === 0) return undefined;
    
    const normalizedSport = formData.sport.trim().toLowerCase();
    if (!normalizedSport) return undefined;
    
    return ATHLETE_SPORTS_OPTIONS.find((option) => 
      option?.value && typeof option.value === 'string' && 
      option.value.toLowerCase() === normalizedSport
    );
  }, [formData.sport]);
  
  const availablePositions = useMemo(() => {
    // Safety checks: ensure selectedSportOption and positions array are valid
    if (!selectedSportOption?.positions) return [];
    if (!Array.isArray(selectedSportOption.positions)) return [];
    
    // Filter out any invalid position objects
    return selectedSportOption.positions.filter(
      (pos) => pos && typeof pos === 'object' && pos.value && pos.label
    );
  }, [selectedSportOption]);

  // Reset errors and saving state when dialog opens
  useEffect(() => {
    if (open) {
      setErrors({});
      setIsSaving(false);
    }
  }, [open]);

  // When zipCode changes in the form, re-fetch the location display
  // This ensures the dialog shows the latest location based on zip lookup,
  // not the stale athlete_profiles.location text
  useEffect(() => {
    const zip = formData?.zipCode;
    if (!zip || zip.trim() === "") {
      setResolvedLocation("");
      setIsLocationValid(false);
      return;
    }

    let isMounted = true;
    (async () => {
      try {
        const { fetchLocationFromZipCode, formatLocationDisplay, hasValidLocationData } = await import("@/utils/geolocation");
        const location = await fetchLocationFromZipCode(zip);
        if (!isMounted) return;
        
        if (location && hasValidLocationData(location)) {
          const displayLocation = formatLocationDisplay(location);
          setResolvedLocation(displayLocation);
          setIsLocationValid(true);
        } else {
          setResolvedLocation("");
          setIsLocationValid(false);
        }
      } catch (err) {
        console.error("Failed to fetch location in dialog:", err);
        setResolvedLocation("");
        setIsLocationValid(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [formData?.zipCode]);

  const handleInputChange = (field: keyof AthleteProfileFormData, value: string) => {
    // Safety check: ensure value is a string
    const safeValue = typeof value === 'string' ? value : '';
    
    setFormData((prev) => {
      if (!prev) return emptyProfile;
      
      let sanitizedValue: string | number = safeValue;
      
      // Handle numeric fields
      if (field === 'graduationYear') {
        const numValue = safeValue ? parseInt(safeValue, 10) : null;
        return { ...prev, graduationYear: numValue };
      }
      
      // Sanitize text inputs to prevent XSS
      if (field === 'fullName') {
        sanitizedValue = truncateString(sanitizeHtml(safeValue), INPUT_LIMITS.MAX_NAME_LENGTH);
      } else if (field === 'sport') {
        sanitizedValue = truncateString(sanitizeHtml(safeValue), INPUT_LIMITS.MAX_SPORT_LENGTH);
      } else if (field === 'position') {
        sanitizedValue = truncateString(sanitizeHtml(safeValue), INPUT_LIMITS.MAX_POSITION_LENGTH);
      } else if (field === 'location') {
        sanitizedValue = truncateString(sanitizeHtml(safeValue), INPUT_LIMITS.MAX_LOCATION_LENGTH);
      }
      
      const next = { ...prev, [field]: sanitizedValue };
      if (field === "fullName") {
        next.initials = deriveInitials(sanitizedValue as string);
      }
      return next;
    });
    
    if (errors?.[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleTagsChange = (value: string) => {
    // Safety check: ensure value is a string
    const safeValue = typeof value === 'string' ? value : '';
    setTagsInputValue(safeValue);
    
    const sanitizedTags = sanitizeTagsFromString(safeValue);
    setFormData((prev) => {
      if (!prev) return emptyProfile;
      return { ...prev, tags: Array.isArray(sanitizedTags) ? sanitizedTags : [] };
    });
    
    if (errors?.tags && Array.isArray(sanitizedTags) && sanitizedTags.length > 0) {
      setErrors((prev) => ({ ...prev, tags: undefined }));
    }
  };
  
  const handleSportChange = (value: string) => {
    // Safety check: ensure value is a string
    const safeValue = typeof value === 'string' ? value : '';
    
    setFormData((prev) => {
      if (!prev) return emptyProfile;
      return { ...prev, sport: safeValue, position: "" };
    });
    
    if (errors?.sport) {
      setErrors((prev) => ({ ...prev, sport: undefined }));
    }
  };
  
  const handleGenderChange = (value: GenderValue) => {
    setFormData((prev) => {
      if (!prev) return emptyProfile;
      return { ...prev, gender: value };
    });
    
    if (errors?.gender) {
      setErrors((prev) => ({ ...prev, gender: undefined }));
    }
  };

  const handleLocationResolved = (info: LocationInfo | null, isValid: boolean) => {
    const formatted = isValid ? formatLocationDisplay(info || null) : "";
    setResolvedLocation(formatted);
    setIsLocationValid(isValid && Boolean(formatted));
    setFormData((prev) => {
      if (!prev) return emptyProfile;
      return { ...prev, location: formatted || prev.location };
    });
    if (!isValid && formData.zipCode) {
      setErrors((prev) => ({ ...prev, zipCode: "Enter a valid zip code to resolve location." }));
    } else if (errors?.zipCode) {
      setErrors((prev) => ({ ...prev, zipCode: undefined }));
    }
  };
  
  const handleZipCodeChange = (value: string) => {
    const safeValue = typeof value === 'string' ? value : '';
    
    setFormData((prev) => {
      if (!prev) return emptyProfile;
      return { ...prev, zipCode: safeValue };
    });
    setResolvedLocation("");
    setIsLocationValid(false);
    
    if (errors?.zipCode) {
      setErrors((prev) => ({ ...prev, zipCode: undefined }));
    }
  };
  
  const handleCurrentlyStudyingChange = (checked: boolean) => {
    setIsCurrentlyStudying(checked);
    
    if (checked) {
      // When checked, set graduation year to current year and reset year level
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      setFormData((prev) => ({
        ...prev,
        graduationYear: currentYear.toString()
      }));
      setCurrentYearLevel("");
    } else {
      // When unchecked, clear year level
      setCurrentYearLevel("");
    }
  };
  
  const handleYearLevelChange = (value: string) => {
    const normalizedYearLevel = normalizeAcademicYear(value) || "";
    setCurrentYearLevel(normalizedYearLevel);
    
    // Calculate graduation year based on year level
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const graduationOffset = getAcademicYearGraduationOffset(normalizedYearLevel) ?? 0;
    const calculatedGradYear = currentYear + graduationOffset;
    
    setFormData((prev) => ({
      ...prev,
      graduationYear: calculatedGradYear.toString()
    }));
  };
  
  const handlePhoneChange = (value: string) => {
    const safeValue = typeof value === 'string' ? value : '';
    const normalizedPhone = normalizePhone(safeValue);
    
    setFormData((prev) => {
      if (!prev) return emptyProfile;
      return { ...prev, phoneNumber: normalizedPhone };
    });
    
    if (errors?.phoneNumber) {
      setErrors((prev) => ({ ...prev, phoneNumber: undefined }));
    }
  };

  // image helpers are provided by utils/imageUtils

  // Phase 2: Cropping functions
  const handleProfileCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setProfileCroppedArea(croppedAreaPixels);
  }, []);

  const handleCoverCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCoverCroppedArea(croppedAreaPixels);
  }, []);

  const handleProfileMediaLoaded = useCallback(
    (mediaSize: { width: number; height: number }) => {
      profileMediaSizeRef.current = mediaSize;
      if (!profileCropSize) return;
      const minZoom = Math.min(
        profileCropSize.width / mediaSize.width,
        profileCropSize.height / mediaSize.height
      );
      setProfileMinZoom(minZoom);
      if (!profileZoomInitializedRef.current) {
        setProfileZoom(minZoom);
        profileZoomInitializedRef.current = true;
      }
    },
    [profileCropSize]
  );

  const handleCoverMediaLoaded = useCallback(
    (mediaSize: { width: number; height: number }) => {
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
    },
    [coverCropSize]
  );

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
    setCoverCropPosition({ x: 0, y: 0 });
    setCoverCropSize(null);
    setCoverMinZoom(1);
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
      
      if (!next) {
        // No more files to process - close the cropper completely
        closeCoverCropper();
      } else {
        // More files to process - set up the next one
        setCurrentCoverFile(next);
        setCropCoverFile(next);
        setCoverCroppedArea(null);
        setCoverZoom(1);
        setCoverCropPosition({ x: 0, y: 0 });
        setCoverPreviewUrl(null);
        setCoverBgColor("#f1f5f9");
        coverZoomInitializedRef.current = false;
      }
      
      return rest;
    });
  };

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>, type: "profile" | "cover") => {
    // Safety checks for event and files
    if (!e?.target?.files || e.target.files.length === 0) return;
    
    const files = e.target.files;

    if (type === "profile") {
      const file = files[0];
      
      // Safety check: ensure file exists
      if (!file) return;
      
      // Validate file type
      const validation = validateImageFile(file);
      if (!validation.valid) {
        toast({
          title: "Invalid file type",
          description: ('error' in validation ? validation.error : undefined) || "Invalid file type",
          variant: "destructive",
        });
        e.target.value = "";
        return;
      }
      
      if (file.size > MAX_PROFILE_IMAGE_SIZE) {
        toast({
          title: "File too large",
          description: "Profile image must be less than 8MB. Compress or crop your image.",
          variant: "destructive",
        });
        e.target.value = "";
        return;
      }
      
      // Validate actual file content (magic bytes)
      const isValidImage = await validateImageMagicBytes(file);
      if (!isValidImage) {
        toast({
          title: "Invalid image file",
          description: "The file does not appear to be a valid image.",
          variant: "destructive",
        });
        e.target.value = "";
        return;
      }

      // Phase 2: Use cropper
      setCropProfileFile(file);
      setShowProfileCropper(true);
    } else {
      if (coverImages.length >= MAX_COVER_IMAGES) {
        toast({
          title: "Limit reached",
          description: `You can only upload ${MAX_COVER_IMAGES} cover images.`,
          variant: "destructive",
        });
        e.target.value = "";
        return;
      }

      const remainingSlots = MAX_COVER_IMAGES - coverImages.length;
      const validFiles: File[] = [];
      
      // Validate all files first
      for (const file of Array.from(files).slice(0, remainingSlots)) {
        const validation = validateImageFile(file);
        if (!validation.valid) {
          toast({
            title: "Invalid file type",
            description: `${file.name}: ${('error' in validation ? validation.error : undefined) || 'Invalid file type'}`,
            variant: "destructive",
          });
          continue;
        }
        
        if (file.size > MAX_COVER_IMAGE_SIZE) {
          toast({
            title: "File too large",
            description: `${file.name} is larger than 10MB.`,
            variant: "destructive",
          });
          continue;
        }
        
        const isValidImage = await validateImageMagicBytes(file);
        if (!isValidImage) {
          toast({
            title: "Invalid image",
            description: `${file.name} is not a valid image file.`,
            variant: "destructive",
          });
          continue;
        }
        
        validFiles.push(file);
      }
      
      if (validFiles.length > 0) {
        // Phase 2: Use cropper
        setPendingCoverFiles(validFiles);
        setCurrentCoverFile(validFiles[0]);
        setCropCoverFile(validFiles[0]);
        setShowCoverCropper(true);
      }
    }
    e.target.value = "";
  }, [coverImages.length, toast]);

  const removeCoverImage = (index: number) => {
    // Safety checks: ensure index is valid
    if (typeof index !== 'number' || index < 0) return;
    
    // Get the URL being removed before updating state
    if (Array.isArray(coverImages) && coverImages[index]) {
      const urlToRemove = coverImages[index];

      // Notify parent BEFORE removing from local state (pass the actual URL)
      onCoverImageRemove?.(urlToRemove);
    }
    
    // Then remove from local preview
    setCoverImages((prev) => {
      if (!Array.isArray(prev)) return [];
      return prev.filter((_, i) => i !== index);
    });
  };

  // Phase 2: Crop handler functions
  const handleProfileCropSave = async () => {
    try {
      if (!cropProfileFile || !profileCroppedArea) {
        toast({ title: "Crop image", description: "Please adjust the crop before saving.", variant: "destructive" });
        return;
      }
      if (!profileObjectUrl) {
        toast({ title: "Crop image", description: "Image is not ready yet.", variant: "destructive" });
        return;
      }
      const profileImage = await loadImageElement(profileObjectUrl);
      const croppedFile = await getCroppedFile(
        cropProfileFile,
        profileCroppedArea,
        "-profile",
        undefined,
        profileImage,
        1
      );
      const preview = await fileToDataUrl(croppedFile);
      setFormData((prev) => ({ ...prev, profileImageUrl: preview }));
      onImageSelect?.(croppedFile);
      closeProfileCropper();
    } catch (err) {
      console.error('Profile crop failed', err);
      toast({ title: "Crop failed", description: "Could not crop profile image.", variant: "destructive" });
    }
  };

  const handleProfileCropCancel = () => {
    closeProfileCropper();
  };

  const handleCoverCropSave = async () => {
    try {
      if (!currentCoverFile || !coverCroppedArea) {
        toast({ title: "Crop image", description: "Please adjust the crop before saving.", variant: "destructive" });
        return;
      }
      if (!coverObjectUrl) {
        toast({ title: "Crop image", description: "Image is not ready yet.", variant: "destructive" });
        return;
      }
      const coverImage = await loadImageElement(coverObjectUrl);
      const croppedFile = await getCroppedFile(
        currentCoverFile,
        coverCroppedArea,
        "-cover",
        coverBgColor,
        coverImage,
        1
      );
      const preview = await fileToDataUrl(croppedFile);
      setCoverImages((prev) => sanitizeImages([...prev, preview]));
      onCoverImagesSelect?.([croppedFile]);
      advanceCoverQueue();
    } catch (err) {
      console.error('Cover crop failed', err);
      toast({ title: "Crop failed", description: "Could not crop cover image.", variant: "destructive" });
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
      setFormData((prev) => ({ ...prev, profileImageUrl: preview }));
      onImageSelect?.(cropProfileFile);
      closeProfileCropper();
    } catch (err) {
      console.error('Use full profile image failed', err);
      toast({ title: "Failed", description: "Could not load the full image.", variant: "destructive" });
    }
  };

  const handleUseFullCoverImage = async () => {
    try {
      if (!currentCoverFile) return;
      const preview = await fileToDataUrl(currentCoverFile);
      setCoverImages((prev) => sanitizeImages([...prev, preview]));
      onCoverImagesSelect?.([currentCoverFile]);
      advanceCoverQueue();
    } catch (err) {
      console.error('Use full cover image failed', err);
      toast({ title: "Failed", description: "Could not load the full image.", variant: "destructive" });
      advanceCoverQueue();
    }
  };

  const handleSave = async () => {
    setErrors({});
    
    // Safety checks before validation
    if (!formData) {
      setErrors({ form: "Profile data is missing. Please refresh and try again." });
      return;
    }

    if (formData.zipCode && !isLocationValid) {
      setErrors((prev) => ({ ...prev, zipCode: "Enter a valid zip code to resolve location." }));
      return;
    }
    
    const payload: AthleteProfileFormData = {
      ...formData,
      tags: Array.isArray(formData.tags) ? formData.tags : [],
      coverImageUrls: Array.isArray(coverImages) ? coverImages : [],
    };

    const validation = profileSchema.safeParse(payload);
    if (!validation.success) {
      const fieldErrors: Partial<Record<keyof AthleteProfileFormData | "form", string>> = {};
      validation.error.issues.forEach((issue) => {
        const fieldName = issue.path[0];
        if (fieldName && typeof fieldName === "string") {
          fieldErrors[fieldName as keyof AthleteProfileFormData] = issue.message;
        } else {
          fieldErrors.form = issue.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    try {
      setIsSaving(true);
      
      // Safety check: ensure onSave callback exists
      if (typeof onSave !== 'function') {
        throw new Error('Save function is not available');
      }
      
      // Prepare the data to save with conditional graduation_year/current_year logic
      const dataToSave = {
        ...formData,
        ...validation.data,
        coverImageUrls: Array.isArray(coverImages) ? coverImages : [],
        profileImageUrl: validation.data.profileImageUrl ?? null,
        location: (resolvedLocation || formData.location || "").trim(),
      };
      
      // Handle graduation year logic
      if (isCurrentlyStudying) {
        // If currently studying, save the year level to current_year and clear graduation_year
        dataToSave.currentYear = currentYearLevel;
        dataToSave.graduationYear = null;
      } else {
        // If not currently studying, save graduation year and clear current_year
        dataToSave.currentYear = null;
        // graduationYear is already in formData
      }
      
      await onSave(dataToSave);
      
      // Wait a moment for ProfileContext/AuthContext state updates to propagate
      // before closing the dialog so the page displays fresh data
      await new Promise(resolve => setTimeout(resolve, 300));
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save profile", error);
      const errorMessage = error instanceof Error ? error.message : "Something went wrong while saving. Please try again.";
      setErrors((prev) => ({
        ...prev,
        form: errorMessage,
      }));
    } finally {
      setIsSaving(false);
    }
  };

  // Phase 2: Cropper UI and logic
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
                  ref={coverCropContainerRef}
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
                      onCropChange={setCoverCropPosition}
                      onCropComplete={handleCoverCropComplete}
                      onZoomChange={setCoverZoom}
                      onMediaLoaded={handleCoverMediaLoaded}
                      restrictPosition={false}
                      objectFit="contain"
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
              <div className="flex flex-wrap items-center gap-4">
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        // Phase 2: cropActive logic
        aria-hidden={cropActive ? "true" : "false"}
        data-crop-open={cropActive ? "true" : "false"}
        style={cropActive ? { pointerEvents: "none" } : undefined}
      >
        <DialogClose asChild>
          {/* <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            aria-label="Close"
          > */}
            {/* <X className="h-4 w-4" /> */}
          {/* </Button> */}
        </DialogClose>
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>Update how coaches and teammates see your profile.</DialogDescription>
        </DialogHeader>

        {errors.form && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errors.form}
          </div>
        )}

        <div className="grid gap-6 py-4">
          <div className="flex flex-col gap-2">
            <Label>Profile Image</Label>
            <div className="flex items-center gap-4">
              <div 
                className="h-20 w-20 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => profileImageInputRef.current?.click()}
              >
                {formData?.profileImageUrl && typeof formData.profileImageUrl === 'string' ? (
                  <img src={formData.profileImageUrl} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-slate-400">
                    {formData?.initials || "NA"}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Input 
                  ref={profileImageInputRef}
                  type="file" 
                  accept="image/jpeg,image/jpg,image/png,image/webp" 
                  onChange={(e) => handleFileChange(e, "profile")} 
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => profileImageInputRef.current?.click()}
                >
                  Upload Photo
                </Button>
                {formData?.profileImageUrl && typeof formData.profileImageUrl === 'string' && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-fit px-2 py-1 text-xs text-muted-foreground"
                    onClick={() => setFormData((prev) => ({ ...prev, profileImageUrl: null }))}
                  >
                    Remove photo
                  </Button>
                )}
            <p className="text-xs text-muted-foreground">JPG, PNG, or WebP up to 8MB. Aspect Ratio 1:1</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Cover Images (Max {MAX_COVER_IMAGES})</Label>
            <div className="grid grid-cols-3 gap-2 mb-2">
              {Array.isArray(coverImages) && coverImages.map((img, idx) => (
                typeof img === 'string' && img.trim() !== '' && (
                  <div
                    key={`${idx}-${img.substring(0, 20)}`}
                    className="relative aspect-video bg-slate-100 rounded-md overflow-hidden group transition-all duration-300 hover:scale-[1.02] hover:shadow-lg/40 animate-in fade-in-50 cursor-pointer"
                    onClick={() => coverImageInputRef.current?.click()}
                  >
                    <img
                      src={img}
                      alt={`Cover ${idx + 1}`}
                      className="h-full w-full object-cover transition-opacity duration-300"
                    />
                    <button
                      type="button"
                      aria-label="Remove cover image"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeCoverImage(idx);
                      }}
                      className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )
              ))}
              {(!Array.isArray(coverImages) || coverImages.length < MAX_COVER_IMAGES) && (
                <div 
                  className="aspect-video bg-slate-50 border-2 border-dashed border-slate-200 rounded-md flex items-center justify-center transition-all duration-300 hover:border-slate-300 hover:bg-slate-50/80 animate-in fade-in-50 cursor-pointer"
                  onClick={() => coverImageInputRef.current?.click()}
                >
                  <ImageIcon className="h-6 w-6 text-slate-300" />
                </div>
              )}
            </div>
            <Input
              ref={coverImageInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              multiple
              disabled={Array.isArray(coverImages) && coverImages.length >= MAX_COVER_IMAGES}
              onChange={(e) => handleFileChange(e, "cover")}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => coverImageInputRef.current?.click()}
              disabled={Array.isArray(coverImages) && coverImages.length >= MAX_COVER_IMAGES}
            >
              Add Cover Images
            </Button>
            <p className="text-xs text-muted-foreground">JPG, PNG, or WebP. Max 10MB per image. Up to {MAX_COVER_IMAGES} images. Aspect Ratio 4:3</p>
            <FieldError message={errors.coverImageUrls} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={formData?.fullName || ''}
              onChange={(e) => handleInputChange("fullName", e.target.value)}
              aria-invalid={Boolean(errors?.fullName)}
            />
            <FieldError message={errors?.fullName} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="sport">Sport</Label>
            <Select
              value={formData?.sport || undefined}
              onValueChange={handleSportChange}
            >
              <SelectTrigger id="sport">
                <SelectValue placeholder="Select sport" />
              </SelectTrigger>
              <SelectContent>
                {Array.isArray(ATHLETE_SPORTS_OPTIONS) && ATHLETE_SPORTS_OPTIONS.map((option) => (
                  option?.value && option?.label && (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  )
                ))}
              </SelectContent>
            </Select>
            <FieldError message={errors?.sport} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="position">Position</Label>
            <Select
              value={formData?.position || undefined}
              onValueChange={(value) => handleInputChange("position", value)}
              disabled={!formData?.sport}
            >
              <SelectTrigger id="position">
                <SelectValue
                  placeholder={
                    formData?.sport
                      ? "Select position"
                      : "Select a sport first"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {Array.isArray(availablePositions) && availablePositions.map((option) => (
                  option?.value && option?.label && (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  )
                ))}
              </SelectContent>
            </Select>
            <FieldError message={errors?.position} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="dateOfBirth">Date of Birth</Label>
            <Input
              id="dateOfBirth"
              type="date"
              value={formData?.dateOfBirth || ''}
              onChange={(e) => handleInputChange("dateOfBirth", e.target.value)}
              aria-invalid={Boolean(errors?.dateOfBirth)}
            />
            <FieldError message={errors?.dateOfBirth} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="phoneNumber">Phone Number</Label>
            <Input
              id="phoneNumber"
              type="tel"
              placeholder="+1234567890"
              value={formData?.phoneNumber || ''}
              onChange={(e) => handlePhoneChange(e.target.value)}
              aria-invalid={Boolean(errors?.phoneNumber)}
            />
            <FieldError message={errors?.phoneNumber} />
          </div>

          {/* <div className="grid gap-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={formData?.location || ""}
              onChange={(e) => handleInputChange("location", e.target.value)}
              aria-invalid={Boolean(errors?.location)}
            />
            <FieldError message={errors?.location} />
          </div> */}

          <GenderSelect
            value={formData?.gender || ''}
            onChange={handleGenderChange}
            disabled={isSaving}
            error={errors?.gender}
            id="gender"
            showLabel={true}
            label={genderLabel || "Gender"}
            size="md"
          />

          <ZipCodeInput
            value={formData?.zipCode || ''}
            onChange={handleZipCodeChange}
            disabled={isSaving}
            error={errors?.zipCode}
            id="zipCode"
            showLabel={true}
            onLocationResolved={handleLocationResolved}
          />

          <div className="grid gap-2">
            <Label htmlFor="graduationYear">High School Grad Year (if applicable)</Label>
            <Input
              id="graduationYear"
              type="number"
              placeholder=""
              min="1950"
              max={new Date().getFullYear() + 10}
              value={formData?.graduationYear || ''}
              onChange={(e) => handleInputChange("graduationYear", e.target.value)}
              aria-invalid={Boolean(errors?.graduationYear)}
              disabled={isCurrentlyStudying}
              className={isCurrentlyStudying ? "bg-gray-100 cursor-not-allowed" : ""}
            />
            <FieldError message={errors?.graduationYear} />
            
            <div className="flex items-center space-x-2 mt-2">
              <Checkbox
                id="currentlyStudying"
                checked={isCurrentlyStudying}
                onCheckedChange={handleCurrentlyStudyingChange}
              />
              <label
                htmlFor="currentlyStudying"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                I am currently studying
              </label>
            </div>
            
            {isCurrentlyStudying && (
              <div className="mt-2">
                <Label htmlFor="currentYearLevel">What year are you in?</Label>
                <Select
                  value={currentYearLevel}
                  onValueChange={handleYearLevelChange}
                >
                  <SelectTrigger id="currentYearLevel">
                    <SelectValue placeholder="Select year level" />
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
          </div>

          {/* <div className="grid gap-2">
            <Label htmlFor="tags">Tags (one per line)</Label>
            <Textarea
              id="tags"
              value={tagsInputValue || ''}
              onChange={(e) => handleTagsChange(e.target.value)}
              rows={4}
              aria-invalid={Boolean(errors?.tags)}
            />
            <p className="text-xs text-muted-foreground">
              Highlight skills or affiliations. {MAX_TAGS - (Array.isArray(formData?.tags) ? formData.tags.length : 0)} slots left.
            </p>
            <FieldError message={errors?.tags} />
          </div> */}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {profileCropperOverlay}
    {coverCropperOverlay}
    </>
  );
};



