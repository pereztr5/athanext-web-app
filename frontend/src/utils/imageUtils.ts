import type { Area } from 'react-easy-crop';

export const fileToDataUrl = (file: File): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

export const createCroppedPreview = (imageSrc: string, crop: Area, backgroundColor: string): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not supported'));
        return;
      }
      canvas.width = Math.max(1, Math.floor(crop.width));
      canvas.height = Math.max(1, Math.floor(crop.height));
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(
        image,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        canvas.width,
        canvas.height
      );
      resolve(canvas.toDataURL('image/jpeg'));
    };
    image.onerror = () => reject(new Error('Failed to load image'));
    image.src = imageSrc;
  });

export const loadImageElement = (imageSrc: string): Promise<HTMLImageElement> =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image'));
    image.src = imageSrc;
  });

/**
 * Get a cropped image file from an original file and crop area
 * @param file - The original image file
 * @param croppedAreaPixels - The crop area in pixels
 * @param suffix - Suffix to add to the filename (e.g., '-profile', '-cover')
 * @param backgroundColor - Optional background color for transparent areas
 * @param image - Optional pre-loaded image element (for advanced usage)
 * @param scale - Optional scale factor (for advanced usage with pre-loaded images)
 * @returns A promise that resolves to the cropped image file
 */
export const getCroppedFile = (
  file: File,
  croppedAreaPixels: Area | null,
  suffix: string,
  backgroundColor?: string,
  image?: HTMLImageElement,
  scale: number = 1
): Promise<File> =>
  new Promise<File>((resolve, reject) => {
    if (!croppedAreaPixels) return reject(new Error('No crop area available'));
    
    // If image is already provided, use it directly
    if (image) {
      processCrop(file, image, croppedAreaPixels, scale, suffix, backgroundColor, resolve, reject);
      return;
    }
    
    // Otherwise, load the image from file
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      processCrop(file, img, croppedAreaPixels, 1, suffix, backgroundColor, resolve, reject);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for cropping'));
    };
  });

/**
 * Internal helper to process the actual cropping
 */
function processCrop(
  file: File,
  image: HTMLImageElement,
  croppedAreaPixels: Area,
  scale: number,
  suffix: string,
  backgroundColor: string | undefined,
  resolve: (value: File) => void,
  reject: (reason: Error) => void
) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    reject(new Error('Canvas not supported'));
    return;
  }
  
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const { width, height, x, y } = croppedAreaPixels;
  
  const cropX = (x * scaleX) / scale;
  const cropY = (y * scaleY) / scale;
  const cropWidth = (width * scaleX) / scale;
  const cropHeight = (height * scaleY) / scale;
  
  canvas.width = Math.max(1, Math.floor(cropWidth));
  canvas.height = Math.max(1, Math.floor(cropHeight));
  
  if (backgroundColor) {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  
  ctx.drawImage(
    image,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    canvas.width,
    canvas.height
  );
  
  canvas.toBlob((blob) => {
    if (!blob) {
      reject(new Error('Failed to crop image'));
      return;
    }
    const ext = file.name.split('.').pop() || 'jpg';
    const base = file.name.replace(/\.[^.]+$/, '');
    const newFile = new File([blob], `${base}${suffix}.${ext}`, { type: file.type || 'image/jpeg' });
    resolve(newFile);
  }, file.type || 'image/jpeg');
}

export default {
  fileToDataUrl,
  createCroppedPreview,
  loadImageElement,
  getCroppedFile,
};
