import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { EnrollmentDetailService } from '../services/enrollment-detail.service';
import {
  CreateEnrollmentDetailDto,
  ListEnrollmentDetailsDto,
  UpdateEnrollmentDetailDto,
} from '../dto';

@Controller()
export class EnrollmentDetailsController {
  constructor(
    private readonly enrollmentDetailsService: EnrollmentDetailService,
  ) {}

  @MessagePattern('enrollment-details.create')
  create(@Payload() createEnrollmentDetailDto: CreateEnrollmentDetailDto) {
    return this.enrollmentDetailsService.create(createEnrollmentDetailDto);
  }

  @MessagePattern('enrollment-details.list')
  findAll(@Payload() listEnrollmentDetailsDto: ListEnrollmentDetailsDto) {
    return this.enrollmentDetailsService.findAll(listEnrollmentDetailsDto);
  }

  @MessagePattern('enrollment-details.findOne')
  findOne(@Payload() id: string) {
    return this.enrollmentDetailsService.findOne(id);
  }

  @MessagePattern('enrollment-details.update')
  update(
    @Payload()
    payload: {
      id: string;
      updateEnrollmentDetailDto: UpdateEnrollmentDetailDto;
    },
  ) {
    return this.enrollmentDetailsService.update(
      payload.id,
      payload.updateEnrollmentDetailDto,
    );
  }

  @MessagePattern('enrollment-details.remove')
  remove(@Payload() id: string) {
    return this.enrollmentDetailsService.remove(id);
  }
}
