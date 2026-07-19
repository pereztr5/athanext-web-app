import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';

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
            <div className={`${frameClass} bg-gray-300 dark:bg-gray-600 rounded-sm flex items-center justify-center`}>
                <div className="text-center">
                    <p className="text-gray-500 dark:text-gray-400 text-sm">No cover image available</p>
                </div>
            </div>
        );
    }

    return (
        <>
        <div className={`${frameClass} overflow-hidden`}>
            <img
                src={currentPhoto}
                alt={`${altTextPrefix || 'Photo'} ${currentPhotoIndex + 1}`}
                className={`w-full h-full ${fitClass} rounded-sm !border-0 !ring-0 !outline-none bg-black ${isImageLoading ? "opacity-0" : "opacity-100"} transition-opacity duration-300`}
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
                <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                    {isImageError ? (
                        <p className="text-sm text-slate-500">Image failed to load.</p>
                    ) : (
                        <div className="flex items-center gap-2 text-slate-500">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span className="text-sm">Loading image...</span>
                        </div>
                    )}
                </div>
            )}

            {/* Navigation Arrows */}
            {hasMultiplePhotos && (
                <>
                    <button
                        onClick={prevPhoto}
                        className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-800 rounded-full p-2 shadow-lg transition-colors"
                        aria-label="Previous photo"
                    >
                        <ChevronLeft className="h-6 w-6 text-slate-900 dark:text-white" />
                    </button>
                    <button
                        onClick={nextPhoto}
                        className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-800 rounded-full p-2 shadow-lg transition-colors"
                        aria-label="Next photo"
                    >
                        <ChevronRight className="h-6 w-6 text-slate-900 dark:text-white" />
                    </button>
                </>
            )}

            {/* Photo Indicators */}
            {hasMultiplePhotos && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    {safePhotos.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setCurrentPhotoIndex(index)}
                            className={`h-2 rounded-full transition-all ${index === currentPhotoIndex
                                ? 'w-8 bg-white'
                                : 'w-2 bg-white/60'
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
                        aria-label="Close preview"
                        className="absolute -top-10 right-0 text-white/90 hover:text-white"
                        onClick={() => setPreviewOpen(false)}
                    >
                        <X className="h-6 w-6" />
                    </button>
                    <div className="relative w-full h-full max-h-[80vh] bg-black/30 rounded-md overflow-hidden flex items-center justify-center">
                        <img
                            src={safePhotos[currentPhotoIndex]}
                            alt={`${altTextPrefix || 'Photo'} ${currentPhotoIndex + 1}`}
                            className="max-h-[80vh] w-auto object-contain"
                        />
                        {hasMultiplePhotos && (
                            <>
                                <button
                                    onClick={(e) => { e.stopPropagation(); prevPhoto(); }}
                                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-slate-900 rounded-full p-2 shadow-lg"
                                    aria-label="Previous photo"
                                >
                                    <ChevronLeft className="h-6 w-6" />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); nextPhoto(); }}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-slate-900 rounded-full p-2 shadow-lg"
                                    aria-label="Next photo"
                                >
                                    <ChevronRight className="h-6 w-6" />
                                </button>
                            </>
                        )}
                    </div>
                    {hasMultiplePhotos && (
                        <div className="flex items-center justify-center gap-2">
                            {safePhotos.map((_, index) => (
                                <button
                                    key={index}
                                    onClick={() => setCurrentPhotoIndex(index)}
                                    className={`h-2 rounded-full transition-all ${index === currentPhotoIndex ? 'w-8 bg-white' : 'w-2 bg-white/60'}`}
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
