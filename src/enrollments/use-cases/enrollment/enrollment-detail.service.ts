import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EnrollmentDetail } from '../../entities/enrollment-detail.entity';
import {
  CreateEnrollmentDetailDto,
  ListEnrollmentDetailsDto,
  UpdateEnrollmentDetailDto,
} from '../../dto';
import { PaginationService, PaginatedResultDto } from '../../../common';
import { EnrollmentContextResolver } from './enrollment-context-resolver.service';

@Injectable()
export class EnrollmentDetailService {
  constructor(
    @InjectRepository(EnrollmentDetail)
    private readonly enrollmentDetailRepository: Repository<EnrollmentDetail>,
    private readonly paginationService: PaginationService,
    private readonly contextResolver: EnrollmentContextResolver,
  ) {}

  async create(createEnrollmentDetailDto: CreateEnrollmentDetailDto) {
    const { enrollmentId, courseSectionId } =
      await this.contextResolver.resolveIdentifiers(createEnrollmentDetailDto);

    await this.contextResolver.ensureNoDuplicate(
      enrollmentId,
      courseSectionId,
    );

    const {
      student_code,
      term_name,
      course_code,
      group_label,
      degree_program_code,
      study_plan_version,
      ...persistableFields
    } = createEnrollmentDetailDto;

    const enrollmentDetail = this.enrollmentDetailRepository.create({
      ...persistableFields,
      enrollment_id: enrollmentId,
      course_section_id: courseSectionId,
    });

    return this.enrollmentDetailRepository.save(enrollmentDetail);
  }

  async findAll(
    paginationDto: ListEnrollmentDetailsDto,
  ): Promise<PaginatedResultDto<EnrollmentDetail>> {
    const { enrollment_id, course_section_id, ...pagination } = paginationDto;

    const qb = this.enrollmentDetailRepository
      .createQueryBuilder('detail')
      .leftJoinAndSelect('detail.enrollment', 'enrollment')
      .leftJoinAndSelect('detail.courseSection', 'courseSection')
      .leftJoinAndSelect('courseSection.course', 'course')
      .leftJoinAndSelect('courseSection.schedules', 'schedules');

    if (enrollment_id) {
      qb.andWhere('detail.enrollment_id = :enrollment_id', { enrollment_id });
    }

    if (course_section_id) {
      qb.andWhere('detail.course_section_id = :course_section_id', {
        course_section_id,
      });
    }

    qb.orderBy('detail.created_at', 'DESC');

    return this.paginationService.paginate(qb, pagination);
  }

  async findOne(id: string): Promise<EnrollmentDetail> {
    const detail = await this.enrollmentDetailRepository.findOne({
      where: { id },
      relations: [
        'enrollment',
        'courseSection',
        'courseSection.course',
        'courseSection.schedules',
      ],
    });

    if (!detail) {
      throw new NotFoundException(`Enrollment detail with ID ${id} not found`);
    }

    return detail;
  }

  async update(
    id: string,
    updateEnrollmentDetailDto: UpdateEnrollmentDetailDto,
  ): Promise<EnrollmentDetail> {
    const { id: _ignored, ...changes } = updateEnrollmentDetailDto;

    const detail = await this.enrollmentDetailRepository.preload({
      id,
      ...changes,
    });

    if (!detail) {
      throw new NotFoundException(`Enrollment detail with ID ${id} not found`);
    }

    return this.enrollmentDetailRepository.save(detail);
  }

  async remove(id: string): Promise<void> {
    const detail = await this.findOne(id);
    await this.enrollmentDetailRepository.remove(detail);
  }
}
