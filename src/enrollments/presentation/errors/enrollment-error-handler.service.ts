import { Injectable, Logger, HttpException } from '@nestjs/common';
import { DomainError } from '../../domain/errors';

/**
 * Maneja errores de inscripción y los traduce a respuestas amigables
 */
@Injectable()
export class EnrollmentErrorHandler {
  private readonly logger = new Logger(EnrollmentErrorHandler.name);

  /**
   * Procesa errores y devuelve respuesta estructurada
   */
  handleError(error: any): { message: string; code: string; details?: any } {
    this.logger.error(`Error: ${error.message}`, error.stack);

    if (error instanceof DomainError) {
      return {
        message: error.message,
        code: error.code,
        details: error.details,
      };
    }

    // Si es una HttpException de NestJS, extraer la respuesta
    if (error instanceof HttpException) {
      const response = error.getResponse() as any;
      return {
        message: response.message || 'Error al procesar la inscripción',
        code: response.code || 'UNKNOWN_ERROR',
        details: this.extractDetails(response),
      };
    }

    // Error genérico
    return {
      message: error.message || 'Error al procesar la inscripción',
      code: 'INTERNAL_ERROR',
      details: { originalMessage: error.message },
    };
  }

  /**
   * Extrae detalles relevantes de la respuesta
   */
  private extractDetails(response: any): any {
    const { message, code, ...details } = response;
    return Object.keys(details).length > 0 ? details : undefined;
  }
}
