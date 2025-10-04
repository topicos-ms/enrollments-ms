import { PartialType } from '@nestjs/mapped-types';
import { CreateEnrollmentDetailDto } from './create-enrollment-detail.dto';
import { IsUUID } from 'class-validator';

export class UpdateEnrollmentDetailDto extends PartialType(CreateEnrollmentDetailDto) {
  @IsUUID()
  id: string;
}
