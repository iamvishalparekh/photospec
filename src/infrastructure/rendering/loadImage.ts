/**
 * Decode a user-selected file into an ImageBitmap, upright.
 *
 * Phone cameras almost never store the pixels the right way up. They store them
 * in the sensor's orientation and add an EXIF tag saying "rotate this on
 * display". Skipping that tag is why so many photo tools show people sideways.
 * `imageOrientation: 'from-image'` makes the browser apply it for us.
 */
export async function loadImageUpright(file: File): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: 'from-image' })
}

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const

export function isSupportedImage(file: File): boolean {
  return file.type.startsWith('image/')
}
