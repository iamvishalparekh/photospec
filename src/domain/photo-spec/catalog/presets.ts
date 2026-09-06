import { mm } from '@domain/shared/units'
import { mmRange, type PhotoSpec } from '../model/PhotoSpec'

/**
 * The preset catalogue.
 *
 * Adding or verifying a country is deliberately the easiest contribution to
 * make to this project: one object, one source URL, no build tooling. See
 * CONTRIBUTING.md.
 *
 * `confidence: 'unverified'` means the numbers came from secondary sources and
 * nobody has yet checked them against the issuing authority. The UI says so.
 */

const WHITE = { colour: '#FFFFFF', description: 'Plain white' }
const LIGHT_GREY = { colour: '#F2F2F2', description: 'Plain light grey' }

const UNIVERSAL_CHECKS = [
  'Taken within the last 6 months',
  'Neutral expression, mouth closed',
  'Eyes open and clearly visible, looking at the camera',
  'No hat or head covering, except worn daily for religious reasons',
  'No reflections or heavy frames if wearing glasses',
  'Even lighting, no shadows on the face or background',
] as const

export const SCHENGEN_VISA: PhotoSpec = {
  id: 'schengen-visa',
  name: 'Schengen visa',
  region: 'Europe',
  width: mm(35),
  height: mm(45),
  headHeight: mmRange(32, 36),
  eyeLineFromBottom: mmRange(24, 33),
  background: LIGHT_GREY,
  minDpi: 600,
  manualChecks: [...UNIVERSAL_CHECKS, 'Colour photograph, black and white is rejected'],
  source: {
    authority: 'Schengen Visa Info (aggregating EU Visa Code guidance)',
    url: 'https://schengenvisainfo.com/photo/',
    checkedOn: '2026-09-05',
    confidence: 'verified',
  },
}

export const UK_PASSPORT: PhotoSpec = {
  id: 'uk-passport',
  name: 'UK passport',
  region: 'Europe',
  width: mm(35),
  height: mm(45),
  headHeight: mmRange(29, 34),
  background: LIGHT_GREY,
  minDpi: 600,
  manualChecks: [...UNIVERSAL_CHECKS],
  source: {
    authority: 'HM Passport Office',
    url: 'https://www.gov.uk/photos-for-passports',
    checkedOn: '',
    confidence: 'unverified',
  },
}

export const US_PASSPORT: PhotoSpec = {
  id: 'us-passport',
  name: 'US passport & visa',
  region: 'Americas',
  width: mm(51),
  height: mm(51),
  headHeight: mmRange(25, 35),
  background: WHITE,
  minDpi: 300,
  manualChecks: [...UNIVERSAL_CHECKS],
  source: {
    authority: 'US Department of State',
    url: 'https://travel.state.gov/content/travel/en/passports/how-apply/photos.html',
    checkedOn: '',
    confidence: 'unverified',
  },
}

export const INDIA_PASSPORT: PhotoSpec = {
  id: 'india-passport',
  name: 'India passport',
  region: 'Asia',
  width: mm(35),
  height: mm(45),
  headHeight: mmRange(32, 36),
  background: WHITE,
  minDpi: 600,
  manualChecks: [...UNIVERSAL_CHECKS],
  source: {
    authority: 'Passport Seva, Ministry of External Affairs',
    url: 'https://www.passportindia.gov.in/',
    checkedOn: '',
    confidence: 'unverified',
  },
}

export const CANADA_PASSPORT: PhotoSpec = {
  id: 'canada-passport',
  name: 'Canada passport',
  region: 'Americas',
  width: mm(50),
  height: mm(70),
  headHeight: mmRange(31, 36),
  background: WHITE,
  minDpi: 600,
  manualChecks: [...UNIVERSAL_CHECKS],
  source: {
    authority: 'Immigration, Refugees and Citizenship Canada',
    url: 'https://www.canada.ca/en/immigration-refugees-citizenship.html',
    checkedOn: '',
    confidence: 'unverified',
  },
}

export const PRESETS: readonly PhotoSpec[] = [
  SCHENGEN_VISA,
  UK_PASSPORT,
  US_PASSPORT,
  INDIA_PASSPORT,
  CANADA_PASSPORT,
]

export const DEFAULT_PRESET = SCHENGEN_VISA

export function findPreset(id: string): PhotoSpec | undefined {
  return PRESETS.find((preset) => preset.id === id)
}

/**
 * Build a spec for a size the user typed in themselves.
 *
 * Head height defaults to the ICAO-style 70–80% of frame, which is what most
 * 35x45-style documents expect.
 */
export function customPreset(widthMm: number, heightMm: number): PhotoSpec {
  return {
    id: 'custom',
    name: `Custom ${widthMm} x ${heightMm} mm`,
    region: 'Custom',
    width: mm(widthMm),
    height: mm(heightMm),
    headHeight: mmRange(heightMm * 0.7, heightMm * 0.8),
    background: WHITE,
    minDpi: 600,
    manualChecks: [...UNIVERSAL_CHECKS],
    source: {
      authority: 'User supplied',
      url: '',
      checkedOn: '',
      confidence: 'unverified',
    },
  }
}
