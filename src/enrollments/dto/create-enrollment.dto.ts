import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateEnrollmentDto {
  @IsUUID()
  @IsOptional()
  student_id?: string;

  @IsString()
  @IsOptional()
  student_code?: string;

  @IsUUID()
  @IsOptional()
  term_id?: string;

  @IsString()
  @IsOptional()
  term_name?: string;

  @Type(() => Date)
  @IsDate()
  enrolled_on: Date;

  @IsEnum(['Active', 'Canceled'])
  @IsOptional()
  state?: string = 'Active';

  @IsEnum(['Regular', 'Extra'])
  @IsOptional()
  origin?: string = 'Regular';

  @IsString()
  @IsOptional()
  note?: string;
}
