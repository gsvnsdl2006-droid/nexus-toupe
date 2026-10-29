// Re-encoding strips camera metadata and keeps the complete photo in a bounded upload.
export async function compressEventPhoto(file) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 15 * 1024 * 1024
  )
    throw Error("Choisis une photo JPG, PNG ou WebP de moins de 15 Mo.");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    let width = Math.min(1600, img.naturalWidth),
      quality = 0.86;
    for (let i = 0; i < 10; i++) {
      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(
        1,
        Math.round((img.naturalHeight * canvas.width) / img.naturalWidth),
      );
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL("image/jpeg", quality);
      if (data.length * 0.75 <= 440 * 1024) return { name: file.name, data };
      quality = Math.max(0.55, quality - 0.1);
      width *= 0.8;
    }
    throw Error("Cette photo est trop grande. Essaie une photo plus petite.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
