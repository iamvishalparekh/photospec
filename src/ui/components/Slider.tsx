interface Props {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (value: number) => void
}

export function Slider({ label, value, min = -1, max = 1, step = 0.05, onChange }: Props) {
  const id = `slider-${label.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <div className="slider">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <output htmlFor={id}>{value.toFixed(2)}</output>
    </div>
  )
}
