import { Injectable, Logger } from '@nestjs/common';
import {
  QuotaExceededException,
  DuplicateEnrollmentException,
  EnrollmentNotActiveException,
} from '../exceptions/enrollment.exceptions';
import {
  MultipleValidationException,
  PrerequisiteNotMetException,
  ScheduleConflictException,
  AcademicLimitExceededException,
  CourseAlreadyPassedException,
  EnrollmentPeriodClosedException,
} from '../exceptions/academic-validation.exceptions';

/**
 * Servicio centralizado para manejo de errores de inscripción.
 * Traduce excepciones técnicas en mensajes claros para el usuario.
 */
@Injectable()
export class EnrollmentErrorHandler {
  private readonly logger = new Logger(EnrollmentErrorHandler.name);

  /**
   * Procesa un error y devuelve un mensaje amigable para el usuario.
   */
  handleError(error: any): { message: string; code: string; details?: any } {
    this.logger.error(`Error capturado: ${error.message}`, error.stack);

    // Manejo de errores de cupo
    if (error instanceof QuotaExceededException) {
      return {
        message: 'No hay cupos disponibles para esta materia.',
        code: 'QUOTA_EXCEEDED',
        details: {
          courseSectionId: error.getResponse()['courseSectionId'],
          availableQuota: error.getResponse()['availableQuota'],
        },
      };
    }

    // Manejo de inscripción duplicada (Idempotencia)
    if (error instanceof DuplicateEnrollmentException) {
      return {
        message: 'Ya te encuentras inscrito en esta materia.',
        code: 'ALREADY_ENROLLED',
        details: {
          enrollmentId: error.getResponse()['enrollmentId'],
          courseSectionId: error.getResponse()['courseSectionId'],
        },
      };
    }

    // Manejo de inscripción no activa
    if (error instanceof EnrollmentNotActiveException) {
      return {
        message: 'Tu inscripción no está activa. Contacta con administración académica.',
        code: 'ENROLLMENT_NOT_ACTIVE',
        details: {
          enrollmentId: error.getResponse()['enrollmentId'],
          currentState: error.getResponse()['currentState'],
        },
      };
    }

    // Manejo de prerequisitos no cumplidos
    if (error instanceof PrerequisiteNotMetException) {
      const details = error.getResponse()['details'];
      const missing = details?.missingPrerequisites || [];
      return {
        message: `No cumples con los prerequisitos: ${missing.join(', ')}`,
        code: 'PREREQUISITE_NOT_MET',
        details: { missingPrerequisites: missing },
      };
    }

    // Manejo de conflictos de horario
    if (error instanceof ScheduleConflictException) {
      return {
        message: 'Existe un conflicto de horario con otra materia inscrita.',
        code: 'SCHEDULE_CONFLICT',
        details: error.getResponse()['details']?.conflicts,
      };
    }

    // Manejo de límites académicos excedidos
    if (error instanceof AcademicLimitExceededException) {
      const details = error.getResponse()['details'];
      return {
        message: `Has excedido el límite de ${details.limitType}. Actual: ${details.currentValue}, Máximo: ${details.maxValue}`,
        code: 'ACADEMIC_LIMIT_EXCEEDED',
        details,
      };
    }

    // Manejo de materia ya aprobada
    if (error instanceof CourseAlreadyPassedException) {
      const details = error.getResponse()['details'];
      return {
        message: `Ya has aprobado la materia ${details.courseName} con calificación ${details.grade}.`,
        code: 'COURSE_ALREADY_PASSED',
        details,
      };
    }

    // Manejo de período de inscripción cerrado
    if (error instanceof EnrollmentPeriodClosedException) {
      return {
        message: 'El período de inscripción no está activo actualmente.',
        code: 'ENROLLMENT_PERIOD_CLOSED',
        details: error.getResponse()['details'],
      };
    }

    // Manejo de múltiples errores de validación
    if (error instanceof MultipleValidationException) {
      const details = error.getResponse()['details'];
      const errors = details?.errors || [];
      return {
        message: `Errores de validación: ${errors.join('; ')}`,
        code: 'MULTIPLE_VALIDATION_ERRORS',
        details,
      };
    }

    // Error genérico
    return {
      message: 'Ocurrió un error al procesar tu inscripción. Inténtalo nuevamente.',
      code: 'INTERNAL_ERROR',
      details: { originalMessage: error.message },
    };
  }

  /**
   * Valida si un error es de tipo recuperable (puede reintentar).
   */
  isRecoverableError(error: any): boolean {
    return !(
      error instanceof DuplicateEnrollmentException ||
      error instanceof QuotaExceededException ||
      error instanceof PrerequisiteNotMetException ||
      error instanceof EnrollmentPeriodClosedException
    );
  }

  /**
   * Devuelve un mensaje resumido para logs.
   */
  getLogMessage(error: any): string {
    if (error.message) {
      return error.message;
    }
    return 'Error desconocido';
  }
}
