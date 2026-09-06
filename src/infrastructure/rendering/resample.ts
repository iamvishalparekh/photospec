/**
 * High quality resampling and sharpening on a canvas.
 *
 * Two things the naive approach gets wrong:
 *
 * 1. `imageSmoothingQuality` defaults to 'low'. One line, and it was missing
 *    from the subject draw. Every photo was being resampled with the cheapest
 *    filter the browser offers.
 *
 * 2. Browsers downscale in a single step using a small filter kernel. Going
 *    from a 4000 px crop straight to 1063 px throws away most of the source
 *    pixels without averaging them, which produces aliasing on hair and fabric.
 *    Halving repeatedly averages every pixel on the way down and looks
 *    dramatically better. This is a well-known canvas technique and costs a few
 *    milliseconds.
 */

export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas

export function createCanvas(width: number, height: number): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

export function context2d(canvas: AnyCanvas): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser did not provide a 2D canvas context')
  const context = ctx as CanvasRenderingContext2D
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  return context
}

/** Bounds the first intermediate canvas so a 48 MP source cannot exhaust memory. */
const MAX_INTERMEDIATE_SCALE = 4

export interface SourceRegion {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/**
 * Draw a region of `source` into a new canvas of exactly `width` x `height`,
 * stepping down by halves when the reduction is large.
 *
 * @param filter optional CSS filter applied during the first draw only, so
 *               enhancement happens at full source resolution rather than after
 *               detail has already been discarded.
 */
export function resampleRegion(
  source: CanvasImageSource,
  region: SourceRegion,
  width: number,
  height: number,
  filter?: string,
): AnyCanvas {
  // Step one: pull the region out, capped so huge sources stay affordable.
  const firstWidth = Math.max(width, Math.min(region.width, width * MAX_INTERMEDIATE_SCALE))
  const firstHeight = Math.max(height, Math.min(region.height, height * MAX_INTERMEDIATE_SCALE))

  let current = createCanvas(Math.round(firstWidth), Math.round(firstHeight))
  const ctx = context2d(current)
  if (filter) ctx.filter = filter
  ctx.drawImage(
    source,
    region.x,
    region.y,
    region.width,
    region.height,
    0,
    0,
    current.width,
    current.height,
  )
  ctx.filter = 'none'

  // Step two: halve until one more halving would overshoot the target.
  while (current.width / 2 >= width && current.height / 2 >= height) {
    const next = createCanvas(Math.round(current.width / 2), Math.round(current.height / 2))
    context2d(next).drawImage(current, 0, 0, next.width, next.height)
    current = next
  }

  if (current.width === width && current.height === height) return current

  const output = createCanvas(width, height)
  context2d(output).drawImage(current, 0, 0, width, height)
  return output
}

/**
 * Unsharp mask.
 *
 * Resampling always softens an image a little, and upscaling softens it a lot.
 * Sharpening cannot recover detail that was never captured, nothing can, but
 * it restores the local contrast that resampling averaged away, which is most
 * of what people mean when they say a photo looks soft.
 *
 * Applied to colour only; the alpha channel is left alone so the soft edge
 * around hair is not turned back into a hard cut-out.
 */
export function sharpen(canvas: AnyCanvas, amount: number): void {
  if (amount <= 0) return

  const ctx = context2d(canvas)
  const { width, height } = canvas
  const image = ctx.getImageData(0, 0, width, height)
  const source = new Uint8ClampedArray(image.data)

  // A 3x3 Laplacian: centre weight 1 + 4a, four neighbours -a each. The weights
  // sum to 1, so flat areas keep their brightness and only edges are affected.
  const a = amount * 0.6
  const centre = 1 + 4 * a

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4
      for (let channel = 0; channel < 3; channel++) {
        const p = i + channel
        image.data[p] =
          centre * source[p]! -
          a * source[p - 4]! -
          a * source[p + 4]! -
          a * source[p - width * 4]! -
          a * source[p + width * 4]!
      }
    }
  }

  ctx.putImageData(image, 0, 0)
}
