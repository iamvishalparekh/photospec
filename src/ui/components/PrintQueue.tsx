import type { QueuedPhoto } from '@application/usecases/GeneratePrintSheet'

interface Props {
  queue: readonly QueuedPhoto[]
  previews: ReadonlyMap<string, string>
  onChangeCopies: (id: string, copies: number) => void
  onRemove: (id: string) => void
}

/**
 * The print queue: several people, or several document types, sharing a sheet.
 *
 * Each row carries its own thumbnail because the whole point is printing photos
 * of different people together, and a list of identical labels would be
 * impossible to tell apart.
 */
export function PrintQueue({ queue, previews, onChangeCopies, onRemove }: Props) {
  if (queue.length === 0) return null

  return (
    <ul className="queue">
      {queue.map((entry) => (
        <li key={entry.id} className="queue-row">
          {previews.get(entry.id) ? (
            <img src={previews.get(entry.id)} alt="" className="queue-thumb" />
          ) : (
            <span className="queue-thumb" />
          )}

          <span className="queue-meta">
            <strong>{entry.label}</strong>
            <small>
              {entry.spec.name} · {entry.spec.width} × {entry.spec.height} mm
            </small>
          </span>

          <label className="queue-copies">
            <span className="visually-hidden">Copies of {entry.label}</span>
            <input
              type="number"
              min={1}
              max={99}
              value={entry.copies}
              onChange={(event) => onChangeCopies(entry.id, Number(event.target.value))}
            />
          </label>

          <button
            type="button"
            className="queue-remove"
            onClick={() => onRemove(entry.id)}
            aria-label={`Remove ${entry.label} from the sheet`}
          >
            Remove
          </button>
        </li>
      ))}
    </ul>
  )
}
