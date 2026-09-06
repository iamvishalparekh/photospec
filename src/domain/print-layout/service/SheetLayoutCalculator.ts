import { mm, type Millimetres } from '@domain/shared/units'
import type { PaperSize } from '../model/PaperSize'
import type { Placement, SheetLayout, SheetOptions } from '../model/SheetLayout'

export const DEFAULT_SHEET_OPTIONS: SheetOptions = {
  margin: mm(8),
  gutter: mm(4),
  allowRotation: false,
  cutGuides: true,
}

/**
 * Work out how many photos fit on a sheet and where each one goes.
 *
 * Both orientations are tried and the one that fits more photos wins, because
 * turning a 35x45 photo sideways can be the difference between 25 and 24 per
 * A4 sheet and paper is not free.
 *
 * The grid is centred inside the printable area rather than pushed to the top
 * left, so a slightly misaligned printer wastes margin evenly on both sides
 * instead of clipping the last row.
 */
export function calculateSheetLayout(
  paper: PaperSize,
  photoWidth: Millimetres,
  photoHeight: Millimetres,
  options: SheetOptions = DEFAULT_SHEET_OPTIONS,
): SheetLayout {
  const upright = gridFor(paper, photoWidth, photoHeight, options, false)
  if (!options.allowRotation) return upright

  const sideways = gridFor(paper, photoHeight, photoWidth, options, true)
  return sideways.capacity > upright.capacity ? sideways : upright
}

function gridFor(
  paper: PaperSize,
  width: Millimetres,
  height: Millimetres,
  options: SheetOptions,
  rotated: boolean,
): SheetLayout {
  const usableWidth = paper.width - 2 * options.margin
  const usableHeight = paper.height - 2 * options.margin

  const columns = countThatFit(usableWidth, width, options.gutter)
  const rows = countThatFit(usableHeight, height, options.gutter)

  if (columns === 0 || rows === 0) {
    return { columns: 0, rows: 0, capacity: 0, rotated, placements: [] }
  }

  const gridWidth = columns * width + (columns - 1) * options.gutter
  const gridHeight = rows * height + (rows - 1) * options.gutter
  const originX = options.margin + (usableWidth - gridWidth) / 2
  const originY = options.margin + (usableHeight - gridHeight) / 2

  const placements: Placement[] = []
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      placements.push({
        x: mm(originX + column * (width + options.gutter)),
        y: mm(originY + row * (height + options.gutter)),
        width,
        height,
        rotated,
      })
    }
  }

  return { columns, rows, capacity: columns * rows, rotated, placements }
}

/**
 * How many items of `size` fit across `available` with `gutter` between them.
 *
 * The gutter is added to both sides of the division so that n items need
 * (n-1) gutters, not n. Getting this off by one is how print sheets end up
 * with a row hanging off the bottom of the page.
 */
function countThatFit(available: number, size: number, gutter: number): number {
  if (size <= 0 || available < size) return 0
  return Math.floor((available + gutter) / (size + gutter))
}

/** How many sheets are needed to print `copies` photos at this layout. */
export function sheetsRequired(layout: SheetLayout, copies: number): number {
  if (layout.capacity === 0) return 0
  return Math.ceil(copies / layout.capacity)
}

/** The placements actually used when printing `copies` photos on one sheet. */
export function placementsFor(layout: SheetLayout, copies: number): readonly Placement[] {
  return layout.placements.slice(0, Math.min(copies, layout.capacity))
}
