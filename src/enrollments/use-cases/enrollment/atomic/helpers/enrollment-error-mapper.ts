import { DuplicateEnrollmentError, EnrollmentNotActiveError, MultipleValidationError } from '../../../../domain/errors';

export class EnrollmentErrorMapper {
  static fromDbError(err: any, enrollmentId: string, courseSectionId: string): any {
    if (err && (err.code === '23505' || err?.detail?.includes('already exists'))) {
      return new DuplicateEnrollmentError(enrollmentId, courseSectionId);
    }
    return err;
  }

  static enrollmentNotActive(enrollmentId: string, state: string) {
    return new EnrollmentNotActiveError(enrollmentId, state);
  }

  static multipleValidation(errors: string[], warnings: string[]) {
    return new MultipleValidationError(errors, warnings);
  }
}

