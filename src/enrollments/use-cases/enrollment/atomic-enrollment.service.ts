import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { TransactionService } from '../../../common';
import { Enrollment } from '../../entities/enrollment.entity';
import { EnrollmentDetail } from '../../entities/enrollment-detail.entity';
import { CourseSection } from '../../entities/external/course-section.entity';
import { CreateEnrollmentDetailDto } from '../../dto';
import { AcademicValidationService } from '../validation';
import { EnrollmentContextResolver } from './enrollment-context-resolver.service';
import {
  DuplicateEnrollmentError,
  EnrollmentNotActiveError,
  MultipleValidationError,
  QuotaExceededError,
} from '../../domain/errors';

export interface EnrollmentResult {
  enrollmentDetail: EnrollmentDetail;
  remainingQuota: number;
  wasCreated: boolean;
}

export interface BatchEnrollmentResult {
  results: EnrollmentResult[];
  requested: number;
}

interface ResolvedIdentifiers {
  enrollmentId: string;
  courseSectionId: string;
}

@Injectable()
export class AtomicEnrollmentService {
  private readonly logger = new Logger(AtomicEnrollmentService.name);

  constructor(
    @InjectRepository(CourseSection)
    private readonly courseSectionRepository: Repository<CourseSection>,
    private readonly transactionService: TransactionService,
    private readonly academicValidationService: AcademicValidationService,
    private readonly contextResolver: EnrollmentContextResolver,
  ) {}

  async enrollStudentInCourseSection(
    dto: CreateEnrollmentDetailDto,
  ): Promise<EnrollmentResult> {
    const identifiers = await this.resolveIdentifiers(dto);
    this.logger.log(
      `Inscribiendo: Enrollment ${identifiers.enrollmentId} -> CourseSection ${identifiers.courseSectionId}`,
    );

    return this.transactionService.executeWithRetry(
      async (manager) =>
        this.processSingleEnrollment(manager, dto, identifiers),
      3,
      10_000,
    );
  }

  async enrollStudentInCourseSectionsBatch(
    dtos: CreateEnrollmentDetailDto[],
  ): Promise<BatchEnrollmentResult> {
    if (!dtos?.length) {
      throw new BadRequestException(
        'At least one enrollment detail is required',
      );
    }

    this.logger.log(`Procesando lote de ${dtos.length} inscripciones`);
    const payload = await this.resolveBatch(dtos);

    const results = await this.transactionService.executeWithRetry(
      async (manager) => {
        const processed: EnrollmentResult[] = [];

        for (const item of payload) {
          // Procesar inscripción individual
          const result = await this.processSingleEnrollmentInBatch(
            manager,
            item.dto,
            item.identifiers,
          );
          processed.push(result);
        }

        return processed;
      },
      3,
      10_000,
    );

    this.logger.log(
      `Lote procesado: ${results.length}/${dtos.length} exitosas`,
    );

    return {
      results,
      requested: dtos.length,
    };
  }

  async getCourseSectionQuotaStatus(courseSectionId: string): Promise<{
    quota_max: number;
    quota_available: number;
    quota_used: number;
    is_full: boolean;
  }> {
    const courseSection = await this.courseSectionRepository.findOne({
      where: { id: courseSectionId },
    });

    if (!courseSection) {
      throw new NotFoundException(
        `Sección de curso con ID ${courseSectionId} no encontrada`,
      );
    }

    const quota_used = courseSection.quota_max - courseSection.quota_available;

    return {
      quota_max: courseSection.quota_max,
      quota_available: courseSection.quota_available,
      quota_used,
      is_full: courseSection.quota_available <= 0,
    };
  }

  private async processSingleEnrollment(
    manager: EntityManager,
    dto: CreateEnrollmentDetailDto,
    identifiers: ResolvedIdentifiers,
  ): Promise<EnrollmentResult> {
    const enrollment = await this.validateEnrollmentExists(
      manager,
      identifiers.enrollmentId,
    );
    const courseSection = await this.getCourseSectionWithLock(
      manager,
      identifiers.courseSectionId,
    );

    await this.validateNoDuplicateEnrollment(
      manager,
      identifiers.enrollmentId,
      identifiers.courseSectionId,
    );
    await this.performAcademicValidations(manager, enrollment, courseSection);
    this.ensureQuotaAvailable(courseSection);

    const enrollmentDetail = await this.createEnrollmentDetail(
      manager,
      dto,
      identifiers,
    );
    const updatedCourseSection = await this.decrementQuota(
      manager,
      courseSection,
    );

    this.logger.log(
      `Inscripción exitosa. Cupos restantes: ${updatedCourseSection.quota_available}`,
    );

    return {
      enrollmentDetail,
      remainingQuota: updatedCourseSection.quota_available,
      wasCreated: true,
    };
  }

  /**
   * Procesa una inscripción individual dentro de un lote
   * IMPORTANTE: Crea el EnrollmentDetail ANTES de validar para que
   * las validaciones vean los cambios pendientes en la transacción
   */
  private async processSingleEnrollmentInBatch(
    manager: EntityManager,
    dto: CreateEnrollmentDetailDto,
    identifiers: ResolvedIdentifiers,
  ): Promise<EnrollmentResult> {
    const enrollment = await this.validateEnrollmentExists(
      manager,
      identifiers.enrollmentId,
    );
    const courseSection = await this.getCourseSectionWithLock(
      manager,
      identifiers.courseSectionId,
    );

    await this.validateNoDuplicateEnrollment(
      manager,
      identifiers.enrollmentId,
      identifiers.courseSectionId,
    );
    this.ensureQuotaAvailable(courseSection);

    // PRIMERO: Crear el EnrollmentDetail (pero NO decrementar cuota aún)
    const enrollmentDetail = await this.createEnrollmentDetail(
      manager,
      dto,
      identifiers,
    );

    // SEGUNDO: Validar (ahora las validaciones ven este detalle en la transacción)
    await this.performAcademicValidations(manager, enrollment, courseSection);

    // TERCERO: Decrementar cuota
    const updatedCourseSection = await this.decrementQuota(
      manager,
      courseSection,
    );

    this.logger.log(
      `Inscripción exitosa en lote. Cupos restantes: ${updatedCourseSection.quota_available}`,
    );

    return {
      enrollmentDetail,
      remainingQuota: updatedCourseSection.quota_available,
      wasCreated: true,
    };
  }

  private async resolveIdentifiers(
    dto: CreateEnrollmentDetailDto,
  ): Promise<ResolvedIdentifiers> {
    const identifiers = await this.contextResolver.resolveIdentifiers(dto);
    return {
      enrollmentId: identifiers.enrollmentId,
      courseSectionId: identifiers.courseSectionId,
    };
  }

  private async resolveBatch(
    dtos: CreateEnrollmentDetailDto[],
  ): Promise<
    Array<{ dto: CreateEnrollmentDetailDto; identifiers: ResolvedIdentifiers }>
  > {
    const payload: Array<{
      dto: CreateEnrollmentDetailDto;
      identifiers: ResolvedIdentifiers;
    }> = [];
    const seenPairs = new Set<string>();

    for (const dto of dtos) {
      const identifiers = await this.resolveIdentifiers(dto);
      const pairKey = `${identifiers.enrollmentId}:${identifiers.courseSectionId}`;

      if (seenPairs.has(pairKey)) {
        throw new DuplicateEnrollmentError(
          identifiers.enrollmentId,
          identifiers.courseSectionId,
        );
      }

      seenPairs.add(pairKey);
      payload.push({ dto, identifiers });
    }

    return payload;
  }

  private async validateEnrollmentExists(
    manager: EntityManager,
    enrollmentId: string,
  ): Promise<Enrollment> {
    const enrollment = await manager.findOne(Enrollment, {
      where: { id: enrollmentId },
      relations: ['student'],
    });

    if (!enrollment) {
      throw new NotFoundException(
        `Inscripción con ID ${enrollmentId} no encontrada`,
      );
    }

    if (enrollment.state !== 'Active') {
      throw new EnrollmentNotActiveError(enrollmentId, enrollment.state);
    }

    return enrollment;
  }

  private async getCourseSectionWithLock(
    manager: EntityManager,
    courseSectionId: string,
  ): Promise<CourseSection> {
    const courseSection = await manager.findOne(CourseSection, {
      where: { id: courseSectionId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!courseSection) {
      throw new NotFoundException(
        `Sección de curso con ID ${courseSectionId} no encontrada`,
      );
    }

    return courseSection;
  }

  private async validateNoDuplicateEnrollment(
    manager: EntityManager,
    enrollmentId: string,
    courseSectionId: string,
  ): Promise<void> {
    const existingDetail = await manager.findOne(EnrollmentDetail, {
      where: { enrollment_id: enrollmentId, course_section_id: courseSectionId },
    });

    if (existingDetail) {
      throw new DuplicateEnrollmentError(enrollmentId, courseSectionId);
    }
  }

  private ensureQuotaAvailable(courseSection: CourseSection): void {
    if (courseSection.quota_available <= 0) {
      throw new QuotaExceededError(
        courseSection.id,
        courseSection.quota_available,
      );
    }
  }

  private async createEnrollmentDetail(
    manager: EntityManager,
    dto: CreateEnrollmentDetailDto,
    identifiers: ResolvedIdentifiers,
  ): Promise<EnrollmentDetail> {
    const {
      student_code,
      term_name,
      course_code,
      group_label,
      degree_program_code,
      study_plan_version,
      ...persistableFields
    } = dto;

    const enrollmentDetail = manager.create(EnrollmentDetail, {
      ...persistableFields,
      enrollment_id: identifiers.enrollmentId,
      course_section_id: identifiers.courseSectionId,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return manager.save(EnrollmentDetail, enrollmentDetail);
  }

  private async decrementQuota(
    manager: EntityManager,
    courseSection: CourseSection,
  ): Promise<CourseSection> {
    const result = await manager
      .createQueryBuilder()
      .update(CourseSection)
      .set({
        quota_available: () => 'quota_available - 1',
        updated_at: new Date(),
      })
      .where('id = :id', { id: courseSection.id })
      .andWhere('quota_available > 0')
      .execute();

    if (result.affected === 0) {
      throw new QuotaExceededError(courseSection.id, 0);
    }

    const updated = await manager.findOne(CourseSection, {
      where: { id: courseSection.id },
    });

    return updated!;
  }

  private async performAcademicValidations(
    manager: EntityManager,
    enrollment: Enrollment,
    courseSection: CourseSection,
  ): Promise<void> {
    const validationResult =
      await this.academicValidationService.validateEnrollment(
        enrollment.student.id,
        courseSection.id,
        courseSection.term_id,
        manager,
      );

    if (!validationResult.isValid) {
      this.logger.warn(
        `Validaciones fallidas: ${validationResult.errors.join('; ')}`,
      );
      throw new MultipleValidationError(
        validationResult.errors,
        validationResult.warnings,
      );
    }

    if (validationResult.warnings.length > 0) {
      this.logger.warn(
        `Advertencias: ${validationResult.warnings.join('; ')}`,
      );
    }
  }
}
