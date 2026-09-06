import { describe, expect, it } from 'vitest'
import { locateCrown, type AlphaMask } from './CrownLocator'

/**
 * Build a synthetic mask: an opaque blob of `blobWidth` centred horizontally,
 * starting at row `topY`. Stands in for a segmented head with hair.
 */
function maskWithBlob(
  width: number,
  height: number,
  topY: number,
  blobWidth: number,
): AlphaMask {
  const data = new Uint8Array(width * height)
  const left = Math.floor((width - blobWidth) / 2)
  for (let y = topY; y < height; y++) {
    for (let x = left; x < left + blobWidth; x++) {
      data[y * width + x] = 255
    }
  }
  return { data, width, height }
}

const FACE_WINDOW = { faceLeft: 80, faceRight: 120 }

describe('locateCrown', () => {
  it('finds the first row where the person begins', () => {
    const mask = maskWithBlob(200, 200, 40, 60)
    expect(locateCrown(mask, FACE_WINDOW)).toBe(40)
  })

  it('finds hair that sits wider than the face itself', () => {
    // Blob is 90 px wide; the detected face is only 40 px. Without padding the
    // search window we would still find it, but this asserts the widened window
    // does not break on a subject with big hair.
    const mask = maskWithBlob(200, 200, 25, 90)
    expect(locateCrown(mask, FACE_WINDOW)).toBe(25)
  })

  it('ignores a stray speckle above the head', () => {
    const mask = maskWithBlob(200, 200, 60, 60)
    // Two isolated pixels of noise at row 5, well under the minimum run.
    ;(mask.data as Uint8Array)[5 * 200 + 99] = 255
    ;(mask.data as Uint8Array)[5 * 200 + 100] = 255
    expect(locateCrown(mask, FACE_WINDOW)).toBe(60)
  })

  it('ignores background that is outside the head window', () => {
    const mask = maskWithBlob(200, 200, 70, 60)
    // A wide opaque band far to the left, e.g. a doorframe wrongly segmented.
    for (let x = 0; x < 30; x++) (mask.data as Uint8Array)[10 * 200 + x] = 255
    expect(locateCrown(mask, FACE_WINDOW)).toBe(70)
  })

  it('respects the alpha threshold rather than treating any value as person', () => {
    const mask = maskWithBlob(200, 200, 50, 60)
    // Fill row 20 with a faint, semi-transparent edge.
    for (let x = 70; x < 130; x++) (mask.data as Uint8Array)[20 * 200 + x] = 60
    expect(locateCrown(mask, FACE_WINDOW)).toBe(50)
  })

  it('returns null when the mask contains no person', () => {
    const empty: AlphaMask = { data: new Uint8Array(200 * 200), width: 200, height: 200 }
    expect(locateCrown(empty, FACE_WINDOW)).toBeNull()
  })

  it('returns null for a degenerate face window', () => {
    const mask = maskWithBlob(200, 200, 40, 60)
    expect(locateCrown(mask, { faceLeft: 100, faceRight: 100 })).toBeNull()
  })
})
