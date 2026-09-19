// Cover photo compression: caps the longest side at 1200px and re-encodes
// as JPEG, so a full-resolution phone photo doesn't bloat IndexedDB.
// `imageOrientation: 'from-image'` makes createImageBitmap bake in the
// EXIF rotation, since a canvas draw otherwise ignores it.
const MAX_SIDE = 1200
const JPEG_QUALITY = 0.8

export async function compressCoverImage(file: File): Promise<Blob> {
  const bitmap = await loadBitmap(file)
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Contexte canvas 2D indisponible')
    context.drawImage(bitmap, 0, 0, width, height)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Échec de la compression de l'image"))),
        'image/jpeg',
        JPEG_QUALITY,
      )
    })
  } finally {
    bitmap.close()
  }
}

// Some browsers (older iPadOS Safari in particular) reject the
// imageOrientation option outright instead of ignoring it: retry without it
// rather than failing the whole upload — the photo just keeps whatever
// rotation the bitmap decoder applies by default.
async function loadBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return createImageBitmap(file)
  }
}
