import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { AcademicValidationService } from '../../../validation';
import { Enrollment } from '../../../../entities/enrollment.entity';
import { EnrollmentDetail } from '../../../../entities/enrollment-detail.entity';
import { EnrollmentErrorMapper } from './enrollment-error-mapper';
import { IdentifiersResolver } from './identifiers-resolver.service';
import { CourseSectionQuotaService } from './quota.service';

export interface EnrollmentResult {
  enrollmentDetail: EnrollmentDetail;
  remainingQuota: number;
  wasCreated: boolean;
}

@Injectable()
export class EnrollmentProcessorService {
  constructor(
    private readonly academicValidationService: AcademicValidationService,
    private readonly identifiers: IdentifiersResolver,
    private readonly courseSectionQuota: CourseSectionQuotaService,
  ) {}

  async processEnrollment(
    manager: EntityManager,
    detailDto: import('../../../../dto').CreateEnrollmentDetailDto,
    enrollmentId: string,
    courseSectionId: string,
  ): Promise<EnrollmentResult> {
    const enrollment = await manager.findOne(Enrollment, {
      where: { id: enrollmentId },
    });
    if (!enrollment) {
      throw new NotFoundException(
        `Inscripción con ID ${enrollmentId} no encontrada`,
      );
    }
    if (enrollment.state !== 'Active') {
      throw EnrollmentErrorMapper.enrollmentNotActive(
        enrollmentId,
        enrollment.state,
      );
    }

    const validationResult = await this.academicValidationService.validateEnrollment(
      enrollment.student_id,
      courseSectionId,
      enrollment.term_id,
      manager,
    );
    if (!validationResult.isValid) {
      throw EnrollmentErrorMapper.multipleValidation(
        validationResult.errors,
        validationResult.warnings,
      );
    }

    const courseSection = await this.courseSectionQuota.getWithLockOrThrow(
      manager,
      courseSectionId,
    );
    this.courseSectionQuota.ensureAvailableOrThrow(courseSection);

    try {
      const enrollmentDetail = await manager.save(
        EnrollmentDetail,
        manager.create(EnrollmentDetail, {
          ...this.identifiers.extractPersistableFields(detailDto),
          enrollment_id: enrollmentId,
          course_section_id: courseSectionId,
        }),
      );

      const remainingQuota = await this.courseSectionQuota.decrementAndReturn(
        manager,
        courseSection.id,
      );
      return { enrollmentDetail, remainingQuota, wasCreated: true };
    } catch (error: any) {
      throw EnrollmentErrorMapper.fromDbError(
        error,
        enrollmentId,
        courseSectionId,
      );
    }
  }
}

