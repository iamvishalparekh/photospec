import { useCallback, useRef, useState } from 'react'
import { isSupportedImage } from '@infrastructure/rendering/loadImage'

interface Props {
  onFile: (file: File) => void
  disabled?: boolean
}

export function Dropzone({ onFile, disabled = false }: Props) {
  const [isOver, setIsOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const accept = useCallback(
    (files: FileList | null) => {
      const file = files?.[0]
      if (file && isSupportedImage(file)) onFile(file)
    },
    [onFile],
  )

  return (
    <div
      className={`dropzone${isOver ? ' over' : ''}`}
      onDragOver={(event) => {
        event.preventDefault()
        setIsOver(true)
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(event) => {
        event.preventDefault()
        setIsOver(false)
        if (!disabled) accept(event.dataTransfer.files)
      }}
    >
      <strong>Drop a photo here</strong>
      <small>A normal phone photo works. Face the camera, plain wall behind you.</small>
      <button
        type="button"
        className="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        Choose a photo
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="visually-hidden"
        onChange={(event) => accept(event.target.files)}
      />
      <small>Your photo stays on this device. Nothing is uploaded.</small>
    </div>
  )
}
