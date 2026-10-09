import { useEffect, useState } from 'react'
import type { ApiResponseMap } from '../data/contracts'
import { toScheduleEvents } from '../data/adapters'
import './WeeklySchedule.css'

const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const dayCodes = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const hourHeight = 48
const timeZone = 'America/Lima'

function formatTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(Math.floor(minutes % 60)).padStart(2, '0')}`
}

export function WeeklySchedule({ data }: { data: ApiResponseMap['horarios']['data'] }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])
  const events = toScheduleEvents(data)
  const clock = new Intl.DateTimeFormat('en-GB', {
    timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(now)
  const [currentHour, currentMinute] = clock.split(':').map(Number)
  const currentTime = currentHour * 60 + currentMinute
  const currentDay = dayCodes.indexOf(new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(now))
  const firstMinute = events.length ? Math.floor(Math.min(...events.map((event) => event.start)) / 60) * 60 : 0
  const lastMinute = events.length ? Math.ceil(Math.max(...events.map((event) => event.end)) / 60) * 60 : 60
  const height = (lastMinute - firstMinute) / 60 * hourHeight
  const hours = Array.from({ length: (lastMinute - firstMinute) / 60 + 1 }, (_, index) => firstMinute + index * 60)
  const showNow = currentTime >= firstMinute && currentTime < lastMinute

  return <section className="weekly-schedule" aria-label="Horario semanal">
    <header className="weekly-schedule__heading">
      <h2>Horario semanal</h2>
      <span>Hoy: {days[currentDay]} · {clock} <small>(Lima)</small></span>
    </header>
    {!events.length ? <p className="weekly-schedule__empty" role="status">No hay horarios registrados.</p> : <>
      <div className="weekly-schedule__scroll" tabIndex={0} role="region" aria-label="Calendario semanal con horas; desplázate horizontalmente para ver todos los días">
        <div className="weekly-schedule__week">
          <div className="weekly-schedule__days">
            <span className="weekly-schedule__hour-heading">Hora</span>
            {days.map((day, index) => <span key={day} className={index === currentDay ? 'is-today' : ''}>
              {day}{index === currentDay && <small>Hoy</small>}
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
              return <div key={day} className={`weekly-schedule__day ${dayIndex === currentDay ? 'is-today' : ''}`} aria-label={day}>
                {!dayEvents.length && <span className="weekly-schedule__no-classes">Sin clases</span>}
                {positioned.map(({ event, lane }, index) => <article key={`${event.course}-${index}`} className="weekly-schedule__event"
                  title={`${day} · ${event.course} · ${event.time} · Sección ${event.section} · ${event.kind}`}
                  style={{ top: (event.start - firstMinute) / 60 * hourHeight,
                    height: (event.end - event.start) / 60 * hourHeight,
                    left: `${lane / laneCount * 100}%`, width: `${100 / laneCount}%` }}>
                  <strong>{event.course}</strong>
                  <span>{event.time}</span>
                  <small>Sección {event.section} · {event.kind}</small>
                </article>)}
                {dayIndex === currentDay && showNow && <div className="weekly-schedule__now"
                  style={{ top: (currentTime - firstMinute) / 60 * hourHeight }} aria-label={`Hora actual: ${clock}`}>
                  <span>Ahora {clock}</span>
                </div>}
              </div>
            })}
          </div>
        </div>
      </div>
      <p className="weekly-schedule__footer">{events.length} sesiones · {formatTime(firstMinute)}–{formatTime(lastMinute)}
        <span>La línea roja indica la hora actual dentro de la franja visible.</span>
      </p>
    </>}
  </section>
}
