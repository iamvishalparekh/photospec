/**
 * Physical and pixel units.
 *
 * Mixing millimetres with pixels is the single most likely bug in this
 * codebase: both are plain numbers, and a photo that is silently 34.6 mm wide
 * instead of 35 mm gets rejected at the visa centre without anyone noticing why.
 *
 * We therefore use *branded* number types. At runtime these are ordinary
 * numbers with zero overhead; at compile time TypeScript refuses to let a
 * `Pixels` value be passed where `Millimetres` is expected.
 */

declare const brand: unique symbol

type Branded<T, B> = T & { readonly [brand]: B }

/** A length in millimetres. */
export type Millimetres = Branded<number, 'Millimetres'>

/** A length in whole device pixels. */
export type Pixels = Branded<number, 'Pixels'>

/** A length in PostScript points, the unit PDF geometry is expressed in. */
export type Points = Branded<number, 'Points'>

/** Dots per inch. Governs how many pixels one millimetre becomes when printed. */
export type Dpi = Branded<number, 'Dpi'>

export const MM_PER_INCH = 25.4

/** There are exactly 72 PostScript points to an inch. */
export const POINTS_PER_INCH = 72

// --- constructors -----------------------------------------------------------

/**
 * A millimetre measurement that may legitimately be negative.
 *
 * Most lengths cannot be below zero and `mm()` rejects those outright. But some
 * measurements are *offsets*, not lengths: headroom above the crown is negative
 * exactly when the top of the head has been cropped off, and reporting that as
 * "-2.1 mm" is far more useful than throwing.
 */
export function signedMm(value: number): Millimetres {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Expected a finite millimetre offset, received ${value}`)
  }
  return value as Millimetres
}

export function mm(value: number): Millimetres {
  assertFinitePositive(value, 'millimetres')
  return value as Millimetres
}

export function px(value: number): Pixels {
  assertFinitePositive(value, 'pixels')
  return value as Pixels
}

export function points(value: number): Points {
  assertFinitePositive(value, 'points')
  return value as Points
}

export function dpi(value: number): Dpi {
  assertFinitePositive(value, 'dpi')
  return value as Dpi
}

function assertFinitePositive(value: number, unit: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`Expected a finite non-negative ${unit}, received ${value}`)
  }
}

// --- conversions ------------------------------------------------------------

/**
 * Convert millimetres to pixels at a given print resolution.
 *
 * Rounds to a whole pixel, because an image cannot have a fractional width.
 * The rounding error is corrected at export time by writing the *actual*
 * effective DPI into the file metadata, so the printed size stays exact.
 *
 * @example mmToPx(mm(35), dpi(600)) === 827   // 35 / 25.4 * 600 = 826.77
 */
export function mmToPx(length: Millimetres, resolution: Dpi): Pixels {
  return px(Math.round((length / MM_PER_INCH) * resolution))
}

/** Convert pixels back to millimetres at a given print resolution. */
export function pxToMm(length: Pixels, resolution: Dpi): Millimetres {
  return mm((length / resolution) * MM_PER_INCH)
}

/**
 * The DPI that a pixel dimension actually represents once rounded.
 *
 * Writing this value into the exported file, rather than the nominal DPI,
 * is what keeps the printed millimetres exact despite pixel rounding.
 *
 * @example effectiveDpi(px(827), mm(35)) === 600.16...
 */
export function effectiveDpi(pixels: Pixels, length: Millimetres): Dpi {
  return dpi((pixels / length) * MM_PER_INCH)
}

/** Convert millimetres to PDF points. */
export function mmToPoints(length: Millimetres): Points {
  return points((length / MM_PER_INCH) * POINTS_PER_INCH)
}

/** The smallest resolution at which `pixels` can print `length` millimetres. */
export function resolutionOf(pixels: Pixels, length: Millimetres): Dpi {
  return effectiveDpi(pixels, length)
}
