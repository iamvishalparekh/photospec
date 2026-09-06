<div align="center">

# PhotoSpec

**Passport and visa photos, made on your own device.**

Turn a phone picture into a correctly sized, compliant ID photo, and a
print-ready sheet of them, without the image ever leaving your browser.

[Live app](https://iamvishalparekh.github.io/photospec/) ·
[How it works](docs/how-the-models-work.md) ·
[Architecture](docs/ARCHITECTURE.md) ·
[Contributing](CONTRIBUTING.md)

![License](https://img.shields.io/badge/license-MIT-blue)
![Runs offline](https://img.shields.io/badge/runs-100%25%20in%20browser-0e6f79)
![No upload](https://img.shields.io/badge/photos-never%20uploaded-2f6b45)

</div>

---

## What it does

You upload a photo. PhotoSpec:

- finds your face and, separately, the true top of your head, hair included
- separates you from whatever is behind you and replaces it with the required plain background
- crops so your head measures exactly what the document demands, in millimetres
- tells you in plain language when something is wrong, and what to do about it
- lays out as many copies as you want on A4 or photo paper, with cut guides, as a PDF
- **queues several people onto one sheet**, two photos for you, four each for two
  others is ten positions on a single sheet, not three sheets and two wasted ones

You can drag the frame yourself at any point, with guide lines showing where the
crown, eyes and chin are supposed to fall.

## Why it exists

Everybody knows a Schengen photo is 35 × 45 mm. Far fewer people know the head
must measure **32–36 mm from chin to crown**, 70–80% of the frame. Most rejected
photos are the right size with the wrong head height.

And the rule is not universal. The general ICAO standard used by the United
States wants the head at **50–69%** of the frame. The same face, the same
original photo, needs a materially different crop for a US passport than for a
Schengen visa. Almost every free tool online ignores this and crops to size only.

PhotoSpec treats head height as a property of each document, measures what it
actually achieved, and reports it back to you in millimetres.

## Privacy

This is the part that makes PhotoSpec different from every commercial
alternative, so it is worth being precise about.

- **Your photo is never uploaded.** There is no backend. There is nothing to
  upload it to.
- The two machine-learning models are downloaded once from Google's CDN and
  cached by your browser. That request carries nothing about you, and it happens
  before you have chosen a photo.
- **Turn your network off after the first load and the app still works.**
- No analytics, no cookies, no accounts, no tracking of any kind.

You do not have to take that on trust. Open your browser's network tab, prepare
a photo, and watch: after the model download there is no traffic at all.

## Supported documents

| Document | Size | Head height | Background | Numbers verified |
|---|---|---|---|---|
| Schengen visa | 35 × 45 mm | 32–36 mm | Light grey | ✅ |
| UK passport | 35 × 45 mm | 29–34 mm | Light grey | ⚠️ not yet |
| US passport & visa | 51 × 51 mm | 25–35 mm | White | ⚠️ not yet |
| India passport | 35 × 45 mm | 32–36 mm | White | ⚠️ not yet |
| Canada passport | 50 × 70 mm | 31–36 mm | White | ⚠️ not yet |
| Custom | any size | 70–80% of height | Your choice |, |

⚠️ means the measurements came from secondary sources and nobody has checked them
against the issuing authority. The app says so too, next to the preset and in the
compliance panel. **Verifying one of these rows is the most useful thing you
could contribute**, it takes about fifteen minutes and no JavaScript. See
[CONTRIBUTING.md](CONTRIBUTING.md).

---

## Use it however you like

PhotoSpec is MIT licensed. In plain terms, you may:

- **use it**, for anything, including commercially, without asking or paying
- **fork it** and take it in a completely different direction
- **self-host it** on your own domain, it is static files, so any web host works
- **rebrand it** for your own organisation, agency or visa centre
- **copy pieces of it** into your own project
- **sell** something built on it

The only condition is that you keep the copyright notice and licence text
somewhere in your distribution. No attribution in the UI is required, no
notification, no share-alike obligation.

**One thing the licence does not cover:** the name *PhotoSpec*, the logo and the
site branding. Copyright and trademark are separate, and MIT grants rights to the
code only. Fork it freely, but please publish your fork under your own name, see
[NOTICE.md](NOTICE.md). Saying your work is *based on* PhotoSpec is accurate and
welcome.

If you build something with it, I would enjoy hearing about it, but that is a
request, not a requirement.

### Running it locally

Requires Node 20 or newer.

```bash
git clone https://github.com/iamvishalparekh/photospec.git
cd photospec
npm install
npm run dev
```

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm test` | Run the domain unit tests |
| `npm run typecheck` | Type-check without emitting |
| `npm run lint` | Lint, including the architecture rules |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |

### Self-hosting

`npm run build` produces a `dist/` folder of static files. Upload it anywhere,
GitHub Pages, Netlify, Cloudflare Pages, S3, or your own nginx. There is no
server component, no database, no environment variables and no runtime
configuration.

If you are serving from a subpath rather than a domain root, set the base path at
build time:

```bash
PHOTOSPEC_BASE=/photospec/ npm run build
```

### Using the measurement logic on its own

The `src/domain` folder is pure TypeScript with no dependency on React, the DOM,
or any library. If you want the crop mathematics, the compliance rules or the
print-sheet layout for something else, a Node CLI, a mobile app, a server
service. You can lift that folder out wholesale and supply your own adapters.
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) explains the seams.

---

## How it works

Nine steps, from file to PDF:

1. **Ingest**, decode the file, honouring EXIF orientation so phone photos come out upright.
2. **Detect landmarks**, MediaPipe Face Landmarker returns 478 points; we take chin, eyes and face edges.
3. **Segment**, MediaPipe Selfie Segmentation returns a soft per-pixel probability that each pixel is you. Keeping those soft values, rather than thresholding them, is what stops hair looking cut out with scissors.
4. **Find the crown**, landmark models cannot locate the top of the head, because hair is not a facial feature. So we scan the segmentation mask downward inside the face's column. [This is the most interesting problem in the project.](docs/how-the-models-work.md#4-the-gap-between-them-and-why-we-wrote-crownlocator)
5. **Solve the crop**, scale from head height; vertical position keeps the crown safely in frame first and satisfies the eye-line rule second; horizontal centres on the face. You can then drag it yourself.
6. **Composite and enhance**, draw you over a flat background using the soft mask as alpha, resampling in halving steps and finishing with an unsharp mask.
7. **Check compliance**, measure the result and report every rule in millimetres.
8. **Lay out the sheet**, 25 Schengen photos fit upright on A4 at 8 mm margins with 4 mm gutters, or 28 turned a quarter turn. Queue several people and they share the sheet; mix document sizes and a shelf-packing heuristic fits them together.
9. **Export**, PNG at exact pixel dimensions, or a PDF with cut guides.

Steps 4, 5, 7 and 8 are pure functions with no browser dependency, which is why
they carry the test suite and the rest does not. Steps 1–3 are the slow half and
run once per photo; the rest re-run on every drag, which is why repositioning is
instant.

### On resolution

Output resolution is chosen from what your photo actually supports, up to 1200
dpi, rather than always dropping to the minimum the authority requires. A
close-up 12 MP phone photo supports around 1000 dpi across a 35 mm print.

PhotoSpec will **not** use a super-resolution model. Those invent plausible
facial detail, skin texture, eyelashes, a hairline, that was never
photographed. For a wallpaper that is delightful; for a document whose entire
purpose is proving a face is yours, it is the wrong thing to do. The line drawn
here is: rearrange and clean up what the camera recorded, never invent what it
did not.

## Architecture

Hexagonal, with the dependency arrows pointing inward:

```
ui  ->  application  ->  domain  <-  infrastructure
                        (pure)      (adapters implement
                                     the domain's ports)
```

The domain imports no framework, touches no DOM, and knows nothing about
MediaPipe, canvas or PDFs, a lint rule enforces this rather than trusting
discipline. Swapping the segmentation model means writing one class. Adding a
country means adding one object.

Full detail in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Contributing

Genuinely useful contributions exist at every level, and the most valuable one
needs no JavaScript at all: **verify a country's measurements against its issuing
authority**. See [CONTRIBUTING.md](CONTRIBUTING.md) for that and other good first
issues.

---

## Disclaimer

PhotoSpec formats your photograph to published measurements. **Whether a photo is
accepted is always the decision of the issuing authority.**

Some authorities state that photographs must not be digitally altered; replacing
a background is a digital alteration. Check the rules for your specific
application. This software is provided without warranty of any kind, see
[LICENSE](LICENSE).

PhotoSpec is an independent open-source project. It is not affiliated with,
endorsed by, or connected to any government, embassy, consulate, visa centre or
issuing authority.

## Search-engine pages

`npm run build` also generates a static HTML page per document type,
`/schengen-visa-photo/`, `/uk-passport-photo/` and so on, plus `sitemap.xml`
and `robots.txt`. Each page carries its own title, description, canonical URL and
schema.org structured data (`HowTo`, `FAQPage`, `BreadcrumbList`).

Every measurement on those pages is read from the domain layer at build time, so
the published requirements can never drift from what the tool actually does.

Set the site URL when you build, or canonical tags and the sitemap will point at
a placeholder:

```bash
PHOTOSPEC_SITE_URL=https://photospec.example.com npm run build
```

The generator is `scripts/generate-seo.ts` and the copy lives in `src/content/`.

## Licence

[MIT](LICENSE) © 2026 Vishal Parekh. Name and branding: see [NOTICE.md](NOTICE.md).

The MediaPipe models are Apache 2.0, © Google.
