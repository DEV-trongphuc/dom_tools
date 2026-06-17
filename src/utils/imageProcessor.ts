export interface ImageOptions {
  format: string; // 'image/webp' | 'image/png' | 'image/jpeg' | 'image/avif'
  quality: number; // 0.0 to 1.0
  resizeMode: 'original' | 'percentage' | 'custom';
  percentage?: number;
  width?: number;
  height?: number;
  crop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

export interface ProcessedResult {
  blob: Blob;
  width: number;
  height: number;
}

/**
 * Formats bytes into a human-readable string.
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Attempts to fetch a remote image URL and convert it to a Blob.
 * Handles CORS issues gracefully.
 */
export async function fetchImageFromUrl(url: string): Promise<Blob> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.blob();
  } catch (error) {
    console.warn('Direct fetch failed. Retrying with image element + crossOrigin anonymous...', error);
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get 2D context for canvas.'));
            return;
          }
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to generate blob from image URL canvas fallback.'));
            }
          }, 'image/png');
        } catch (canvasErr) {
          reject(new Error('CORS Blocked: The server hosting this image does not allow sharing (no Access-Control-Allow-Origin header). Please download the image manually and drag it into the app.'));
        }
      };
      img.onerror = () => {
        reject(new Error('Failed to load image. Verify the URL is correct and public, or try downloading it first.'));
      };
      img.src = url;
    });
  }
}

/**
 * Core image processing using HTML Canvas.
 */
export function processImage(file: Blob | File, options: ImageOptions): Promise<ProcessedResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      
      let sourceX = 0;
      let sourceY = 0;
      let sourceWidth = img.naturalWidth;
      let sourceHeight = img.naturalHeight;
      
      if (options.crop && options.crop.width > 0 && options.crop.height > 0) {
        sourceX = options.crop.x;
        sourceY = options.crop.y;
        sourceWidth = options.crop.width;
        sourceHeight = options.crop.height;
      }
      
      let targetWidth = sourceWidth;
      let targetHeight = sourceHeight;
      
      if (options.resizeMode === 'percentage') {
        const scale = (options.percentage || 100) / 100;
        targetWidth = Math.max(1, Math.round(sourceWidth * scale));
        targetHeight = Math.max(1, Math.round(sourceHeight * scale));
      } else if (options.resizeMode === 'custom') {
        targetWidth = options.width || sourceWidth;
        targetHeight = options.height || sourceHeight;
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get 2D context'));
        return;
      }
      
      if (options.format === 'image/jpeg') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
      }
      
      ctx.drawImage(
        img,
        sourceX, sourceY, sourceWidth, sourceHeight,
        0, 0, targetWidth, targetHeight
      );
      
      const mimeType = options.format;
      const quality = options.quality;
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve({
              blob,
              width: targetWidth,
              height: targetHeight
            });
          } else {
            reject(new Error('Canvas exporting returned null blob.'));
          }
        },
        mimeType,
        quality
      );
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to parse image file.'));
    };
    
    img.src = objectUrl;
  });
}
