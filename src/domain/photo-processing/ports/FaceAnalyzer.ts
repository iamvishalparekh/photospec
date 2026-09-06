/**
 * Locates facial landmarks in an image.
 *
 * Note what this port does *not* promise: a crown. Landmark models cannot find
 * the top of the head because hair is not a facial feature. The crown is
 * derived in the domain by CrownLocator, from the segmentation mask.
 */
export interface FaceLandmarks {
  readonly chinY: number
  readonly eyeLineY: number
  readonly faceCentreX: number
  readonly faceLeft: number
  readonly faceRight: number
}

export interface FaceAnalyzer {
  /** @returns landmarks, or null when no face (or more than one) is found. */
  analyze(image: ImageBitmap): Promise<FaceLandmarks | null>
  dispose(): void
}
