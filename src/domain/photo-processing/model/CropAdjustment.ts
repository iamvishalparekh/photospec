/**
 * A manual nudge on top of the automatically solved crop.
 *
 * Offsets are fractions of the crop's own size rather than pixels, so a drag
 * feels the same whether the source photo is 12 megapixels or 2.
 */
export interface CropAdjustment {
  /** Positive moves the frame right, revealing more of the left of the subject. */
  readonly offsetX: number
  /** Positive moves the frame down, revealing more above the subject. */
  readonly offsetY: number
  /** 1 is the solver's own scale. Above 1 zooms in, below 1 zooms out. */
  readonly scale: number
}

export const NO_ADJUSTMENT: CropAdjustment = { offsetX: 0, offsetY: 0, scale: 1 }

export function isAdjusted(adjustment: CropAdjustment): boolean {
  return adjustment.offsetX !== 0 || adjustment.offsetY !== 0 || adjustment.scale !== 1
}

/** Users can nudge by up to a quarter of the frame in each direction. */
export const MAX_OFFSET = 0.25
export const MIN_SCALE = 0.7
export const MAX_SCALE = 1.4

export function clampAdjustment(adjustment: CropAdjustment): CropAdjustment {
  return {
    offsetX: clamp(adjustment.offsetX, -MAX_OFFSET, MAX_OFFSET),
    offsetY: clamp(adjustment.offsetY, -MAX_OFFSET, MAX_OFFSET),
    scale: clamp(adjustment.scale, MIN_SCALE, MAX_SCALE),
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
