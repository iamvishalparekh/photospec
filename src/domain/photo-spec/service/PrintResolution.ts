import { dpi, MM_PER_INCH, type Dpi } from '@domain/shared/units'
import type { PhotoSpec } from '../model/PhotoSpec'

/**
 * Beyond this there is nothing left to gain: the ink spreads further than the
 * pixels are apart, and the file gets large for no visible benefit.
 */
export const MAX_OUTPUT_DPI = 1200

/**
 * Choose the resolution to render at.
 *
 * The first version always used the spec's *minimum* dpi, which was a quiet
 * bug: a photo taken close on a modern phone can support around 1000 dpi across
 * a 35 mm print, and forcing it down to 600 threw away 40% of the linear detail
 * the user actually had.
 *
 * So: use everything the source offers, but never below what the authority
 * requires, and never past the point of diminishing returns.
 *
 * When the source cannot reach the minimum we still render at the minimum. The
 * print has to be the right physical size, and the compliance checker warns
 * that the result was upscaled.
 */
export function chooseOutputDpi(
  spec: PhotoSpec,
  cropWidthPx: number,
  ceiling: number = MAX_OUTPUT_DPI,
): Dpi {
  const supported = supportedDpi(spec, cropWidthPx)
  return dpi(Math.round(Math.min(Math.max(supported, spec.minDpi), ceiling)))
}

/** The resolution the source pixels genuinely support at the printed size. */
export function supportedDpi(spec: PhotoSpec, cropWidthPx: number): number {
  return (cropWidthPx / spec.width) * MM_PER_INCH
}

/** True when we have to invent pixels to reach the required print size. */
export function requiresUpscaling(spec: PhotoSpec, cropWidthPx: number): boolean {
  return supportedDpi(spec, cropWidthPx) < spec.minDpi
}
