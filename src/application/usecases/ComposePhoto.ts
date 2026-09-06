import { mm, mmToPx, type Dpi } from '@domain/shared/units'
import type { PhotoSpec } from '@domain/photo-spec/model/PhotoSpec'
import { chooseOutputDpi } from '@domain/photo-spec/service/PrintResolution'
import {
  checkCompliance,
  type ComplianceResult,
} from '@domain/photo-spec/service/ComplianceChecker'
import type {
  Enhancement,
  ImageRenderer,
  RenderedPhoto,
} from '@domain/photo-processing/ports/ImageRenderer'
import { NO_ADJUSTMENT, type CropAdjustment } from '@domain/photo-processing/model/CropAdjustment'
import { solveCrop, type CropSolution } from '@domain/photo-processing/service/CropSolver'
import type { PhotoAnalysis } from './AnalysePhoto'

export interface ComposeRequest {
  readonly analysis: PhotoAnalysis
  readonly spec: PhotoSpec
  readonly enhancement: Enhancement
  readonly adjustment?: CropAdjustment
  readonly backgroundColour?: string
  readonly outputDpi?: Dpi
}

export interface ComposedPhoto {
  readonly photo: RenderedPhoto
  readonly solution: CropSolution
  readonly compliance: readonly ComplianceResult[]
}

/**
 * Everything that depends on the user's choices: which document, how bright,
 * where they dragged the frame.
 *
 * This is the fast half. No models run here, so it is cheap enough to call on
 * every frame of a drag.
 */
export class ComposePhoto {
  constructor(private readonly renderer: ImageRenderer) {}

  async execute(request: ComposeRequest): Promise<ComposedPhoto> {
    const { analysis, spec } = request
    const solution = solveCrop(
      analysis.face,
      { width: analysis.image.width, height: analysis.image.height },
      spec,
      request.adjustment ?? NO_ADJUSTMENT,
    )

    // Resolution is chosen from the crop, so it has to come after the solve:
    // a user who zooms in is using fewer source pixels for the same print.
    const outputDpi = request.outputDpi ?? chooseOutputDpi(spec, solution.crop.width)

    const photo = await this.renderer.render({
      image: analysis.image,
      mask: analysis.mask,
      crop: solution.crop,
      outputWidthPx: mmToPx(spec.width, outputDpi),
      outputHeightPx: mmToPx(spec.height, outputDpi),
      outputWidthMm: mm(spec.width),
      backgroundColour: request.backgroundColour ?? spec.background.colour,
      enhancement: request.enhancement,
    })

    return { photo, solution, compliance: checkCompliance(spec, solution, outputDpi) }
  }
}
