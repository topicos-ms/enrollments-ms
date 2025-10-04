import { PaginationDto } from '../../common';
import { IsOptional, IsUUID } from 'class-validator';

export class ListEnrollmentDetailsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  enrollment_id?: string;

  @IsOptional()
  @IsUUID()
  course_section_id?: string;
}
