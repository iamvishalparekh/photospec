import type { AlphaMask } from '../service/CrownLocator'

/**
 * Separates the person from the background.
 *
 * The domain declares what it needs; infrastructure decides how. Today a
 * MediaPipe adapter implements this. Swapping in a different model, or a manual
 * brush tool, means writing one new class and changing one line of wiring.
 */
export interface BackgroundRemover {
  /** @returns an opacity mask the same size as the input, 255 = person. */
  removeBackground(image: ImageBitmap): Promise<AlphaMask>
  /** Frees any model resources held by the adapter. */
  dispose(): void
}
