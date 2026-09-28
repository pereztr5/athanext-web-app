import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Image as ImageIcon, Loader2, X } from 'lucide-react';

const navButtonClass =
    "absolute top-1/2 -translate-y-1/2 inline-flex size-[34px] items-center justify-center rounded-[8px] border border-[#EAEADF] bg-[#F7F7F0]/90 text-[#1A202C] transition-colors hover:bg-[#F7F7F0]";

interface CarouselProps {
    photos: string[];
    altTextPrefix: string;
    enablePreview?: boolean;
    imageFit?: "cover" | "contain";
    containUntilLg?: boolean;
    aspect?: "fixed" | "cover3x1";
}

export function Carousel({
    photos,
    altTextPrefix,
    enablePreview = false,
    imageFit = "cover",
    containUntilLg = false,
    aspect = "fixed",
}: CarouselProps) {
    const loadedImageCacheRef = useRef<Set<string>>(new Set());
    const safePhotos = useMemo(() => photos.filter(Boolean), [photos]);
    const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [isImageLoading, setIsImageLoading] = useState(true);
    const [isImageError, setIsImageError] = useState(false);
    const portalTarget = typeof document !== 'undefined' ? document.body : null;
    const hasMultiplePhotos = safePhotos.length >= 2;
    const hasNoPhotos = safePhotos.length === 0;
    const fitClass = containUntilLg
        ? "object-contain lg:object-cover"
        : imageFit === "contain"
        ? "object-contain"
        : "object-cover";
    const currentPhoto = safePhotos[currentPhotoIndex];
    const frameClass =
        aspect === "cover3x1"
            ? "relative w-full h-[200px] md:h-[250px] lg:h-[550px]"
            : "relative w-full h-[300px] md:h-[400px]";

    useEffect(() => {
        if (currentPhotoIndex >= safePhotos.length) {
            setCurrentPhotoIndex(0);
        }
    }, [currentPhotoIndex, safePhotos.length]);

    useEffect(() => {
        if (!currentPhoto) return;
        if (loadedImageCacheRef.current.has(currentPhoto)) {
            setIsImageLoading(false);
            setIsImageError(false);
            return;
        }
        setIsImageLoading(true);
        setIsImageError(false);
    }, [currentPhoto]);

    const nextPhoto = () => {
        setCurrentPhotoIndex((prev) => (prev + 1) % safePhotos.length);
    };

    const prevPhoto = () => {
        setCurrentPhotoIndex((prev) => (prev - 1 + safePhotos.length) % safePhotos.length);
    };

    // When no photos are available, show a grayed-out placeholder
    if (hasNoPhotos) {
        return (
            <div className={`${frameClass} flex items-center justify-center rounded-[8px] bg-[#F4F4EB]`}>
                <div className="flex flex-col items-center gap-2 text-center">
                    <ImageIcon className="size-6 text-[#A3A6AB]" strokeWidth={1.5} aria-hidden="true" />
                    <p className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">No cover photo yet</p>
                </div>
            </div>
        );
    }

    return (
        <>
        <div className={`${frameClass} overflow-hidden rounded-[8px] bg-[#F4F4EB]`}>
            <img
                src={currentPhoto}
                alt={`${altTextPrefix || 'Photo'} ${currentPhotoIndex + 1}`}
                className={`w-full h-full ${fitClass} rounded-[8px] !border-0 !ring-0 !outline-none bg-[#F4F4EB] ${isImageLoading ? "opacity-0" : "opacity-100"} transition-opacity duration-300`}
                onClick={enablePreview ? () => setPreviewOpen(true) : undefined}
                role={enablePreview ? 'button' : undefined}
                tabIndex={enablePreview ? 0 : -1}
                onKeyDown={enablePreview ? (e) => { if (e.key === 'Enter' || e.key === ' ') setPreviewOpen(true); } : undefined}
                onLoad={() => {
                    if (currentPhoto) {
                        loadedImageCacheRef.current.add(currentPhoto);
                    }
                    setIsImageLoading(false);
                }}
                onError={() => {
                    setIsImageLoading(false);
                    setIsImageError(true);
                }}
            />
            {(isImageLoading || isImageError) && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#F4F4EB]">
                    {isImageError ? (
                        <p className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">This photo couldn't load.</p>
                    ) : (
                        <div className="flex items-center gap-2 text-[#767980]">
                            <Loader2 className="size-4 animate-spin" strokeWidth={1.5} aria-hidden="true" />
                            <span className="text-[14px] leading-[18px] tracking-[-0.03em]">Loading photo</span>
                        </div>
                    )}
                </div>
            )}

            {/* Navigation Arrows */}
            {hasMultiplePhotos && (
                <>
                    <button
                        type="button"
                        onClick={prevPhoto}
                        className={`${navButtonClass} left-4`}
                        aria-label="Previous photo"
                    >
                        <ChevronLeft className="size-4" strokeWidth={1.5} />
                    </button>
                    <button
                        type="button"
                        onClick={nextPhoto}
                        className={`${navButtonClass} right-4`}
                        aria-label="Next photo"
                    >
                        <ChevronRight className="size-4" strokeWidth={1.5} />
                    </button>
                </>
            )}

            {/* Photo Indicators */}
            {hasMultiplePhotos && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    {safePhotos.map((_, index) => (
                        <button
                            type="button"
                            key={index}
                            onClick={() => setCurrentPhotoIndex(index)}
                            className={`h-[5px] rounded-[10px] transition-all ${index === currentPhotoIndex
                                ? 'w-6 bg-[#F7F7F0]'
                                : 'w-[5px] bg-[#F7F7F0]/60'
                                }`}
                            aria-label={`Go to photo ${index + 1}`}
                        />
                    ))}
                </div>
            )}
        </div>

        {enablePreview && previewOpen && portalTarget && safePhotos[currentPhotoIndex] && createPortal(
            <div className="fixed inset-0 z-[2100] bg-black/80 flex items-center justify-center px-4">
                <div className="absolute inset-0" onClick={() => setPreviewOpen(false)} />
                <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col gap-3 z-[2101]">
                    <button
                        type="button"
                        aria-label="Close preview"
                        className="absolute -top-10 right-0 text-[#F1F1E6]/90 hover:text-[#F1F1E6]"
                        onClick={() => setPreviewOpen(false)}
                    >
                        <X className="size-6" strokeWidth={1.5} />
                    </button>
                    <div className="relative w-full h-full max-h-[80vh] bg-black/30 rounded-[10px] overflow-hidden flex items-center justify-center">
                        <img
                            src={safePhotos[currentPhotoIndex]}
                            alt={`${altTextPrefix || 'Photo'} ${currentPhotoIndex + 1}`}
                            className="max-h-[80vh] w-auto object-contain"
                        />
                        {hasMultiplePhotos && (
                            <>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); prevPhoto(); }}
                                    className={`${navButtonClass} left-4`}
                                    aria-label="Previous photo"
                                >
                                    <ChevronLeft className="size-4" strokeWidth={1.5} />
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); nextPhoto(); }}
                                    className={`${navButtonClass} right-4`}
                                    aria-label="Next photo"
                                >
                                    <ChevronRight className="size-4" strokeWidth={1.5} />
                                </button>
                            </>
                        )}
                    </div>
                    {hasMultiplePhotos && (
                        <div className="flex items-center justify-center gap-2">
                            {safePhotos.map((_, index) => (
                                <button
                                    type="button"
                                    key={index}
                                    onClick={() => setCurrentPhotoIndex(index)}
                                    className={`h-[5px] rounded-[10px] transition-all ${index === currentPhotoIndex ? 'w-6 bg-[#F7F7F0]' : 'w-[5px] bg-[#F7F7F0]/60'}`}
                                    aria-label={`Go to photo ${index + 1}`}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>,
            portalTarget
        )}
        </>
    );
}
