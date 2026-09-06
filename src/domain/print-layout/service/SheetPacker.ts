import { mm } from '@domain/shared/units'
import type { PaperSize } from '../model/PaperSize'
import type { SheetOptions } from '../model/SheetLayout'
import type {
  PackedPlacement,
  PackedSheet,
  PackResult,
  PrintItem,
  UnplacedItem,
} from '../model/PrintItem'
import { calculateSheetLayout, DEFAULT_SHEET_OPTIONS } from './SheetLayoutCalculator'

/**
 * Arrange a queue of photos onto as few sheets as possible.
 *
 * Two strategies, chosen automatically:
 *
 * **Uniform**. Every queued photo is the same size, which is the common case
 * (a family all applying for Schengen visas). The existing grid calculator
 * handles it, giving a tidy centred grid with even margins, and we simply hand
 * out its positions in queue order.
 *
 * **Mixed**, sizes differ, so a single grid cannot work and this becomes a
 * two-dimensional bin-packing problem. We use next-fit decreasing height, the
 * standard shelf heuristic: sort tallest first, lay them left to right in rows,
 * start a new row when the width runs out. Sorting by height first is what makes
 * it work. The tallest item in each row sets the row height, so no vertical
 * space is wasted by a short item opening a tall row.
 *
 * Shelf packing is not optimal, optimal 2D packing is NP-hard, but for a
 * handful of ID photos it is within a photo or two of perfect and runs
 * instantly.
 */
export function packSheets(
  paper: PaperSize,
  items: readonly PrintItem[],
  options: SheetOptions = DEFAULT_SHEET_OPTIONS,
): PackResult {
  const queue = items.filter((item) => item.copies > 0)
  if (queue.length === 0) {
    return { sheets: [], unplaced: [], uniformGrid: true, totalPlaced: 0 }
  }

  return isUniform(queue)
    ? packUniform(paper, queue, options)
    : packMixed(paper, queue, options)
}

function isUniform(items: readonly PrintItem[]): boolean {
  const first = items[0]!
  return items.every((item) => item.width === first.width && item.height === first.height)
}

/** Every photo the same size: reuse the tidy centred grid. */
function packUniform(
  paper: PaperSize,
  items: readonly PrintItem[],
  options: SheetOptions,
): PackResult {
  const first = items[0]!
  const layout = calculateSheetLayout(paper, first.width, first.height, options)

  if (layout.capacity === 0) {
    return {
      sheets: [],
      uniformGrid: true,
      totalPlaced: 0,
      unplaced: items.map((item) => ({
        itemId: item.id,
        copies: item.copies,
        reason: `A ${paper.name} sheet is too small for a ${item.width} x ${item.height} mm photo.`,
      })),
    }
  }

  const sheets: PackedSheet[] = []
  let placements: PackedPlacement[] = []
  let placed = 0

  for (const item of items) {
    for (let copy = 0; copy < item.copies; copy++) {
      const slot = layout.placements[placements.length]!
      placements.push({ ...slot, itemId: item.id })
      placed++

      if (placements.length === layout.capacity) {
        sheets.push({ index: sheets.length, placements })
        placements = []
      }
    }
  }

  if (placements.length > 0) sheets.push({ index: sheets.length, placements })
  return { sheets, unplaced: [], uniformGrid: true, totalPlaced: placed }
}

/** Mixed sizes: next-fit decreasing height shelf packing. */
function packMixed(
  paper: PaperSize,
  items: readonly PrintItem[],
  options: SheetOptions,
): PackResult {
  const usableWidth = paper.width - 2 * options.margin
  const usableHeight = paper.height - 2 * options.margin

  const unplaced: UnplacedItem[] = []
  const copies: { itemId: string; width: number; height: number }[] = []

  for (const item of items) {
    if (item.width > usableWidth || item.height > usableHeight) {
      unplaced.push({
        itemId: item.id,
        copies: item.copies,
        reason: `A ${item.width} x ${item.height} mm photo does not fit on ${paper.name}.`,
      })
      continue
    }
    for (let copy = 0; copy < item.copies; copy++) {
      copies.push({ itemId: item.id, width: item.width, height: item.height })
    }
  }

  // Tallest first, so the first item in each row sets that row's height.
  copies.sort((a, b) => b.height - a.height || b.width - a.width)

  const sheets: PackedSheet[] = []
  let placements: PackedPlacement[] = []
  // Plain numbers, not Millimetres: these accumulate through arithmetic and are
  // converted back at the point a placement is created.
  let cursorX: number = options.margin
  let cursorY: number = options.margin
  let rowHeight = 0

  const startSheet = () => {
    if (placements.length > 0) sheets.push({ index: sheets.length, placements })
    placements = []
    cursorX = options.margin
    cursorY = options.margin
    rowHeight = 0
  }

  for (const copy of copies) {
    // Out of width: begin a new row below the current one.
    if (cursorX + copy.width > options.margin + usableWidth + 1e-9) {
      cursorY += rowHeight + options.gutter
      cursorX = options.margin
      rowHeight = 0
    }
    // Out of height: begin a new sheet.
    if (cursorY + copy.height > options.margin + usableHeight + 1e-9) {
      startSheet()
    }

    placements.push({
      itemId: copy.itemId,
      x: mm(cursorX),
      y: mm(cursorY),
      width: mm(copy.width),
      height: mm(copy.height),
      rotated: false,
    })

    cursorX += copy.width + options.gutter
    rowHeight = Math.max(rowHeight, copy.height)
  }

  if (placements.length > 0) sheets.push({ index: sheets.length, placements })

  return {
    sheets,
    unplaced,
    uniformGrid: false,
    totalPlaced: sheets.reduce((sum, sheet) => sum + sheet.placements.length, 0),
  }
}

/** How many more photos would fit on the last sheet before a new one is needed. */
export function spareCapacity(paper: PaperSize, items: readonly PrintItem[], options: SheetOptions = DEFAULT_SHEET_OPTIONS): number | null {
  const queue = items.filter((i) => i.copies > 0)
  if (queue.length === 0 || !isUniform(queue)) return null

  const first = queue[0]!
  const layout = calculateSheetLayout(paper, first.width, first.height, options)
  if (layout.capacity === 0) return null

  const used = queue.reduce((sum, item) => sum + item.copies, 0) % layout.capacity
  return used === 0 ? 0 : layout.capacity - used
}
