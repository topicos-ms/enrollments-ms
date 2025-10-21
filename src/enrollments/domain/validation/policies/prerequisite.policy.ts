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
export class PrerequisitePolicy implements ValidationPolicy {
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

    const prerequisites =
      await this.optimizedQueryService.getPrerequisitesByCourse(
        courseSection.course.id,
      );

    if (prerequisites.length === 0) {
      return { errors: [], warnings: [] };
    }

    const prerequisiteChecks =
      await this.optimizedQueryService.batchCheckPrerequisites(
        context.studentId,
        [courseSection.course.id],
      );

    const courseCheck = prerequisiteChecks[0];

    if (courseCheck.hasPrerequisites) {
      return { errors: [], warnings: [] };
    }

    return {
      errors: courseCheck.missingPrerequisites.map((code) => ({
        code: 'PREREQUISITE_NOT_MET',
        message: `Prerrequisito no cumplido: ${code}`,
        details: { missingPrerequisite: code },
      })),
      warnings: [],
    };
  }
}
