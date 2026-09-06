import { describe, expect, it } from 'vitest'
import { mm } from '@domain/shared/units'
import { A4, PHOTO_6X4 } from '../model/PaperSize'
import type { SheetOptions } from '../model/SheetLayout'
import {
  calculateSheetLayout,
  DEFAULT_SHEET_OPTIONS,
  placementsFor,
  sheetsRequired,
} from './SheetLayoutCalculator'

const UPRIGHT_ONLY: SheetOptions = { ...DEFAULT_SHEET_OPTIONS, allowRotation: false }
const ROTATABLE: SheetOptions = { ...DEFAULT_SHEET_OPTIONS, allowRotation: true }

describe('calculateSheetLayout', () => {
  it('fits 25 Schengen photos on an A4 sheet upright', () => {
    const layout = calculateSheetLayout(A4, mm(35), mm(45), UPRIGHT_ONLY)
    expect(layout.columns).toBe(5)
    expect(layout.rows).toBe(5)
    expect(layout.capacity).toBe(25)
  })

  it('never places a photo outside the printable area', () => {
    const layout = calculateSheetLayout(A4, mm(35), mm(45), UPRIGHT_ONLY)
    for (const p of layout.placements) {
      expect(p.x).toBeGreaterThanOrEqual(DEFAULT_SHEET_OPTIONS.margin - 0.001)
      expect(p.y).toBeGreaterThanOrEqual(DEFAULT_SHEET_OPTIONS.margin - 0.001)
      expect(p.x + p.width).toBeLessThanOrEqual(A4.width - DEFAULT_SHEET_OPTIONS.margin + 0.001)
      expect(p.y + p.height).toBeLessThanOrEqual(A4.height - DEFAULT_SHEET_OPTIONS.margin + 0.001)
    }
  })

  it('centres the grid so leftover space is shared between both margins', () => {
    const layout = calculateSheetLayout(A4, mm(35), mm(45), UPRIGHT_ONLY)
    const first = layout.placements[0]!
    const last = layout.placements[layout.placements.length - 1]!
    const leftGap = first.x
    const rightGap = A4.width - (last.x + last.width)
    expect(leftGap).toBeCloseTo(rightGap, 5)
  })

  it('leaves exactly one gutter between neighbouring photos', () => {
    const layout = calculateSheetLayout(A4, mm(35), mm(45), UPRIGHT_ONLY)
    const first = layout.placements[0]!
    const second = layout.placements[1]!
    expect(second.x - (first.x + first.width)).toBeCloseTo(DEFAULT_SHEET_OPTIONS.gutter, 5)
  })

  it('leaves photos upright by default, because a surprise rotation reads as a bug', () => {
    const layout = calculateSheetLayout(A4, mm(35), mm(45))
    expect(layout.rotated).toBe(false)
    expect(layout.capacity).toBe(25)
    expect(layout.placements.every((p) => !p.rotated)).toBe(true)
  })

  it('fits more per sheet when rotation is allowed', () => {
    // 4 across x 7 down = 28, against 25 upright.
    const layout = calculateSheetLayout(A4, mm(35), mm(45), ROTATABLE)
    expect(layout.rotated).toBe(true)
    expect(layout.capacity).toBe(28)
  })

  it('marks every placement in a rotated layout, so the writer cannot miss it', () => {
    // The PDF writer needs this to turn the photo rather than squash it into
    // the box. It shipped without the flag once; this test is why it will not
    // ship without it again.
    const layout = calculateSheetLayout(A4, mm(35), mm(45), ROTATABLE)
    expect(layout.placements.every((p) => p.rotated)).toBe(true)
  })

  it('gives a rotated placement a landscape box for a portrait photo', () => {
    const layout = calculateSheetLayout(A4, mm(35), mm(45), ROTATABLE)
    const first = layout.placements[0]!
    expect(first.width).toBe(45)
    expect(first.height).toBe(35)
  })

  it('keeps the cut photo 35 x 45 mm whichever way it is laid out', () => {
    // This is the invariant that actually matters to an applicant: whatever the
    // sheet does, the rectangle they cut out must be 35 wide by 45 tall.
    for (const options of [UPRIGHT_ONLY, ROTATABLE]) {
      const layout = calculateSheetLayout(A4, mm(35), mm(45), options)
      for (const p of layout.placements) {
        const [cutWidth, cutHeight] = p.rotated ? [p.height, p.width] : [p.width, p.height]
        expect(cutWidth).toBe(35)
        expect(cutHeight).toBe(45)
      }
    }
  })

  it('never rotates when rotation would not fit more on the page', () => {
    const layout = calculateSheetLayout(PHOTO_6X4, mm(35), mm(45), ROTATABLE)
    const upright = calculateSheetLayout(PHOTO_6X4, mm(35), mm(45), UPRIGHT_ONLY)
    expect(layout.capacity).toBeGreaterThanOrEqual(upright.capacity)
  })

  it('returns an empty layout when the photo is larger than the paper', () => {
    const layout = calculateSheetLayout(PHOTO_6X4, mm(300), mm(400))
    expect(layout.capacity).toBe(0)
    expect(layout.placements).toHaveLength(0)
  })

  it('counts columns without an off-by-one in the gutter arithmetic', () => {
    // 194 mm usable, 35 mm photos, 4 mm gutters:
    // 5 photos = 175 + 4 gutters = 191 mm, fits. 6 = 210 + 20 = 230, does not.
    const layout = calculateSheetLayout(A4, mm(35), mm(45), UPRIGHT_ONLY)
    const width = layout.columns * 35 + (layout.columns - 1) * 4
    expect(width).toBeLessThanOrEqual(A4.width - 2 * DEFAULT_SHEET_OPTIONS.margin)
  })
})

describe('sheetsRequired', () => {
  it('needs one sheet for a full page and two for one more', () => {
    const layout = calculateSheetLayout(A4, mm(35), mm(45), UPRIGHT_ONLY)
    expect(sheetsRequired(layout, 25)).toBe(1)
    expect(sheetsRequired(layout, 26)).toBe(2)
    expect(sheetsRequired(layout, 1)).toBe(1)
  })
})

describe('placementsFor', () => {
  it('returns only as many positions as copies requested', () => {
    const layout = calculateSheetLayout(A4, mm(35), mm(45), UPRIGHT_ONLY)
    expect(placementsFor(layout, 4)).toHaveLength(4)
    expect(placementsFor(layout, 99)).toHaveLength(layout.capacity)
  })
})
