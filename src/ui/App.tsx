import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PRESETS, customPreset, DEFAULT_PRESET, findPreset } from '@domain/photo-spec/catalog/presets'
import type { PhotoSpec } from '@domain/photo-spec/model/PhotoSpec'
import { worstSeverity } from '@domain/photo-spec/service/ComplianceChecker'
import { DEFAULT_ENHANCEMENT, type Enhancement } from '@domain/photo-processing/ports/ImageRenderer'
import { DEFAULT_PAPER, PAPER_SIZES } from '@domain/print-layout/model/PaperSize'
import {
  calculateSheetLayout,
  DEFAULT_SHEET_OPTIONS,
} from '@domain/print-layout/service/SheetLayoutCalculator'
import {
  GeneratePrintSheet,
  type QueuedPhoto,
} from '@application/usecases/GeneratePrintSheet'
import { AnalysePhoto, type AnalyseStage, type PhotoAnalysis } from '@application/usecases/AnalysePhoto'
import { ComposePhoto, type ComposedPhoto } from '@application/usecases/ComposePhoto'
import { MediaPipeFaceAnalyzer } from '@infrastructure/face/MediaPipeFaceAnalyzer'
import { MediaPipeBackgroundRemover } from '@infrastructure/segmentation/MediaPipeBackgroundRemover'
import { CanvasImageRenderer } from '@infrastructure/rendering/CanvasImageRenderer'
import { loadImageUpright } from '@infrastructure/rendering/loadImage'
import { PdfLibDocumentWriter } from '@infrastructure/pdf/PdfLibDocumentWriter'
import { guidesFor } from '@domain/photo-processing/service/CropSolver'
import { NO_ADJUSTMENT, isAdjusted, type CropAdjustment } from '@domain/photo-processing/model/CropAdjustment'
import { packSheets, spareCapacity } from '@domain/print-layout/service/SheetPacker'
import { ComplianceList } from '@ui/components/ComplianceList'
import { DocumentDetails } from '@ui/components/DocumentDetails'
import { PrintQueue } from '@ui/components/PrintQueue'
import { CropStage } from '@ui/components/CropStage'
import { Dropzone } from '@ui/components/Dropzone'
import { Slider } from '@ui/components/Slider'
import { useTheme } from '@ui/theme/useTheme'
import './App.css'

const STAGE_LABELS: Record<AnalyseStage | 'loading-models', string> = {
  'loading-models': 'Loading the models, first time only',
  'detecting-face': 'Finding your face',
  'removing-background': 'Separating you from the background',
  'locating-crown': 'Measuring your head',
}

export function App() {
  const { theme, toggle } = useTheme()

  const [image, setImage] = useState<ImageBitmap | null>(null)
  const [specId, setSpecId] = useState(DEFAULT_PRESET.id)
  const [customSize, setCustomSize] = useState({ width: 35, height: 45 })
  const [enhancement, setEnhancement] = useState<Enhancement>(DEFAULT_ENHANCEMENT)
  const [copies, setCopies] = useState(8)
  const [paperId, setPaperId] = useState(DEFAULT_PAPER.id)
  const [allowRotation, setAllowRotation] = useState(false)
  const [queue, setQueue] = useState<QueuedPhoto[]>([])
  const [queuePreviews, setQueuePreviews] = useState<Map<string, string>>(new Map())

  const [adjustment, setAdjustment] = useState<CropAdjustment>(NO_ADJUSTMENT)
  const [showGuides, setShowGuides] = useState(true)

  const [analysis, setAnalysis] = useState<PhotoAnalysis | null>(null)
  const [result, setResult] = useState<ComposedPhoto | null>(null)
  const [stage, setStage] = useState<AnalyseStage | 'loading-models' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Adapters are created once and reused: each holds a loaded model, and
  // rebuilding them on every render would re-download several megabytes.
  const pipeline = useRef({
    faces: new MediaPipeFaceAnalyzer(),
    backgrounds: new MediaPipeBackgroundRemover(),
    renderer: new CanvasImageRenderer(),
    writer: new PdfLibDocumentWriter(),
  })

  const spec: PhotoSpec = useMemo(
    () =>
      specId === 'custom'
        ? customPreset(customSize.width, customSize.height)
        : (findPreset(specId) ?? DEFAULT_PRESET),
    [specId, customSize],
  )

  const paper = PAPER_SIZES.find((p) => p.id === paperId) ?? DEFAULT_PAPER
  const sheetOptions = useMemo(
    () => ({ ...DEFAULT_SHEET_OPTIONS, allowRotation }),
    [allowRotation],
  )
  // The queue plus whatever is on screen right now, which is what will actually
  // be printed if the user hits download without adding the current photo first.
  const effectiveQueue: QueuedPhoto[] = useMemo(() => {
    if (!result) return queue
    return [
      ...queue,
      { id: 'current', label: 'This photo', spec, photo: result.photo.blob, copies },
    ]
  }, [queue, result, spec, copies])

  const packing = useMemo(
    () =>
      packSheets(
        paper,
        effectiveQueue.map((entry) => ({
          id: entry.id,
          label: entry.label,
          width: entry.spec.width,
          height: entry.spec.height,
          copies: entry.copies,
        })),
        sheetOptions,
      ),
    [paper, effectiveQueue, sheetOptions],
  )

  const spare = useMemo(
    () =>
      spareCapacity(
        paper,
        effectiveQueue.map((entry) => ({
          id: entry.id,
          label: entry.label,
          width: entry.spec.width,
          height: entry.spec.height,
          copies: entry.copies,
        })),
        sheetOptions,
      ),
    [paper, effectiveQueue, sheetOptions],
  )

  // What turning the photos would buy, so the offer states a real number.
  const rotatedCapacity = useMemo(
    () =>
      calculateSheetLayout(paper, spec.width, spec.height, {
        ...DEFAULT_SHEET_OPTIONS,
        allowRotation: true,
      }).capacity,
    [paper, spec],
  )

  // Slow half: runs the two models. Depends only on the photo, so it runs once
  // per image and never again while the user fiddles with settings.
  useEffect(() => {
    if (!image) {
      setAnalysis(null)
      return
    }
    let cancelled = false
    setError(null)
    setStage('loading-models')

    void (async () => {
      try {
        const analysed = await new AnalysePhoto(
          pipeline.current.faces,
          pipeline.current.backgrounds,
        ).execute(image, (s) => !cancelled && setStage(s))
        if (!cancelled) setAnalysis(analysed)
      } catch (caught) {
        if (cancelled) return
        setAnalysis(null)
        setError(caught instanceof Error ? caught.message : 'That photo could not be analysed.')
      } finally {
        if (!cancelled) setStage(null)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [image])

  // Fast half: no models, just arithmetic and one canvas draw. Cheap enough to
  // run on every frame of a drag.
  useEffect(() => {
    if (!analysis) {
      setResult(null)
      return
    }
    let cancelled = false

    void (async () => {
      try {
        const composed = await new ComposePhoto(pipeline.current.renderer).execute({
          analysis,
          spec,
          enhancement,
          adjustment,
        })
        if (!cancelled) setResult(composed)
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'The photo could not be rendered.')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [analysis, spec, enhancement, adjustment])

  // A new document type has its own geometry, so a nudge made for the old one
  // is meaningless. Start from the solver's answer again.
  useEffect(() => {
    setAdjustment(NO_ADJUSTMENT)
  }, [specId])

  // Object URLs are a manual resource: revoke the old one or the tab leaks.
  useEffect(() => {
    if (!result) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(result.photo.blob)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [result])

  const onFile = useCallback(async (file: File) => {
    setError(null)
    try {
      setImage(await loadImageUpright(file))
    } catch {
      setError('That file could not be opened as an image. Try a JPEG or PNG.')
    }
  }, [])

  const addToSheet = useCallback(() => {
    if (!result) return
    const id = `photo-${Date.now()}`
    const entry: QueuedPhoto = {
      id,
      label: `Photo ${queue.length + 1}`,
      spec,
      photo: result.photo.blob,
      copies,
    }
    setQueue((current) => [...current, entry])
    setQueuePreviews((current) => {
      const next = new Map(current)
      next.set(id, URL.createObjectURL(result.photo.blob))
      return next
    })
    // Clear the workspace so the next person can be prepared from scratch.
    setImage(null)
    setAnalysis(null)
    setResult(null)
    setAdjustment(NO_ADJUSTMENT)
  }, [result, spec, copies, queue.length])

  const removeFromSheet = useCallback((id: string) => {
    setQueue((current) => current.filter((entry) => entry.id !== id))
    setQueuePreviews((current) => {
      const url = current.get(id)
      if (url) URL.revokeObjectURL(url)
      const next = new Map(current)
      next.delete(id)
      return next
    })
  }, [])

  const setQueuedCopies = useCallback((id: string, next: number) => {
    setQueue((current) =>
      current.map((entry) =>
        entry.id === id ? { ...entry, copies: Math.max(1, Math.min(99, next)) } : entry,
      ),
    )
  }, [])

  const downloadPhoto = () => {
    if (result) save(result.photo.blob, `${spec.id}-${spec.width}x${spec.height}mm.png`)
  }

  const downloadSheet = async () => {
    if (effectiveQueue.length === 0) return
    try {
      const sheet = await new GeneratePrintSheet(pipeline.current.writer).execute({
        queue: effectiveQueue,
        paper,
        options: sheetOptions,
      })
      const total = effectiveQueue.reduce((sum, entry) => sum + entry.copies, 0)
      save(sheet.document, `photospec-${total}-photos-${paper.id}.pdf`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The print sheet could not be created.')
    }
  }

  const severity = result ? worstSeverity(result.compliance) : null

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <h1>PhotoSpec</h1>
          <p>Passport and visa photos, made on your own device.</p>
        </div>
        <button className="theme-toggle" onClick={toggle} aria-live="polite">
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
      </header>

      <section className="card">
        <h2>
          <span className="step-number">1</span> Choose your photo
        </h2>
        {image ? (
          <div className="actions">
            <span style={{ fontSize: 14, color: 'var(--ink-2)' }}>
              Loaded {image.width} × {image.height} px
            </span>
            <button
              className="button secondary"
              onClick={() => {
                setImage(null)
                setResult(null)
                setAnalysis(null)
                setAdjustment(NO_ADJUSTMENT)
              }}
            >
              Use a different photo
            </button>
          </div>
        ) : (
          <Dropzone onFile={onFile} disabled={stage !== null} />
        )}
      </section>

      <section className="card">
        <h2>
          <span className="step-number">2</span> Choose the document
        </h2>
        <div className="row">
          <div className="field">
            <label htmlFor="preset">Document type</label>
            <select id="preset" value={specId} onChange={(e) => setSpecId(e.target.value)}>
              {PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name} ({preset.width}×{preset.height} mm)
                </option>
              ))}
              <option value="custom">Custom size</option>
            </select>
          </div>
          {specId === 'custom' && (
            <>
              <div className="field">
                <label htmlFor="cw">Width (mm)</label>
                <input
                  id="cw"
                  type="number"
                  min={10}
                  max={200}
                  value={customSize.width}
                  onChange={(e) => setCustomSize((s) => ({ ...s, width: Number(e.target.value) }))}
                />
              </div>
              <div className="field">
                <label htmlFor="ch">Height (mm)</label>
                <input
                  id="ch"
                  type="number"
                  min={10}
                  max={200}
                  value={customSize.height}
                  onChange={(e) => setCustomSize((s) => ({ ...s, height: Number(e.target.value) }))}
                />
              </div>
            </>
          )}
        </div>
        {spec.source.confidence === 'unverified' && (
          <div className="banner warn">
            These measurements have not been verified against {spec.source.authority}. Check the
            official requirements before you submit.
          </div>
        )}
      </section>

      {(stage || error || result) && (
        <section className="card">
          <h2>
            <span className="step-number">3</span> Your photo
          </h2>

          {stage && (
            <p style={{ margin: 0, color: 'var(--ink-2)', fontSize: 14 }}>
              <span className="spinner" aria-hidden="true" />
              {STAGE_LABELS[stage]}…
            </p>
          )}

          {error && <div className="banner fail">{error}</div>}

          {result && previewUrl && (
            <>
              <div className="preview">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <CropStage
                    src={previewUrl}
                    alt={`Prepared ${spec.name} photo`}
                    guides={guidesFor(spec)}
                    adjustment={adjustment}
                    showGuides={showGuides}
                    onAdjust={setAdjustment}
                  />
                  <div className="stage-controls">
                    <button onClick={() => setAdjustment((a) => ({ ...a, offsetY: a.offsetY - 0.03 }))}>
                      Move down
                    </button>
                    <button onClick={() => setAdjustment((a) => ({ ...a, offsetY: a.offsetY + 0.03 }))}>
                      Move up
                    </button>
                    {isAdjusted(adjustment) && (
                      <button onClick={() => setAdjustment(NO_ADJUSTMENT)}>Reset</button>
                    )}
                  </div>
                  <label className="toggle-guides">
                    <input
                      type="checkbox"
                      checked={showGuides}
                      onChange={(e) => setShowGuides(e.target.checked)}
                    />
                    Show guide lines
                  </label>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {severity === 'fail' && (
                    <div className="banner fail">
                      This photo would probably be rejected. See below.
                    </div>
                  )}
                  <ComplianceList results={result.compliance} />
                </div>
              </div>

              <details>
                <summary style={{ cursor: 'pointer', fontSize: 14, color: 'var(--ink-2)' }}>
                  Adjust brightness, colour and sharpness
                </summary>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12 }}>
                  <Slider
                    label="Brightness"
                    value={enhancement.brightness}
                    onChange={(brightness) => setEnhancement((e) => ({ ...e, brightness }))}
                  />
                  <Slider
                    label="Contrast"
                    value={enhancement.contrast}
                    onChange={(contrast) => setEnhancement((e) => ({ ...e, contrast }))}
                  />
                  <Slider
                    label="Warmth"
                    value={enhancement.warmth}
                    onChange={(warmth) => setEnhancement((e) => ({ ...e, warmth }))}
                  />
                  <Slider
                    label="Saturation"
                    value={enhancement.saturation}
                    onChange={(saturation) => setEnhancement((e) => ({ ...e, saturation }))}
                  />
                  <Slider
                    label="Sharpness"
                    min={0}
                    max={1}
                    value={enhancement.sharpness}
                    onChange={(sharpness) => setEnhancement((e) => ({ ...e, sharpness }))}
                  />
                </div>
              </details>
            </>
          )}
        </section>
      )}

      {(result || queue.length > 0) && (
        <section className="card">
          <h2>
            <span className="step-number">4</span> Print sheet
          </h2>

          {result && (
            <div className="row">
              <div className="field">
                <label htmlFor="copies">Copies of this photo</label>
                <input
                  id="copies"
                  type="number"
                  min={1}
                  max={99}
                  value={copies}
                  onChange={(e) => setCopies(Number(e.target.value))}
                />
              </div>
              <div className="field">
                <label htmlFor="paper">Paper</label>
                <select id="paper" value={paperId} onChange={(e) => setPaperId(e.target.value)}>
                  {PAPER_SIZES.map((size) => (
                    <option key={size.id} value={size.id}>
                      {size.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {result && (
            <div className="actions">
              <button className="button secondary" onClick={addToSheet}>
                Add another person to this sheet
              </button>
            </div>
          )}

          <PrintQueue
            queue={queue}
            previews={queuePreviews}
            onChangeCopies={setQueuedCopies}
            onRemove={removeFromSheet}
          />

          <p className="queue-summary">
            <strong>{packing.totalPlaced}</strong> photo
            {packing.totalPlaced === 1 ? '' : 's'} on{' '}
            <strong>
              {packing.sheets.length} {paper.name} sheet
              {packing.sheets.length === 1 ? '' : 's'}
            </strong>
            {spare !== null && spare > 0 && `, with room for ${spare} more`}
            {packing.uniformGrid ? '' : ' (mixed sizes, packed to fit)'}. Each photo cuts out at
            its own size. Print at 100% scale, never “fit to page”.
          </p>

          {packing.unplaced.length > 0 && (
            <div className="banner warn">
              {packing.unplaced.map((u) => u.reason).join(' ')}
            </div>
          )}

          {rotatedCapacity > 0 && !allowRotation && packing.uniformGrid && (
            <label className="toggle-guides">
              <input
                type="checkbox"
                checked={allowRotation}
                onChange={(e) => setAllowRotation(e.target.checked)}
              />
              Turn photos sideways to fit more per sheet
            </label>
          )}
          {allowRotation && (
            <label className="toggle-guides">
              <input
                type="checkbox"
                checked={allowRotation}
                onChange={(e) => setAllowRotation(e.target.checked)}
              />
              Photos turned sideways to fit more per sheet
            </label>
          )}

          <div className="actions">
            <button className="button" onClick={downloadSheet}>
              Download print sheet (PDF)
            </button>
            {result && (
              <button className="button secondary" onClick={downloadPhoto}>
                Download this photo only (PNG)
              </button>
            )}
          </div>
        </section>
      )}

      <DocumentDetails spec={spec} />

      <footer className="footer">
        PhotoSpec formats your photo to the published measurements. Whether it is accepted is
        always the issuing authority’s decision. Everything runs in your browser and your photo is
        never uploaded. <a href="https://github.com/">Source code and how it works</a>.
      </footer>
    </div>
  )
}

function save(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
