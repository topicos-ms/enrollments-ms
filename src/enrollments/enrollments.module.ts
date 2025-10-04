import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Enrollment } from './entities/enrollment.entity';
import { EnrollmentDetail } from './entities/enrollment-detail.entity';
import { Student } from './entities/external/student.entity';
import { Term } from './entities/external/term.entity';
import { Course } from './entities/external/course.entity';
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
  OptimizedQueryService,
} from './services';
import {
  EnrollmentDetailsController,
  EnrollmentsController,
  AcademicValidationController,
  AtomicEnrollmentController,
  DatabasePerformanceController,
} from './controllers';
import { IdempotencyService, PaginationService, TransactionService } from '../common';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Enrollment,
      EnrollmentDetail,
      Student,
      Term,
      Course,
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
  ],
  providers: [
    EnrollmentsService,
    EnrollmentDetailService,
    AcademicValidationService,
    AtomicEnrollmentService,
    OptimizedQueryService,
    PaginationService,
    TransactionService,
    IdempotencyService,
  ],
})
export class EnrollmentsModule {}
