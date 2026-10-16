import assert from 'node:assert/strict'
import { test } from 'node:test'
import { enrollmentReport } from '../../tests/fixtures/matriculaRegularKit.ts'
import { buildSumReportView, formatRecordRange } from './regularEnrollmentReport.ts'

test('V-08: rows show cycle, code - name, credits, section label and teacher, ordered by cycle', () => {
  const base = enrollmentReport()
  const view = buildSumReportView(enrollmentReport({ rows: base.rows.map((row, index) => ({
    ...row, cycle: index === 0 ? 7 : 1, label: String(index + 1), teacher: index === 0 ? null : 'SINTÉTICO, DOCENTE DOS',
  })) }))
  assert.deepEqual(view.headers, ['Ciclo', 'Asignatura', 'Créditos', 'Sección', 'Docente Asignado'])
  assert.deepEqual(view.rows, [
    ['1', 'SYN-SIS-C2 - Curso, "sintético" 2', '3', '2', 'SINTÉTICO, DOCENTE DOS'],
    ['7', 'SYN-SIS-C1 - Curso sintético 1', '4', '1', '-- --, --'],
  ])
  assert.equal(view.acceptedAt, '11/08/2026 10:00:00')
  assert.equal(view.enrollmentType, 'Matrícula Vía Web')
  assert.equal(view.totalCredits, 7)
  assert.equal(view.courseCount, 2)
})

test('MR2 reports without display fields fall back to --, the sectionId and the observed empty teacher', () => {
  const view = buildSumReportView(enrollmentReport())
  assert.deepEqual(view.rows[0], ['--', 'SYN-SIS-C1 - Curso sintético 1', '4', 'SYN-SIS-S1', '-- --, --'])
})

test('V-08: record range text', () => {
  assert.equal(formatRecordRange(3), 'Mostrando 1 - 3 de 3 registros')
  assert.equal(formatRecordRange(0), 'Mostrando 0 - 0 de 0 registros')
})

test('the CSV mirrors the table and keeps a single-extension base name', () => {
  const view = buildSumReportView(enrollmentReport())
  assert.deepEqual(view.csv.headers, view.headers)
  assert.deepEqual(view.csv.rows, view.rows)
  assert.equal(view.csv.name, 'reporte-matricula-SYN-SIS-A')
})
