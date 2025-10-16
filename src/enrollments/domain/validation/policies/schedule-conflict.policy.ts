import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { OptimizedQueryService } from '../../../infrastructure/persistence/optimized-query.service';
import {
  ValidationContext,
  ValidationReport,
} from '../validation-types';
import { ValidationPolicy } from './validation-policy';

@Injectable()
export class ScheduleConflictPolicy implements ValidationPolicy {
  constructor(
    private readonly optimizedQueryService: OptimizedQueryService,
  ) {}

  async evaluate(
    context: ValidationContext,
    manager?: EntityManager,
  ): Promise<ValidationReport> {
    const newSchedules =
      await this.optimizedQueryService.getSchedulesBySections(
        [context.courseSectionId],
        manager,
      );

    if (newSchedules.length === 0) {
      return { errors: [], warnings: [] };
    }

    const enrolledDetails =
      await this.optimizedQueryService.getStudentEnrollmentDetails(
        context.studentId,
        context.termId,
        manager,
      );

    console.log(`[ScheduleConflictPolicy] Student ${context.studentId} tiene ${enrolledDetails.length} materias inscritas`);

    if (enrolledDetails.length === 0) {
      return { errors: [], warnings: [] };
    }

    const enrolledSectionIds = enrolledDetails.map(
      (detail) => detail.courseSection.id,
    );
    
    // Filtrar la sección actual para no comparar consigo misma
    const otherEnrolledSectionIds = enrolledSectionIds.filter(
      (id) => id !== context.courseSectionId,
    );

    console.log(`[ScheduleConflictPolicy] Comparando contra ${otherEnrolledSectionIds.length} secciones (excluyendo la actual)`);

    if (otherEnrolledSectionIds.length === 0) {
      return { errors: [], warnings: [] };
    }

    const enrolledSchedules =
      await this.optimizedQueryService.getSchedulesBySections(
        otherEnrolledSectionIds,
        manager,
      );

    const conflicts: ValidationReport['errors'] = [];

    console.log(`[ScheduleConflictPolicy] newSchedules:`, newSchedules.map(s => `${s.weekday} ${s.time_start}-${s.time_end}`));
    console.log(`[ScheduleConflictPolicy] enrolledSchedules:`, enrolledSchedules.map(s => `${s.weekday} ${s.time_start}-${s.time_end}`));

    for (const newSchedule of newSchedules) {
      for (const existingSchedule of enrolledSchedules) {
        const sameDay =
          newSchedule.weekday === existingSchedule.weekday;
        
        console.log(`[ScheduleConflictPolicy] Comparando: ${newSchedule.weekday} ${newSchedule.time_start}-${newSchedule.time_end} vs ${existingSchedule.weekday} ${existingSchedule.time_start}-${existingSchedule.time_end}, sameDay: ${sameDay}`);
        
        if (
          sameDay &&
          this.hasTimeOverlap(
            newSchedule.time_start,
            newSchedule.time_end,
            existingSchedule.time_start,
            existingSchedule.time_end,
          )
        ) {
          console.log(`[ScheduleConflictPolicy] ¡CONFLICTO DETECTADO!`);
          conflicts.push({
            code: 'SCHEDULE_CONFLICT',
            message: `Conflicto de horario el ${newSchedule.weekday} de ${newSchedule.time_start} - ${newSchedule.time_end} con ${existingSchedule.courseSection.course.code} - Grupo ${existingSchedule.courseSection.group_label}`,
            details: {
              conflictingSectionId:
                existingSchedule.courseSection.id ??
                existingSchedule.course_section_id,
              conflictingCourse:
                existingSchedule.courseSection.course.code,
              conflictingGroup:
                existingSchedule.courseSection.group_label,
            },
          });
        }
      }
    }

    return {
      errors: conflicts,
      warnings: [],
    };
  }

  private hasTimeOverlap(
    startA: string,
    endA: string,
    startB: string,
    endB: string,
  ): boolean {
    const [startMinutesA, endMinutesA] = [
      this.timeToMinutes(startA),
      this.timeToMinutes(endA),
    ];
    const [startMinutesB, endMinutesB] = [
      this.timeToMinutes(startB),
      this.timeToMinutes(endB),
    ];

    return startMinutesA < endMinutesB && startMinutesB < endMinutesA;
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }
}
