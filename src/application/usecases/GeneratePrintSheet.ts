import type { PhotoSpec } from '@domain/photo-spec/model/PhotoSpec'
import type { DocumentWriter } from '@domain/print-layout/ports/DocumentWriter'
import type { PaperSize } from '@domain/print-layout/model/PaperSize'
import type { PrintItem, UnplacedItem } from '@domain/print-layout/model/PrintItem'
import type { SheetOptions } from '@domain/print-layout/model/SheetLayout'
import { DEFAULT_SHEET_OPTIONS } from '@domain/print-layout/service/SheetLayoutCalculator'
import { packSheets } from '@domain/print-layout/service/SheetPacker'

/** One prepared photo waiting to be printed, with the image itself attached. */
export interface QueuedPhoto {
  readonly id: string
  readonly label: string
  readonly spec: PhotoSpec
  readonly photo: Blob
  readonly copies: number
}

export interface PrintSheetRequest {
  readonly queue: readonly QueuedPhoto[]
  readonly paper: PaperSize
  readonly options?: SheetOptions
}

export interface PrintSheet {
  readonly document: Blob
  readonly sheetCount: number
  readonly placed: number
  readonly unplaced: readonly UnplacedItem[]
}

export class NothingToPrintError extends Error {
  constructor() {
    super('There is nothing in the print queue yet.')
    this.name = 'NothingToPrintError'
  }
}

export class SheetTooSmallError extends Error {
  constructor(paper: string) {
    super(`A ${paper} sheet is too small for the photos in the queue.`)
    this.name = 'SheetTooSmallError'
  }
}

/**
 * Turn the print queue into a PDF.
 *
 * The queue can hold several different people, and several different document
 * types, at once, which is the whole point. Printing two photos for one person
 * and four each for two others used to mean three sheets and two mostly-empty
 * pieces of photo paper.
 */
export class GeneratePrintSheet {
  constructor(private readonly writer: DocumentWriter) {}

  async execute(request: PrintSheetRequest): Promise<PrintSheet> {
    const queue = request.queue.filter((entry) => entry.copies > 0)
    if (queue.length === 0) throw new NothingToPrintError()

    const options = request.options ?? DEFAULT_SHEET_OPTIONS
    const items: PrintItem[] = queue.map((entry) => ({
      id: entry.id,
      label: entry.label,
      width: entry.spec.width,
      height: entry.spec.height,
      copies: entry.copies,
    }))

    const packed = packSheets(request.paper, items, options)
    if (packed.sheets.length === 0) throw new SheetTooSmallError(request.paper.name)

    const document = await this.writer.write({
      paper: request.paper,
      photos: new Map(queue.map((entry) => [entry.id, entry.photo])),
      sheets: packed.sheets,
      options,
      caption: captionFor(queue),
    })

    return {
      document,
      sheetCount: packed.sheets.length,
      placed: packed.totalPlaced,
      unplaced: packed.unplaced,
    }
  }
}

function captionFor(queue: readonly QueuedPhoto[]): string {
  const specs = [...new Set(queue.map((entry) => entry.spec.name))].join(', ')
  const total = queue.reduce((sum, entry) => sum + entry.copies, 0)
  return `${total} photo${total === 1 ? '' : 's'} · ${specs} · made with PhotoSpec`
}
