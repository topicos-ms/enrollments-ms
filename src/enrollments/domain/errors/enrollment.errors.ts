import { DomainError } from './domain-error';

export class QuotaExceededError extends DomainError<{
  courseSectionId: string;
  availableQuota: number;
}> {
  constructor(courseSectionId: string, availableQuota: number) {
    super(
      'QUOTA_EXCEEDED',
      'No hay cupos disponibles para esta materia',
      { courseSectionId, availableQuota },
    );
  }
}

export class DuplicateEnrollmentError extends DomainError<{
  enrollmentId: string;
  courseSectionId: string;
}> {
  constructor(enrollmentId: string, courseSectionId: string) {
    super(
      'ALREADY_ENROLLED',
      'Ya te encuentras inscrito en esta materia',
      { enrollmentId, courseSectionId },
    );
  }
}

export class EnrollmentNotActiveError extends DomainError<{
  enrollmentId: string;
  currentState: string;
}> {
  constructor(enrollmentId: string, currentState: string) {
    super(
      'ENROLLMENT_NOT_ACTIVE',
      'Tu inscripción no está activa',
      { enrollmentId, currentState },
    );
  }
}
