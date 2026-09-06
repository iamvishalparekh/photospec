# Architecture

PhotoSpec is a hexagonal (ports and adapters) application with a domain-driven
core. It is a browser app, but the parts that matter do not know that.

## Why this shape for a front-end app

The arithmetic in this project can quietly ruin someone's visa application. A
crop that is 2 mm off, an off-by-one in the sheet grid, a rounding error in the
DPI, none of these throw an exception. They produce a photo that looks fine and
gets rejected at the counter.

So the risky logic is isolated into pure functions with no browser dependency,
where it can be tested exhaustively in milliseconds. Everything that *is* browser
dependent, models, canvas, files, is pushed to the edges where it does nothing
but move bytes.

## The layers

```
                    +---------------------------+
                    |            ui             |   React components, theme
                    +-------------+-------------+
                                  | depends on
                    +-------------v-------------+
                    |        application        |   use cases, orchestration
                    +-------------+-------------+
                                  | depends on
                    +-------------v-------------+
                    |          domain           |   pure TypeScript
                    |  models, services, PORTS  |   no framework, no DOM
                    +-------------^-------------+
                                  | implements ports
                    +-------------+-------------+
                    |      infrastructure       |   MediaPipe, canvas, pdf-lib
                    +---------------------------+
```

Note the direction of the bottom arrow. Infrastructure depends on the domain, not
the other way round. The domain declares an interface describing what it needs;
infrastructure supplies a class that satisfies it. This is what keeps the core
testable and the adapters replaceable.

## Bounded contexts

The domain is divided by subject matter, not by technical layer:

| Context | Answers the question | Key types |
|---|---|---|
| `photo-spec` | What does a compliant photo look like? | `PhotoSpec`, `MmRange`, `ComplianceChecker` |
| `photo-processing` | How do we turn this image into that photo? | `FaceGeometry`, `CropSolver`, `CrownLocator`, `CropAdjustment` |
| `print-layout` | How do these photos sit on paper? | `PaperSize`, `SheetLayoutCalculator`, `SheetPacker`, `PrintItem` |

A new feature usually belongs cleanly in one of these, or announces itself as a
fourth.

## The ports

| Port | Implemented by | Could also be |
|---|---|---|
| `BackgroundRemover` | `MediaPipeBackgroundRemover` | A different model, or a manual brush tool |
| `FaceAnalyzer` | `MediaPipeFaceAnalyzer` | Draggable guide lines the user positions by hand |
| `ImageRenderer` | `CanvasImageRenderer` | A WebGL renderer, or `sharp` in a Node CLI |
| `DocumentWriter` | `PdfLibDocumentWriter` | An SVG or multi-page PNG writer |

## Units are types, not numbers

`Millimetres`, `Pixels`, `Points` and `Dpi` are branded number types in
`src/domain/shared/units.ts`. At runtime they are ordinary numbers with zero
cost; at compile time TypeScript refuses to let you pass pixels where
millimetres belong.

This exists because mixing the two is the most likely bug in the codebase and the
hardest to notice: nothing crashes, the photo just comes out the wrong size.

## Rounding, and why the exported DPI is not round

35 mm at 600 dpi is 826.77 pixels. Images cannot have fractional widths, so we
round to 827. That makes the photo very slightly wider than 35 mm at exactly
600 dpi.

Rather than accept the drift, `effectiveDpi()` computes the resolution those 827
pixels *actually* represent (600.17 dpi) and that value is what goes into the
export. The printed millimetres stay exact; only the metadata is unusual.

## Why analysis and composition are separate use cases

`AnalysePhoto` runs the two neural networks and depends only on the photograph.
`ComposePhoto` runs the arithmetic and one canvas draw, and depends on
everything the user can change: document type, brightness, where they dragged
the frame.

Splitting them is what makes the drag-to-reposition gesture feel instant. The
models run once per photo; dragging re-runs only the cheap half.

## The constraint priority in CropSolver

The vertical position of the crop obeys three rules in a strict order:

1. **Hard**. The crown stays in frame with real space above it.
2. **Default**. The head sits conventionally, about 30% of the leftover space
   above the crown.
3. **Soft**. The eye-line rule is satisfied, but only far enough to get inside
   the permitted band.

The first version ran rule 3 first and aimed at the *midpoint* of the eye-line
band. For Schengen that midpoint implies eyes about 39% of the way down the
head; real eyes sit at 44–52% depending on hair volume. The solver chased an
impossible target and cropped the tops of people's heads off. `CropSolver.test.ts`
now asserts the whole head stays visible across the full 40–56% range.

## Two packing strategies

`SheetPacker` chooses between them automatically:

**Uniform**. Every queued photo is the same size, which is the common case (a
family all applying for Schengen visas). `SheetLayoutCalculator` produces a tidy
centred grid and the packer hands out its positions in queue order.

**Mixed**, sizes differ, so no single grid works and this becomes
two-dimensional bin packing. We use next-fit decreasing height: sort tallest
first, lay photos left to right in rows, start a new row when the width runs out.
Sorting by height first is what makes it work. The tallest photo in each row
sets the row height, so no vertical space is wasted by a short photo opening a
tall row.

Shelf packing is not optimal; optimal 2D packing is NP-hard. For a handful of ID
photos it lands within a photo or two of perfect and runs instantly, which is the
right trade.

## Testing strategy

| Layer | Tested how |
|---|---|
| `domain` | Unit tests, no browser, no mocks needed. 52 of them and counting. |
| `application` | Use cases take ports, so fakes are trivial to write. |
| `infrastructure` | Mostly verified by using the app, but the PDF writer has an integration test that builds a real multi-photo sheet from generated PNGs, print output is expensive to check by hand. |
| `ui` | Manual for now. |

The domain tests use realistic fixtures, a 3000×4000 phone photo with a
plausible face geometry, rather than convenient round numbers, because round
numbers hide rounding bugs.

## Extending it

| You want to | You change |
|---|---|
| Add or fix a country | One object in `photo-spec/catalog/presets.ts` |
| Add a paper size | One object in `print-layout/model/PaperSize.ts` |
| Use a better cutout model | One new class implementing `BackgroundRemover` |
| Add a compliance rule | One function in `ComplianceChecker` |
| Build a Node CLI that batches a folder | Reuse `domain` and `application`; write Node adapters |
| Let users position guides by hand | A second `FaceAnalyzer` implementation |

None of these require touching the others, which is the point.
