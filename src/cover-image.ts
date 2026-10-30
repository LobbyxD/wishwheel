const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const MAX_COVER_BYTES = 280 * 1024;

export class CoverImageError extends Error {
 constructor(public reason: 'type' | 'size' | 'decode') { super(reason); }
}

// Resize phone photos before sending them with the room settings. The final
// data URL fits both the API request limit and the stored cover-image limit.
export async function prepareCoverImage(file: File): Promise<string> {
 if (!/^(image\/(png|jpeg|webp))$/i.test(file.type) &&
     !(file.type === '' && /\.(png|jpe?g|webp)$/i.test(file.name))) throw new CoverImageError('type');
 if (file.size > MAX_UPLOAD_BYTES) throw new CoverImageError('size');
 const url = URL.createObjectURL(file);
 const image = new Image();
 try {
  await new Promise<void>((resolve, reject) => {
   image.onload = () => resolve();
   image.onerror = () => reject(new CoverImageError('decode'));
   image.src = url;
  });
  if (!image.naturalWidth || !image.naturalHeight) throw new CoverImageError('decode');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new CoverImageError('decode');
  for (const edge of [1024, 768, 512]) {
   const scale = Math.min(1, edge / Math.max(image.naturalWidth, image.naturalHeight));
   canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
   canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
   context.fillStyle = '#fff8f0';
   context.fillRect(0, 0, canvas.width, canvas.height);
   context.drawImage(image, 0, 0, canvas.width, canvas.height);
   for (const quality of [0.88, 0.74, 0.6]) {
    let data = canvas.toDataURL('image/webp', quality);
    if (!data.startsWith('data:image/webp;')) data = canvas.toDataURL('image/jpeg', quality);
    const bytes = (data.length - data.indexOf(',') - 1) * 3 / 4;
    if (bytes <= MAX_COVER_BYTES) return data;
   }
  }
  throw new CoverImageError('size');
 } finally {
  image.onload = null;
  image.onerror = null;
  URL.revokeObjectURL(url);
 }
}
