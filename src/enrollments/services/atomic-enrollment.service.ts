import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { TransactionService } from '../../common';
import { Enrollment } from '../entities/enrollment.entity';
import { EnrollmentDetail } from '../entities/enrollment-detail.entity';
import { CourseSection } from '../entities/external/course-section.entity';
import { CreateEnrollmentDetailDto } from '../dto';
import {
  QuotaExceededException,
  DuplicateEnrollmentException,
  EnrollmentNotActiveException,
} from '../exceptions';
import { AcademicValidationService } from './academic-validation.service';
import { EnrollmentErrorHandler } from './enrollment-error-handler.service';
import { MultipleValidationException } from '../exceptions/academic-validation.exceptions';
import { Student } from '../entities/external/student.entity';
import { Term } from '../entities/external/term.entity';
import { Course } from '../entities/external/course.entity';
import { StudyPlan } from '../entities/external/study-plan.entity';
import { DegreeProgram } from '../entities/external/degree-program.entity';

export interface EnrollmentResult {
  enrollmentDetail: EnrollmentDetail;
  remainingQuota: number;
  wasCreated: boolean;
}

export interface BatchEnrollmentResult {
  results: EnrollmentResult[];
  requested: number;
}

@Injectable()
export class AtomicEnrollmentService {
  private readonly logger = new Logger(AtomicEnrollmentService.name);

  constructor(
    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>,
    @InjectRepository(EnrollmentDetail)
    private readonly enrollmentDetailRepository: Repository<EnrollmentDetail>,
    @InjectRepository(CourseSection)
    private readonly courseSectionRepository: Repository<CourseSection>,
    @InjectRepository(Student)
    private readonly studentRepository: Repository<Student>,
    @InjectRepository(Term)
    private readonly termRepository: Repository<Term>,
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(StudyPlan)
    private readonly studyPlanRepository: Repository<StudyPlan>,
    @InjectRepository(DegreeProgram)
    private readonly degreeProgramRepository: Repository<DegreeProgram>,
    private readonly transactionService: TransactionService,
    private readonly academicValidationService: AcademicValidationService,
    private readonly errorHandler: EnrollmentErrorHandler,
  ) {}

  /**
   * Inscribe a un estudiante en una sección de curso
   */
  async enrollStudentInCourseSection(
    createEnrollmentDetailDto: CreateEnrollmentDetailDto,
  ): Promise<EnrollmentResult> {
    const resolved = await this.resolveIdsForEnrollmentDetail(createEnrollmentDetailDto);
    
    this.logger.log(`Inscribiendo: Enrollment ${resolved.enrollment_id} -> CourseSection ${resolved.course_section_id}`);

    return await this.transactionService.executeWithRetry(
      async (manager: EntityManager) => {
        const enrollment = await this.validateEnrollmentExists(manager, resolved.enrollment_id);
        const courseSection = await this.getCourseSectionWithLock(manager, resolved.course_section_id);

        await this.validateNoDuplicateEnrollment(manager, resolved.enrollment_id, resolved.course_section_id);
        await this.performAcademicValidations(manager, enrollment, courseSection);
        this.validateQuotaAvailable(courseSection);

        const enrollmentDetail = await this.createEnrollmentDetail(manager, { ...createEnrollmentDetailDto, ...resolved });
        const updatedCourseSection = await this.decrementQuota(manager, courseSection);

        this.logger.log(`Inscripción exitosa. Cupos restantes: ${updatedCourseSection.quota_available}`);

        return {
          enrollmentDetail,
          remainingQuota: updatedCourseSection.quota_available,
          wasCreated: true,
        };
      },
      3,
      10000,
    );
  }

  /**
   * Inscribe múltiples materias en lote
   */
  async enrollStudentInCourseSectionsBatch(
    createEnrollmentDetailDtos: CreateEnrollmentDetailDto[],
  ): Promise<BatchEnrollmentResult> {
    if (!createEnrollmentDetailDtos?.length) {
      throw new BadRequestException('At least one enrollment detail is required');
    }

    this.logger.log(`Procesando lote de ${createEnrollmentDetailDtos.length} inscripciones`);

    // Resolver IDs y validar duplicados en el request
    const normalizedPayload = await this.resolveAndValidateBatchRequest(createEnrollmentDetailDtos);

    // Procesar inscripciones en transacción
    const results = await this.transactionService.executeWithRetry(
      async (manager: EntityManager) => this.processEnrollmentBatch(manager, normalizedPayload),
      3,
      10000,
    );

    this.logger.log(`Lote procesado: ${results.length}/${createEnrollmentDetailDtos.length} exitosas`);

    return {
      results,
      requested: createEnrollmentDetailDtos.length,
    };
  }

  /**
   * Resuelve IDs y valida que no haya duplicados en el request
   */
  private async resolveAndValidateBatchRequest(
    dtos: CreateEnrollmentDetailDto[],
  ): Promise<Array<{ dto: CreateEnrollmentDetailDto; resolved: { enrollment_id: string; course_section_id: string } }>> {
    const normalizedPayload: Array<{
      dto: CreateEnrollmentDetailDto;
      resolved: { enrollment_id: string; course_section_id: string };
    }> = [];
    const seenPairs = new Set<string>();

    for (const dto of dtos) {
      const resolved = await this.resolveIdsForEnrollmentDetail(dto);
      const pairKey = `${resolved.enrollment_id}:${resolved.course_section_id}`;

      if (seenPairs.has(pairKey)) {
        throw new DuplicateEnrollmentException(resolved.enrollment_id, resolved.course_section_id);
      }

      seenPairs.add(pairKey);
      normalizedPayload.push({ dto, resolved });
    }

    return normalizedPayload;
  }

  /**
   * Procesa el lote de inscripciones en una transacción
   */
  private async processEnrollmentBatch(
    manager: EntityManager,
    payload: Array<{ dto: CreateEnrollmentDetailDto; resolved: { enrollment_id: string; course_section_id: string } }>,
  ): Promise<EnrollmentResult[]> {
    const processed: EnrollmentResult[] = [];

    for (const { dto, resolved } of payload) {
      const enrollment = await this.validateEnrollmentExists(manager, resolved.enrollment_id);
      const courseSection = await this.getCourseSectionWithLock(manager, resolved.course_section_id);

      await this.validateNoDuplicateEnrollment(manager, resolved.enrollment_id, resolved.course_section_id);
      await this.performAcademicValidations(manager, enrollment, courseSection);
      this.validateQuotaAvailable(courseSection);

      const enrollmentDetail = await this.createEnrollmentDetail(manager, { ...dto, ...resolved });
      const updatedCourseSection = await this.decrementQuota(manager, courseSection);

      processed.push({
        enrollmentDetail,
        remainingQuota: updatedCourseSection.quota_available,
        wasCreated: true,
      });
    }

    return processed;
  }

  private async resolveIdsForEnrollmentDetail(dto: CreateEnrollmentDetailDto): Promise<{ enrollment_id: string; course_section_id: string }> {
    let { enrollment_id, course_section_id } = dto;

    const usingIds = !!enrollment_id && !!course_section_id;
    const canResolveEnrollment = !!dto.student_code && !!dto.term_name;
    const canResolveSection =
      !!dto.course_code &&
      !!dto.group_label &&
      !!dto.term_name &&
      (!!dto.degree_program_code || !!dto.study_plan_version); // at least one context

    if (!usingIds) {
      // Resolver enrollment por (student_code, term_name)
      if (!canResolveEnrollment) {
        throw new BadRequestException(
          'Provide enrollment_id or (student_code, term_name)'
        );
      }
      const student = await this.studentRepository.findOne({
        where: { code: dto.student_code! },
      });
      if (!student) {
        throw new NotFoundException(`Student with code '${dto.student_code}' not found`);
      }
      const term = await this.termRepository.findOne({
        where: { name: dto.term_name! },
      });
      if (!term) {
        throw new NotFoundException(`Term with name '${dto.term_name}' not found`);
      }

      const enrollment = await this.enrollmentRepository.findOne({
        where: { student_id: student.id, term_id: term.id },
      });
      if (!enrollment) {
        throw new NotFoundException(
          `Enrollment not found for student_code='${dto.student_code}' and term_name='${dto.term_name}'`
        );
      }
      enrollment_id = enrollment.id;
    }

    if (!course_section_id) {
      if (!canResolveSection) {
        throw new BadRequestException(
          'Provide course_section_id or (course_code, group_label, term_name, [degree_program_code|study_plan_version])'
        );
      }

      // Resolver Course por código (con contexto opcional para evitar ambigüedad)
      const qb = this.courseRepository
        .createQueryBuilder('c')
        .innerJoin('c.study_plan', 'sp')
        .innerJoin('sp.degree_program', 'dp')
        .where('c.code = :courseCode', { courseCode: dto.course_code! });

      if (dto.degree_program_code) {
        qb.andWhere('dp.code = :dpCode', { dpCode: dto.degree_program_code });
      }
      if (dto.study_plan_version) {
        qb.andWhere('sp.version = :version', { version: dto.study_plan_version });
      }

      const course = await qb.getOne();
      if (!course) {
        throw new NotFoundException(
          `Course not found for code='${dto.course_code}' with provided context`,
        );
      }

      const term = await this.termRepository.findOne({
        where: { name: dto.term_name! },
      });
      if (!term) {
        throw new NotFoundException(`Term with name '${dto.term_name}' not found`);
      }

      const courseSection = await this.courseSectionRepository.findOne({
        where: {
          course_id: course.id,
          term_id: term.id,
          group_label: dto.group_label!,
        } as any,
      });

      if (!courseSection) {
        throw new NotFoundException(
          `CourseSection not found for course_code='${dto.course_code}', group='${dto.group_label}', term='${dto.term_name}'`,
        );
      }

      course_section_id = courseSection.id;
    }

    return { enrollment_id: enrollment_id!, course_section_id: course_section_id! };
  }

  /**
   * Valida que la inscripción existe y está activa
   */
  private async validateEnrollmentExists(manager: EntityManager, enrollmentId: string): Promise<Enrollment> {
    const enrollment = await manager.findOne(Enrollment, {
      where: { id: enrollmentId },
      relations: ['student'],
    });

    if (!enrollment) {
      throw new NotFoundException(`Inscripción con ID ${enrollmentId} no encontrada`);
    }

    if (enrollment.state !== 'Active') {
      throw new EnrollmentNotActiveException(enrollmentId, enrollment.state);
    }

    return enrollment;
  }

  /**
   * Obtiene la sección con lock para evitar condiciones de carrera
   */
  private async getCourseSectionWithLock(manager: EntityManager, courseSectionId: string): Promise<CourseSection> {
    const courseSection = await manager.findOne(CourseSection, {
      where: { id: courseSectionId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!courseSection) {
      throw new NotFoundException(`Sección de curso con ID ${courseSectionId} no encontrada`);
    }

    return courseSection;
  }

  /**
   * Verifica que no existe inscripción duplicada
   */
  private async validateNoDuplicateEnrollment(
    manager: EntityManager,
    enrollmentId: string,
    courseSectionId: string,
  ): Promise<void> {
    const existingDetail = await manager.findOne(EnrollmentDetail, {
      where: { enrollment_id: enrollmentId, course_section_id: courseSectionId },
    });

    if (existingDetail) {
      throw new DuplicateEnrollmentException(enrollmentId, courseSectionId);
    }
  }

  /**
   * Verifica que hay cupos disponibles
   */
  private validateQuotaAvailable(courseSection: CourseSection): void {
    if (courseSection.quota_available <= 0) {
      throw new QuotaExceededException(courseSection.id, courseSection.quota_available);
    }
  }

  /**
   * Crea el detalle de inscripción
   */
  private async createEnrollmentDetail(
    manager: EntityManager,
    createEnrollmentDetailDto: CreateEnrollmentDetailDto,
  ): Promise<EnrollmentDetail> {
    const enrollmentDetail = manager.create(EnrollmentDetail, {
      ...createEnrollmentDetailDto,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return await manager.save(EnrollmentDetail, enrollmentDetail);
  }

  /**
   * Reduce el cupo disponible de forma atómica
   */
  private async decrementQuota(manager: EntityManager, courseSection: CourseSection): Promise<CourseSection> {
    const result = await manager
      .createQueryBuilder()
      .update(CourseSection)
      .set({ quota_available: () => 'quota_available - 1', updated_at: new Date() })
      .where('id = :id', { id: courseSection.id })
      .andWhere('quota_available > 0')
      .execute();

    if (result.affected === 0) {
      throw new QuotaExceededException(courseSection.id, 0);
    }

    const updated = await manager.findOne(CourseSection, { where: { id: courseSection.id } });
    return updated!;
  }

  /**
   * Obtiene el estado actual de cupos de una sección de curso
   */
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

  /**
   * Realiza validaciones académicas antes de la inscripción
   */
  private async performAcademicValidations(
    manager: EntityManager,
    enrollment: Enrollment,
    courseSection: CourseSection,
  ): Promise<void> {
    const validationResult = await this.academicValidationService.validateEnrollment(
      enrollment.student.id,
      courseSection.id,
      courseSection.term_id,
      manager,
    );

    if (!validationResult.isValid) {
      this.logger.warn(`Validaciones fallidas: ${validationResult.errors.join('; ')}`);
      throw new MultipleValidationException(validationResult.errors, validationResult.warnings);
    }

    if (validationResult.warnings.length > 0) {
      this.logger.warn(`Advertencias: ${validationResult.warnings.join('; ')}`);
    }
  }
}
