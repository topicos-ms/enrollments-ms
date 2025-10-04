import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { EnrollmentsService } from '../services/enrollment.service';
import {
  CreateEnrollmentDto,
  ListEnrollmentsDto,
  UpdateEnrollmentDto,
} from '../dto';

@Controller()
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @MessagePattern('enrollments.create')
  create(@Payload() createEnrollmentDto: CreateEnrollmentDto) {
    return this.enrollmentsService.create(createEnrollmentDto);
  }

  @MessagePattern('enrollments.list')
  findAll(@Payload() listEnrollmentsDto: ListEnrollmentsDto) {
    return this.enrollmentsService.findAll(listEnrollmentsDto);
  }

  @MessagePattern('enrollments.findOne')
  findOne(@Payload() id: string) {
    return this.enrollmentsService.findOne(id);
  }

  @MessagePattern('enrollments.update')
  update(
    @Payload()
    payload: {
      id: string;
      updateEnrollmentDto: UpdateEnrollmentDto;
    },
  ) {
    return this.enrollmentsService.update(payload.id, payload.updateEnrollmentDto);
  }

  @MessagePattern('enrollments.remove')
  remove(@Payload() id: string) {
    return this.enrollmentsService.remove(id);
  }
}
