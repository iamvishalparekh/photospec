import { describe, expect, it } from 'vitest'
import { mm } from '@domain/shared/units'
import { A4, PHOTO_6X4 } from '../model/PaperSize'
import type { PrintItem } from '../model/PrintItem'
import { DEFAULT_SHEET_OPTIONS } from './SheetLayoutCalculator'
import { packSheets, spareCapacity } from './SheetPacker'

const schengen = (id: string, copies: number): PrintItem => ({
  id,
  label: id,
  width: mm(35),
  height: mm(45),
  copies,
})

/** Every placement must sit inside the printable area. */
function assertInsideMargins(result: ReturnType<typeof packSheets>, paper = A4) {
  const m = DEFAULT_SHEET_OPTIONS.margin
  for (const sheet of result.sheets) {
    for (const p of sheet.placements) {
      expect(p.x).toBeGreaterThanOrEqual(m - 1e-6)
      expect(p.y).toBeGreaterThanOrEqual(m - 1e-6)
      expect(p.x + p.width).toBeLessThanOrEqual(paper.width - m + 1e-6)
      expect(p.y + p.height).toBeLessThanOrEqual(paper.height - m + 1e-6)
    }
  }
}

/** No two photos may overlap, or they print on top of each other. */
function assertNoOverlaps(result: ReturnType<typeof packSheets>) {
  for (const sheet of result.sheets) {
    const ps = sheet.placements
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i]!, b = ps[j]!
        const separated =
          a.x + a.width <= b.x + 1e-9 ||
          b.x + b.width <= a.x + 1e-9 ||
          a.y + a.height <= b.y + 1e-9 ||
          b.y + b.height <= a.y + 1e-9
        expect(separated, `placement ${i} overlaps ${j}`).toBe(true)
      }
    }
  }
}

describe('packSheets, all photos the same size', () => {
  // The case that prompted this feature: two of one person, four each of two
  // others. Three separate sheets before; one sheet now.
  const family = [schengen('vishal', 2), schengen('kinjal', 4), schengen('mum', 4)]

  it('puts ten photos of three people on a single A4 sheet', () => {
    const result = packSheets(A4, family)
    expect(result.sheets).toHaveLength(1)
    expect(result.totalPlaced).toBe(10)
  })

  it('gives each person exactly the number of copies they asked for', () => {
    const result = packSheets(A4, family)
    const counts = new Map<string, number>()
    for (const p of result.sheets[0]!.placements) {
      counts.set(p.itemId, (counts.get(p.itemId) ?? 0) + 1)
    }
    expect(counts.get('vishal')).toBe(2)
    expect(counts.get('kinjal')).toBe(4)
    expect(counts.get('mum')).toBe(4)
  })

  it('keeps the tidy centred grid when everything is one size', () => {
    const result = packSheets(A4, family)
    expect(result.uniformGrid).toBe(true)
  })

  it('never overlaps or overflows the page', () => {
    const result = packSheets(A4, family)
    assertInsideMargins(result)
    assertNoOverlaps(result)
  })

  it('spills onto a second sheet past 25 photos', () => {
    const result = packSheets(A4, [schengen('a', 25), schengen('b', 3)])
    expect(result.sheets).toHaveLength(2)
    expect(result.sheets[0]!.placements).toHaveLength(25)
    expect(result.sheets[1]!.placements).toHaveLength(3)
    expect(result.totalPlaced).toBe(28)
  })

  it('reports nothing placed when the photo is bigger than the paper', () => {
    const huge: PrintItem = { id: 'x', label: 'x', width: mm(300), height: mm(400), copies: 1 }
    const result = packSheets(PHOTO_6X4, [huge])
    expect(result.sheets).toHaveLength(0)
    expect(result.unplaced).toHaveLength(1)
  })

  it('ignores queue entries asking for zero copies', () => {
    const result = packSheets(A4, [schengen('a', 4), schengen('b', 0)])
    expect(result.totalPlaced).toBe(4)
  })

  it('handles an empty queue without inventing a sheet', () => {
    const result = packSheets(A4, [])
    expect(result.sheets).toHaveLength(0)
    expect(result.totalPlaced).toBe(0)
  })
})

describe('packSheets, mixed photo sizes', () => {
  const mixed: PrintItem[] = [
    schengen('schengen', 4),
    { id: 'us', label: 'US', width: mm(51), height: mm(51), copies: 2 },
    { id: 'canada', label: 'Canada', width: mm(50), height: mm(70), copies: 2 },
  ]

  it('packs different sizes onto one sheet rather than refusing', () => {
    const result = packSheets(A4, mixed)
    expect(result.uniformGrid).toBe(false)
    expect(result.totalPlaced).toBe(8)
    expect(result.sheets).toHaveLength(1)
  })

  it('never overlaps photos of different sizes', () => {
    assertNoOverlaps(packSheets(A4, mixed))
  })

  it('keeps every photo inside the printable area', () => {
    assertInsideMargins(packSheets(A4, mixed))
  })

  it('preserves each photo’s own dimensions', () => {
    const result = packSheets(A4, mixed)
    const byId = new Map(result.sheets.flatMap((s) => s.placements).map((p) => [p.itemId, p]))
    expect(byId.get('schengen')!.width).toBe(35)
    expect(byId.get('us')!.width).toBe(51)
    expect(byId.get('canada')!.height).toBe(70)
  })

  it('drops only the oversized item and still places the rest', () => {
    const result = packSheets(PHOTO_6X4, [schengen('ok', 2), {
      id: 'toobig', label: 'too big', width: mm(300), height: mm(400), copies: 1,
    }])
    expect(result.unplaced.map((u) => u.itemId)).toEqual(['toobig'])
    expect(result.totalPlaced).toBe(2)
  })
})

describe('spareCapacity', () => {
  it('reports how many more would fit before a new sheet is needed', () => {
    expect(spareCapacity(A4, [schengen('a', 10)])).toBe(15)
  })

  it('reports zero when the sheet is exactly full', () => {
    expect(spareCapacity(A4, [schengen('a', 25)])).toBe(0)
  })

  it('declines to guess for a mixed-size queue', () => {
    expect(
      spareCapacity(A4, [schengen('a', 2), { id: 'b', label: 'b', width: mm(51), height: mm(51), copies: 1 }]),
    ).toBeNull()
  })
})
