import { describe, expect, it } from 'vitest'
import { dpi, mm } from '@domain/shared/units'
import type { CropSolution } from '@domain/photo-processing/service/CropSolver'
import { SCHENGEN_VISA, UK_PASSPORT } from '../catalog/presets'
import { checkCompliance, worstSeverity } from './ComplianceChecker'

function solution(overrides: Partial<CropSolution> = {}): CropSolution {
  return {
    crop: { x: 0, y: 0, width: 1200, height: 1543 },
    achieved: {
      headHeight: mm(34),
      eyeLineFromBottom: mm(28),
      headHeightRatio: 34 / 45,
      headroom: mm(3.3),
    },
    fitsWithinSource: true,
    wasShifted: false,
    headFullyVisible: true,
    ...overrides,
  }
}

const severityOf = (results: ReturnType<typeof checkCompliance>, id: string) =>
  results.find((r) => r.id === id)?.severity

describe('checkCompliance', () => {
  it('passes a well-formed Schengen photo on every automatic rule', () => {
    const results = checkCompliance(SCHENGEN_VISA, solution(), dpi(600))
    expect(severityOf(results, 'head-height')).toBe('pass')
    expect(severityOf(results, 'eye-line')).toBe('pass')
    expect(severityOf(results, 'framing')).toBe('pass')
    expect(worstSeverity(results)).toBe('pass')
  })

  it('warns rather than fails when head height is just outside tolerance', () => {
    const results = checkCompliance(
      SCHENGEN_VISA,
      solution({ achieved: { headHeight: mm(31.5), eyeLineFromBottom: mm(28), headHeightRatio: 0.7, headroom: mm(3.3) } }),
      dpi(600),
    )
    expect(severityOf(results, 'head-height')).toBe('warn')
  })

  it('fails a head that is well outside tolerance and says which way to move', () => {
    const results = checkCompliance(
      SCHENGEN_VISA,
      solution({ achieved: { headHeight: mm(26), eyeLineFromBottom: mm(28), headHeightRatio: 0.58, headroom: mm(3.3) } }),
      dpi(600),
    )
    const rule = results.find((r) => r.id === 'head-height')
    expect(rule?.severity).toBe('fail')
    expect(rule?.message).toContain('26.0')
    expect(rule?.message).toContain('Move closer')
  })

  it('tells the applicant to step back when the head is too large', () => {
    const results = checkCompliance(
      SCHENGEN_VISA,
      solution({ achieved: { headHeight: mm(41), eyeLineFromBottom: mm(28), headHeightRatio: 0.91, headroom: mm(3.3) } }),
      dpi(600),
    )
    expect(results.find((r) => r.id === 'head-height')?.message).toContain('Move further')
  })

  it('fails a photo framed too tightly to crop', () => {
    const results = checkCompliance(SCHENGEN_VISA, solution({ fitsWithinSource: false }), dpi(600))
    expect(severityOf(results, 'framing')).toBe('fail')
    expect(worstSeverity(results)).toBe('fail')
  })

  it('warns when the crop must be upscaled to reach the print resolution', () => {
    const results = checkCompliance(
      SCHENGEN_VISA,
      solution({ crop: { x: 0, y: 0, width: 600, height: 771 } }),
      dpi(600),
    )
    expect(severityOf(results, 'resolution')).toBe('warn')
  })

  it('skips the eye-line rule for specs that do not state one', () => {
    const results = checkCompliance(UK_PASSPORT, solution(), dpi(600))
    expect(results.some((r) => r.id === 'eye-line')).toBe(false)
  })

  it('warns that an unverified preset should be checked against the authority', () => {
    const results = checkCompliance(UK_PASSPORT, solution(), dpi(600))
    expect(severityOf(results, 'preset-confidence')).toBe('warn')
  })

  it('fails when a manual drag has pushed the head out of the frame', () => {
    const results = checkCompliance(SCHENGEN_VISA, solution({ headFullyVisible: false }), dpi(600))
    const rule = results.find((r) => r.id === 'head-in-frame')
    expect(rule?.severity).toBe('fail')
    expect(rule?.message).toContain('Drag the photo down')
  })

  it('states the measured value in every message so the advice is actionable', () => {
    const results = checkCompliance(SCHENGEN_VISA, solution(), dpi(600))
    expect(results.find((r) => r.id === 'head-height')?.message).toContain('34.0 mm')
  })
})
