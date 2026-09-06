/**
 * Finding the top of the head.
 *
 * Face-landmark models return points on the *face*: jaw, brows, eyes, nose.
 * None of them mark the crown, because hair is not a facial feature. But every
 * ID photo spec measures head height from chin to crown *including hair*, so
 * landmarks alone cannot produce a compliant crop.
 *
 * The segmentation mask does know where hair is, it separates person from
 * background, and hair is part of the person. So we combine the two: use the
 * landmarks to say *where to look*, and the mask to say *what is there*.
 *
 * Scan down from the top of the mask, inside a horizontal window centred on the
 * face, and the first row with a convincing run of person-pixels is the crown.
 */

/** A single-channel opacity mask, row-major, one byte per pixel (0-255). */
export interface AlphaMask {
  readonly data: Uint8Array | Uint8ClampedArray
  readonly width: number
  readonly height: number
}

export interface CrownSearchWindow {
  /** Left edge of the face, in mask pixels. */
  readonly faceLeft: number
  /** Right edge of the face, in mask pixels. */
  readonly faceRight: number
}

export interface CrownOptions {
  /** Opacity at or above which a pixel counts as part of the person. */
  readonly alphaThreshold: number
  /**
   * How far past the face edges to look, as a fraction of face width.
   * Hair is wider than the face, so the window is widened before scanning.
   */
  readonly widthPadding: number
  /**
   * Minimum person-pixels in a row before we believe it. Rejects the stray
   * speckle that segmentation models produce at the very top of a frame.
   */
  readonly minRunFraction: number
}

export const DEFAULT_CROWN_OPTIONS: CrownOptions = {
  alphaThreshold: 128,
  widthPadding: 0.25,
  minRunFraction: 0.08,
}

/**
 * @returns the y coordinate of the crown in mask pixels, or `null` if no row
 *          in the window contains a convincing amount of person.
 */
export function locateCrown(
  mask: AlphaMask,
  window: CrownSearchWindow,
  options: CrownOptions = DEFAULT_CROWN_OPTIONS,
): number | null {
  const faceWidth = window.faceRight - window.faceLeft
  if (faceWidth <= 0) return null

  const padding = faceWidth * options.widthPadding
  const left = Math.max(0, Math.floor(window.faceLeft - padding))
  const right = Math.min(mask.width, Math.ceil(window.faceRight + padding))
  const windowWidth = right - left
  if (windowWidth <= 0) return null

  const minRun = Math.max(1, Math.floor(windowWidth * options.minRunFraction))

  for (let y = 0; y < mask.height; y++) {
    let count = 0
    const rowStart = y * mask.width
    for (let x = left; x < right; x++) {
      if ((mask.data[rowStart + x] ?? 0) >= options.alphaThreshold) {
        count++
        if (count >= minRun) return y
      }
    }
  }

  return null
}
