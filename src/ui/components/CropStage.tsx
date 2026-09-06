import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import type { CropGuides } from '@domain/photo-processing/service/CropSolver'
import { MAX_OFFSET, type CropAdjustment } from '@domain/photo-processing/model/CropAdjustment'

interface Props {
  src: string
  alt: string
  guides: CropGuides
  adjustment: CropAdjustment
  showGuides: boolean
  onAdjust: (next: CropAdjustment) => void
}

/**
 * The preview, with the photo draggable inside its frame.
 *
 * A drag of one frame-height changes offsetY by 1, so the gesture maps directly
 * onto the domain's fraction-of-crop units and feels identical regardless of how
 * large the preview happens to be rendered.
 *
 * Dragging *down* reveals more above the subject, which is what a user wants
 * when their hair is being clipped, so the sign is deliberately inverted: pull
 * the picture down, get more headroom.
 */
export function CropStage({ src, alt, guides, adjustment, showGuides, onAdjust }: Props) {
  const stage = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; from: CropAdjustment } | null>(null)

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId)
      drag.current = { x: event.clientX, y: event.clientY, from: adjustment }
    },
    [adjustment],
  )

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const start = drag.current
      const box = stage.current?.getBoundingClientRect()
      if (!start || !box) return

      onAdjust({
        ...start.from,
        offsetX: start.from.offsetX - (event.clientX - start.x) / box.width,
        offsetY: start.from.offsetY - (event.clientY - start.y) / box.height,
      })
    },
    [onAdjust],
  )

  const endDrag = useCallback(() => {
    drag.current = null
  }, [])

  const nudge = useCallback(
    (deltaY: number) => onAdjust({ ...adjustment, offsetY: adjustment.offsetY + deltaY }),
    [adjustment, onAdjust],
  )

  return (
    <div
      ref={stage}
      className="stage"
      role="group"
      aria-label="Photo position. Drag, or use the arrow keys, to move the frame."
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={(event) => {
        if (event.key === 'ArrowUp') { nudge(0.02); event.preventDefault() }
        if (event.key === 'ArrowDown') { nudge(-0.02); event.preventDefault() }
      }}
    >
      <img src={src} alt={alt} draggable={false} />

      {showGuides && (
        <div className="guides" aria-hidden="true">
          <span className="guide-band" style={bandStyle(guides.crown)} data-label="top of head" />
          {guides.eyes && (
            <span className="guide-band eyes" style={bandStyle(guides.eyes)} data-label="eyes" />
          )}
          <span className="guide-band" style={bandStyle(guides.chin)} data-label="chin" />
        </div>
      )}

      <div className="stage-hint">
        {adjustment.offsetY >= MAX_OFFSET
          ? 'That is as far down as this photo goes'
          : 'Drag to reposition'}
      </div>
    </div>
  )
}

function bandStyle(band: { min: number; max: number }) {
  const top = `${band.min * 100}%`
  const height = `${Math.max(band.max - band.min, 0.004) * 100}%`
  return { top, height }
}
