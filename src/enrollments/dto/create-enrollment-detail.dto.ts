import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateEnrollmentDetailDto {
  @IsUUID()
  @IsOptional()
  enrollment_id?: string;

  @IsString()
  @IsOptional()
  student_code?: string;

  @IsString()
  @IsOptional()
  term_name?: string;

  @IsUUID()
  @IsOptional()
  course_section_id?: string;

  @IsString()
  @IsOptional()
  course_code?: string;

  @IsString()
  @IsOptional()
  group_label?: string;

  @IsString()
  @IsOptional()
  degree_program_code?: string;

  @IsString()
  @IsOptional()
  study_plan_version?: string;

  @IsEnum(['Enrolled', 'Approved', 'Failed', 'Withdrawn'])
  @IsOptional()
  course_state?: string = 'Enrolled';

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  final_grade?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  attempts?: number = 1;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  closed_on?: Date;

  @IsString()
  @IsOptional()
  remark?: string;
}
