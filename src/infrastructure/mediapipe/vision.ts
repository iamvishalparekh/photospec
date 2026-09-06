import { FilesetResolver } from '@mediapipe/tasks-vision'

/**
 * Where the model files come from.
 *
 * These are Google's own hosted copies of the MediaPipe models. Both are
 * Apache-2.0 licensed and are downloaded once, then cached by the browser.
 * Nothing about your photo is sent anywhere: the download is one-way, the
 * inference happens locally in WebAssembly.
 *
 * To vendor them instead, drop the files into `public/models/` and change
 * these to '/models/selfie_segmenter.tflite' and '/models/face_landmarker.task'.
 */
export const MODEL_URLS = {
  wasmRoot: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm',
  segmenter:
    'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
  faceLandmarker:
    'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
} as const

let filesetPromise: ReturnType<typeof FilesetResolver.forVisionTasks> | null = null

/**
 * The WASM runtime is several megabytes and shared by both models, so it is
 * resolved once and reused. Kept out of the adapters themselves so neither has
 * to know the other exists.
 */
export function visionFileset(): ReturnType<typeof FilesetResolver.forVisionTasks> {
  filesetPromise ??= FilesetResolver.forVisionTasks(MODEL_URLS.wasmRoot)
  return filesetPromise
}
