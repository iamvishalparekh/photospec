/** A rectangle in source-image pixel coordinates. */
export interface CropRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export function right(rect: CropRect): number {
  return rect.x + rect.width
}

export function bottom(rect: CropRect): number {
  return rect.y + rect.height
}

export interface ImageSize {
  readonly width: number
  readonly height: number
}

export function fitsWithin(rect: CropRect, bounds: ImageSize): boolean {
  return rect.x >= 0 && rect.y >= 0 && right(rect) <= bounds.width && bottom(rect) <= bounds.height
}

/**
 * Slide a rectangle back inside the bounds without changing its size.
 *
 * Resizing would change the head-height ratio we just solved for, so a crop
 * that hangs off the edge is nudged, never shrunk. If it is simply larger than
 * the image, it is left alone and the caller reports the failure.
 */
export function shiftIntoBounds(rect: CropRect, bounds: ImageSize): CropRect {
  if (rect.width > bounds.width || rect.height > bounds.height) return rect
  const x = Math.min(Math.max(rect.x, 0), bounds.width - rect.width)
  const y = Math.min(Math.max(rect.y, 0), bounds.height - rect.height)
  return { ...rect, x, y }
}
