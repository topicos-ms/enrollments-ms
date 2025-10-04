import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Enrollment } from '../entities/enrollment.entity';
import { EnrollmentDetail } from '../entities/enrollment-detail.entity';
import {
  CreateEnrollmentDetailDto,
  ListEnrollmentDetailsDto,
  UpdateEnrollmentDetailDto,
} from '../dto';
import { PaginationService, PaginatedResultDto } from '../../common';
import { CourseSection } from '../entities/external/course-section.entity';
import { Student } from '../entities/external/student.entity';
import { Term } from '../entities/external/term.entity';
import { Course } from '../entities/external/course.entity';

@Injectable()
export class EnrollmentDetailService {
  constructor(
    @InjectRepository(EnrollmentDetail)
    private readonly enrollmentDetailRepository: Repository<EnrollmentDetail>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>,
    @InjectRepository(CourseSection)
    private readonly courseSectionRepository: Repository<CourseSection>,
    @InjectRepository(Student)
    private readonly studentRepository: Repository<Student>,
    @InjectRepository(Term)
    private readonly termRepository: Repository<Term>,
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    private readonly paginationService: PaginationService,
  ) {}

  async create(createEnrollmentDetailDto: CreateEnrollmentDetailDto) {
    const identifiers = await this.resolveIdentifiers(createEnrollmentDetailDto);

    await this.ensureNoDuplicate(
      identifiers.enrollment_id,
      identifiers.course_section_id,
    );

    const {
      student_code,
      term_name,
      course_code,
      group_label,
      degree_program_code,
      study_plan_version,
      ...persistableFields
    } = createEnrollmentDetailDto;

    const enrollmentDetail = this.enrollmentDetailRepository.create({
      ...persistableFields,
      enrollment_id: identifiers.enrollment_id,
      course_section_id: identifiers.course_section_id,
    });

    return this.enrollmentDetailRepository.save(enrollmentDetail);
  }

  async findAll(
    paginationDto: ListEnrollmentDetailsDto,
  ): Promise<PaginatedResultDto<EnrollmentDetail>> {
    const { enrollment_id, course_section_id, ...pagination } = paginationDto;

    const qb = this.enrollmentDetailRepository
      .createQueryBuilder('detail')
      .leftJoinAndSelect('detail.enrollment', 'enrollment')
      .leftJoinAndSelect('detail.course_section', 'course_section');

    if (enrollment_id) {
      qb.andWhere('detail.enrollment_id = :enrollment_id', { enrollment_id });
    }

    if (course_section_id) {
      qb.andWhere('detail.course_section_id = :course_section_id', {
        course_section_id,
      });
    }

    qb.orderBy('detail.created_at', 'DESC');

    return this.paginationService.paginate(qb, pagination);
  }

  async findOne(id: string): Promise<EnrollmentDetail> {
    const detail = await this.enrollmentDetailRepository.findOne({
      where: { id },
      relations: ['enrollment', 'course_section'],
    });

    if (!detail) {
      throw new NotFoundException(`Enrollment detail with ID ${id} not found`);
    }

    return detail;
  }

  async update(
    id: string,
    updateEnrollmentDetailDto: UpdateEnrollmentDetailDto,
  ): Promise<EnrollmentDetail> {
    const { id: _ignored, ...changes } = updateEnrollmentDetailDto;

    const detail = await this.enrollmentDetailRepository.preload({
      id,
      ...changes,
    });

    if (!detail) {
      throw new NotFoundException(`Enrollment detail with ID ${id} not found`);
    }

    return this.enrollmentDetailRepository.save(detail);
  }

  async remove(id: string): Promise<void> {
    const detail = await this.findOne(id);
    await this.enrollmentDetailRepository.remove(detail);
  }

  private async resolveIdentifiers(
    dto: CreateEnrollmentDetailDto,
  ): Promise<{ enrollment_id: string; course_section_id: string }> {
    const enrollment_id = await this.resolveEnrollmentId(dto);
    const course_section_id = await this.resolveCourseSectionId(dto);
    return { enrollment_id, course_section_id };
  }

  private async resolveEnrollmentId(
    dto: CreateEnrollmentDetailDto,
  ): Promise<string> {
    if (dto.enrollment_id) {
      return dto.enrollment_id;
    }

    if (!dto.student_code || !dto.term_name) {
      throw new BadRequestException(
        'Provide enrollment_id or (student_code, term_name)',
      );
    }

    const student = await this.studentRepository.findOne({
      where: { code: dto.student_code },
    });
    if (!student) {
      throw new NotFoundException(
        `Student with code '${dto.student_code}' not found`,
      );
    }

    const term = await this.termRepository.findOne({
      where: { name: dto.term_name },
    });
    if (!term) {
      throw new NotFoundException(
        `Term with name '${dto.term_name}' not found`,
      );
    }

    const enrollment = await this.enrollmentRepository.findOne({
      where: { student_id: student.id, term_id: term.id },
    });

    if (!enrollment) {
      throw new NotFoundException(
        `Enrollment not found for student_code='${dto.student_code}' and term_name='${dto.term_name}'`,
      );
    }

    return enrollment.id;
  }

  private async resolveCourseSectionId(
    dto: CreateEnrollmentDetailDto,
  ): Promise<string> {
    if (dto.course_section_id) {
      return dto.course_section_id;
    }

    const hasContext =
      !!dto.course_code &&
      !!dto.group_label &&
      !!dto.term_name &&
      (!!dto.degree_program_code || !!dto.study_plan_version);

    if (!hasContext) {
      throw new BadRequestException(
        'Provide course_section_id or (course_code, group_label, term_name, [degree_program_code|study_plan_version])',
      );
    }

    const term = await this.termRepository.findOne({
      where: { name: dto.term_name },
    });
    if (!term) {
      throw new NotFoundException(
        `Term with name '${dto.term_name}' not found`,
      );
    }

    const courseQuery = this.courseRepository
      .createQueryBuilder('course')
      .innerJoin('course.study_plan', 'studyPlan')
      .innerJoin('studyPlan.degree_program', 'degreeProgram')
      .where('course.code = :courseCode', { courseCode: dto.course_code });

    if (dto.degree_program_code) {
      courseQuery.andWhere('degreeProgram.code = :degreeProgramCode', {
        degreeProgramCode: dto.degree_program_code,
      });
    }

    if (dto.study_plan_version) {
      courseQuery.andWhere('studyPlan.version = :studyPlanVersion', {
        studyPlanVersion: dto.study_plan_version,
      });
    }

    const course = await courseQuery.getOne();

    if (!course) {
      throw new NotFoundException(
        `Course not found for code='${dto.course_code}' with provided context`,
      );
    }

    const courseSection = await this.courseSectionRepository.findOne({
      where: {
        course_id: course.id,
        term_id: term.id,
        group_label: dto.group_label!,
      },
    });

    if (!courseSection) {
      throw new NotFoundException(
        `Course section not found for course_code='${dto.course_code}', group='${dto.group_label}', term='${dto.term_name}'`,
      );
    }

    return courseSection.id;
  }

  private async ensureNoDuplicate(
    enrollment_id: string,
    course_section_id: string,
  ): Promise<void> {
    const existing = await this.enrollmentDetailRepository.findOne({
      where: { enrollment_id, course_section_id },
    });

    if (existing) {
      throw new BadRequestException(
        'Enrollment detail already exists for this student and course section',
      );
    }
  }
}
