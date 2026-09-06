import { ImageSegmenter } from '@mediapipe/tasks-vision'
import type { BackgroundRemover } from '@domain/photo-processing/ports/BackgroundRemover'
import type { AlphaMask } from '@domain/photo-processing/service/CrownLocator'
import { MODEL_URLS, visionFileset } from '../mediapipe/vision'

/**
 * Separates person from background using MediaPipe Selfie Segmentation.
 *
 * The model returns a *confidence* mask rather than a hard yes/no: each pixel
 * carries a probability that it belongs to the person. We keep those soft
 * values rather than thresholding them, because the soft edge is precisely what
 * stops hair looking like it was cut out with scissors.
 */
export class MediaPipeBackgroundRemover implements BackgroundRemover {
  private segmenter: ImageSegmenter | null = null

  private async ready(): Promise<ImageSegmenter> {
    if (this.segmenter) return this.segmenter
    const fileset = await visionFileset()
    this.segmenter = await ImageSegmenter.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URLS.segmenter, delegate: 'GPU' },
      runningMode: 'IMAGE',
      outputCategoryMask: false,
      outputConfidenceMasks: true,
    })
    return this.segmenter
  }

  async removeBackground(image: ImageBitmap): Promise<AlphaMask> {
    const segmenter = await this.ready()
    const result = segmenter.segment(image)

    try {
      const masks = result.confidenceMasks
      if (!masks || masks.length === 0) {
        throw new Error('Segmentation returned no mask')
      }

      // The selfie model emits [background, person] when it emits two masks,
      // and a single foreground mask when it emits one.
      const personMask = masks.length > 1 ? masks[1]! : masks[0]!
      const floats = personMask.getAsFloat32Array()

      const data = new Uint8Array(floats.length)
      for (let i = 0; i < floats.length; i++) {
        data[i] = Math.round((floats[i] ?? 0) * 255)
      }

      return { data, width: personMask.width, height: personMask.height }
    } finally {
      result.close()
    }
  }

  dispose(): void {
    this.segmenter?.close()
    this.segmenter = null
  }
}
