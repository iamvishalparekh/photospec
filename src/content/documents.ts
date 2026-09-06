import { PRESETS } from '@domain/photo-spec/catalog/presets'
import type { PhotoSpec } from '@domain/photo-spec/model/PhotoSpec'

/**
 * Per-document editorial content.
 *
 * Deliberately separate from `PhotoSpec`: the domain holds measurements that
 * must be correct, this holds prose that must be useful. Mixing them would mean
 * a copy edit touching the file that decides whether someone's crop is legal.
 */
export interface DocumentContent {
  readonly specId: string
  /** URL segment for this document's landing page. */
  readonly slug: string
  readonly searchTitle: string
  readonly metaDescription: string
  readonly intro: string
  readonly commonRejections: readonly string[]
  readonly faq: readonly { question: string; answer: string }[]
}

export const DOCUMENT_CONTENT: readonly DocumentContent[] = [
  {
    specId: 'schengen-visa',
    slug: 'schengen-visa-photo',
    searchTitle: 'Schengen Visa Photo Maker: 35 × 45 mm, Free, No Upload',
    metaDescription:
      'Make a compliant 35 × 45 mm Schengen visa photo from a phone picture. Correct 32–36 mm head height, plain background, printable sheet. Free, in your browser, never uploaded.',
    intro:
      'A Schengen visa photo is 35 mm wide and 45 mm tall, with the head measuring 32 to 36 millimetres from the chin to the top of the head, between 70% and 80% of the frame. The same photograph is accepted across all Schengen countries, so one correct photo works whether you are applying through France, Germany, Italy, Spain or any other member state.',
    commonRejections: [
      'Head too small. This is the single most common reason. A photo cropped only to 35 × 45 mm without checking head height will usually be the wrong proportion.',
      'Shadows on the background from standing too close to the wall.',
      'Smiling, or an open mouth. The expression must be neutral.',
      'Hair covering the eyes, or glasses causing reflections.',
      'A photo older than six months.',
      'Printed on plain paper rather than photo paper.',
    ],
    faq: [
      {
        question: 'What size is a Schengen visa photo?',
        answer:
          '35 mm wide by 45 mm tall, printed at 600 dpi or better on photo-quality paper. Two identical copies are usually required.',
      },
      {
        question: 'How big should the head be in a Schengen visa photo?',
        answer:
          '32 to 36 mm measured from the bottom of the chin to the top of the head, including hair. That is 70–80% of the 45 mm height.',
      },
      {
        question: 'Does a Schengen photo need a white or grey background?',
        answer:
          'The official guidance asks for a plain light-coloured background and states a preference for light grey. Plain white is very widely accepted in practice. This tool defaults to light grey for Schengen and lets you switch to white.',
      },
      {
        question: 'Can I use the same photo for every Schengen country?',
        answer:
          'Yes. The photo requirement is common across the Schengen area, so a compliant photo works for any member state’s application.',
      },
    ],
  },
  {
    specId: 'uk-passport',
    slug: 'uk-passport-photo',
    searchTitle: 'UK Passport Photo Maker: 35 × 45 mm, Free, No Upload',
    metaDescription:
      'Make a UK passport photo from a phone picture. 35 × 45 mm with correct head height, plain background and a printable sheet. Free, runs in your browser, never uploaded.',
    intro:
      'A UK passport photo is 35 mm wide and 45 mm tall. The head must measure between 29 and 34 millimetres from chin to crown, which is a slightly smaller head than a Schengen visa photo of the same overall size, one of several reasons a photo accepted for one document can be rejected for another.',
    commonRejections: [
      'Head height outside the 29–34 mm range.',
      'A background that is not plain and light.',
      'Shadows across the face or behind the head.',
      'Anything covering the face, including a fringe over the eyes.',
      'Photos taken more than a month before applying, for a first passport.',
    ],
    faq: [
      {
        question: 'What size is a UK passport photo?',
        answer: '35 mm wide by 45 mm tall, the same overall size as a Schengen visa photo.',
      },
      {
        question: 'Is a UK passport photo the same as a Schengen visa photo?',
        answer:
          'The paper size is the same, but the head-height rule is not: the UK asks for 29–34 mm while Schengen asks for 32–36 mm. A photo at the top of the UK range may be at the bottom of the Schengen range.',
      },
    ],
  },
  {
    specId: 'us-passport',
    slug: 'us-passport-photo',
    searchTitle: 'US Passport & Visa Photo Maker: 2 × 2 inch, Free, No Upload',
    metaDescription:
      'Make a US passport or visa photo from a phone picture. 2 × 2 inches (51 × 51 mm) with correct head size, white background and a printable sheet. Free and never uploaded.',
    intro:
      'A US passport or visa photo is square: 2 × 2 inches, or 51 × 51 millimetres. The head must measure between 25 and 35 millimetres from chin to crown, which is 50–69% of the frame, a noticeably smaller head than European documents ask for, so a European photo cropped to a square will usually be wrong.',
    commonRejections: [
      'Head too large. A common mistake for anyone reusing a European-style photo.',
      'A background that is not plain white or off-white.',
      'Glasses. The United States no longer accepts photos with glasses in almost all cases.',
      'Digital alteration or filters, including beauty modes some phones apply by default.',
    ],
    faq: [
      {
        question: 'What size is a US passport photo?',
        answer:
          '2 × 2 inches, which is 51 × 51 millimetres, printed at 300 dpi or better on photo paper.',
      },
      {
        question: 'Why is the head smaller than in a European photo?',
        answer:
          'The US follows the general ICAO guidance of 50–69% head height, while Schengen and most European documents ask for 70–80%. The rule genuinely differs by document, which is why this tool stores head height per document rather than as a single setting.',
      },
    ],
  },
  {
    specId: 'india-passport',
    slug: 'india-passport-photo',
    searchTitle: 'India Passport Photo Maker: 35 × 45 mm, Free, No Upload',
    metaDescription:
      'Make an India passport photo from a phone picture. 35 × 45 mm with a plain white background, correct head height and a printable sheet. Free, in your browser, never uploaded.',
    intro:
      'An India passport photo is 35 mm wide and 45 mm tall on a plain white background, with the face centred and occupying most of the frame. The same size is used for many Indian visa and OCI applications, though individual forms sometimes ask for a different size, so check your specific form.',
    commonRejections: [
      'A background that is off-white, cream or shadowed rather than plain white.',
      'The face too small in the frame.',
      'A photo printed on plain paper rather than photo paper.',
      'Uneven lighting leaving one side of the face darker.',
    ],
    faq: [
      {
        question: 'What size is an India passport photo?',
        answer: '35 mm wide by 45 mm tall on a plain white background.',
      },
      {
        question: 'Can I use this for an OCI or Indian visa application?',
        answer:
          'The 35 × 45 mm white-background format covers many Indian applications, but forms vary and some ask for a square photo. Check the size your specific form requires, then use the custom size option if it differs.',
      },
    ],
  },
  {
    specId: 'canada-passport',
    slug: 'canada-passport-photo',
    searchTitle: 'Canada Passport Photo Maker: 50 × 70 mm, Free, No Upload',
    metaDescription:
      'Make a Canada passport photo from a phone picture. 50 × 70 mm with correct 31–36 mm head height, plain background and a printable sheet. Free and never uploaded.',
    intro:
      'A Canadian passport photo is 50 mm wide and 70 mm tall, an unusually tall format compared with most countries, with the head measuring 31 to 36 millimetres from chin to crown. Because the photo is taller, the head occupies a much smaller share of the frame than in a 35 × 45 mm photo.',
    commonRejections: [
      'Using a 35 × 45 mm photo, which is the wrong size entirely.',
      'Head height outside the 31–36 mm range.',
      'A background that is not plain and uniform.',
    ],
    faq: [
      {
        question: 'What size is a Canadian passport photo?',
        answer: '50 mm wide by 70 mm tall, which is larger and proportionally taller than most.',
      },
    ],
  },
]

export function contentFor(specId: string): DocumentContent | undefined {
  return DOCUMENT_CONTENT.find((entry) => entry.specId === specId)
}

export function specFor(content: DocumentContent): PhotoSpec | undefined {
  return PRESETS.find((preset) => preset.id === content.specId)
}

/** Every document page that should exist, with its spec resolved. */
export function documentPages(): { content: DocumentContent; spec: PhotoSpec }[] {
  return DOCUMENT_CONTENT.flatMap((content) => {
    const spec = specFor(content)
    return spec ? [{ content, spec }] : []
  })
}
