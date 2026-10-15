import React, { useState, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { EnrollmentResultDialog } from '../../src/components/EnrollmentResultDialog'
import type { MatriculaRegularOutcome } from '../../../shared/matricula-regular.mjs'
import '../../src/components/EnrollmentResultDialog.css'

const sampleAcceptedOutcome: MatriculaRegularOutcome = {
  requestId: '11111111-1111-4111-8111-111111111111',
  actorId: 'SYN-SIS-A',
  profileRevision: 'MR-SYN-SIS-1',
  state: 'accepted',
  evaluatedAt: '2026-08-11T15:00:00.000Z',
  windowOrigin: 'synthetic',
  selection: [
    { courseId: 'SYN-SIS-C1', sectionId: 'SYN-SIS-S1' },
    { courseId: 'SYN-SIS-C2', sectionId: 'SYN-SIS-S2' },
  ],
  causes: [],
  gaps: [],
  enrollmentId: '22222222-2222-4222-8222-222222222222',
  reportPath: '/local/matricula-regular/v1/reportes/22222222-2222-4222-8222-222222222222',
}

const sampleRejectedMultiCausesOutcome: MatriculaRegularOutcome = {
  requestId: '55555555-5555-4555-8555-555555555555',
  actorId: 'SYN-SIS-A',
  profileRevision: 'MR-SYN-SIS-1',
  state: 'rejected',
  evaluatedAt: '2026-08-11T15:01:00.000Z',
  windowOrigin: 'synthetic',
  selection: [
    { courseId: 'SYN-SIS-C1', sectionId: 'SYN-SIS-S1' },
    { courseId: 'SYN-SIS-C2', sectionId: 'SYN-SIS-S2' },
  ],
  causes: [
    {
      code: 'SCHEDULE_CONFLICT',
      courseIds: ['SYN-SIS-C1', 'SYN-SIS-C2'],
      sectionIds: ['SYN-SIS-S1', 'SYN-SIS-S2'],
      sourceIds: ['L-01'],
    },
    {
      code: 'SECTION_FULL',
      courseIds: ['SYN-SIS-C2'],
      sectionIds: ['SYN-SIS-S2'],
      sourceIds: ['L-01'],
    },
  ],
  gaps: [],
  enrollmentId: null,
  reportPath: null,
}

const samplePendingOutcome: MatriculaRegularOutcome = {
  requestId: '66666666-6666-4666-8666-666666666666',
  actorId: 'SYN-SIS-A',
  profileRevision: 'MR-SYN-SIS-1',
  state: 'configuration-pending',
  evaluatedAt: '2026-08-11T15:02:00.000Z',
  windowOrigin: null,
  selection: [
    { courseId: 'SYN-SIS-C1', sectionId: 'SYN-SIS-S1' },
  ],
  causes: [],
  gaps: [
    {
      code: 'PLAN_OR_OFFER_UNKNOWN',
      courseIds: ['SYN-SIS-C1'],
      sourceIds: ['L-01'],
    },
  ],
  enrollmentId: null,
  reportPath: null,
}

export function DialogTestHarness() {
  const [outcome, setOutcome] = useState<MatriculaRegularOutcome | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [openerDisabled, setOpenerDisabled] = useState(false)
  const [status, setStatus] = useState<string>('idle')
  const [closeCount, setCloseCount] = useState(0)
  const [reportInfo, setReportInfo] = useState<{ path: string; id: string } | null>(null)
  const [draftIdentity] = useState('SYN-SIS-A:SYN-SIS-C1,SYN-SIS-C2')
  const [requestCount] = useState(0)

  const screenHeadingRef = useRef<HTMLHeadingElement>(null)
  const reportHeadingRef = useRef<HTMLHeadingElement>(null)
  const openerButtonRef = useRef<HTMLButtonElement>(null)

  const handleOpenD1 = () => {
    setOutcome(sampleAcceptedOutcome)
    setIsOpen(true)
    setStatus('dialog-open-d1')
  }

  const handleOpenD2 = () => {
    setOutcome(sampleRejectedMultiCausesOutcome)
    setIsOpen(true)
    setStatus('dialog-open-d2')
  }

  const handleSetPending = () => {
    setOutcome(samplePendingOutcome)
    setIsOpen(true)
    setStatus('attempt-open-pending')
  }

  const handleSetNull = () => {
    setOutcome(null)
    setIsOpen(true)
    setStatus('attempt-open-null')
  }

  const handleClose = () => {
    setIsOpen(false)
    setCloseCount((prev) => prev + 1)

    // C-T037 protocol: Return focus to available opener or fallback to screen heading if opener is disabled/ineligible
    setTimeout(() => {
      if (openerDisabled || !openerButtonRef.current) {
        screenHeadingRef.current?.focus()
        setStatus('closed-return-heading')
      } else {
        openerButtonRef.current.focus()
        setStatus('closed-return-opener')
      }
    }, 0)
  }

  const handleViewReport = (path: string, id: string) => {
    setIsOpen(false)
    setReportInfo({ path, id })
    setStatus('navigated-report')
    setTimeout(() => {
      reportHeadingRef.current?.focus()
    }, 0)
  }

  return (
    <div style={{ padding: '24px', fontFamily: 'sans-serif' }}>
      <header>
        <h1 id="screen-heading" ref={screenHeadingRef} tabIndex={-1}>
          Matrícula Regular FISI - Harness de Prueba
        </h1>
      </header>

      <section style={{ margin: '16px 0', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          id="btn-open-submit"
          ref={openerButtonRef}
          type="button"
          disabled={openerDisabled}
          onClick={handleOpenD1}
          style={{ padding: '8px 16px', fontWeight: 'bold' }}
        >
          Enviar Matrícula (Opener)
        </button>

        <button id="btn-trigger-d1" type="button" onClick={handleOpenD1}>
          Activar D1 (Aceptada)
        </button>

        <button id="btn-trigger-d2" type="button" onClick={handleOpenD2}>
          Activar D2 (Rechazada Multicausas)
        </button>

        <button id="btn-trigger-pending" type="button" onClick={handleSetPending}>
          Activar Pending (Incierto)
        </button>

        <button id="btn-trigger-null" type="button" onClick={handleSetNull}>
          Activar Null
        </button>

        <button
          id="btn-toggle-opener-disable"
          type="button"
          onClick={() => setOpenerDisabled((prev) => !prev)}
        >
          {openerDisabled ? 'Habilitar Opener' : 'Deshabilitar Opener'}
        </button>
      </section>

      <section style={{ border: '1px solid #ccc', padding: '12px', borderRadius: '4px' }}>
        <h2>Estado del Harness</h2>
        <p>Harness status: <span id="harness-status">{status}</span></p>
        <p>Close count: <span id="close-count">{closeCount}</span></p>
        <p>Draft identity: <span id="draft-identity">{draftIdentity}</span></p>
        <p>Fetch request count: <span id="fetch-request-count">{requestCount}</span></p>
        {reportInfo && (
          <div id="report-view-container">
            <h2 id="report-heading" ref={reportHeadingRef} tabIndex={-1}>
              Reporte de Matrícula (P1)
            </h2>
            <p id="report-path">{reportInfo.path}</p>
            <p id="report-id">{reportInfo.id}</p>
          </div>
        )}
      </section>

      <EnrollmentResultDialog
        outcome={outcome}
        isOpen={isOpen}
        onClose={handleClose}
        onViewReport={handleViewReport}
      />
    </div>
  )
}

const container = document.getElementById('root')
if (container) {
  const root = createRoot(container)
  root.render(<DialogTestHarness />)
}
