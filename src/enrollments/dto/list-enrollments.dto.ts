import { PaginationDto } from '../../common';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class ListEnrollmentsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  student_id?: string;

  @IsOptional()
  @IsUUID()
  term_id?: string;

  @IsOptional()
  @IsEnum(['Active', 'Canceled'])
  state?: string;
}
