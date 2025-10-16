import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { OptimizedQueryService } from '../../../infrastructure/persistence/optimized-query.service';
import {
  ValidationContext,
  ValidationReport,
} from '../validation-types';
import { ValidationPolicy } from './validation-policy';

const MAX_COURSES_PER_TERM = 8;

@Injectable()
export class AcademicLimitsPolicy implements ValidationPolicy {
  constructor(
    private readonly optimizedQueryService: OptimizedQueryService,
  ) {}

  async evaluate(
    context: ValidationContext,
    _manager?: EntityManager,
  ): Promise<ValidationReport> {
    const enrolledCount =
      await this.optimizedQueryService.getEnrolledCoursesCount(
        context.studentId,
        context.termId,
      );

    const errors =
      enrolledCount >= MAX_COURSES_PER_TERM
        ? [
            {
              code: 'ACADEMIC_LIMIT_EXCEEDED',
              message: `Límite de materias excedido: ${enrolledCount}/${MAX_COURSES_PER_TERM}`,
              details: {
                enrolledCount,
                limit: MAX_COURSES_PER_TERM,
              },
            },
          ]
        : [];

    const warnings =
      enrolledCount >= MAX_COURSES_PER_TERM - 1
        ? [
            {
              code: 'ACADEMIC_LIMIT_WARNING',
              message: `Cerca del límite de materias: ${enrolledCount}/${MAX_COURSES_PER_TERM}`,
              details: {
                enrolledCount,
                limit: MAX_COURSES_PER_TERM,
              },
            },
          ]
        : [];

    return { errors, warnings };
  }
}
