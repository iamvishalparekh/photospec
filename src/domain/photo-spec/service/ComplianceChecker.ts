import { mmToPx, type Dpi } from '@domain/shared/units'
import { supportedDpi } from './PrintResolution'
import type { AchievedMetrics, CropSolution } from '@domain/photo-processing/service/CropSolver'
import { contains, type PhotoSpec } from '../model/PhotoSpec'

export type Severity = 'pass' | 'warn' | 'fail'

export interface ComplianceResult {
  readonly id: string
  readonly label: string
  readonly severity: Severity
  /** Written for the applicant, not the developer. Always states the numbers. */
  readonly message: string
}

/** How far outside a range still counts as a warning rather than a failure. */
const TOLERANCE_MM = 1

/**
 * Judge a prepared photo against its spec.
 *
 * Every result carries the actual measurement in its message, because "head too
 * small" tells an applicant nothing while "head is 30 mm, needs 32-36 mm" tells
 * them to step closer to the camera.
 */
export function checkCompliance(
  spec: PhotoSpec,
  solution: CropSolution,
  outputDpi: Dpi,
): ComplianceResult[] {
  return [
    checkHeadInFrame(solution),
    checkHeadHeight(spec, solution.achieved),
    ...(spec.eyeLineFromBottom ? [checkEyeLine(spec, solution.achieved)] : []),
    checkCropFits(solution),
    checkResolution(spec, solution, outputDpi),
    checkPresetConfidence(spec),
  ]
}

export function worstSeverity(results: readonly ComplianceResult[]): Severity {
  if (results.some((r) => r.severity === 'fail')) return 'fail'
  if (results.some((r) => r.severity === 'warn')) return 'warn'
  return 'pass'
}

/**
 * The rule that outranks all the others.
 *
 * A photo with the top of the head cut off is rejected on sight, so this is
 * checked first and reported first. The automatic solve cannot produce this;
 * only a manual drag can, which is exactly why the rule exists.
 */
function checkHeadInFrame(solution: CropSolution): ComplianceResult {
  const visible = solution.headFullyVisible
  return {
    id: 'head-in-frame',
    label: 'Whole head visible',
    severity: visible ? 'pass' : 'fail',
    message: visible
      ? `The whole head is inside the frame, with ${solution.achieved.headroom.toFixed(1)} mm of space above it.`
      : 'The top of the head or the chin is cut off. Drag the photo down to bring the whole head into the frame.',
  }
}

function checkHeadHeight(spec: PhotoSpec, achieved: AchievedMetrics): ComplianceResult {
  const { headHeight } = spec
  const actual = achieved.headHeight
  const inRange = contains(headHeight, actual)
  const nearlyInRange =
    actual >= headHeight.min - TOLERANCE_MM && actual <= headHeight.max + TOLERANCE_MM

  return {
    id: 'head-height',
    label: 'Head height',
    severity: inRange ? 'pass' : nearlyInRange ? 'warn' : 'fail',
    message: inRange
      ? `Head measures ${fmt(actual)} mm, within the required ${fmt(headHeight.min)}-${fmt(headHeight.max)} mm.`
      : `Head measures ${fmt(actual)} mm but must be ${fmt(headHeight.min)}-${fmt(headHeight.max)} mm. ${
          actual < headHeight.min ? 'Move closer to the camera.' : 'Move further from the camera.'
        }`,
  }
}

function checkEyeLine(spec: PhotoSpec, achieved: AchievedMetrics): ComplianceResult {
  const range = spec.eyeLineFromBottom
  if (!range) throw new Error('checkEyeLine called for a spec without an eye-line rule')
  const actual = achieved.eyeLineFromBottom
  const inRange = contains(range, actual)

  return {
    id: 'eye-line',
    label: 'Eye position',
    severity: inRange ? 'pass' : 'warn',
    message: inRange
      ? `Eyes sit ${fmt(actual)} mm from the bottom edge, within the required ${fmt(range.min)}-${fmt(range.max)} mm.`
      : `Eyes sit ${fmt(actual)} mm from the bottom edge; the requirement is ${fmt(range.min)}-${fmt(range.max)} mm.`,
  }
}

function checkCropFits(solution: CropSolution): ComplianceResult {
  return {
    id: 'framing',
    label: 'Framing',
    severity: solution.fitsWithinSource ? 'pass' : 'fail',
    message: solution.fitsWithinSource
      ? 'The whole photo fits inside your original image.'
      : 'Your original photo is too tightly framed. Retake it with more space above the head and around the shoulders.',
  }
}

/**
 * Judge sharpness, and say something the user can act on.
 *
 * "Low resolution" is useless advice. What a person can actually change is how
 * far they stood from the camera and how the photo reached this device, so the
 * message names those.
 */
function checkResolution(
  spec: PhotoSpec,
  solution: CropSolution,
  outputDpi: Dpi,
): ComplianceResult {
  const available = supportedDpi(spec, solution.crop.width)
  const requiredPx = mmToPx(spec.width, outputDpi)
  const availablePx = Math.round(solution.crop.width)
  const shortfall = available / spec.minDpi

  if (shortfall >= 1) {
    return {
      id: 'resolution',
      label: 'Sharpness',
      severity: 'pass',
      message: `Printing at ${Math.round(outputDpi)} dpi from ${availablePx} px of real detail, ${
        shortfall >= 1.5 ? 'comfortably above' : 'above'
      } the ${spec.minDpi} dpi minimum.`,
    }
  }

  return {
    id: 'resolution',
    label: 'Sharpness',
    severity: shortfall >= 0.7 ? 'warn' : 'fail',
    message: `Only ${availablePx} px of real detail across the photo, but ${requiredPx} px is needed for ${spec.minDpi} dpi. It has been sharpened as far as is honest, and will still look soft. Retake it standing closer, using the main camera rather than the selfie camera, and transfer the original file rather than sending it through a messaging app.`,
  }
}

function checkPresetConfidence(spec: PhotoSpec): ComplianceResult {
  const verified = spec.source.confidence === 'verified'
  return {
    id: 'preset-confidence',
    label: 'Specification source',
    severity: verified ? 'pass' : 'warn',
    message: verified
      ? `Measurements checked against ${spec.source.authority} on ${spec.source.checkedOn}.`
      : `These measurements have not yet been verified against ${spec.source.authority}. Check the official requirements before submitting.`,
  }
}

function fmt(value: number): string {
  return value.toFixed(1)
}
