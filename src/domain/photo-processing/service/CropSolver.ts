import { mm, signedMm, type Millimetres } from '@domain/shared/units'
import { aspectRatio, midpoint, type PhotoSpec } from '@domain/photo-spec/model/PhotoSpec'
import {
  fitsWithin,
  shiftIntoBounds,
  type CropRect,
  type ImageSize,
} from '../model/CropRect'
import {
  clampAdjustment,
  NO_ADJUSTMENT,
  type CropAdjustment,
} from '../model/CropAdjustment'
import { headHeightPx, isPlausible, type FaceGeometry } from '../model/FaceGeometry'

/**
 * How much of the leftover vertical space sits above the crown.
 *
 * "Leftover" is whatever the head does not occupy: 45 mm of photo minus a 34 mm
 * head leaves 11 mm to share between headroom and the space below the chin.
 *
 * These three numbers are the fix for a real bug. The first version positioned
 * the crop purely from the eye-line rule, which silently overrode the crown.
 * Anyone whose eyes sit at 48% or more of their head height (that is, anyone
 * with a reasonable amount of hair) had the top of their head cut off. The eye
 * line is now a *target*, and the headroom band is a *hard constraint* that wins.
 */
const HEADROOM = {
  /** Never less than this, or the hair touches the top edge. */
  min: 0.18,
  /** The conventional placement, used when there is no eye-line rule. */
  target: 0.3,
  /** Never more than this, or the shoulders crowd the bottom edge. */
  max: 0.5,
} as const

export interface AchievedMetrics {
  readonly headHeight: Millimetres
  readonly eyeLineFromBottom: Millimetres
  /** Head height as a fraction of photo height, e.g. 0.755. */
  readonly headHeightRatio: number
  /**
   * Space above the crown, in millimetres of the printed photo.
   * Negative means the top of the head has been cropped off.
   */
  readonly headroom: Millimetres
}

export interface CropSolution {
  readonly crop: CropRect
  readonly achieved: AchievedMetrics
  /** False when the required crop is bigger than the source image. */
  readonly fitsWithinSource: boolean
  /** True when the crop had to be nudged away from where the face wanted it. */
  readonly wasShifted: boolean
  /**
   * False when the crown or chin falls outside the frame. Only reachable by
   * manual adjustment. The automatic solve guarantees this is true.
   */
  readonly headFullyVisible: boolean
}

export class UnusableFaceError extends Error {
  constructor() {
    super('The detected face landmarks are not usable: chin, crown and eye line are inconsistent.')
    this.name = 'UnusableFaceError'
  }
}

/**
 * Work out where to crop the source image so the resulting photo satisfies the
 * spec's head-height and eye-line rules.
 *
 * The crop has three degrees of freedom and the solve is direct, not iterative:
 *
 *   scale  <- fixed by the target head height
 *   y      <- aimed at the eye-line rule, then clamped so the crown is safe
 *   x      <- centred on the face
 *
 * A manual adjustment is applied last, so a user dragging the frame is always
 * moving away from a known-good starting point rather than from nothing.
 *
 * Touches no pixels, knows nothing about canvases. That is what makes the
 * riskiest arithmetic in the project testable in milliseconds.
 */
export function solveCrop(
  face: FaceGeometry,
  source: ImageSize,
  spec: PhotoSpec,
  adjustment: CropAdjustment = NO_ADJUSTMENT,
): CropSolution {
  if (!isPlausible(face)) throw new UnusableFaceError()

  const nudge = clampAdjustment(adjustment)
  const headPx = headHeightPx(face)
  const targetHeadMm = midpoint(spec.headHeight)

  // If the head must occupy targetHeadMm of a spec.height-tall photo, the whole
  // crop is taller than the head by exactly that ratio. Zooming shrinks the crop,
  // which makes the head bigger in the finished photo.
  const cropHeight = (headPx * (spec.height / targetHeadMm)) / nudge.scale
  const cropWidth = cropHeight * aspectRatio(spec)

  const y = verticalPosition(face, spec, cropHeight) + nudge.offsetY * cropHeight
  const x = face.faceCentreX - cropWidth / 2 + nudge.offsetX * cropWidth

  const desired: CropRect = { x, y, width: cropWidth, height: cropHeight }
  const crop = shiftIntoBounds(desired, source)

  return {
    crop,
    achieved: measure(face, crop, spec),
    fitsWithinSource: fitsWithin(crop, source),
    wasShifted: crop.x !== desired.x || crop.y !== desired.y,
    headFullyVisible: crop.y <= face.crownY && crop.y + crop.height >= face.chinY,
  }
}

/**
 * Choose the top edge of the crop.
 *
 * Three rules, in strict priority order. Getting this order wrong is what
 * produced the cropped-head bug:
 *
 *   1. HARD    the crown must stay in frame with real space above it
 *   2. DEFAULT place the head conventionally, ~30% of the leftover space above
 *   3. SOFT    satisfy the eye-line rule, but only far enough to get inside the
 *              permitted band
 *
 * Rule 3 used to run first and aim at the *midpoint* of the eye-line band. For
 * Schengen that midpoint (28.5 mm from the bottom) implies eyes sitting about
 * 39% of the way down the head, but real eyes sit at 44-52% depending on hair
 * volume. So the solver kept hauling the frame upwards to chase an impossible
 * target and sliced the top of people's heads off. Aiming at the *nearest edge*
 * of the band instead of its midpoint removes the fight entirely.
 */
function verticalPosition(face: FaceGeometry, spec: PhotoSpec, cropHeight: number): number {
  const leftover = 1 - midpoint(spec.headHeight) / spec.height

  // 2. Start from the conventional placement.
  let y = face.crownY - leftover * HEADROOM.target * cropHeight

  // 3. Nudge only as far as the eye-line band requires.
  const band = spec.eyeLineFromBottom
  if (band) {
    const yGiving = (eyeFromBottom: number) =>
      face.eyeLineY - cropHeight * (1 - eyeFromBottom / spec.height)
    y = clamp(y, yGiving(band.min), yGiving(band.max))
  }

  // 1. The crown wins over everything else, unconditionally.
  return clamp(
    y,
    face.crownY - leftover * HEADROOM.max * cropHeight,
    face.crownY - leftover * HEADROOM.min * cropHeight,
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Measure what the crop actually achieved, in millimetres of the printed photo.
 *
 * Always derived from the final crop rather than the intended one, so a crop
 * that was nudged or clamped reports the truth and the compliance checker can
 * fail it honestly.
 */
function measure(face: FaceGeometry, crop: CropRect, spec: PhotoSpec): AchievedMetrics {
  const ratio = headHeightPx(face) / crop.height
  const eyeFromBottomPx = crop.y + crop.height - face.eyeLineY
  return {
    headHeight: mm(ratio * spec.height),
    eyeLineFromBottom: signedMm((eyeFromBottomPx / crop.height) * spec.height),
    headHeightRatio: ratio,
    headroom: signedMm(((face.crownY - crop.y) / crop.height) * spec.height),
  }
}

/**
 * Where the crown, eyes and chin should fall, as fractions of photo height from
 * the top edge.
 *
 * The UI draws these as guide lines over the preview so a user dragging the
 * frame can see the target rather than guess at it.
 */
export interface CropGuides {
  readonly crown: { readonly min: number; readonly max: number }
  readonly chin: { readonly min: number; readonly max: number }
  readonly eyes: { readonly min: number; readonly max: number } | null
}

export function guidesFor(spec: PhotoSpec): CropGuides {
  const band = (headMm: number) => {
    const leftoverMm = spec.height - headMm
    const crownMm = leftoverMm * HEADROOM.target
    return { crown: crownMm / spec.height, chin: (crownMm + headMm) / spec.height }
  }

  const tallest = band(spec.headHeight.max)
  const shortest = band(spec.headHeight.min)

  return {
    crown: { min: Math.min(tallest.crown, shortest.crown), max: Math.max(tallest.crown, shortest.crown) },
    chin: { min: Math.min(tallest.chin, shortest.chin), max: Math.max(tallest.chin, shortest.chin) },
    eyes: spec.eyeLineFromBottom
      ? {
          min: (spec.height - spec.eyeLineFromBottom.max) / spec.height,
          max: (spec.height - spec.eyeLineFromBottom.min) / spec.height,
        }
      : null,
  }
}
