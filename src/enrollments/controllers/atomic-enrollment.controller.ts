import { BadRequestException, Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AtomicEnrollmentService } from '../services';
import { CreateEnrollmentDetailDto } from '../dto';
import { IdempotencyService } from '../../common';

interface AtomicEnrollPayload {
  data: CreateEnrollmentDetailDto;
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
  ) {}

  @MessagePattern('enrollments.atomic.enroll')
  async enrollStudent(@Payload() payload: AtomicEnrollPayload) {
    const { data, idempotencyKey } = payload;

    if (!idempotencyKey) {
      throw new BadRequestException(
        'idempotencyKey is required for enrollment operations',
      );
    }

    const operationKey = `enroll:${idempotencyKey}:${data.enrollment_id}:${data.course_section_id}`;

    const result = await this.idempotencyService.executeWithIdempotency(
      operationKey,
      async () => {
        return await this.atomicEnrollmentService.enrollStudentInCourseSection(
          data,
        );
      },
    );

    return {
      success: true,
      message: result.isNew
        ? 'Inscripción realizada exitosamente'
        : 'Inscripción procesada previamente',
      data: {
        enrollmentDetail: result.data.enrollmentDetail,
        remainingQuota: result.data.remainingQuota,
        isNewOperation: result.isNew,
      },
    };
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
