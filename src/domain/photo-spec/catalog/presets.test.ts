import { describe, expect, it } from 'vitest'
import { headHeightRatio } from '../model/PhotoSpec'
import { customPreset, PRESETS, SCHENGEN_VISA, US_PASSPORT, findPreset } from './presets'

describe('preset catalogue', () => {
  it('gives every preset a unique id', () => {
    const ids = PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('names an issuing authority and a source URL for every preset', () => {
    for (const preset of PRESETS) {
      expect(preset.source.authority, preset.id).not.toBe('')
      expect(preset.source.url, preset.id).toMatch(/^https:\/\//)
    }
  })

  it('records a check date for every preset marked verified', () => {
    for (const preset of PRESETS.filter((p) => p.source.confidence === 'verified')) {
      expect(preset.source.checkedOn, preset.id).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('keeps head height inside the photo it belongs to', () => {
    for (const preset of PRESETS) {
      expect(preset.headHeight.max, preset.id).toBeLessThan(preset.height)
      expect(preset.headHeight.min, preset.id).toBeGreaterThan(0)
    }
  })

  it('holds the Schengen numbers we verified against the source', () => {
    expect(SCHENGEN_VISA.width).toBe(35)
    expect(SCHENGEN_VISA.height).toBe(45)
    expect(SCHENGEN_VISA.headHeight).toEqual({ min: 32, max: 36 })
    expect(SCHENGEN_VISA.minDpi).toBe(600)
  })

  it('places Schengen head height at 70-80% of frame', () => {
    const ratio = headHeightRatio(SCHENGEN_VISA)
    expect(ratio.min).toBeCloseTo(0.711, 2)
    expect(ratio.max).toBeCloseTo(0.8, 2)
  })

  it('places US head height in the lower ICAO band, not the Schengen one', () => {
    // The whole reason head-height ratio is per-preset rather than a constant.
    const ratio = headHeightRatio(US_PASSPORT)
    expect(ratio.max).toBeLessThan(headHeightRatio(SCHENGEN_VISA).min)
  })

  it('finds a preset by id and returns undefined for an unknown one', () => {
    expect(findPreset('schengen-visa')).toBe(SCHENGEN_VISA)
    expect(findPreset('atlantis-passport')).toBeUndefined()
  })

  it('builds a custom preset with a sensible default head-height band', () => {
    const custom = customPreset(40, 60)
    expect(custom.width).toBe(40)
    expect(custom.height).toBe(60)
    expect(custom.headHeight).toEqual({ min: 42, max: 48 })
    expect(custom.source.confidence).toBe('unverified')
  })
})
