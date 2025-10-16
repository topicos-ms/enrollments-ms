import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Prerequisite } from '../../entities/external/prerequisite.entity';
import { Schedule } from '../../entities/external/schedule.entity';
import { ValidationAggregate } from '../../domain/validation/validation-types';
import {
  AcademicLimitsPolicy,
  CourseNotPassedPolicy,
  PrerequisitePolicy,
  ScheduleConflictPolicy,
} from '../../domain/validation/policies';
import { ValidationReport } from '../../domain/validation/validation-types';
import { OptimizedQueryService } from '../../infrastructure/persistence/optimized-query.service';

export interface ValidationResult extends ValidationAggregate { }

export interface ScheduleConflict {
  existingCourseSection: string;
  conflictingTime: string;
  day: string;
}

@Injectable()
export class AcademicValidationService {
  constructor(
    private readonly prerequisitePolicy: PrerequisitePolicy,
    private readonly scheduleConflictPolicy: ScheduleConflictPolicy,
    private readonly academicLimitsPolicy: AcademicLimitsPolicy,
    private readonly courseNotPassedPolicy: CourseNotPassedPolicy,
    private readonly optimizedQueryService: OptimizedQueryService,
  ) { }

  async validateEnrollment(
    studentId: string,
    courseSectionId: string,
    termId: string,
    manager?: EntityManager,
  ): Promise<ValidationResult> {
    const context = { studentId, courseSectionId, termId };
    const reports = await Promise.all([
      this.prerequisitePolicy.evaluate(context, manager),
      this.scheduleConflictPolicy.evaluate(context, manager),
      this.academicLimitsPolicy.evaluate(context, manager),
      this.courseNotPassedPolicy.evaluate(context, manager),
    ]);

    return this.aggregateReports(reports);
  }

  async validatePrerequisites(
    studentId: string,
    courseSectionId: string,
    termId: string,
    manager?: EntityManager,
  ): Promise<ValidationResult> {
    const context = { studentId, courseSectionId, termId };
    return this.aggregateReports([
      await this.prerequisitePolicy.evaluate(context, manager),
    ]);
  }

  async validateScheduleConflicts(
    studentId: string,
    courseSectionId: string,
    termId: string,
    manager?: EntityManager,
  ): Promise<ValidationResult> {
    const context = { studentId, courseSectionId, termId };
    return this.aggregateReports([
      await this.scheduleConflictPolicy.evaluate(context, manager),
    ]);
  }

  async validateAcademicLimits(
    studentId: string,
    termId: string,
    manager?: EntityManager,
  ): Promise<ValidationResult> {
    const context = { studentId, courseSectionId: '', termId };
    return this.aggregateReports([
      await this.academicLimitsPolicy.evaluate(context, manager),
    ]);
  }

  async validateCourseNotPassed(
    studentId: string,
    courseSectionId: string,
    termId: string,
    manager?: EntityManager,
  ): Promise<ValidationResult> {
    const context = { studentId, courseSectionId, termId };
    return this.aggregateReports([
      await this.courseNotPassedPolicy.evaluate(context, manager),
    ]);
  }

  async getPrerequisitesForCourse(courseId: string): Promise<Prerequisite[]> {
    return this.optimizedQueryService.getPrerequisitesByCourse(courseId);
  }

  async checkPrerequisitesCompliance(
    studentId: string,
    courseId: string,
  ): Promise<{
    courseId: string;
    hasPrerequisites: boolean;
    missingPrerequisites: string[];
  }> {
    const prerequisiteChecks =
      await this.optimizedQueryService.batchCheckPrerequisites(studentId, [
        courseId,
      ]);

    return prerequisiteChecks[0];
  }

  async getScheduleConflictsForStudent(
    studentId: string,
    termId: string,
    proposedSchedules: {
      weekday: string;
      timeStart: string;
      timeEnd: string;
    }[],
  ): Promise<ScheduleConflict[]> {
    const enrolledDetails =
      await this.optimizedQueryService.getStudentEnrollmentDetails(
        studentId,
        termId,
      );

    if (enrolledDetails.length === 0) {
      return [];
    }

    const enrolledSectionIds = enrolledDetails.map(
      (detail) => detail.courseSection.id,
    );
    const enrolledSchedules =
      await this.optimizedQueryService.getSchedulesBySections(
        enrolledSectionIds,
      );

    const conflicts: ScheduleConflict[] = [];

    for (const proposedSchedule of proposedSchedules) {
      for (const existingSchedule of enrolledSchedules) {
        if (
          proposedSchedule.weekday === existingSchedule.weekday &&
          this.hasTimeOverlap(
            proposedSchedule.timeStart,
            proposedSchedule.timeEnd,
            existingSchedule.time_start,
            existingSchedule.time_end,
          )
        ) {
          conflicts.push({
            existingCourseSection: `${existingSchedule.courseSection.course.code} - Grupo ${existingSchedule.courseSection.group_label}`,
            conflictingTime: `${proposedSchedule.timeStart} - ${proposedSchedule.timeEnd}`,
            day: proposedSchedule.weekday,
          });
        }
      }
    }

    return conflicts;
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

  private aggregateReports(reports: ValidationReport[]): ValidationResult {
    const errors = reports.flatMap((report) =>
      report.errors.map((issue) => issue.message),
    );
    const warnings = reports.flatMap((report) =>
      report.warnings.map((issue) => issue.message),
    );

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
