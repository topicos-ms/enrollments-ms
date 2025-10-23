import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Enrollment } from './entities/enrollment.entity';
import { EnrollmentDetail } from './entities/enrollment-detail.entity';
import { User } from './entities/external/user.entity';
import { Student } from './entities/external/student.entity';
import { Teacher } from './entities/external/teacher.entity';
import { AcademicYear } from './entities/external/academic-year.entity';
import { Term } from './entities/external/term.entity';
import { Course } from './entities/external/course.entity';
import { Level } from './entities/external/level.entity';
import { StudyPlan } from './entities/external/study-plan.entity';
import { DegreeProgram } from './entities/external/degree-program.entity';
import { CourseSection } from './entities/external/course-section.entity';
import { Schedule } from './entities/external/schedule.entity';
import { Prerequisite } from './entities/external/prerequisite.entity';
import { Grade } from './entities/external/grade.entity';
import {
  EnrollmentDetailService,
  EnrollmentsService,
  AcademicValidationService,
  AtomicEnrollmentService,
  CourseRecommendationService,
  EnrollmentContextResolver,
} from './use-cases';
import { IdentifiersResolver } from './use-cases/enrollment/atomic/helpers/identifiers-resolver.service';
import { CourseSectionQuotaService } from './use-cases/enrollment/atomic/helpers/quota.service';
import { EnrollmentProcessorService } from './use-cases/enrollment/atomic/helpers/enrollment-processor.service';
import { OptimizedQueryService } from './infrastructure/persistence/optimized-query.service';
import {
  EnrollmentDetailsController,
  EnrollmentsController,
  AcademicValidationController,
  AtomicEnrollmentController,
  DatabasePerformanceController,
  StudentAdvisoryController,
} from './presentation/messaging';
import {
  AcademicLimitsPolicy,
  CourseNotPassedPolicy,
  PrerequisitePolicy,
  ScheduleConflictPolicy,
} from './domain/validation/policies';
import { EnrollmentErrorHandler } from './presentation/errors/enrollment-error-handler.service';
import { IdempotencyService, PaginationService, TransactionService } from '../common';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Enrollment,
      EnrollmentDetail,
      User,
      Student,
      Teacher,
      Term,
      AcademicYear,
      Course,
      Level,
      StudyPlan,
      DegreeProgram,
      CourseSection,
      Schedule,
      Prerequisite,
      Grade,
    ]),
  ],
  controllers: [
    EnrollmentsController,
    EnrollmentDetailsController,
    AcademicValidationController,
    AtomicEnrollmentController,
    DatabasePerformanceController,
    StudentAdvisoryController,
  ],
  providers: [
    EnrollmentsService,
    EnrollmentDetailService,
    AcademicValidationService,
    AtomicEnrollmentService,
    CourseRecommendationService,
    EnrollmentContextResolver,
    IdentifiersResolver,
    CourseSectionQuotaService,
    EnrollmentProcessorService,
    OptimizedQueryService,
    PrerequisitePolicy,
    ScheduleConflictPolicy,
    AcademicLimitsPolicy,
    CourseNotPassedPolicy,
    EnrollmentErrorHandler,
    PaginationService,
    TransactionService,
    IdempotencyService,
  ],
})
export class EnrollmentsModule {}

