import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionService } from '../../../../common';
import { CreateEnrollmentDetailDto } from '../../../dto';
import { CourseSection } from '../../../entities/external/course-section.entity';
import { EnrollmentDetail } from '../../../entities/enrollment-detail.entity';
import { IdentifiersResolver } from './helpers/identifiers-resolver.service';
import { EnrollmentProcessorService } from './helpers/enrollment-processor.service';

export interface EnrollmentResult {
  enrollmentDetail: EnrollmentDetail;
  remainingQuota: number;
  wasCreated: boolean;
}

export interface BatchEnrollmentResult {
  results: EnrollmentResult[];
  requested: number;
}

@Injectable()
export class AtomicEnrollmentService {
  private readonly logger = new Logger(AtomicEnrollmentService.name);

  constructor(
    @InjectRepository(CourseSection)
    private readonly courseSectionRepository: Repository<CourseSection>,
    private readonly transactionService: TransactionService,
    private readonly identifiers: IdentifiersResolver,
    private readonly processor: EnrollmentProcessorService,
  ) {}

  // enrollStudentInCourseSection eliminado: usar siempre enrollStudentInCourseSectionsBatch

  async enrollStudentInCourseSectionsBatch(
    detailDtos: CreateEnrollmentDetailDto[],
  ): Promise<BatchEnrollmentResult> {
    if (!detailDtos?.length) {
      throw new BadRequestException('At least one enrollment detail is required');
    }

    this.logger.log(`Procesando lote de ${detailDtos.length} inscripciones`);

    // Resolver identificadores y ordenar por courseSectionId para un orden de locks consistente
    const batchItems = await this.identifiers.resolveBatchIdentifiers(detailDtos);
    batchItems.sort((a, b) =>
      a.identifiers.courseSectionId.localeCompare(b.identifiers.courseSectionId),
    );

    const results = await this.transactionService.executeWithRetry(
      async (manager) => {
        const processedResults: EnrollmentResult[] = [];
        for (const item of batchItems) {
          const result = await this.processor.processEnrollment(
            manager,
            item.dto,
            item.identifiers.enrollmentId,
            item.identifiers.courseSectionId,
          );
          processedResults.push(result);
        }
        return processedResults;
      },
      3,
      10_000,
    );

    this.logger.log(
      `Lote procesado: ${results.length}/${detailDtos.length} exitosas`,
    );
    return { results, requested: detailDtos.length };
  }

  async getCourseSectionQuotaStatus(courseSectionId: string): Promise<{
    quota_max: number;
    quota_available: number;
    quota_used: number;
    is_full: boolean;
  }> {
    const courseSection = await this.courseSectionRepository.findOne({
      where: { id: courseSectionId },
    });
    if (!courseSection) {
      throw new NotFoundException(
        `Sección de curso con ID ${courseSectionId} no encontrada`,
      );
    }
    const quota_used = courseSection.quota_max - courseSection.quota_available;
    return {
      quota_max: courseSection.quota_max,
      quota_available: courseSection.quota_available,
      quota_used,
      is_full: courseSection.quota_available <= 0,
    };
  }
}

