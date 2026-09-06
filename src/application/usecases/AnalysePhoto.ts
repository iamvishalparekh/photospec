import type { BackgroundRemover } from '@domain/photo-processing/ports/BackgroundRemover'
import type { FaceAnalyzer } from '@domain/photo-processing/ports/FaceAnalyzer'
import { locateCrown, type AlphaMask } from '@domain/photo-processing/service/CrownLocator'
import type { FaceGeometry } from '@domain/photo-processing/model/FaceGeometry'

export type AnalyseStage = 'detecting-face' | 'removing-background' | 'locating-crown'

export interface PhotoAnalysis {
  readonly image: ImageBitmap
  readonly face: FaceGeometry
  readonly mask: AlphaMask
}

export class NoFaceDetectedError extends Error {
  constructor() {
    super('No single face was found. Use a photo with exactly one person, facing the camera.')
    this.name = 'NoFaceDetectedError'
  }
}

export class CrownNotFoundError extends Error {
  constructor() {
    super('The top of the head could not be located. Try a photo with a plainer background.')
    this.name = 'CrownNotFoundError'
  }
}

/**
 * Everything that depends only on the photograph, not on which document the
 * user picked.
 *
 * This is the slow half: it runs two neural networks and takes a second or so.
 * It is deliberately separated from composition so that changing the document
 * type, nudging a slider or dragging the frame re-renders instantly instead of
 * re-running the models.
 */
export class AnalysePhoto {
  constructor(
    private readonly faces: FaceAnalyzer,
    private readonly backgrounds: BackgroundRemover,
  ) {}

  async execute(
    image: ImageBitmap,
    onStage?: (stage: AnalyseStage) => void,
  ): Promise<PhotoAnalysis> {
    onStage?.('detecting-face')
    const landmarks = await this.faces.analyze(image)
    if (!landmarks) throw new NoFaceDetectedError()

    onStage?.('removing-background')
    const mask = await this.backgrounds.removeBackground(image)

    onStage?.('locating-crown')
    // The mask comes back at the model's own resolution, so the face window is
    // converted into mask pixels before searching.
    const scale = mask.width / image.width
    const crownInMask = locateCrown(mask, {
      faceLeft: landmarks.faceLeft * scale,
      faceRight: landmarks.faceRight * scale,
    })
    if (crownInMask === null) throw new CrownNotFoundError()

    return {
      image,
      mask,
      face: {
        crownY: crownInMask / scale,
        chinY: landmarks.chinY,
        eyeLineY: landmarks.eyeLineY,
        faceCentreX: landmarks.faceCentreX,
      },
    }
  }
}
