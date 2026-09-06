import type { PaperSize } from '../model/PaperSize'
import type { PackedSheet } from '../model/PrintItem'
import type { SheetOptions } from '../model/SheetLayout'

export interface SheetDocumentRequest {
  readonly paper: PaperSize
  /**
   * Every queued photo, keyed by item id. A sheet may mix several people, so
   * the writer looks each placement's photo up rather than receiving one image.
   */
  readonly photos: ReadonlyMap<string, Blob>
  readonly sheets: readonly PackedSheet[]
  readonly options: SheetOptions
  /** Printed faintly in the margin so a reprint is reproducible. */
  readonly caption: string
}

/**
 * Writes a print-ready document. Implemented by a pdf-lib adapter; could just
 * as well be implemented by an SVG or PNG writer without the domain noticing.
 */
export interface DocumentWriter {
  write(request: SheetDocumentRequest): Promise<Blob>
}
