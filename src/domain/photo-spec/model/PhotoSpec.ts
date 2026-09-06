import { mm, type Millimetres } from '@domain/shared/units'

/** An inclusive range of millimetre values. */
export interface MmRange {
  readonly min: Millimetres
  readonly max: Millimetres
}

export function mmRange(min: number, max: number): MmRange {
  if (min > max) throw new RangeError(`Range min ${min} exceeds max ${max}`)
  return { min: mm(min), max: mm(max) }
}

export function midpoint(range: MmRange): Millimetres {
  return mm((range.min + range.max) / 2)
}

export function contains(range: MmRange, value: Millimetres): boolean {
  return value >= range.min && value <= range.max
}

/**
 * How confident we are in a preset's numbers.
 *
 * Presets are the part of this project most likely to drift or be wrong, and a
 * wrong preset produces a confidently incorrect photo. So confidence is part of
 * the model, surfaced in the UI, rather than a comment someone forgets.
 */
export type SpecConfidence = 'verified' | 'unverified'

export interface SpecSource {
  /** The body that issues the requirement, e.g. "European Commission". */
  readonly authority: string
  readonly url: string
  /** ISO date the numbers were last checked against the source. */
  readonly checkedOn: string
  readonly confidence: SpecConfidence
}

export interface BackgroundSpec {
  /** Hex colour used when compositing, e.g. '#FFFFFF'. */
  readonly colour: string
  /** Shown to the user so a debatable default is a visible choice, not a silent one. */
  readonly description: string
}

/**
 * The complete definition of a compliant photo for one document type.
 *
 * Every downstream calculation reads from here. Nothing in this project should
 * contain a hard-coded 35, 45 or 32.
 */
export interface PhotoSpec {
  readonly id: string
  /** Shown in the picker, e.g. "Schengen visa". */
  readonly name: string
  /** Grouping label for the picker, e.g. "Europe". */
  readonly region: string
  readonly width: Millimetres
  readonly height: Millimetres
  /** Chin to crown, including hair. */
  readonly headHeight: MmRange
  /** Distance from the bottom edge to the eye line, where the authority states one. */
  readonly eyeLineFromBottom?: MmRange
  readonly background: BackgroundSpec
  /** Minimum print resolution the authority accepts. */
  readonly minDpi: number
  /** Plain-language rules we cannot check automatically, shown as a checklist. */
  readonly manualChecks: readonly string[]
  readonly source: SpecSource
}

/** Head height as a fraction of total photo height, e.g. 0.71–0.80 for Schengen. */
export function headHeightRatio(spec: PhotoSpec): { min: number; max: number } {
  return {
    min: spec.headHeight.min / spec.height,
    max: spec.headHeight.max / spec.height,
  }
}

/** Width divided by height. Used to derive crop shape from crop height. */
export function aspectRatio(spec: PhotoSpec): number {
  return spec.width / spec.height
}

/**
 * Does this document state a rule about where the eyes must sit?
 *
 * Not all authorities do. CropSolver treats the rule as a soft constraint when
 * present and falls back to conventional headroom when absent.
 */
export function hasEyeLineRule(spec: PhotoSpec): boolean {
  return spec.eyeLineFromBottom !== undefined
}
