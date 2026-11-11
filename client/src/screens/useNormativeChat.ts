import { useEffect, useRef, useState } from 'react'
import type { AcademicNormativeRequest, AcademicNormativeResponse } from '../../../shared/programacion-academica-api.mjs'
import { fetchAcademicNormativeAdvice, type PlanningPeriod } from '../data/academicScheduling'
import { prototypeProfileFor } from '../../../shared/prototype-teacher-profiles.mjs'

type Turn = { id: string; question: string; previousQuestion?: string; answer?: AcademicNormativeResponse; error?: string; cancelled?: boolean }

export function useNormativeChat(academicPeriod: PlanningPeriod) {
  const [question, setQuestion] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [loading, setLoading] = useState(false)
  const [asOf, setAsOf] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [teacherType, setTeacherType] = useState<AcademicNormativeRequest['teacherType']>('unknown')
  // Prototype-only: a synthetic reference code whose regime fixes the filter. Not an official record.
  const [teacherId, setTeacherId] = useState('')
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

  const submit = async (customQuestion?: string, customTeacherType?: AcademicNormativeRequest['teacherType'], retryId?: string, independent = false) => {
    const text = (customQuestion ?? question).trim()
    const targetType = customTeacherType ?? teacherType
    if (loading || !text) return
    const id = retryId ?? String(++sequence.current)
    // Only the previous successful user question is sent, never model prose or a
    // growing transcript. Retry preserves the failed request's original antecedent.
    const previousQuestion = independent || targetType !== teacherType ? undefined : retryId
      ? turns.find((turn) => turn.id === retryId)?.previousQuestion
      : [...turns].reverse().find((turn) => turn.answer)?.question
    const controller = new AbortController()
    pending.current = controller
    setTurns((items) => retryId
      ? items.map((turn) => turn.id === retryId ? { id, question: text, previousQuestion } : turn)
      : [...items, { id, question: text, previousQuestion }])
    if (!retryId) setQuestion('')
    setLoading(true)
    try {
      const answer = await fetchAcademicNormativeAdvice(
        { question: text, facultyId: 'FISI', academicPeriod, asOf, teacherType: targetType,
          ...(previousQuestion ? { previousQuestion } : {}) },
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

  const retry = (id: string) => {
    const turn = turns.find((item) => item.id === id && item.error)
    if (turn) void submit(turn.question, teacherType, id)
  }

  const changeAsOf = (value: string) => {
    pending.current?.abort()
    setLoading(false)
    setAsOf(value)
    setTurns([])
  }
  const changeTeacherType = (value: AcademicNormativeRequest['teacherType']) => {
    pending.current?.abort()
    setLoading(false)
    setTeacherId('')
    setTeacherType(value)
    setTurns([])
  }
  const changeTeacher = (id: string) => {
    pending.current?.abort()
    setLoading(false)
    const profile = id ? prototypeProfileFor(id) : null
    setTeacherId(profile ? profile.id : '')
    setTeacherType(profile ? profile.regime : 'unknown')
    setTurns([])
  }

  return { question, setQuestion, turns, loading, asOf, teacherType, teacherId, cancel, submit, retry, changeAsOf, changeTeacherType, changeTeacher }
}

export type NormativeChat = ReturnType<typeof useNormativeChat>
