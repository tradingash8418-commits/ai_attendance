/**
 * Client-side high-performance image compression utility.
 * Compresses high-resolution camera photos (5-15MB) down to crisp ~200KB JPEGs (1280px max)
 * before network upload to prevent Vercel 413 Payload Too Large errors while preserving
 * full YuNet / SFace AI facial recognition accuracy.
 */
export async function compressImageFile(
  file: File,
  maxDimension = 1280,
  quality = 0.85
): Promise<File> {
  // If file is already smaller than 400KB, no compression needed
  if (file.size < 400 * 1024 && file.type === 'image/jpeg') {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }

            const cleanFileName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
            const compressedFile = new File([blob], cleanFileName, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });

            console.log(
              `[ImageCompress] Compressed ${file.name} from ${(file.size / 1024 / 1024).toFixed(2)} MB to ${(compressedFile.size / 1024).toFixed(1)} KB (${width}x${height})`
            );

            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };

    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}
