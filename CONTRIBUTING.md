# Contributing to PhotoSpec

Thank you for looking. There is a genuinely useful contribution here for almost
any level of experience.

## The most valuable thing you can do: verify a country

Most presets in this project are marked `unverified`, meaning the numbers came
from secondary sources and nobody has checked them against the government that
actually issues the document. **A wrong preset produces a confidently incorrect
photo**, which is worse than no preset at all.

Verifying one takes about fifteen minutes and needs no JavaScript:

1. Find the official requirements page for the country's passport or visa photo.
   Prefer the issuing authority itself over any third-party site.
2. Open `src/domain/photo-spec/catalog/presets.ts` and find the preset.
3. Check every number: width, height, head height range, background colour,
   minimum resolution.
4. Update `source` with the authority's real name, the official URL, today's date
   in `checkedOn`, and set `confidence: 'verified'`.
5. Run `npm test`. The catalogue tests will tell you if anything is inconsistent.
6. Open a pull request quoting the exact sentence from the official page.

If the official page contradicts what we have, **that is the most useful pull
request in the repository.** Say so in the description and we will merge it fast.

## Adding a new country

Same shape, new object:

```ts
export const EXAMPLE_PASSPORT: PhotoSpec = {
  id: 'example-passport',
  name: 'Example passport',
  region: 'Europe',
  width: mm(35),
  height: mm(45),
  headHeight: mmRange(32, 36),
  eyeLineFromBottom: mmRange(24, 33), // omit if the authority states no rule
  background: { colour: '#FFFFFF', description: 'Plain white' },
  minDpi: 600,
  manualChecks: [...UNIVERSAL_CHECKS],
  source: {
    authority: 'Example Passport Office',
    url: 'https://example.gov/photo-requirements',
    checkedOn: '2026-09-05',
    confidence: 'verified',
  },
}
```

Then add it to the `PRESETS` array. That is the whole change.

## Other good first issues

- **Test a photo of yourself and report what went wrong.** Different hair,
  lighting and skin tones stress the segmentation model in different ways, and we
  need reports from people who do not look like the maintainers. Do not attach
  your photo, describe what happened.
- **Translate the interface.** The strings are short and there is no i18n
  framework to learn yet; adding one would itself be a welcome contribution.
- **Improve the mask edge.** A guided filter or alpha-matting pass over the
  segmentation output would visibly improve hair.
- **Add a paper size.** `src/domain/print-layout/model/PaperSize.ts`.

## Ground rules for code

- **The domain layer stays pure.** No React, no DOM, no MediaPipe, no `window`
  under `src/domain`. If you need a capability from outside, declare a port
  interface and implement it in `src/infrastructure`.
- **New domain logic comes with tests.** The domain is where the arithmetic that
  can silently ruin someone's visa application lives.
- **Comments explain why, not what.** `// increment i` helps nobody; `// the
  gutter is added to both sides so n items need n-1 gutters` prevents a bug.
- **Run `npm test && npm run typecheck && npm run lint` before opening a PR.**

## What this project will not do

- Upload photos anywhere, or add a backend that could.
- Add analytics, tracking or accounts.
- Claim or imply that a photo will be accepted. We format to published
  measurements; the authority decides.
