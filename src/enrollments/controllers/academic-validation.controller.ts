import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AcademicValidationService } from '../services/academic-validation.service';

interface PrerequisiteCheckPayload {
  studentId: string;
  courseId: string;
}

interface EnrollmentValidationPayload {
  studentId: string;
  courseSectionId: string;
  termId: string;
}

@Controller()
export class AcademicValidationController {
  constructor(
    private readonly academicValidationService: AcademicValidationService,
  ) {}

  @MessagePattern('enrollments.academic.checkPrerequisites')
  async checkPrerequisites(@Payload() payload: PrerequisiteCheckPayload) {
    return await this.academicValidationService.checkPrerequisitesCompliance(
      payload.studentId,
      payload.courseId,
    );
  }

  @MessagePattern('enrollments.academic.validateEnrollment')
  async validateEnrollmentEligibility(
    @Payload() payload: EnrollmentValidationPayload,
  ) {
    return await this.academicValidationService.validateEnrollment(
      payload.studentId,
      payload.courseSectionId,
      payload.termId,
    );
  }
}
