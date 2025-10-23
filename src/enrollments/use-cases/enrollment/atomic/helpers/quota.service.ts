import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CourseSection } from '../../../../entities/external/course-section.entity';
import { QuotaExceededError } from '../../../../domain/errors';

@Injectable()
export class CourseSectionQuotaService {
  async getWithLockOrThrow(
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

  ensureAvailableOrThrow(courseSection: CourseSection): void {
    if (courseSection.quota_available <= 0 || courseSection.quota_available == null) {
      throw new QuotaExceededError(
        courseSection.id,
        courseSection.quota_available,
      );
    }
  }

  async decrementAndReturn(
    manager: EntityManager,
    courseSectionId: string,
  ): Promise<number> {
    const updateQuery = manager
      .createQueryBuilder()
      .update(CourseSection)
      .set({
        quota_available: () => 'quota_available - 1',
        updated_at: () => 'now()' as any,
      })
      .where('id = :id', { id: courseSectionId })
      .andWhere('quota_available > 0');

    // RETURNING solo para Postgres
    (updateQuery as any).returning(['quota_available']);
    const result = await updateQuery.execute();

    if (!result.affected) {
      throw new QuotaExceededError(courseSectionId, 0);
    }

    const updatedRow = (result as any).raw?.[0];
    return updatedRow?.quota_available ?? 0;
  }
}

