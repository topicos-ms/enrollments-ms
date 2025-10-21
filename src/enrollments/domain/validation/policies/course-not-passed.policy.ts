import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { CourseSection } from '../../../entities/external/course-section.entity';
import { OptimizedQueryService } from '../../../infrastructure/persistence/optimized-query.service';
import {
  ValidationContext,
  ValidationReport,
} from '../validation-types';
import { ValidationPolicy } from './validation-policy';

@Injectable()
export class CourseNotPassedPolicy implements ValidationPolicy {
  constructor(
    @InjectRepository(CourseSection)
    private readonly courseSectionRepository: Repository<CourseSection>,
    private readonly optimizedQueryService: OptimizedQueryService,
  ) {}

  async evaluate(
    context: ValidationContext,
    manager?: EntityManager,
  ): Promise<ValidationReport> {
    const repository = manager
      ? manager.getRepository(CourseSection)
      : this.courseSectionRepository;

    const courseSection = await repository.findOne({
      where: { id: context.courseSectionId },
      relations: ['course'],
    });

    if (!courseSection?.course?.id) {
      return {
        errors: [
          {
            code: 'COURSE_SECTION_NOT_FOUND',
            message: 'Sección de curso no encontrada',
          },
        ],
        warnings: [],
      };
    }

    const hasPassed = await this.optimizedQueryService.hasStudentPassedCourse(
      context.studentId,
      courseSection.course.id,
    );

    if (!hasPassed) {
      return { errors: [], warnings: [] };
    }

    return {
      errors: [
        {
          code: 'COURSE_ALREADY_PASSED',
          message: `Ya aprobó la materia: ${courseSection.course.code} - ${courseSection.course.name}`,
          details: {
            courseId: courseSection.course.id,
            courseCode: courseSection.course.code,
          },
        },
      ],
      warnings: [],
    };
  }
}
