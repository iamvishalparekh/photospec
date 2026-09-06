import type { Millimetres } from '@domain/shared/units'

/**
 * Where one photo sits on the sheet, measured from the top-left corner in mm.
 *
 * `width` and `height` describe the box ON THE PAGE, not the photo. When
 * `rotated` is true the photo is turned a quarter turn to fill that box, so a
 * 35 x 45 mm photo occupies a 45 x 35 mm box and is still 35 x 45 mm once cut
 * out. A renderer that ignores `rotated` will squash the photo into the box
 * instead of turning it, which is exactly the bug this field exists to prevent.
 */
export interface Placement {
  readonly x: Millimetres
  readonly y: Millimetres
  readonly width: Millimetres
  readonly height: Millimetres
  readonly rotated: boolean
}

export interface SheetLayout {
  readonly columns: number
  readonly rows: number
  /** How many photos fit on one sheet. */
  readonly capacity: number
  /** True when photos were turned 90 degrees to fit more on the page. */
  readonly rotated: boolean
  readonly placements: readonly Placement[]
}

export interface SheetOptions {
  /** Unprintable border most consumer printers require. */
  readonly margin: Millimetres
  /** Space between photos, giving somewhere to cut. */
  readonly gutter: Millimetres
  /**
   * Whether photos may be turned a quarter turn if that fits more on the page.
   *
   * Off by default. On A4 it fits 28 instead of 25, but people expect a 35 x 45
   * photo to appear upright on the page and a surprise rotation reads as a bug
   * even when the cut photo is correct.
   */
  readonly allowRotation: boolean
  /** Draw hairline cut guides between photos. */
  readonly cutGuides: boolean
}
