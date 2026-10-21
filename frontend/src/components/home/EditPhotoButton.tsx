/**
 * "Edit photo" for the athlete card (Home edit dialog and Account). Picks an image and uploads
 * it straight away; the card and the account avatar update when it's saved.
 */
import { useRef, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera } from "@/components/icons";
import { athleteHomeAPI } from "@/api/athleteHome";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export const EditPhotoButton = ({
  athleteId,
  photo,
  isParent,
  className,
  children = "Edit photo",
}: {
  athleteId: string;
  photo: string | null;
  isParent: boolean;
  className?: string;
  children?: ReactNode;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { setUserImg, refreshUserProfile } = useAuth();

  const upload = useMutation({
    mutationFn: (file: File) => athleteHomeAPI.uploadPhoto(athleteId, file, { previousUrl: photo, isAccountPhoto: !isParent }),
    onSuccess: async (url) => {
      await queryClient.invalidateQueries({ queryKey: ["athlete-home"] });
      if (!isParent) {
        setUserImg(url);
        await refreshUserProfile();
      }
      toast({ title: "Photo updated" });
    },
    onError: (err: unknown) =>
      toast({
        title: "Couldn't upload the photo",
        description: err && typeof err === "object" && "message" in err ? String(err.message) : "Try again.",
        variant: "destructive",
      }),
  });

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) upload.mutate(file);
        }}
      />
      <button type="button" className={className} disabled={upload.isPending} onClick={() => inputRef.current?.click()}>
        <Camera strokeWidth={1.5} aria-hidden="true" />
        {upload.isPending ? "Uploading…" : children}
      </button>
    </>
  );
};
