import { Injectable } from '@nestjs/common'
import { validateEnrollmentReportResponse } from '../../../shared/matricula-regular.mjs'
import type {
  MatriculaRegularEnrollmentReport,
  MatriculaRegularEnvelope,
  MatriculaRegularId,
  MatriculaRegularUuid,
} from '../../../shared/matricula-regular.mjs'
import { MatriculaRegularError } from './matricula-regular-error.filter.js'
import { MatriculaRegularRepository } from './matricula-regular.repository.js'

@Injectable()
export class ReportService {
  constructor(private readonly repository: MatriculaRegularRepository) {}

  read(
    enrollmentId: MatriculaRegularUuid,
    runId: MatriculaRegularUuid,
    actorId: MatriculaRegularId,
  ): MatriculaRegularEnvelope<MatriculaRegularEnrollmentReport> {
    const snapshot = this.repository.readSnapshot()
    if (runId !== snapshot.runId) throw new MatriculaRegularError(409, snapshot.runId, 'RUN_CHANGED')
    if (!snapshot.actors.some((actor) => actor.actorId === actorId)) {
      throw new MatriculaRegularError(404, snapshot.runId, 'ACTOR_NOT_FOUND')
    }

    const report = snapshot.reports.find(([id]) => id === enrollmentId)?.[1]
    if (report === undefined || report.actorId !== actorId) {
      throw new MatriculaRegularError(404, snapshot.runId, 'REPORT_NOT_FOUND')
    }
    const response = { runId: snapshot.runId, data: structuredClone(report) }
    validateEnrollmentReportResponse(response, { runId: snapshot.runId, actorId, enrollmentId })
    return response
  }
}
