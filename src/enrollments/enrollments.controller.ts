import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { EnrollmentsService } from './enrollments.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';

@Controller()
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @MessagePattern('createEnrollment')
  create(@Payload() createEnrollmentDto: CreateEnrollmentDto) {
    return this.enrollmentsService.create(createEnrollmentDto);
  }

  @MessagePattern('findAllEnrollments')
  findAll() {
    return this.enrollmentsService.findAll();
  }

  @MessagePattern('findOneEnrollment')
  findOne(@Payload() id: number) {
    return this.enrollmentsService.findOne(id);
  }

  @MessagePattern('updateEnrollment')
  update(@Payload() updateEnrollmentDto: UpdateEnrollmentDto) {
    return this.enrollmentsService.update(updateEnrollmentDto.id, updateEnrollmentDto);
  }

  @MessagePattern('removeEnrollment')
  remove(@Payload() id: number) {
    return this.enrollmentsService.remove(id);
  }
}
