import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Error cuando no hay cupos disponibles
 */
export class QuotaExceededException extends HttpException {
  constructor(courseSectionId: string, availableQuota: number) {
    super(
      {
        message: 'No hay cupos disponibles para esta materia',
        code: 'QUOTA_EXCEEDED',
        courseSectionId,
        availableQuota,
      },
      HttpStatus.CONFLICT,
    );
  }
}

/**
 * Error cuando el estudiante ya está inscrito (idempotencia)
 */
export class DuplicateEnrollmentException extends HttpException {
  constructor(enrollmentId: string, courseSectionId: string) {
    super(
      {
        message: 'Ya te encuentras inscrito en esta materia',
        code: 'ALREADY_ENROLLED',
        enrollmentId,
        courseSectionId,
      },
      HttpStatus.CONFLICT,
    );
  }
}

/**
 * Error cuando la inscripción no está activa
 */
export class EnrollmentNotActiveException extends HttpException {
  constructor(enrollmentId: string, currentState: string) {
    super(
      {
        message: 'Tu inscripción no está activa',
        code: 'ENROLLMENT_NOT_ACTIVE',
        enrollmentId,
        currentState,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
