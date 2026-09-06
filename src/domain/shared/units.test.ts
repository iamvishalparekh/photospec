import { describe, expect, it } from 'vitest'
import {
  dpi,
  effectiveDpi,
  mm,
  mmToPoints,
  mmToPx,
  MM_PER_INCH,
  px,
  pxToMm,
} from './units'

describe('unit conversions', () => {
  it('converts the Schengen photo width to pixels at 600 dpi', () => {
    // 35 / 25.4 * 600 = 826.77 -> 827
    expect(mmToPx(mm(35), dpi(600))).toBe(827)
  })

  it('converts the Schengen photo height to pixels at 600 dpi', () => {
    // 45 / 25.4 * 600 = 1062.99 -> 1063
    expect(mmToPx(mm(45), dpi(600))).toBe(1063)
  })

  it('converts a 2 inch US photo at 300 dpi to exactly 600 px', () => {
    expect(mmToPx(mm(2 * MM_PER_INCH), dpi(300))).toBe(600)
  })

  it('round-trips millimetres through pixels within a pixel of tolerance', () => {
    const original = mm(35)
    const back = pxToMm(mmToPx(original, dpi(600)), dpi(600))
    expect(back).toBeCloseTo(original, 1)
  })

  it('reports the effective dpi that keeps printed size exact after rounding', () => {
    // 827 px across 35 mm is very slightly more than 600 dpi
    expect(effectiveDpi(px(827), mm(35))).toBeCloseTo(600.17, 1)
  })

  it('converts A4 width to PDF points', () => {
    // 210 mm = 595.28 pt, the well-known A4 point width
    expect(mmToPoints(mm(210))).toBeCloseTo(595.28, 1)
  })

  it('rejects negative lengths', () => {
    expect(() => mm(-1)).toThrow(RangeError)
    expect(() => px(Number.NaN)).toThrow(RangeError)
  })
})
