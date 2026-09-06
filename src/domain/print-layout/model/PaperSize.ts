import { mm, type Millimetres } from '@domain/shared/units'

export interface PaperSize {
  readonly id: string
  readonly name: string
  readonly width: Millimetres
  readonly height: Millimetres
}

export const A4: PaperSize = { id: 'a4', name: 'A4', width: mm(210), height: mm(297) }
export const A5: PaperSize = { id: 'a5', name: 'A5', width: mm(148), height: mm(210) }
export const LETTER: PaperSize = {
  id: 'letter',
  name: 'US Letter',
  width: mm(215.9),
  height: mm(279.4),
}
export const PHOTO_6X4: PaperSize = {
  id: 'photo-6x4',
  name: '6 x 4 inch photo paper',
  width: mm(152.4),
  height: mm(101.6),
}

export const PAPER_SIZES: readonly PaperSize[] = [A4, A5, LETTER, PHOTO_6X4]

export const DEFAULT_PAPER = A4
