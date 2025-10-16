import { DomainError } from './domain-error';

export class PrerequisiteNotMetError extends DomainError<{
  missingPrerequisites: string[];
}> {
  constructor(missingPrerequisites: string[]) {
    super(
      'PREREQUISITE_NOT_MET',
      `Prerequisitos no cumplidos: ${missingPrerequisites.join(', ')}`,
      { missingPrerequisites },
    );
  }
}

export class ScheduleConflictError extends DomainError<{
  conflicts: Array<{ course: string; time: string; day: string }>;
}> {
  constructor(conflicts: Array<{ course: string; time: string; day: string }>) {
    super(
      'SCHEDULE_CONFLICT',
      `Conflictos de horario detectados: ${conflicts
        .map((c) => `${c.course} (${c.day} ${c.time})`)
        .join(', ')}`,
      { conflicts },
    );
  }
}

export class AcademicLimitExceededError extends DomainError<{
  limitType: string;
  currentValue: number;
  maxValue: number;
}> {
  constructor(limitType: string, currentValue: number, maxValue: number) {
    super(
      'ACADEMIC_LIMIT_EXCEEDED',
      `Límite académico excedido: ${limitType}. Actual: ${currentValue}, Máximo: ${maxValue}`,
      { limitType, currentValue, maxValue },
    );
  }
}

export class CourseAlreadyPassedError extends DomainError<{
  courseName: string;
  grade: number;
}> {
  constructor(courseName: string, grade: number) {
    super(
      'COURSE_ALREADY_PASSED',
      `La materia ${courseName} ya fue aprobada con calificación ${grade}`,
      { courseName, grade },
    );
  }
}

export class EnrollmentPeriodClosedError extends DomainError<{
  periodStatus: string;
  startDate?: Date;
  endDate?: Date;
}> {
  constructor(
    periodStatus: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    super(
      'ENROLLMENT_PERIOD_CLOSED',
      `Período de inscripción no activo. Estado actual: ${periodStatus}`,
      { periodStatus, startDate, endDate },
    );
  }
}

export class MultipleValidationError extends DomainError<{
  errors: string[];
  warnings: string[];
}> {
  constructor(errors: string[], warnings: string[] = []) {
    super(
      'MULTIPLE_VALIDATION_ERROR',
      `Múltiples errores de validación académica: ${errors.join('; ')}`,
      { errors, warnings },
    );
  }
}
