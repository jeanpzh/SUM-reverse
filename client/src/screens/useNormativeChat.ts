import { useEffect, useRef, useState } from 'react'
import type { AcademicNormativeRequest, AcademicNormativeResponse } from '../../../shared/programacion-academica-api.mjs'
import { fetchAcademicNormativeAdvice, type PlanningPeriod } from '../data/academicScheduling'

type Turn = { id: string; question: string; answer?: AcademicNormativeResponse; error?: string; cancelled?: boolean }

export function useNormativeChat(academicPeriod: PlanningPeriod) {
  const [question, setQuestion] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [loading, setLoading] = useState(false)
  const [asOf, setAsOf] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [teacherType, setTeacherType] = useState<AcademicNormativeRequest['teacherType']>('unknown')
  const pending = useRef<AbortController | null>(null)
  const sequence = useRef(0)

  useEffect(() => () => pending.current?.abort(), [])

  useEffect(() => {
    pending.current?.abort()
    setTurns([])
    setLoading(false)
  }, [academicPeriod])

  const cancel = () => {
    pending.current?.abort()
    setLoading(false)
    setTurns((items) => items.map((turn) => (!turn.answer && !turn.error ? { ...turn, cancelled: true } : turn)))
  }

  const submit = async (customQuestion?: string, customTeacherType?: AcademicNormativeRequest['teacherType']) => {
    const text = (customQuestion ?? question).trim()
    const targetType = customTeacherType ?? teacherType
    if (loading || !text) return
    const id = String(++sequence.current)
    const controller = new AbortController()
    pending.current = controller
    setTurns((items) => [...items, { id, question: text }])
    setQuestion('')
    setLoading(true)
    try {
      const answer = await fetchAcademicNormativeAdvice(
        { question: text, facultyId: 'FISI', academicPeriod, asOf, teacherType: targetType },
        globalThis.fetch,
        controller.signal
      )
      if (!controller.signal.aborted) {
        setTurns((items) => items.map((turn) => (turn.id === id ? { ...turn, answer } : turn)))
      }
    } catch (failure) {
      if (!controller.signal.aborted) {
        setTurns((items) =>
          items.map((turn) =>
            turn.id === id
              ? {
                  ...turn,
                  error: failure instanceof Error ? failure.message : 'No se pudo consultar la normativa.',
                }
              : turn
          )
        )
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  const changeAsOf = (value: string) => {
    setAsOf(value)
    setTurns([])
  }
  const changeTeacherType = (value: AcademicNormativeRequest['teacherType']) => {
    setTeacherType(value)
    setTurns([])
  }

  return { question, setQuestion, turns, loading, asOf, teacherType, cancel, submit, changeAsOf, changeTeacherType }
}

export type NormativeChat = ReturnType<typeof useNormativeChat>
