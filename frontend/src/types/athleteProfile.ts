export interface AthleteProfileFormData {
  fullName: string;
  initials: string;
  sport: string;
  position: string;
  dateOfBirth: string;
  phoneNumber: string;
  location: string;
  tags: string[];
  pathwayTags: string[];
  profileImageUrl: string | null;
  coverImageUrls: string[];
  graduationYear: string | number | null;
  currentYear: string | null;
  highSchool: string | null;
  gpa: string | number | null;
  height: string | number | null;
  weight: string | number | null;
  dominantHand: string | null;
  gender: string | null;
  zipCode: string | null;
}

export interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: AthleteProfileFormData | null;
  onSave: (profile: AthleteProfileFormData) => Promise<void> | void;
  onImageSelect?: (file: File) => void;
  onCoverImagesSelect?: (files: File[]) => void;
  onCoverImageRemove?: (url: string) => void;
  genderLabel?: string;
}
