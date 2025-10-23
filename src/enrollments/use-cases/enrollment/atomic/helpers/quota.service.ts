import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CourseSection } from '../../../../entities/external/course-section.entity';
import { QuotaExceededError } from '../../../../domain/errors';

@Injectable()
export class CourseSectionQuotaService {
  // Obtiene la sección del curso con un bloqueo pesimista; usado por EnrollmentProcessorService para reservar la fila antes de inscribir.
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

  // Verifica que aún exista cupo disponible; EnrollmentProcessorService lo invoca tras obtener la sección.
  ensureAvailableOrThrow(courseSection: CourseSection): void {
    if (courseSection.quota_available <= 0 || courseSection.quota_available == null) {
      throw new QuotaExceededError(
        courseSection.id,
        courseSection.quota_available,
      );
    }
  }

  // Descuenta una unidad del cupo y devuelve cuánto queda; EnrollmentProcessorService lo usa después de crear el detalle de inscripción.
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
