import type { PhotoSpec } from '@domain/photo-spec/model/PhotoSpec'
import type { DocumentContent } from './documents'
import { GENERAL_FAQ, SITE } from './site'

/**
 * schema.org JSON-LD.
 *
 * Search engines use these to build rich results: the FAQ accordion and the
 * numbered how-to steps that appear directly in search listings. They are worth
 * more than any amount of keyword tuning, because they change what the listing
 * looks like rather than only where it ranks.
 */

type Json = Record<string, unknown>

export function webApplicationSchema(baseUrl: string): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: SITE.name,
    url: `${baseUrl}/`,
    description: SITE.description,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Any browser',
    browserRequirements: 'Requires JavaScript and WebAssembly',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    author: { '@type': 'Person', name: SITE.author },
    isAccessibleForFree: true,
    featureList: [
      'Automatic background replacement',
      'Automatic head-height cropping to each document’s rules',
      'Compliance checking in millimetres',
      'Printable multi-photo sheets as PDF',
      'Several people on one sheet',
      'Runs entirely in the browser with no upload',
    ],
  }
}

export function faqSchema(
  faq: readonly { question: string; answer: string }[] = GENERAL_FAQ,
): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: { '@type': 'Answer', text: entry.answer },
    })),
  }
}

export function howToSchema(spec: PhotoSpec, content: DocumentContent): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: `How to make a ${spec.name} photo at home`,
    description: content.metaDescription,
    totalTime: 'PT3M',
    supply: [
      { '@type': 'HowToSupply', name: 'A phone camera' },
      { '@type': 'HowToSupply', name: 'A plain wall' },
      { '@type': 'HowToSupply', name: 'Photo paper, 200 gsm or heavier' },
    ],
    step: [
      {
        '@type': 'HowToStep',
        name: 'Take the photo',
        text: 'Stand about an arm and a half from a plain wall in even daylight, face the camera straight on with a neutral expression, and have someone take the photo with the main camera.',
      },
      {
        '@type': 'HowToStep',
        name: 'Upload it',
        text: `Open ${SITE.name} and choose the photo. It is processed on your own device and never uploaded.`,
      },
      {
        '@type': 'HowToStep',
        name: `Choose ${spec.name}`,
        text: `The photo is cropped to ${spec.width} × ${spec.height} mm with the head at ${spec.headHeight.min}–${spec.headHeight.max} mm, and the background is replaced.`,
      },
      {
        '@type': 'HowToStep',
        name: 'Check the measurements',
        text: 'Every rule is reported in millimetres. Drag the photo to reposition it if you want a different framing.',
      },
      {
        '@type': 'HowToStep',
        name: 'Print it',
        text: 'Download the print sheet PDF and print at 100% scale on photo paper. Never use "fit to page".',
      },
    ],
  }
}

export function breadcrumbSchema(
  content: DocumentContent,
  spec: PhotoSpec,
  baseUrl: string,
): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE.name, item: `${baseUrl}/` },
      {
        '@type': 'ListItem',
        position: 2,
        name: spec.name,
        item: `${baseUrl}/${content.slug}/`,
      },
    ],
  }
}
