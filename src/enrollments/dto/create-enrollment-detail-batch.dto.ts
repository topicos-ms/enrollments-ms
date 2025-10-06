import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { CreateEnrollmentDetailDto } from './create-enrollment-detail.dto';

export class CreateEnrollmentDetailBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateEnrollmentDetailDto)
  items: CreateEnrollmentDetailDto[];
}
