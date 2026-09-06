/**
 * Where the important landmarks sit in the *source* image, in source pixels.
 *
 * The domain does not care how these were found. A MediaPipe adapter produces
 * them today; a manual drag-the-guides UI could produce them tomorrow.
 */
export interface FaceGeometry {
  /** Top of the head *including hair*. See CrownLocator for why this is special. */
  readonly crownY: number
  /** Bottom of the chin. */
  readonly chinY: number
  /** Midpoint between the two pupils, vertically. */
  readonly eyeLineY: number
  /** Midpoint between the two pupils, horizontally. Used to centre the crop. */
  readonly faceCentreX: number
}

/** Chin-to-crown distance in source pixels. */
export function headHeightPx(face: FaceGeometry): number {
  return face.chinY - face.crownY
}

export function isPlausible(face: FaceGeometry): boolean {
  return (
    headHeightPx(face) > 0 &&
    face.eyeLineY > face.crownY &&
    face.eyeLineY < face.chinY &&
    Number.isFinite(face.faceCentreX)
  )
}
