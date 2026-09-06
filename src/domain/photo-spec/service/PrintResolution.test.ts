import { describe, expect, it } from 'vitest'
import { SCHENGEN_VISA, US_PASSPORT } from '../catalog/presets'
import {
  chooseOutputDpi,
  MAX_OUTPUT_DPI,
  requiresUpscaling,
  supportedDpi,
} from './PrintResolution'

describe('chooseOutputDpi', () => {
  it('uses the detail a close-up phone photo actually has, not just the minimum', () => {
    // 1372 px across a 35 mm print supports about 996 dpi.
    const chosen = chooseOutputDpi(SCHENGEN_VISA, 1372)
    expect(chosen).toBeGreaterThan(SCHENGEN_VISA.minDpi)
    expect(chosen).toBeCloseTo(996, -1)
  })

  it('never drops below what the authority requires, even for a poor source', () => {
    expect(chooseOutputDpi(SCHENGEN_VISA, 400)).toBe(SCHENGEN_VISA.minDpi)
  })

  it('stops at the ceiling rather than making a pointlessly huge file', () => {
    expect(chooseOutputDpi(SCHENGEN_VISA, 6000)).toBe(MAX_OUTPUT_DPI)
  })

  it('respects each spec’s own minimum', () => {
    // The US spec asks for 300 dpi, not 600, over a wider 51 mm print.
    expect(chooseOutputDpi(US_PASSPORT, 300)).toBe(US_PASSPORT.minDpi)
  })

  it('reports the resolution a source genuinely supports', () => {
    expect(supportedDpi(SCHENGEN_VISA, 827)).toBeCloseTo(600, 0)
  })

  it('knows when pixels have to be invented', () => {
    expect(requiresUpscaling(SCHENGEN_VISA, 549)).toBe(true)
    expect(requiresUpscaling(SCHENGEN_VISA, 1372)).toBe(false)
  })
})
