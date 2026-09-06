import type { Dpi, Millimetres } from '@domain/shared/units'
import type { AlphaMask } from '../service/CrownLocator'
import type { CropRect } from '../model/CropRect'

export interface Enhancement {
  /** -1 to 1, 0 is unchanged. */
  readonly brightness: number
  /** -1 to 1, 0 is unchanged. */
  readonly contrast: number
  /** -1 to 1, 0 is unchanged. Shifts the image towards warm or cool. */
  readonly warmth: number
  /** 0 to 1. Lifts a dull photo without blowing out skin tones. */
  readonly saturation: number
  /**
   * 0 to 1. Unsharp mask strength, applied after resampling.
   *
   * This cannot recover detail the camera never captured. It restores the local
   * contrast that resizing averages away, which is most of what makes a
   * resampled photo look soft.
   */
  readonly sharpness: number
}

export const NO_ENHANCEMENT: Enhancement = {
  brightness: 0,
  contrast: 0,
  warmth: 0,
  saturation: 0,
  sharpness: 0,
}

/**
 * A mild default. Every photo is resampled on its way to the print size, so a
 * little sharpening is closer to "correct" than none at all.
 */
export const DEFAULT_ENHANCEMENT: Enhancement = { ...NO_ENHANCEMENT, sharpness: 0.25 }

export interface RenderRequest {
  readonly image: ImageBitmap
  readonly mask: AlphaMask
  readonly crop: CropRect
  readonly outputWidthPx: number
  readonly outputHeightPx: number
  /** The physical width the pixels represent. Needed to report a truthful DPI. */
  readonly outputWidthMm: Millimetres
  readonly backgroundColour: string
  readonly enhancement: Enhancement
}

export interface RenderedPhoto {
  readonly blob: Blob
  readonly widthPx: number
  readonly heightPx: number
  readonly dpi: Dpi
}

export interface ImageRenderer {
  render(request: RenderRequest): Promise<RenderedPhoto>
}
