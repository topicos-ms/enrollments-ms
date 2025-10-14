import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../entities/external/student.entity';
import { StudyPlan } from '../entities/external/study-plan.entity';
import { Course } from '../entities/external/course.entity';
import { OptimizedQueryService } from './optimized-query.service';

export interface RecommendedCourseDto {
  courseId: string;
  code: string;
  name: string;
  credits: number;
  levelId: string | null;
  levelName: string | null;
  levelOrder: number | null;
  prerequisites: Array<{
    courseId: string;
    code: string | null;
    name: string | null;
  }>;
}

export interface RecommendedCoursesResponse {
  student: {
    id: string;
    code: string;
    studyPlanId: string;
  };
  studyPlan: {
    id: string;
    version: string;
    degreeProgramId: string;
  };
  targetLevel: {
    id: string | null;
    name: string | null;
    order: number | null;
  };
  courses: RecommendedCourseDto[];
}

@Injectable()
export class CourseRecommendationService {
  constructor(
    @InjectRepository(Student)
    private readonly studentRepository: Repository<Student>,
    @InjectRepository(StudyPlan)
    private readonly studyPlanRepository: Repository<StudyPlan>,
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    private readonly optimizedQueryService: OptimizedQueryService,
  ) {}

  async getRecommendedCoursesForStudent(params: {
    studentId?: string;
    studentCode?: string;
  }): Promise<RecommendedCoursesResponse> {
    if (!params.studentId && !params.studentCode) {
      throw new BadRequestException(
        'Provide studentId or studentCode to identify the student',
      );
    }

    const student = await this.studentRepository.findOne({
      where: params.studentId
        ? { id: params.studentId }
        : { code: params.studentCode! },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    if (!student.study_plan_id) {
      throw new BadRequestException(
        `Student ${student.code} does not have an assigned study plan`,
      );
    }

    const studyPlan = await this.studyPlanRepository.findOne({
      where: { id: student.study_plan_id },
    });

    if (!studyPlan) {
      throw new NotFoundException(
        `Study plan with id '${student.study_plan_id}' not found`,
      );
    }

    const courses = await this.courseRepository
      .createQueryBuilder('course')
      .leftJoinAndSelect('course.level', 'level')
      .leftJoinAndSelect('course.prerequisites_as_main', 'prerequisite')
      .leftJoinAndSelect('prerequisite.required_course', 'requiredCourse')
      .where('course.study_plan_id = :studyPlanId', {
        studyPlanId: student.study_plan_id,
      })
      .orderBy('level.order', 'ASC')
      .addOrderBy('course.code', 'ASC')
      .getMany();

    if (courses.length === 0) {
      return {
        student: {
          id: student.id,
          code: student.code,
          studyPlanId: student.study_plan_id,
        },
        studyPlan: {
          id: studyPlan.id,
          version: studyPlan.version,
          degreeProgramId: studyPlan.degree_program_id,
        },
        targetLevel: {
          id: null,
          name: null,
          order: null,
        },
        courses: [],
      };
    }

    const courseIds = courses.map((course) => course.id);
    const approvedCourses = await this.optimizedQueryService.getApprovedCoursesByStudent(
      student.id,
      courseIds,
    );
    const approvedCourseIds = new Set(
      approvedCourses
        .map((grade) => grade.courseSection?.course?.id)
        .filter((courseId): courseId is string => Boolean(courseId)),
    );

    const levelOrders = Array.from(
      new Set(
        courses
          .map((course) => course.level?.order ?? Number.MAX_SAFE_INTEGER)
          .filter((order) => order !== null && order !== undefined),
      ),
    ).sort((a, b) => a - b);

    for (const order of levelOrders) {
      const levelCourses = courses.filter(
        (course) => (course.level?.order ?? Number.MAX_SAFE_INTEGER) === order,
      );

      const pendingCourses = levelCourses.filter(
        (course) => !approvedCourseIds.has(course.id),
      );

      if (pendingCourses.length === 0) {
        continue;
      }

      const availableCourses = pendingCourses.filter((course) => {
        const prerequisites = course.prerequisites_as_main ?? [];
        return prerequisites.every((prerequisite) =>
          approvedCourseIds.has(prerequisite.required_course_id),
        );
      });

      if (availableCourses.length === 0) {
        continue;
      }

      const targetLevel = availableCourses[0].level ?? null;

      return {
        student: {
          id: student.id,
          code: student.code,
          studyPlanId: student.study_plan_id,
        },
        studyPlan: {
          id: studyPlan.id,
          version: studyPlan.version,
          degreeProgramId: studyPlan.degree_program_id,
        },
        targetLevel: {
          id: targetLevel?.id ?? null,
          name: targetLevel?.name ?? null,
          order: targetLevel?.order ?? null,
        },
        courses: availableCourses.map((course) => ({
          courseId: course.id,
          code: course.code,
          name: course.name,
          credits: course.credits,
          levelId: course.level?.id ?? null,
          levelName: course.level?.name ?? null,
          levelOrder: course.level?.order ?? null,
          prerequisites: (course.prerequisites_as_main ?? []).map((prerequisite) => ({
            courseId: prerequisite.required_course_id,
            code: prerequisite.required_course?.code ?? null,
            name: prerequisite.required_course?.name ?? null,
          })),
        })),
      };
    }

    // If student has approved every course or none are currently available
    return {
      student: {
        id: student.id,
        code: student.code,
        studyPlanId: student.study_plan_id,
      },
      studyPlan: {
        id: studyPlan.id,
        version: studyPlan.version,
        degreeProgramId: studyPlan.degree_program_id,
      },
      targetLevel: {
        id: null,
        name: null,
        order: null,
      },
      courses: [],
    };
  }
}
