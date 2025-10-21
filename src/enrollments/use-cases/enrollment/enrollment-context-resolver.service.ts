import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { CreateEnrollmentDetailDto } from '../../dto';
import { Enrollment } from '../../entities/enrollment.entity';
import { EnrollmentDetail } from '../../entities/enrollment-detail.entity';
import { CourseSection } from '../../entities/external/course-section.entity';
import { Course } from '../../entities/external/course.entity';
import { Student } from '../../entities/external/student.entity';
import { Term } from '../../entities/external/term.entity';

export interface EnrollmentDetailIdentifiers {
  enrollmentId: string;
  courseSectionId: string;
}

@Injectable()
export class EnrollmentContextResolver {
  constructor(
    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>,
    @InjectRepository(EnrollmentDetail)
    private readonly enrollmentDetailRepository: Repository<EnrollmentDetail>,
    @InjectRepository(CourseSection)
    private readonly courseSectionRepository: Repository<CourseSection>,
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(Student)
    private readonly studentRepository: Repository<Student>,
    @InjectRepository(Term)
    private readonly termRepository: Repository<Term>,
  ) {}

  async resolveIdentifiers(
    dto: CreateEnrollmentDetailDto,
    manager?: EntityManager,
  ): Promise<EnrollmentDetailIdentifiers> {
    const enrollmentId = await this.resolveEnrollmentId(dto, manager);
    const courseSectionId = await this.resolveCourseSectionId(dto, manager);

    return { enrollmentId, courseSectionId };
  }

  async ensureNoDuplicate(
    enrollmentId: string,
    courseSectionId: string,
    manager?: EntityManager,
  ): Promise<void> {
    const repository =
      manager?.getRepository(EnrollmentDetail) ??
      this.enrollmentDetailRepository;
    const existing = await repository.findOne({
      where: { enrollment_id: enrollmentId, course_section_id: courseSectionId },
    });

    if (existing) {
      throw new BadRequestException(
        'Enrollment detail already exists for this student and course section',
      );
    }
  }

  private async resolveEnrollmentId(
    dto: CreateEnrollmentDetailDto,
    manager?: EntityManager,
  ): Promise<string> {
    if (dto.enrollment_id) {
      return dto.enrollment_id;
    }

    if (!dto.student_code || !dto.term_name) {
      throw new BadRequestException(
        'Provide enrollment_id or (student_code, term_name)',
      );
    }

    const studentRepository =
      manager?.getRepository(Student) ?? this.studentRepository;
    const student = await studentRepository.findOne({
      where: { code: dto.student_code },
    });

    if (!student) {
      throw new NotFoundException(
        `Student with code '${dto.student_code}' not found`,
      );
    }

    const termRepository = manager?.getRepository(Term) ?? this.termRepository;
    const term = await termRepository.findOne({
      where: { name: dto.term_name },
    });

    if (!term) {
      throw new NotFoundException(
        `Term with name '${dto.term_name}' not found`,
      );
    }

    const enrollmentRepository =
      manager?.getRepository(Enrollment) ?? this.enrollmentRepository;
    const enrollment = await enrollmentRepository.findOne({
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
    manager?: EntityManager,
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

    const course = await this.findCourseByContext(dto, manager);

    const termRepository = manager?.getRepository(Term) ?? this.termRepository;
    const term = await termRepository.findOne({
      where: { name: dto.term_name },
    });

    if (!term) {
      throw new NotFoundException(
        `Term with name '${dto.term_name}' not found`,
      );
    }

    const courseSectionRepository =
      manager?.getRepository(CourseSection) ?? this.courseSectionRepository;
    const courseSection = await courseSectionRepository.findOne({
      where: {
        course_id: course.id,
        term_id: term.id,
        group_label: dto.group_label!,
      } as any,
    });

    if (!courseSection) {
      throw new NotFoundException(
        `Course section not found for course_code='${dto.course_code}', group='${dto.group_label}', term='${dto.term_name}'`,
      );
    }

    return courseSection.id;
  }

  private async findCourseByContext(
    dto: CreateEnrollmentDetailDto,
    manager?: EntityManager,
  ): Promise<Course> {
    const courseRepository =
      manager?.getRepository(Course) ?? this.courseRepository;
    const qb = courseRepository
      .createQueryBuilder('course')
      .innerJoin('course.study_plan', 'studyPlan')
      .innerJoin('studyPlan.degree_program', 'degreeProgram')
      .where('course.code = :courseCode', { courseCode: dto.course_code! });

    if (dto.degree_program_code) {
      qb.andWhere('degreeProgram.code = :degreeProgramCode', {
        degreeProgramCode: dto.degree_program_code,
      });
    }

    if (dto.study_plan_version) {
      qb.andWhere('studyPlan.version = :studyPlanVersion', {
        studyPlanVersion: dto.study_plan_version,
      });
    }

    const course = await qb.getOne();

    if (!course) {
      throw new NotFoundException(
        `Course not found for code='${dto.course_code}' with provided context`,
      );
    }

    return course;
  }

}
