import { deflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { mm } from '@domain/shared/units'
import { A4 } from '@domain/print-layout/model/PaperSize'
import type { PrintItem } from '@domain/print-layout/model/PrintItem'
import { DEFAULT_SHEET_OPTIONS } from '@domain/print-layout/service/SheetLayoutCalculator'
import { packSheets } from '@domain/print-layout/service/SheetPacker'
import { PdfLibDocumentWriter } from './PdfLibDocumentWriter'

/** Minimal solid-colour PNG encoder, so the test ships no binary fixtures. */
function solidPng(width: number, height: number, rgbColour: [number, number, number]): Blob {
  const raw = Buffer.alloc(height * (1 + width * 3))
  for (let y = 0; y < height; y++) {
    const row = y * (1 + width * 3)
    raw[row] = 0 // filter: none
    for (let x = 0; x < width; x++) {
      raw[row + 1 + x * 3] = rgbColour[0]
      raw[row + 2 + x * 3] = rgbColour[1]
      raw[row + 3 + x * 3] = rgbColour[2]
    }
  }

  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc32 = (buffer: Buffer) => {
    let c = 0xffffffff
    for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff]! ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4)
    length.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body))
    return Buffer.concat([length, body, crc])
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // truecolour

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])

  return new Blob([png], { type: 'image/png' })
}

const item = (id: string, copies: number): PrintItem => ({
  id,
  label: id,
  width: mm(35),
  height: mm(45),
  copies,
})

describe('PdfLibDocumentWriter with a mixed queue', () => {
  it('writes one page holding all three people’s photos', async () => {
    // The reported scenario: 2 of one person, 4 each of two others.
    const items = [item('red', 2), item('green', 4), item('blue', 4)]
    const packed = packSheets(A4, items)

    const photos = new Map<string, Blob>([
      ['red', solidPng(35, 45, [220, 40, 50])],
      ['green', solidPng(35, 45, [40, 180, 90])],
      ['blue', solidPng(35, 45, [50, 90, 220])],
    ])

    const pdf = await new PdfLibDocumentWriter().write({
      paper: A4,
      photos,
      sheets: packed.sheets,
      options: DEFAULT_SHEET_OPTIONS,
      caption: '10 photos · Schengen visa · made with PhotoSpec',
    })

    expect(pdf.type).toBe('application/pdf')
    const bytes = Buffer.from(await pdf.arrayBuffer())
    expect(bytes.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(packed.sheets).toHaveLength(1)

    // Every queued person must appear in the file. pdf-lib writes each embedded
    // image as its own stream, so three distinct photos means three streams.
    const streams = bytes.toString('latin1').match(/\/Subtype\s*\/Image/g) ?? []
    expect(streams).toHaveLength(3)
  })

  it('embeds each distinct photo once, not once per copy', async () => {
    // Twenty copies of one face must not mean twenty copies of the image data.
    const one = await new PdfLibDocumentWriter().write({
      paper: A4,
      photos: new Map([['a', solidPng(200, 260, [200, 60, 60])]]),
      sheets: packSheets(A4, [item('a', 1)]).sheets,
      options: DEFAULT_SHEET_OPTIONS,
      caption: 'one',
    })
    const twenty = await new PdfLibDocumentWriter().write({
      paper: A4,
      photos: new Map([['a', solidPng(200, 260, [200, 60, 60])]]),
      sheets: packSheets(A4, [item('a', 20)]).sheets,
      options: DEFAULT_SHEET_OPTIONS,
      caption: 'twenty',
    })
    // Twenty placements add a little geometry, but nothing like 20x the bytes.
    expect(twenty.size).toBeLessThan(one.size * 2)
  })

  it('writes a page per sheet when the queue overflows', async () => {
    const packed = packSheets(A4, [item('a', 30)])
    expect(packed.sheets).toHaveLength(2)
    const pdf = await new PdfLibDocumentWriter().write({
      paper: A4,
      photos: new Map([['a', solidPng(35, 45, [10, 10, 10])]]),
      sheets: packed.sheets,
      options: DEFAULT_SHEET_OPTIONS,
      caption: 'overflow',
    })
    expect(pdf.size).toBeGreaterThan(0)
  })
})
