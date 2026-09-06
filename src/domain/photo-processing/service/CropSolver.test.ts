import { describe, expect, it } from 'vitest'
import { SCHENGEN_VISA, UK_PASSPORT, US_PASSPORT } from '@domain/photo-spec/catalog/presets'
import { contains } from '@domain/photo-spec/model/PhotoSpec'
import { guidesFor, solveCrop, UnusableFaceError } from './CropSolver'
import { MAX_OFFSET, NO_ADJUSTMENT } from '../model/CropAdjustment'
import type { FaceGeometry } from '../model/FaceGeometry'

/**
 * A realistic phone photo: 3000 x 4000, subject reasonably framed with the head
 * roughly a third of the frame height.
 */
const SOURCE = { width: 3000, height: 4000 }

const FACE: FaceGeometry = {
  crownY: 900,
  chinY: 2100, // 1200 px head
  eyeLineY: 1440,
  faceCentreX: 1500,
}

describe('solveCrop', () => {
  it('lands the head height inside the Schengen tolerance', () => {
    const { achieved } = solveCrop(FACE, SOURCE, SCHENGEN_VISA)
    expect(contains(SCHENGEN_VISA.headHeight, achieved.headHeight)).toBe(true)
  })

  it('lands the eye line inside the Schengen tolerance', () => {
    const { achieved } = solveCrop(FACE, SOURCE, SCHENGEN_VISA)
    expect(contains(SCHENGEN_VISA.eyeLineFromBottom!, achieved.eyeLineFromBottom)).toBe(true)
  })

  it('produces a crop with the spec aspect ratio', () => {
    const { crop } = solveCrop(FACE, SOURCE, SCHENGEN_VISA)
    expect(crop.width / crop.height).toBeCloseTo(35 / 45, 5)
  })

  it('produces a square crop for the square US spec', () => {
    const { crop } = solveCrop(FACE, SOURCE, US_PASSPORT)
    expect(crop.width / crop.height).toBeCloseTo(1, 5)
  })

  it('applies the different US head-height rule, not the Schengen one', () => {
    // Schengen wants 70-80% of frame; the US wants 50-69%. Same face, same
    // photo, materially different crop. This is the bug a global constant causes.
    const schengen = solveCrop(FACE, SOURCE, SCHENGEN_VISA)
    const us = solveCrop(FACE, SOURCE, US_PASSPORT)
    expect(us.achieved.headHeightRatio).toBeLessThan(schengen.achieved.headHeightRatio)
    expect(contains(US_PASSPORT.headHeight, us.achieved.headHeight)).toBe(true)
  })

  it('centres the crop horizontally on the face', () => {
    const { crop } = solveCrop(FACE, SOURCE, SCHENGEN_VISA)
    expect(crop.x + crop.width / 2).toBeCloseTo(FACE.faceCentreX, 5)
  })

  it('scales the crop with the size of the head', () => {
    const closer: FaceGeometry = { crownY: 600, chinY: 2400, eyeLineY: 1110, faceCentreX: 1500 }
    const far = solveCrop(FACE, SOURCE, SCHENGEN_VISA)
    const near = solveCrop(closer, SOURCE, SCHENGEN_VISA)
    expect(near.crop.height).toBeGreaterThan(far.crop.height)
    expect(contains(SCHENGEN_VISA.headHeight, near.achieved.headHeight)).toBe(true)
  })

  it('reports when the source photo is framed too tightly to crop', () => {
    const tight = { width: 400, height: 500 }
    const bigFace: FaceGeometry = { crownY: 10, chinY: 460, eyeLineY: 140, faceCentreX: 200 }
    const solution = solveCrop(bigFace, tight, SCHENGEN_VISA)
    expect(solution.fitsWithinSource).toBe(false)
  })

  it('nudges rather than shrinks a crop that overhangs the edge', () => {
    const offCentre: FaceGeometry = { ...FACE, faceCentreX: 120 }
    const centred = solveCrop(FACE, SOURCE, SCHENGEN_VISA)
    const nudged = solveCrop(offCentre, SOURCE, SCHENGEN_VISA)

    expect(nudged.wasShifted).toBe(true)
    expect(nudged.crop.x).toBe(0)
    // The size is preserved, so the head height stays compliant.
    expect(nudged.crop.width).toBeCloseTo(centred.crop.width, 5)
    expect(contains(SCHENGEN_VISA.headHeight, nudged.achieved.headHeight)).toBe(true)
  })

  it('measures the achieved eye line from the final crop, not the intended one', () => {
    const high: FaceGeometry = { crownY: 30, chinY: 1230, eyeLineY: 570, faceCentreX: 1500 }
    const solution = solveCrop(high, SOURCE, SCHENGEN_VISA)
    const expected =
      ((solution.crop.y + solution.crop.height - high.eyeLineY) / solution.crop.height) * 45
    expect(solution.achieved.eyeLineFromBottom).toBeCloseTo(expected, 5)
  })

  it('rejects landmarks that cannot describe a real face', () => {
    const upsideDown: FaceGeometry = { crownY: 2100, chinY: 900, eyeLineY: 1400, faceCentreX: 1500 }
    expect(() => solveCrop(upsideDown, SOURCE, SCHENGEN_VISA)).toThrow(UnusableFaceError)
  })
})

/**
 * Regression tests for the bug that shipped in the first version.
 *
 * The solver positioned the crop purely from the eye-line rule, which silently
 * overrode the crown. Where somebody's eyes sit relative to their head varies a
 * lot with hair volume, from roughly 44% to 52% of head height, and anyone
 * past about 48% had the top of their head cut off.
 */
describe('the crown is never cropped, whatever the face proportions', () => {
  const CROWN = 100
  const CHIN = 1300

  function faceWithEyesAt(share: number): FaceGeometry {
    return {
      crownY: CROWN,
      chinY: CHIN,
      eyeLineY: CROWN + share * (CHIN - CROWN),
      faceCentreX: 1500,
    }
  }

  // The full human range, well past both ends of what the bug tolerated.
  const EYE_SHARES = [0.4, 0.44, 0.46, 0.48, 0.5, 0.52, 0.56]

  it.each(EYE_SHARES)('keeps the whole head in frame with eyes at %s of head height', (share) => {
    const solution = solveCrop(faceWithEyesAt(share), SOURCE, SCHENGEN_VISA)
    expect(solution.headFullyVisible).toBe(true)
    expect(solution.crop.y).toBeLessThanOrEqual(CROWN)
  })

  it.each(EYE_SHARES)('leaves real space above the crown with eyes at %s', (share) => {
    const solution = solveCrop(faceWithEyesAt(share), SOURCE, SCHENGEN_VISA)
    // At least 1.5 mm of the printed 45 mm, so hair never touches the edge.
    expect(solution.achieved.headroom).toBeGreaterThan(1.5)
  })

  it('still holds for the specific case that was reported', () => {
    // Eyes at 50% of head height: the exact geometry that produced a clipped
    // crown before the headroom clamp was introduced.
    const solution = solveCrop(faceWithEyesAt(0.5), SOURCE, SCHENGEN_VISA)
    expect(solution.headFullyVisible).toBe(true)
    expect(solution.achieved.headroom).toBeGreaterThan(0)
    expect(contains(SCHENGEN_VISA.headHeight, solution.achieved.headHeight)).toBe(true)
  })

  it('keeps head height compliant even when the eye line has to give way', () => {
    // Head height is the hard requirement; the eye line is the soft target.
    const solution = solveCrop(faceWithEyesAt(0.56), SOURCE, SCHENGEN_VISA)
    expect(contains(SCHENGEN_VISA.headHeight, solution.achieved.headHeight)).toBe(true)
  })

  it('never leaves so much headroom that the chin falls out of frame', () => {
    const solution = solveCrop(faceWithEyesAt(0.4), SOURCE, SCHENGEN_VISA)
    expect(solution.crop.y + solution.crop.height).toBeGreaterThanOrEqual(CHIN)
  })
})

describe('manual adjustment', () => {
  it('moves the frame down when the user drags down', () => {
    const base = solveCrop(FACE, SOURCE, SCHENGEN_VISA)
    const moved = solveCrop(FACE, SOURCE, SCHENGEN_VISA, { ...NO_ADJUSTMENT, offsetY: 0.1 })
    expect(moved.crop.y).toBeGreaterThan(base.crop.y)
  })

  it('gives more headroom when the user drags down, which is the point', () => {
    const base = solveCrop(FACE, SOURCE, SCHENGEN_VISA)
    const moved = solveCrop(FACE, SOURCE, SCHENGEN_VISA, { ...NO_ADJUSTMENT, offsetY: -0.05 })
    expect(moved.achieved.headroom).toBeGreaterThan(base.achieved.headroom)
  })

  it('zooms out to a larger crop, making the head smaller in the photo', () => {
    const base = solveCrop(FACE, SOURCE, SCHENGEN_VISA)
    const zoomedOut = solveCrop(FACE, SOURCE, SCHENGEN_VISA, { ...NO_ADJUSTMENT, scale: 0.8 })
    expect(zoomedOut.crop.height).toBeGreaterThan(base.crop.height)
    expect(zoomedOut.achieved.headHeight).toBeLessThan(base.achieved.headHeight)
  })

  it('reports honestly when a drag pushes the head out of frame', () => {
    const solution = solveCrop(FACE, SOURCE, SCHENGEN_VISA, {
      ...NO_ADJUSTMENT,
      offsetY: -MAX_OFFSET,
    })
    expect(solution.headFullyVisible).toBe(false)
  })

  it('refuses a drag beyond the allowed range rather than losing the subject', () => {
    const clamped = solveCrop(FACE, SOURCE, SCHENGEN_VISA, { offsetX: 99, offsetY: 99, scale: 99 })
    const atLimit = solveCrop(FACE, SOURCE, SCHENGEN_VISA, {
      offsetX: MAX_OFFSET,
      offsetY: MAX_OFFSET,
      scale: 1.4,
    })
    expect(clamped.crop).toEqual(atLimit.crop)
  })

  it('leaves the crop untouched for a zero adjustment', () => {
    const base = solveCrop(FACE, SOURCE, SCHENGEN_VISA)
    const explicit = solveCrop(FACE, SOURCE, SCHENGEN_VISA, NO_ADJUSTMENT)
    expect(explicit.crop).toEqual(base.crop)
  })
})

describe('guidesFor', () => {
  it('puts the crown guide near the top and the chin guide near the bottom', () => {
    const guides = guidesFor(SCHENGEN_VISA)
    expect(guides.crown.min).toBeGreaterThan(0)
    expect(guides.crown.max).toBeLessThan(0.15)
    expect(guides.chin.min).toBeGreaterThan(0.75)
    expect(guides.chin.max).toBeLessThan(1)
  })

  it('orders every band from min to max so the UI can draw it directly', () => {
    for (const spec of [SCHENGEN_VISA, US_PASSPORT]) {
      const guides = guidesFor(spec)
      expect(guides.crown.min).toBeLessThanOrEqual(guides.crown.max)
      expect(guides.chin.min).toBeLessThanOrEqual(guides.chin.max)
      if (guides.eyes) expect(guides.eyes.min).toBeLessThanOrEqual(guides.eyes.max)
    }
  })

  it('places the automatic solve inside its own guides', () => {
    // The guides must describe where the solver actually puts things, or the
    // overlay would tell users to fix something that is already correct.
    const guides = guidesFor(SCHENGEN_VISA)
    const solution = solveCrop(FACE, SOURCE, SCHENGEN_VISA)
    const crownFraction = (FACE.crownY - solution.crop.y) / solution.crop.height
    expect(crownFraction).toBeGreaterThanOrEqual(guides.crown.min - 0.02)
    expect(crownFraction).toBeLessThanOrEqual(guides.crown.max + 0.06)
  })

  it('omits the eye band for a spec with no eye-line rule', () => {
    expect(guidesFor(UK_PASSPORT).eyes).toBeNull()
  })
})
