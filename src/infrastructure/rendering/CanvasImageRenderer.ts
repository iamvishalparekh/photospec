import { effectiveDpi, px } from '@domain/shared/units'
import type {
  ImageRenderer,
  RenderRequest,
  RenderedPhoto,
} from '@domain/photo-processing/ports/ImageRenderer'
import type { AlphaMask } from '@domain/photo-processing/service/CrownLocator'
import {
  context2d,
  createCanvas,
  resampleRegion,
  sharpen,
  type AnyCanvas,
} from './resample'

/**
 * Composites the final photo on a canvas.
 *
 * The order matters and is not obvious:
 *
 *   1. resample the cropped subject, enhanced, onto a transparent canvas
 *   2. punch the segmentation mask through it with `destination-in`,
 *      which keeps the subject only where the mask says "person"
 *   3. draw that result on top of a flat background fill
 *   4. sharpen, last, so the mask edge is already soft before we touch it
 *
 * Doing 2 and 3 the other way round, background first, then masked subject,
 * bleeds the original background colour through the soft edge of the mask and
 * leaves a halo around the hair.
 */
export class CanvasImageRenderer implements ImageRenderer {
  async render(request: RenderRequest): Promise<RenderedPhoto> {
    const { outputWidthPx: width, outputHeightPx: height } = request

    // Enhancement is applied during the first draw, at source resolution, so
    // brightness and contrast act on real pixels rather than resampled ones.
    const subject = resampleRegion(
      request.image,
      request.crop,
      width,
      height,
      filterFor(request),
    )

    const subjectCtx = context2d(subject)
    subjectCtx.globalCompositeOperation = 'destination-in'
    subjectCtx.drawImage(maskCanvas(request.mask, request.crop, width, height), 0, 0)
    subjectCtx.globalCompositeOperation = 'source-over'

    const output = createCanvas(width, height)
    const outputCtx = context2d(output)
    outputCtx.fillStyle = request.backgroundColour
    outputCtx.fillRect(0, 0, width, height)
    outputCtx.drawImage(subject, 0, 0)

    sharpen(output, request.enhancement.sharpness)

    return {
      blob: await toBlob(output),
      widthPx: width,
      heightPx: height,
      dpi: effectiveDpi(px(width), request.outputWidthMm),
    }
  }
}

/**
 * Turn the enhancement settings into a CSS filter string.
 *
 * Canvas filters are hardware accelerated and applied during the draw, which is
 * far faster than walking the pixel array by hand, and for the gentle
 * adjustments an ID photo needs, indistinguishable in quality. Sharpening is
 * the exception and is done separately, because CSS has no unsharp mask.
 */
function filterFor(request: RenderRequest): string {
  const { brightness, contrast, saturation, warmth } = request.enhancement
  const parts = [
    `brightness(${(1 + brightness * 0.5).toFixed(3)})`,
    `contrast(${(1 + contrast * 0.5).toFixed(3)})`,
    `saturate(${(1 + saturation * 0.5).toFixed(3)})`,
  ]
  if (warmth !== 0) {
    // Sepia leans the image warm; hue-rotate steers it back for cool values.
    parts.push(`sepia(${Math.abs(warmth * 0.3).toFixed(3)})`)
    if (warmth < 0) parts.push('hue-rotate(180deg)')
  }
  return parts.join(' ')
}

/**
 * Render the mask into a canvas matching the output framing.
 *
 * The mask arrives at the model's own working resolution, 256x256 for the
 * selfie segmenter, so it is scaled and cropped exactly like the photo, or the
 * alpha lands offset from the face. It goes through the same stepped resampler,
 * which keeps the soft hair edge smooth instead of blocky.
 */
function maskCanvas(
  mask: AlphaMask,
  crop: RenderRequest['crop'],
  width: number,
  height: number,
): AnyCanvas {
  const full = createCanvas(mask.width, mask.height)
  const fullCtx = context2d(full)
  const image = fullCtx.createImageData(mask.width, mask.height)

  for (let i = 0; i < mask.width * mask.height; i++) {
    const offset = i * 4
    image.data[offset] = 255
    image.data[offset + 1] = 255
    image.data[offset + 2] = 255
    image.data[offset + 3] = mask.data[i] ?? 0
  }
  fullCtx.putImageData(image, 0, 0)

  return resampleRegion(full, crop, width, height)
}

async function toBlob(canvas: AnyCanvas): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: 'image/png' })
  }
  return new Promise((resolve, reject) => {
    ;(canvas as HTMLCanvasElement).toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Canvas produced no image data'))
    }, 'image/png')
  })
}
