import type { ArgumentMetadata, PipeTransform } from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import { MatriculaRegularError } from './matricula-regular-error.filter.js'
import { MatriculaRegularRepository } from './matricula-regular.repository.js'
import type { MatriculaRegularSubmission } from '../../../shared/matricula-regular.mjs'
import { parseSubmissionRequest, submissionValidationFields } from './dto/submission.dto.js'

@Injectable()
export class MatriculaRegularSubmissionPipe implements PipeTransform<unknown, MatriculaRegularSubmission> {
  constructor(private readonly repository: MatriculaRegularRepository) {}

  transform(value: unknown, _metadata: ArgumentMetadata): MatriculaRegularSubmission {
    try {
      return parseSubmissionRequest(value)
    } catch (error) {
      throw new MatriculaRegularError(400, this.repository.runId, 'INVALID_REQUEST', submissionValidationFields(error))
    }
  }
}
