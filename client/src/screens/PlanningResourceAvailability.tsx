import { Fragment, useRef, useState } from 'react'
import type { AcademicInterval } from '../../../shared/programacion-academica-api.mjs'
import './PlanningResourceAvailability.css'

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const BANDS = [[480, 780], [840, 1080], [1080, 1320]] as const

/** A band edit preserves every minute outside that band, including custom intervals. */
export function PlanningResourceAvailability({ label, intervals, disabled, onChange }: {
  label: string
  intervals: AcademicInterval[]
  disabled: boolean
  onChange: (value: AcademicInterval[]) => void
}) {
  const [active, setActive] = useState(0)
  const [error, setError] = useState('')
  const buttons = useRef<Array<HTMLButtonElement | null>>([])
  // Saturday is on the board. Sunday remains reachable even before it is configured.
  const days = DAYS
  const toggle = (day: number, startMinute: number, endMinute: number, covered: boolean) => {
    if (disabled) return
    const next = intervals.flatMap((interval) => {
      if (interval.day !== day || interval.endMinute <= startMinute || interval.startMinute >= endMinute) return [interval]
      return [
        ...(interval.startMinute < startMinute ? [{ ...interval, endMinute: startMinute }] : []),
        ...(interval.endMinute > endMinute ? [{ ...interval, startMinute: endMinute }] : []),
      ]
    })
    if (!covered) next.push({ day, startMinute, endMinute })
    // Coalesce touching intervals on the edited day only, preserving other days verbatim.
    const edited = next.filter((interval) => interval.day === day).sort((a, b) => a.startMinute - b.startMinute)
    const merged: AcademicInterval[] = []
    for (const interval of edited) {
      const previous = merged.at(-1)
      if (previous && interval.startMinute <= previous.endMinute) previous.endMinute = Math.max(previous.endMinute, interval.endMinute)
      else merged.push({ ...interval })
    }
    const value = [...next.filter((interval) => interval.day !== day), ...merged]
    if (value.length > 32) {
      setError('Máximo 32 intervalos. Ajusta los intervalos precisos antes de cambiar esta franja.')
      return
    }
    setError('')
    onChange(value)
  }

  return (
    <div className="planning-resource-availability">
      <div className="planning-resource-availability__scroll">
        <div className="planning-resource-availability__grid" aria-label={label}>
          <span />{days.map((day) => <span key={day} title={day}>{day.slice(0, 3)}</span>)}
          {BANDS.map(([start, end], row) => (
            <Fragment key={start}>
              <span>{start / 60}–{end / 60}</span>
              {days.map((day, column) => {
                const index = row * days.length + column
                let cursor = start as number
                const overlaps = intervals.filter((interval) => interval.day === column + 1 && interval.startMinute < end && interval.endMinute > start).sort((a, b) => a.startMinute - b.startMinute)
                for (const interval of overlaps) {
                  if (interval.startMinute > cursor) break
                  cursor = Math.max(cursor, interval.endMinute)
                }
                const pressed = cursor >= end
                const partial = !pressed && overlaps.length > 0
                return <button
                  key={day}
                  type="button"
                  ref={(node) => { buttons.current[index] = node }}
                  tabIndex={active === index ? 0 : -1}
                  disabled={disabled}
                  aria-label={`${label} · ${day} · ${start / 60}–${end / 60} h${partial ? ' · disponibilidad parcial; activar completa la franja' : ''}`}
                  aria-pressed={partial ? 'mixed' : pressed}
                  onFocus={() => setActive(index)}
                  onClick={() => toggle(column + 1, start, end, pressed)}
                  onKeyDown={(event) => {
                    let target: number
                    if (event.key === 'ArrowRight') target = row * days.length + (column + 1) % days.length
                    else if (event.key === 'ArrowLeft') target = row * days.length + (column + days.length - 1) % days.length
                    else if (event.key === 'ArrowDown') target = ((row + 1) % BANDS.length) * days.length + column
                    else if (event.key === 'ArrowUp') target = ((row + BANDS.length - 1) % BANDS.length) * days.length + column
                    else if (event.key === 'Home') target = event.ctrlKey ? 0 : row * days.length
                    else if (event.key === 'End') target = event.ctrlKey ? BANDS.length * days.length - 1 : (row + 1) * days.length - 1
                    else return
                    event.preventDefault()
                    buttons.current[target]?.focus()
                  }}
                >{pressed ? 'Sí' : partial ? 'Parcial' : 'No'}</button>
              })}
            </Fragment>
          ))}
        </div>
      </div>
      <p>Cada franja es un botón conmutable con su estado en texto. Teclado: flechas para moverse, Espacio para cambiar.</p>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
