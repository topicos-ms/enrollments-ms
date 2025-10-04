import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { OptimizedQueryService } from '../services/optimized-query.service';

interface CourseIdPayload { courseId: string; }
interface StudentCoursesPayload { studentId: string; courseIds: string[] | string; }
interface SectionIdsPayload { courseSectionIds: string[] | string; }
interface StudentTermPayload { studentId: string; termId: string; }

@Controller()
export class DatabasePerformanceController {
  constructor(private readonly optimizedQueryService: OptimizedQueryService) {}

  @MessagePattern('enrollments.performance.prerequisites')
  async getPrerequisitesPerformance(@Payload() payload: CourseIdPayload) {
    const startTime = Date.now();

    const prerequisites =
      await this.optimizedQueryService.getPrerequisitesByCourse(payload.courseId);

    const executionTime = Date.now() - startTime;

    return {
      courseId: payload.courseId,
      prerequisites: prerequisites.map((p) => ({
        id: p.id,
        kind: p.kind,
        requiredCourse: {
          id: p.required_course.id,
          code: p.required_course.code,
          name: p.required_course.name,
        },
      })),
      performance: {
        executionTimeMs: executionTime,
        resultCount: prerequisites.length,
        indexUsed: 'IDX_prerequisite_main_course',
      },
    };
  }

  @MessagePattern('enrollments.performance.approvedCourses')
  async getApprovedCoursesPerformance(@Payload() payload: StudentCoursesPayload) {
    const startTime = Date.now();

    const courseIdArray = Array.isArray(payload.courseIds)
      ? payload.courseIds
      : payload.courseIds.split(',');

    const approvedCourses =
      await this.optimizedQueryService.getApprovedCoursesByStudent(
        payload.studentId,
        courseIdArray,
      );

    const executionTime = Date.now() - startTime;

    return {
      studentId: payload.studentId,
      courseIds: courseIdArray,
      approvedCourses: approvedCourses.map((grade) => ({
        gradeId: grade.id,
        finalGrade: grade.final_grade,
        courseSection: {
          id: grade.course_section.id,
          course: {
            id: grade.course_section.course.id,
            code: grade.course_section.course.code,
          },
        },
      })),
      performance: {
        executionTimeMs: executionTime,
        resultCount: approvedCourses.length,
        indexUsed: 'IDX_grade_approved_courses',
      },
    };
  }

  @MessagePattern('enrollments.performance.schedules')
  async getSchedulesPerformance(@Payload() payload: SectionIdsPayload) {
    const startTime = Date.now();

    const sectionIdArray = Array.isArray(payload.courseSectionIds)
      ? payload.courseSectionIds
      : payload.courseSectionIds.split(',');

    const schedules =
      await this.optimizedQueryService.getSchedulesBySections(sectionIdArray);

    const executionTime = Date.now() - startTime;

    return {
      courseSectionIds: sectionIdArray,
      schedules: schedules.map((schedule) => ({
        id: schedule.id,
        courseSectionId: schedule.course_section_id,
        weekday: schedule.weekday,
        timeStart: schedule.time_start,
        timeEnd: schedule.time_end,
        courseSection: {
          groupLabel: schedule.course_section.group_label,
          course: {
            code: schedule.course_section.course.code,
            name: schedule.course_section.course.name,
          },
        },
      })),
      performance: {
        executionTimeMs: executionTime,
        resultCount: schedules.length,
        indexUsed: 'IDX_schedule_course_section',
      },
    };
  }

  @MessagePattern('enrollments.performance.enrollmentCount')
  async getEnrollmentCountPerformance(@Payload() payload: StudentTermPayload) {
    const startTime = Date.now();

    const enrolledCount = await this.optimizedQueryService.getEnrolledCoursesCount(
      payload.studentId,
      payload.termId,
    );

    const executionTime = Date.now() - startTime;

    return {
      studentId: payload.studentId,
      termId: payload.termId,
      enrolledCount,
      performance: {
        executionTimeMs: executionTime,
        indexUsed: 'IDX_enrollment_detail_student_term',
      },
    };
  }

  @MessagePattern('enrollments.performance.batchPrerequisites')
  async getBatchPrerequisitesPerformance(@Payload() payload: StudentCoursesPayload) {
    const startTime = Date.now();

    const courseIdArray = Array.isArray(payload.courseIds)
      ? payload.courseIds
      : payload.courseIds.split(',');

    const prerequisiteChecks =
      await this.optimizedQueryService.batchCheckPrerequisites(
        payload.studentId,
        courseIdArray,
      );

    const executionTime = Date.now() - startTime;

    return {
      studentId: payload.studentId,
      courseIds: courseIdArray,
      prerequisiteChecks,
      performance: {
        executionTimeMs: executionTime,
        resultCount: prerequisiteChecks.length,
        indexesUsed: [
          'IDX_prerequisite_main_course',
          'IDX_grade_approved_courses',
        ],
      },
    };
  }

  @MessagePattern('enrollments.performance.hasPassed')
  async getHasPassedPerformance(@Payload() payload: CourseIdPayload & { studentId: string }) {
    const startTime = Date.now();

    const hasPassed = await this.optimizedQueryService.hasStudentPassedCourse(
      payload.studentId,
      payload.courseId,
    );

    const executionTime = Date.now() - startTime;

    return {
      studentId: payload.studentId,
      courseId: payload.courseId,
      hasPassed,
      performance: {
        executionTimeMs: executionTime,
        indexUsed: 'IDX_grade_approved_courses',
      },
    };
  }

  @MessagePattern('enrollments.performance.studentEnrollmentDetails')
  async getStudentEnrollmentDetailsPerformance(
    @Payload() payload: StudentTermPayload,
  ) {
    const startTime = Date.now();

    const enrollmentDetails =
      await this.optimizedQueryService.getStudentEnrollmentDetails(
        payload.studentId,
        payload.termId,
      );

    const executionTime = Date.now() - startTime;

    return {
      studentId: payload.studentId,
      termId: payload.termId,
      enrollmentDetails: enrollmentDetails.map((detail) => ({
        id: detail.id,
        courseState: detail.course_state,
        courseSection: {
          id: detail.course_section.id,
          groupLabel: detail.course_section.group_label,
          course: {
            id: detail.course_section.course.id,
            code: detail.course_section.course.code,
            name: detail.course_section.course.name,
            credits: detail.course_section.course.credits,
          },
        },
      })),
      performance: {
        executionTimeMs: executionTime,
        resultCount: enrollmentDetails.length,
        indexUsed: 'IDX_enrollment_detail_student_term',
      },
    };
  }
}
