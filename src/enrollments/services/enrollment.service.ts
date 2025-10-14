import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Enrollment } from '../entities/enrollment.entity';
import {
  CreateEnrollmentDto,
  ListEnrollmentsDto,
  UpdateEnrollmentDto,
} from '../dto';
import { PaginationService, PaginatedResultDto } from '../../common';
import { Student } from '../entities/external/student.entity';
import { Term } from '../entities/external/term.entity';

@Injectable()
export class EnrollmentsService {
  constructor(
    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>,
    @InjectRepository(Student)
    private readonly studentRepository: Repository<Student>,
    @InjectRepository(Term)
    private readonly termRepository: Repository<Term>,
    private readonly paginationService: PaginationService,
  ) {}

  async create(createEnrollmentDto: CreateEnrollmentDto): Promise<Enrollment> {
    let { student_id, term_id } = createEnrollmentDto;
    const usingIds = !!student_id && !!term_id;
    const usingCodes =
      !!createEnrollmentDto.student_code && !!createEnrollmentDto.term_name;

    if (!usingIds && !usingCodes) {
      throw new BadRequestException(
        'Provide either (student_id, term_id) or (student_code, term_name)',
      );
    }

    if (usingCodes) {
      const student = await this.studentRepository.findOne({
        where: { code: createEnrollmentDto.student_code! },
      });
      if (!student) {
        throw new NotFoundException(
          `Student with code '${createEnrollmentDto.student_code}' not found`,
        );
      }

      const term = await this.termRepository.findOne({
        where: { name: createEnrollmentDto.term_name! },
      });
      if (!term) {
        throw new NotFoundException(
          `Term with name '${createEnrollmentDto.term_name}' not found`,
        );
      }

      student_id = student.id;
      term_id = term.id;
    }

    const enrollment = this.enrollmentRepository.create({
      student_id: student_id!,
      term_id: term_id!,
      enrolled_on: createEnrollmentDto.enrolled_on ?? new Date(),
      state: createEnrollmentDto.state ?? 'Active',
      origin: createEnrollmentDto.origin ?? 'Regular',
      note: createEnrollmentDto.note ?? null,
    });

    return await this.enrollmentRepository.save(enrollment);
  }

  async findAll(
    query: ListEnrollmentsDto,
  ): Promise<PaginatedResultDto<Enrollment>> {
    const { student_id, term_id, state, ...pagination } = query;

    const qb = this.enrollmentRepository
      .createQueryBuilder('enrollment')
      .leftJoinAndSelect('enrollment.student', 'student')
      .leftJoinAndSelect('enrollment.term', 'term')
      .leftJoinAndSelect('enrollment.enrollment_details', 'details')
      .leftJoinAndSelect('details.courseSection', 'courseSection');

    if (student_id) {
      qb.andWhere('enrollment.student_id = :student_id', { student_id });
    }

    if (term_id) {
      qb.andWhere('enrollment.term_id = :term_id', { term_id });
    }

    if (state) {
      qb.andWhere('enrollment.state = :state', { state });
    }

    qb.orderBy('enrollment.enrolled_on', 'DESC');

    return this.paginationService.paginate(qb, pagination);
  }

  async findOne(id: string): Promise<Enrollment> {
    const enrollment = await this.enrollmentRepository.findOne({
      where: { id },
      relations: ['student', 'term', 'enrollment_details', 'enrollment_details.course_section'],
    });

    if (!enrollment) {
      throw new NotFoundException(`Enrollment with ID ${id} not found`);
    }

    return enrollment;
  }

  async update(
    id: string,
    updateEnrollmentDto: UpdateEnrollmentDto,
  ): Promise<Enrollment> {
    const { id: _ignored, ...changes } = updateEnrollmentDto;

    const enrollment = await this.enrollmentRepository.preload({
      id,
      ...changes,
    });

    if (!enrollment) {
      throw new NotFoundException(`Enrollment with ID ${id} not found`);
    }

    if (!enrollment.enrolled_on) {
      enrollment.enrolled_on = new Date();
    }

    return await this.enrollmentRepository.save(enrollment);
  }

  async remove(id: string): Promise<void> {
    const enrollment = await this.findOne(id);
    await this.enrollmentRepository.remove(enrollment);
  }
}
