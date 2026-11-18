import { useEffect, useState } from 'react'
import type { ApiResponseMap } from '../data/contracts'
import { toScheduleEvents } from '../data/adapters'
import type { ScheduleDisplayEvent } from '../data/localAcademicView'
import './WeeklySchedule.css'

const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const dayCodes = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const hourHeight = 80
const timeZone = 'America/Lima'
const clockFormatter = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const dayFormatter = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' })
const dateFormatter = new Intl.DateTimeFormat('es-PE', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' })

function formatTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(Math.floor(minutes % 60)).padStart(2, '0')}`
}

function parseReferenceNow(referenceNow?: string | Date | null): Date | null {
  if (referenceNow == null) return null
  if (referenceNow instanceof Date) {
    return Number.isNaN(referenceNow.getTime()) ? null : referenceNow
  }
  if (typeof referenceNow === 'string') {
    const trimmed = referenceNow.trim()
    if (!trimmed) return null
    const parsed = new Date(trimmed)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

export function WeeklySchedule({ data, displayEvents, referenceNow }: {
  data: ApiResponseMap['horarios']['data'] | null
  displayEvents?: ScheduleDisplayEvent[]
  referenceNow?: string | Date | null
}) {
  const contextNow = parseReferenceNow(referenceNow)
  const hasContextNow = contextNow !== null
  const [liveNow, setLiveNow] = useState(() => new Date())
  useEffect(() => {
    if (hasContextNow) return
    const timer = setInterval(() => setLiveNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [hasContextNow])
  const now = contextNow ?? liveNow
  const events = displayEvents ?? toScheduleEvents(data ?? [])
  const clock = clockFormatter.format(now)
  const [currentHour, currentMinute] = clock.split(':').map(Number)
  const currentTime = currentHour * 60 + currentMinute
  const currentDay = dayCodes.indexOf(dayFormatter.format(now))
  const firstMinute = events.length ? Math.floor(Math.min(...events.map((event) => event.start)) / 60) * 60 : 0
  const lastMinute = events.length ? Math.ceil(Math.max(...events.map((event) => event.end)) / 60) * 60 : 60
  const height = (lastMinute - firstMinute) / 60 * hourHeight
  const hours = Array.from({ length: (lastMinute - firstMinute) / 60 + 1 }, (_, index) => firstMinute + index * 60)
  const showNow = currentTime >= firstMinute && currentTime < lastMinute

  return <section className="weekly-schedule" aria-label="Horario semanal">
    <header className="weekly-schedule__heading">
      <h2>Horario semanal</h2>
      {hasContextNow ? (
        <span>
          Reloj del contexto: {days[currentDay]} {dateFormatter.format(now)} · {clock}{' '}
          <small>(Lima) · contexto sintético</small>
        </span>
      ) : (
        <span>Hoy: {days[currentDay]} · {clock} <small>(Lima)</small></span>
      )}
    </header>
    {!events.length && displayEvents === undefined ? <p className="weekly-schedule__empty" role="status">No hay horarios registrados.</p> : <>
      <div className="weekly-schedule__scroll" tabIndex={0} role="region" aria-label="Calendario semanal con horas; desplázate horizontalmente para ver todos los días">
        <div className="weekly-schedule__week">
          <div className="weekly-schedule__days">
            <span className="weekly-schedule__hour-heading">Hora</span>
            {days.map((day, index) => <span key={day} className={index === currentDay ? 'is-today' : ''}>
              {day}{index === currentDay && <small>{hasContextNow ? 'Contexto' : 'Hoy'}</small>}
            </span>)}
          </div>
          <div className="weekly-schedule__body" style={{ height }}>
            <div className="weekly-schedule__hours" aria-label="Escala de horas">
              {hours.map((minute) => <span key={minute} style={{ top: (minute - firstMinute) / 60 * hourHeight }}>
                {formatTime(minute)}
              </span>)}
            </div>
            {days.map((day, dayIndex) => {
              const dayEvents = events.filter((event) => event.day === dayIndex + 1).sort((a, b) => a.start - b.start || a.end - b.end)
              const laneEnds: number[] = []
              const positioned = dayEvents.map((event) => {
                let lane = laneEnds.findIndex((end) => end <= event.start)
                if (lane === -1) lane = laneEnds.length
                laneEnds[lane] = event.end
                return { event, lane }
              })
              const laneCount = Math.max(1, laneEnds.length)
              return <div key={day} className={`weekly-schedule__day ${dayIndex === currentDay ? 'is-today' : ''}`} aria-label={day}
                style={{ backgroundSize: `100% ${hourHeight}px` }}>
                {!dayEvents.length && <span className="weekly-schedule__no-classes">Sin clases</span>}
                {positioned.map(({ event, lane }, index) => {
                  const sessionType = 'sessionType' in event ? event.sessionType : undefined
                  const room = 'room' in event ? event.room : undefined
                  const teacher = 'teacher' in event ? event.teacher : undefined
                  const hasSessionMetadata = Boolean(sessionType || room || teacher)
                  const sectionLine = hasSessionMetadata
                    ? `Sección ${event.section} · ${[sessionType, room].filter(Boolean).join(' · ') || event.kind}`
                    : `Sección ${event.section} · ${event.kind}`
                  const accessibleSummary = hasSessionMetadata
                    ? `${day} · ${event.course} · ${event.time} · Sección ${event.section} · ${[sessionType, room, teacher].filter(Boolean).join(' · ')}`
                    : `${day} · ${event.course} · ${event.time} · Sección ${event.section} · ${event.kind}`
                  return (
                    <article key={`${event.course}-${index}`}
                      className={`weekly-schedule__event${event.end - event.start < 60 ? ' is-compact' : ''}`} tabIndex={0}
                      aria-label={accessibleSummary}
                      title={accessibleSummary}
                      style={{ top: (event.start - firstMinute) / 60 * hourHeight,
                        height: (event.end - event.start) / 60 * hourHeight,
                        left: `${lane / laneCount * 100}%`, width: `${100 / laneCount}%` }}>
                      <strong>{event.course}</strong>
                      <span>{event.time}</span>
                      <small>{sectionLine}</small>
                      {hasSessionMetadata && teacher && (
                        <small className="weekly-schedule__teacher">{teacher}</small>
                      )}
                    </article>
                  )
                })}
                {dayIndex === currentDay && showNow && <div className="weekly-schedule__now"
                  style={{ top: (currentTime - firstMinute) / 60 * hourHeight }}
                  aria-label={hasContextNow ? `Hora del contexto: ${clock}` : `Hora actual: ${clock}`}>
                  <span>Ahora {clock}</span>
                </div>}
              </div>
            })}
          </div>
        </div>
      </div>
      <p className="weekly-schedule__footer">{events.length} sesiones · {formatTime(firstMinute)}–{formatTime(lastMinute)}
        <span>{hasContextNow
          ? 'La línea roja indica la hora del reloj de contexto dentro de la franja visible.'
          : 'La línea roja indica la hora actual dentro de la franja visible.'}</span>
      </p>
    </>}
  </section>
}
