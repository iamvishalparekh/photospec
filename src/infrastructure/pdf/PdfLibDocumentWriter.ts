import { degrees, PDFDocument, rgb, type PDFImage, type PDFPage } from 'pdf-lib'
import { mmToPoints } from '@domain/shared/units'
import type {
  DocumentWriter,
  SheetDocumentRequest,
} from '@domain/print-layout/ports/DocumentWriter'

/** Faint grey for the cut guides, visible enough to follow, faint enough to trim off. */
const GUIDE_GREY = rgb(0.75, 0.75, 0.75)
const GUIDE_WIDTH = 0.25

/**
 * Writes the print sheet as a PDF.
 *
 * PDF geometry is in points measured from the *bottom* left, while the domain
 * lays photos out in millimetres from the *top* left, the way a person reads a
 * page. The flip happens here, at the boundary, so the domain never has to
 * think upside down.
 */
export class PdfLibDocumentWriter implements DocumentWriter {
  async write(request: SheetDocumentRequest): Promise<Blob> {
    const pdf = await PDFDocument.create()
    pdf.setTitle(request.caption)
    pdf.setCreator('PhotoSpec')

    // Each distinct photo is embedded once and reused across every position it
    // appears in, so twenty copies of one face do not mean twenty copies of the
    // image data in the file.
    const embedded = new Map<string, PDFImage>()
    for (const [id, blob] of request.photos) {
      embedded.set(id, await pdf.embedPng(new Uint8Array(await blob.arrayBuffer())))
    }

    const pageWidth = mmToPoints(request.paper.width)
    const pageHeight = mmToPoints(request.paper.height)

    for (const sheet of request.sheets) {
      const page = pdf.addPage([pageWidth, pageHeight])

      for (const placement of sheet.placements) {
        const image = embedded.get(placement.itemId)
        if (!image) continue

        const width = mmToPoints(placement.width)
        const height = mmToPoints(placement.height)
        const x = mmToPoints(placement.x)
        const y = pageHeight - mmToPoints(placement.y) - height

        if (placement.rotated) drawTurned(page, image, x, y, width, height)
        else page.drawImage(image, { x, y, width, height })

        if (request.options.cutGuides) {
          page.drawRectangle({
            x,
            y,
            width,
            height,
            borderColor: GUIDE_GREY,
            borderWidth: GUIDE_WIDTH,
          })
        }
      }

      const pageLabel =
        request.sheets.length > 1
          ? `${request.caption}, sheet ${sheet.index + 1} of ${request.sheets.length}`
          : request.caption

      page.drawText(pageLabel, {
        x: mmToPoints(request.options.margin),
        y: mmToPoints(request.options.margin) / 2,
        size: 6,
        color: GUIDE_GREY,
      })
    }

    return new Blob([(await pdf.save()) as BlobPart], { type: 'application/pdf' })
  }
}

/**
 * Draw a portrait photo turned a quarter turn into a landscape box.
 *
 * pdf-lib rotates about the placement's lower-left corner, counter-clockwise.
 * A quarter turn sends an offset (u, v) to (-v, u), so the image ends up
 * entirely to the LEFT of the anchor point. Anchoring at the box's lower-RIGHT
 * corner therefore lands it exactly inside the box.
 *
 * The width and height passed to drawImage are the photo's own dimensions, not
 * the box's, they are what gets rotated. Passing the box dimensions is what
 * produced a squashed face instead of a turned one.
 */
function drawTurned(
  page: PDFPage,
  image: PDFImage,
  x: number,
  y: number,
  boxWidth: number,
  boxHeight: number,
): void {
  page.drawImage(image, {
    x: x + boxWidth,
    y,
    width: boxHeight,
    height: boxWidth,
    rotate: degrees(90),
  })
}
