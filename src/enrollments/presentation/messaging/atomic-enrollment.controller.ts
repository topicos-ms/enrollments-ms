import { BadRequestException, Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AtomicEnrollmentService } from '../../use-cases/enrollment';
import { EnrollmentErrorHandler } from '../errors/enrollment-error-handler.service';
import { CreateEnrollmentDetailBatchDto } from '../../dto';
import { IdempotencyService } from '../../../common';

interface AtomicEnrollBatchPayload {
  data: CreateEnrollmentDetailBatchDto;
  idempotencyKey?: string;
}

interface CourseSectionIdPayload {
  courseSectionId: string;
}

@Controller()
export class AtomicEnrollmentController {
  constructor(
    private readonly atomicEnrollmentService: AtomicEnrollmentService,
    private readonly idempotencyService: IdempotencyService,
    private readonly errorHandler: EnrollmentErrorHandler,
  ) {}

  @MessagePattern('enrollments.atomic.enrollBatch')
  async enrollStudentBatch(@Payload() payload: AtomicEnrollBatchPayload) {
    const { data, idempotencyKey } = payload;

    if (!idempotencyKey) {
      throw new BadRequestException(
        'idempotencyKey is required for enrollment operations',
      );
    }

    if (!data?.items?.length) {
      throw new BadRequestException(
        'At least one enrollment detail is required to process the batch',
      );
    }

    const operationKey = `enroll-batch:${idempotencyKey}`;

    try {
      const result = await this.idempotencyService.executeWithIdempotency(
        operationKey,
        async () =>
          this.atomicEnrollmentService.enrollStudentInCourseSectionsBatch(
            data.items,
          ),
      );

      return {
        success: true,
        message: result.isNew
          ? `Inscripciones procesadas exitosamente (solicitadas: ${data.items.length}, completadas: ${result.data.results.length})`
          : 'Inscripciones procesadas previamente',
        data: {
          enrollments: result.data.results,
          totals: {
            requested: data.items.length,
            processed: result.data.results.length,
          },
          isNewOperation: result.isNew,
        },
      };
    } catch (error) {
      const errorInfo = this.errorHandler.handleError(error);
      return {
        success: false,
        message: errorInfo.message,
        error: {
          code: errorInfo.code,
          details: errorInfo.details,
        },
      };
    }
  }

  @MessagePattern('enrollments.atomic.quotaStatus')
  async getQuotaStatus(@Payload() payload: CourseSectionIdPayload) {
    const status =
      await this.atomicEnrollmentService.getCourseSectionQuotaStatus(
        payload.courseSectionId,
      );

    return {
      success: true,
      data: status,
    };
  }

  @MessagePattern('enrollments.atomic.idempotencyStats')
  async getIdempotencyStats() {
    const stats = this.idempotencyService.getStats();

    return {
      success: true,
      data: {
        ...stats,
        message: 'Sistema de idempotencia activo',
      },
    };
  }
}
