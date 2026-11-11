import { useId, useMemo, useState } from 'react'
import type { LectiveHourMinutes, LoadAuthorizationKind, TeacherLoadCondition, TeacherRegime } from '../../../shared/academic-normative-profile.mjs'
import type { AcademicTeacherResource } from '../../../shared/programacion-academica-api.mjs'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Checkbox } from '../components/ui/Checkbox'
import { Input } from '../components/ui/Input'
import { Label } from '../components/ui/Label'
import { NativeSelect } from '../components/ui/NativeSelect'
import {
  LECTIVE_HOUR_MINUTES, addLoadAuthorization, removeLoadAuthorization, setTeacherAppointment, setTeacherRegime, setWeeklyServiceHours,
  teacherLoadView, toggleLoadCondition,
} from '../data/planningDecisions'
import './PlanningTeacherLoad.css'

const REGIME_LABEL: Record<TeacherRegime, string> = { 'dedicacion-exclusiva': 'Dedicación exclusiva', 'tiempo-completo': 'Tiempo completo', 'tiempo-parcial': 'Tiempo parcial' }
const APPOINTMENT_LABEL: Record<NonNullable<AcademicTeacherResource['appointment']>, string> = {
  'faculty-ordinary': 'Ordinario de la facultad', 'interfaculty-ordinary': 'Ordinario interfacultativo', contract: 'Contratado' }
const CONDITION_LABEL: Record<TeacherLoadCondition, string> = {
  'renacyt-researcher': 'Investigador RENACYT', 'postgraduate-study': 'Estudios de posgrado', 'on-leave': 'Licencia o año sabático' }
const AUTHORIZATION_LABEL: Record<LoadAuthorizationKind, string> = { 'voluntary-declaration': 'Declaración jurada del docente', 'vrap-authorization': 'Autorización del VRAP' }

function minutesText(minutes: number | null, lectiveHourMinutes: number | undefined) {
  if (minutes === null) return 'Sin tope reglamentado'
  const hours = lectiveHourMinutes ? ` (${Number.isInteger(minutes / lectiveHourMinutes) ? minutes / lectiveHourMinutes : (minutes / lectiveHourMinutes).toFixed(1)} h lectivas)` : ''
  return `${minutes} min${hours}`
}

export function LectiveHourSelect({ value, disabled, onChange }: { value: LectiveHourMinutes | undefined; disabled: boolean; onChange: (value: LectiveHourMinutes | undefined) => void }) {
  const id = useId()
  return <div className="planning-teacher-load__lective">
    <Label htmlFor={id}>Duración de la hora lectiva</Label>
    <NativeSelect id={id} value={value ?? ''} disabled={disabled}
      onChange={(event) => onChange(event.currentTarget.value === '' ? undefined : Number(event.currentTarget.value) as LectiveHourMinutes)}>
      <option value="">Sin indicar</option>
      {LECTIVE_HOUR_MINUTES.map((minutes) => <option key={minutes} value={minutes}>{minutes} minutos</option>)}
    </NativeSelect>
    <p className="planning-decisions__provenance">El reglamento permite 45, 50 o 60 minutos y la de FISI no está verificada. Sin indicarla no se calculan los topes por docente y se conserva la carga semanal declarada.</p>
  </div>
}

export function TeacherLoadFields({ teacher, period, lectiveHourMinutes, disabled, onChange }: {
  teacher: AcademicTeacherResource
  period: string
  lectiveHourMinutes: LectiveHourMinutes | undefined
  disabled: boolean
  onChange: (teacher: AcademicTeacherResource) => void
}) {
  const [serviceText, setServiceText] = useState(teacher.weeklyServiceHours === undefined ? '' : String(teacher.weeklyServiceHours))
  const [serviceError, setServiceError] = useState('')
  const [kind, setKind] = useState<LoadAuthorizationKind>('voluntary-declaration')
  const [reference, setReference] = useState('')
  const [hours, setHours] = useState('')
  const [authorizationError, setAuthorizationError] = useState('')
  const view = useMemo(() => teacherLoadView(teacher, { period, lectiveHourMinutes }), [teacher, period, lectiveHourMinutes])
  const ids = { service: useId(), error: useId(), reference: 'teacher-load-reference', hours: useId(), authError: useId() }
  const partTime = teacher.regime === 'tiempo-parcial'
  const authorized = view.status === 'ok' ? view.authorizedMaxMinutes : null

  const submitAuthorization = () => {
    const result = addLoadAuthorization(teacher, { kind, reference,
      ...(kind === 'vrap-authorization' ? { maxLectiveHours: hours.trim() === '' ? Number.NaN : Number(hours) } : {}) })
    if (!result.ok) { setAuthorizationError(result.message); return }
    setAuthorizationError('')
    setReference('')
    setHours('')
    onChange(result.teacher)
  }

  return <fieldset className="academic-resource-workbench__resource-fields planning-teacher-load" id="teacher-load-fieldset">
    <legend>Carga reglamentaria</legend>
    <Label>
      Régimen de dedicación
      <NativeSelect aria-label="Régimen de dedicación" value={teacher.regime ?? ''} disabled={disabled}
        onChange={(event) => {
          const value = event.currentTarget.value as TeacherRegime | ''
          setServiceText(''); setServiceError('')
          onChange(setTeacherRegime(teacher, value === '' ? undefined : value))
        }}>
        <option value="">Sin registrar</option>
        {(Object.keys(REGIME_LABEL) as TeacherRegime[]).map((regime) => <option key={regime} value={regime}>{REGIME_LABEL[regime]}</option>)}
      </NativeSelect>
    </Label>
    <Label>
      Nombramiento
      <NativeSelect aria-label="Nombramiento" value={teacher.appointment ?? ''} disabled={disabled}
        onChange={(event) => onChange(setTeacherAppointment(teacher, (event.currentTarget.value || undefined) as AcademicTeacherResource['appointment']))}>
        <option value="">Sin registrar</option>
        {(Object.keys(APPOINTMENT_LABEL) as Array<keyof typeof APPOINTMENT_LABEL>).map((value) => <option key={value} value={value}>{APPOINTMENT_LABEL[value]}</option>)}
      </NativeSelect>
    </Label>
    {partTime && <div>
      <Label htmlFor={ids.service}>Horas semanales de servicio (tiempo parcial)</Label>
      <Input id={ids.service} inputMode="numeric" value={serviceText} disabled={disabled} aria-invalid={Boolean(serviceError)} aria-describedby={serviceError ? ids.error : undefined}
        onChange={(event) => {
          const text = event.currentTarget.value
          setServiceText(text)
          const result = setWeeklyServiceHours(teacher, text)
          if (result.ok) { setServiceError(''); onChange(result.teacher) } else setServiceError(result.message)
        }} />
      {serviceError && <span id={ids.error} role="alert" className="academic-resource-workbench__inline-error">{serviceError} No se guardó este valor.</span>}
    </div>}

    <div role="group" aria-label="Condiciones de carga" className="planning-teacher-load__conditions">
      {(Object.keys(CONDITION_LABEL) as TeacherLoadCondition[]).map((condition) => <div className="academic-resource-workbench__course-option" key={condition}>
        <Checkbox id={`teacher-condition-${condition}`} checked={teacher.loadConditions?.includes(condition) ?? false} disabled={disabled}
          onCheckedChange={(checked) => onChange(toggleLoadCondition(teacher, condition, checked === true))} />
        <Label htmlFor={`teacher-condition-${condition}`}>{CONDITION_LABEL[condition]}</Label>
      </div>)}
    </div>

    <div className="planning-teacher-load__limits" aria-live="polite">
      <strong>Topes resueltos por el perfil normativo</strong>
      {view.status === 'unavailable' ? <p className="planning-decisions__provenance">{view.reason}</p> : <>
        <dl className="planning-teacher-load__limit-list">
          <div><dt>Mínimo</dt><dd>{minutesText(view.minimumMinutes, lectiveHourMinutes)}</dd></div>
          <div><dt>Máximo ordinario</dt><dd>{minutesText(view.ordinaryMaxMinutes, lectiveHourMinutes)}</dd></div>
          <div><dt>Máximo autorizado</dt><dd>{minutesText(view.authorizedMaxMinutes, lectiveHourMinutes)}</dd></div>
        </dl>
        <p className="planning-decisions__provenance">Fuentes: {view.sources.map((source) => `${source.id}`).join(', ')}{view.articles.length ? ` · referencias ${view.articles.join(', ')}` : ''}.</p>
        {view.gaps.length > 0 && <ul className="planning-decisions__gaps" aria-label="Vacíos normativos de este docente">{view.gaps.map((gap) => <li key={gap.code}>{gap.message}</li>)}</ul>}
        {view.nextException && <p className="planning-decisions__provenance">
          Siguiente paso regulado: {AUTHORIZATION_LABEL[view.nextException.kind].toLowerCase()}{view.nextException.maxMinutes !== null ? ` (hasta ${minutesText(view.nextException.maxMinutes, lectiveHourMinutes)})` : ''}.
        </p>}
        {authorized !== null && teacher.regime && teacher.maxWeeklyMinutes !== authorized && (Number.isFinite(teacher.maxWeeklyMinutes)) && <p className="planning-decisions__provenance">
          {teacher.maxWeeklyMinutes < authorized
            ? `La carga semanal máxima configurada (${teacher.maxWeeklyMinutes} min) es menor que el máximo autorizado: la propuesta usa la menor.`
            : `La carga semanal máxima configurada (${teacher.maxWeeklyMinutes} min) supera el máximo autorizado: la propuesta la limita a ${authorized} min.`}
          {teacher.maxWeeklyMinutes < authorized && <> <Button type="button" size="sm" variant="outline" disabled={disabled}
            onClick={() => onChange({ ...teacher, maxWeeklyMinutes: authorized })}>Igualar la carga semanal al máximo autorizado</Button></>}
        </p>}
        {!teacher.regime && <p className="planning-decisions__provenance">Sin régimen registrado la propuesta usa solo la carga semanal máxima declarada.</p>}
      </>}
    </div>

    <div className="planning-teacher-load__authorizations">
      <strong>Autorizaciones registradas</strong>
      <p className="planning-decisions__provenance">Registrar una autorización deja constancia de un trámite formal hecho fuera de este sistema; no lo reemplaza ni lo sustituye.</p>
      {(teacher.loadAuthorizations?.length ?? 0) === 0 ? <p className="planning-decisions__provenance">Sin autorizaciones registradas.</p>
        : <ul className="planning-teacher-load__authorization-list">{teacher.loadAuthorizations!.map((item, index) => <li key={`${item.kind}-${index}`}>
          <Badge variant="outline">{AUTHORIZATION_LABEL[item.kind]}</Badge>
          <span>Ref. {item.reference}{item.maxLectiveHours !== undefined ? ` · hasta ${item.maxLectiveHours} h lectivas` : ''}</span>
          <Button type="button" size="sm" variant="ghost" disabled={disabled} aria-label={`Quitar ${AUTHORIZATION_LABEL[item.kind].toLowerCase()} ${item.reference}`}
            onClick={() => onChange(removeLoadAuthorization(teacher, index))}>Quitar</Button>
        </li>)}</ul>}
      <div className="planning-teacher-load__add">
        <Label>
          Tipo
          <NativeSelect aria-label="Tipo de autorización" value={kind} disabled={disabled} onChange={(event) => { setKind(event.currentTarget.value as LoadAuthorizationKind); setAuthorizationError('') }}>
            {(Object.keys(AUTHORIZATION_LABEL) as LoadAuthorizationKind[]).map((value) => <option key={value} value={value}>{AUTHORIZATION_LABEL[value]}</option>)}
          </NativeSelect>
        </Label>
        <div>
          <Label htmlFor={ids.reference}>Referencia del documento</Label>
          <Input id={ids.reference} value={reference} disabled={disabled} maxLength={200} aria-invalid={Boolean(authorizationError)} aria-describedby={authorizationError ? ids.authError : undefined}
            onChange={(event) => setReference(event.currentTarget.value)} />
        </div>
        {kind === 'vrap-authorization' && <div>
          <Label htmlFor={ids.hours}>Horas lectivas máximas</Label>
          <Input id={ids.hours} inputMode="numeric" value={hours} disabled={disabled} onChange={(event) => setHours(event.currentTarget.value)} />
        </div>}
        <Button type="button" variant="outline" disabled={disabled} onClick={submitAuthorization}>Registrar autorización</Button>
      </div>
      {authorizationError && <span id={ids.authError} role="alert" className="academic-resource-workbench__inline-error">{authorizationError}</span>}
    </div>
  </fieldset>
}
