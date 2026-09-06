import type { Millimetres } from '@domain/shared/units'
import type { Placement } from './SheetLayout'

/**
 * One entry in the print queue: a prepared photo and how many of it to print.
 *
 * The queue is what lets a family print together. Two photos of one person and
 * four each of two others used to mean three separate sheets and two wasted
 * pieces of photo paper; queued, they are ten positions on one sheet.
 */
export interface PrintItem {
  readonly id: string
  /** Shown in the queue and printed faintly beside the photo. */
  readonly label: string
  readonly width: Millimetres
  readonly height: Millimetres
  readonly copies: number
}

/** A placement that knows which queued photo belongs in it. */
export interface PackedPlacement extends Placement {
  readonly itemId: string
}

export interface PackedSheet {
  /** Zero-based page number. */
  readonly index: number
  readonly placements: readonly PackedPlacement[]
}

export interface UnplacedItem {
  readonly itemId: string
  readonly copies: number
  readonly reason: string
}

export interface PackResult {
  readonly sheets: readonly PackedSheet[]
  /** Copies that could not be placed, currently only ones larger than the paper. */
  readonly unplaced: readonly UnplacedItem[]
  /** True when every item was the same size and a tidy centred grid was used. */
  readonly uniformGrid: boolean
  readonly totalPlaced: number
}

export function totalCopies(items: readonly PrintItem[]): number {
  return items.reduce((sum, item) => sum + item.copies, 0)
}
