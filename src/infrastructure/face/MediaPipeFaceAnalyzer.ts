import { FaceLandmarker } from '@mediapipe/tasks-vision'
import type { FaceAnalyzer, FaceLandmarks } from '@domain/photo-processing/ports/FaceAnalyzer'
import { MODEL_URLS, visionFileset } from '../mediapipe/vision'

/**
 * Landmark indices in MediaPipe's 468-point face mesh.
 *
 * These are fixed by the model, so naming them is the difference between
 * readable code and a wall of magic numbers.
 */
const LANDMARK = {
  chin: 152,
  rightEyeOuter: 33,
  rightEyeInner: 133,
  leftEyeInner: 362,
  leftEyeOuter: 263,
  faceRightEdge: 234,
  faceLeftEdge: 454,
} as const

export class MediaPipeFaceAnalyzer implements FaceAnalyzer {
  private landmarker: FaceLandmarker | null = null

  private async ready(): Promise<FaceLandmarker> {
    if (this.landmarker) return this.landmarker
    const fileset = await visionFileset()
    this.landmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URLS.faceLandmarker, delegate: 'GPU' },
      runningMode: 'IMAGE',
      numFaces: 2, // Detect two so we can reject group photos rather than guess.
    })
    return this.landmarker
  }

  async analyze(image: ImageBitmap): Promise<FaceLandmarks | null> {
    const landmarker = await this.ready()
    const result = landmarker.detect(image)

    const faces = result.faceLandmarks
    if (!faces || faces.length !== 1) return null

    const points = faces[0]!
    const at = (index: number) => {
      const point = points[index]
      if (!point) throw new Error(`Landmark ${index} missing from the model output`)
      return { x: point.x * image.width, y: point.y * image.height }
    }

    const rightEye = midpointOf(at(LANDMARK.rightEyeOuter), at(LANDMARK.rightEyeInner))
    const leftEye = midpointOf(at(LANDMARK.leftEyeInner), at(LANDMARK.leftEyeOuter))

    return {
      chinY: at(LANDMARK.chin).y,
      eyeLineY: (rightEye.y + leftEye.y) / 2,
      faceCentreX: (rightEye.x + leftEye.x) / 2,
      faceLeft: Math.min(at(LANDMARK.faceRightEdge).x, at(LANDMARK.faceLeftEdge).x),
      faceRight: Math.max(at(LANDMARK.faceRightEdge).x, at(LANDMARK.faceLeftEdge).x),
    }
  }

  dispose(): void {
    this.landmarker?.close()
    this.landmarker = null
  }
}

function midpointOf(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}
