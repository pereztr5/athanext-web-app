/**
 * Crop a profile photo before it uploads (ATH-109): drag to centre it, zoom in, then Save.
 * Same look as the camp cover cropper. Square by default, shown as a circle guide.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Cropper, { type Area } from "react-easy-crop";
import { X } from "@/components/icons";
import { meta, primaryButton, secondaryButton, textButton } from "@/components/schedule/styles";
import { getCroppedFile } from "@/utils/imageUtils";

export const PhotoCropDialog = ({
  file,
  title = "Crop your photo",
  round = true,
  busy = false,
  onCancel,
  onSave,
}: {
  /** The picked image; null keeps the dialog closed. */
  file: File | null;
  title?: string;
  /** Show the guide as a circle (avatars). The saved photo is always a square. */
  round?: boolean;
  /** The parent is uploading the cropped photo. */
  busy?: boolean;
  onCancel: () => void;
  onSave: (cropped: File) => void | Promise<void>;
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cropping, setCropping] = useState(false);
  const objectUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);
  // A new photo starts centred and unzoomed.
  useEffect(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setArea(null);
    setError(null);
  }, [file]);

  const onCropComplete = useCallback((_: Area, pixels: Area) => setArea(pixels), []);

  const save = async () => {
    if (!file || !area) return;
    setCropping(true);
    setError(null);
    try {
      await onSave(await getCroppedFile(file, area, "-cropped"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't crop this photo. Try another one.");
    } finally {
      setCropping(false);
    }
  };

  if (!file || !objectUrl || typeof document === "undefined") return null;
  const working = busy || cropping;

  return createPortal(
    <div className="pointer-events-auto fixed inset-0 z-[2000] flex items-center justify-center bg-dark/50 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-crop-title"
        className="w-full max-w-md rounded-card border border-light-525 bg-light-300 shadow-overlay"
      >
        <div className="flex items-center justify-between gap-2 px-5 py-4">
          <h3 id="photo-crop-title" className="text-section text-dark">
            {title}
          </h3>
          <button type="button" className={textButton} onClick={onCancel} disabled={working} aria-label="Close">
            <X strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
        <div className="h-px bg-light-525" />
        <div className="flex flex-col gap-4 px-5 py-4">
          <div className="relative h-[280px] w-full overflow-hidden rounded-control bg-dark">
            <Cropper
              image={objectUrl}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape={round ? "round" : "rect"}
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
          <span className={meta}>Drag to centre your face. Zoom in to fill the frame.</span>
          <label className="flex items-center gap-3">
            <span className="text-label-sm text-dark-400">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="h-[5px] w-full cursor-pointer accent-primary"
            />
          </label>
          {error ? <span className="text-caption text-error-700">{error}</span> : null}
        </div>
        <div className="h-px bg-light-525" />
        <div className="flex flex-col-reverse gap-2 px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" className={secondaryButton} onClick={onCancel} disabled={working}>
            Cancel
          </button>
          <button type="button" className={primaryButton} disabled={working || !area} onClick={() => void save()}>
            {working ? "Saving…" : "Save photo"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
