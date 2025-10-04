import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { EnrollmentDetail } from '../enrollments/entities/enrollment-detail.entity';
import { Student } from '../enrollments/entities/external/student.entity';
import { Term } from '../enrollments/entities/external/term.entity';
import { Course } from '../enrollments/entities/external/course.entity';
import { StudyPlan } from '../enrollments/entities/external/study-plan.entity';
import { DegreeProgram } from '../enrollments/entities/external/degree-program.entity';
import { CourseSection } from '../enrollments/entities/external/course-section.entity';
import { Schedule } from '../enrollments/entities/external/schedule.entity';
import { Prerequisite } from '../enrollments/entities/external/prerequisite.entity';
import { Grade } from '../enrollments/entities/external/grade.entity';

export const typeOrmConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get<string>('DB_HOST', 'localhost'),
  port: parseInt(configService.get<string>('DB_PORT', '5432'), 10),
  username: configService.get<string>('DB_USER', 'postgres'),
  password: configService.get<string>('DB_PASSWORD'),
  database: configService.get<string>('DB_NAME', 'topicos_db'),
  entities: [
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
  ],
  synchronize: true,
  logging:
    configService.get<string>('NODE_ENV') === 'development' ? ['error', 'warn'] : false,
});
