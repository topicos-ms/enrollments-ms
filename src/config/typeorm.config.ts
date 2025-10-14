import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { EnrollmentDetail } from '../enrollments/entities/enrollment-detail.entity';
import { User } from '../enrollments/entities/external/user.entity';
import { Student } from '../enrollments/entities/external/student.entity';
import { Teacher } from '../enrollments/entities/external/teacher.entity';
import { AcademicYear } from '../enrollments/entities/external/academic-year.entity';
import { Term } from '../enrollments/entities/external/term.entity';
import { Course } from '../enrollments/entities/external/course.entity';
import { Level } from '../enrollments/entities/external/level.entity';
import { StudyPlan } from '../enrollments/entities/external/study-plan.entity';
import { DegreeProgram } from '../enrollments/entities/external/degree-program.entity';
import { CourseSection } from '../enrollments/entities/external/course-section.entity';
import { Schedule } from '../enrollments/entities/external/schedule.entity';
import { Prerequisite } from '../enrollments/entities/external/prerequisite.entity';
import { Grade } from '../enrollments/entities/external/grade.entity';

export const typeOrmConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const synchronize =
    (configService.get<string>('DB_SYNCHRONIZE', 'true') ?? 'true').toLowerCase() ===
    'true';

  return {
    type: 'postgres',
    host: configService.get<string>('DB_HOST', 'localhost'),
    port: parseInt(configService.get<string>('DB_PORT', '5432'), 10),
    username: configService.get<string>('DB_USER', 'postgres'),
    password: configService.get<string>('DB_PASSWORD'),
    database: configService.get<string>('DB_NAME', 'topicos_db'),
    entities: [
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
    ],
    synchronize,
    logging:
      configService.get<string>('NODE_ENV') === 'development' ? ['error', 'warn'] : false,
  };
};

