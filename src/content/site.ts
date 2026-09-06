/**
 * Site-wide copy and URLs.
 *
 * This folder sits outside domain / application / infrastructure / ui on
 * purpose: it is neither business rules nor plumbing, it is the words the site
 * says. Both the React app and the build-time page generator read from here, so
 * the marketing copy and the app copy cannot drift apart.
 */

/**
 * Used when no site URL is supplied at build time.
 *
 * Deliberately NOT read from `process.env` here. This module is imported by the
 * React app, and `process` does not exist in a browser: Vite substitutes it
 * during a production build but not in dev, so a `process.env` reference here
 * builds cleanly and then throws on `npm run dev`, blanking the page. The build
 * script reads the environment variable instead, because that is Node, where it belongs.
 */
export const DEFAULT_SITE_URL = 'https://example.github.io/photospec'

export const SITE = {
  name: 'PhotoSpec',
  tagline: 'Passport and visa photos, made on your own device',
  url: DEFAULT_SITE_URL,
  description:
    'Free tool to make a compliant passport or visa photo from a phone picture. Correct head height, plain background and a print-ready sheet, all in your browser, with no upload.',
  author: 'Vishal Parekh',
  repository: 'https://github.com/iamvishalparekh/photospec',
} as const

/** Questions people actually search for, answered honestly. */
export const GENERAL_FAQ: readonly { question: string; answer: string }[] = [
  {
    question: 'Is my photo uploaded anywhere?',
    answer:
      'No. Everything happens inside your browser tab. There is no server to upload to. You can verify this by opening your browser network tab, or by turning off your internet after the page loads, the tool keeps working.',
  },
  {
    question: 'Is it free?',
    answer:
      'Yes, completely, with no account, no watermark, no limit on downloads and no advertising. It is an open-source project, not a business.',
  },
  {
    question: 'Why do most visa photos get rejected?',
    answer:
      'Usually head size, not photo size. Almost everyone gets the 35 × 45 mm right and the head height wrong. For a Schengen visa the head must measure 32–36 mm from chin to crown, which is 70–80% of the frame. This tool measures what it produced and tells you in millimetres.',
  },
  {
    question: 'Can I print these at home?',
    answer:
      'Yes. Download the print sheet as a PDF and print it at 100% scale. Never use "fit to page", which silently resizes it. Use photo paper of 200 gsm or heavier. Matte and glossy are both accepted; matte avoids glare when the photo is scanned.',
  },
  {
    question: 'What kind of photo should I start with?',
    answer:
      'A normal phone photo works. Face the camera straight on with a neutral expression, stand about an arm and a half away in front of a plain wall, use even indoor daylight rather than direct sun, and use the main camera rather than the selfie camera if you can. Transfer the original file rather than sending it through a messaging app, which reduces the resolution.',
  },
  {
    question: 'Will my photo definitely be accepted?',
    answer:
      'Nobody can promise that. This tool formats your photograph to the published measurements and tells you where it falls short. Whether a photo is accepted is always the decision of the issuing authority. Some authorities also state that photographs must not be digitally altered, and replacing a background is a digital alteration, check the rules for your specific application.',
  },
  {
    question: 'Can I put photos of several people on one sheet?',
    answer:
      'Yes. Prepare one person, add them to the sheet, then prepare the next. A family applying together shares a single sheet of photo paper instead of wasting one per person.',
  },
  {
    question: 'Does it work on a phone?',
    answer:
      'Yes. It runs in a mobile browser and you can take or choose a photo directly. The first visit downloads a few megabytes of model files, which are then cached.',
  },
]
