import { Injectable, BadRequestException } from '@nestjs/common';
import { CreateEnrollmentDetailDto } from '../../../../dto';
import { EnrollmentContextResolver } from '../../enrollment-context-resolver.service';
import { DuplicateEnrollmentError } from '../../../../domain/errors';

export interface ResolvedIdentifiers {
  enrollmentId: string;
  courseSectionId: string;
}

@Injectable()
export class IdentifiersResolver {
  constructor(private readonly contextResolver: EnrollmentContextResolver) {}

  async resolveIdentifiers(
    dto: CreateEnrollmentDetailDto,
  ): Promise<ResolvedIdentifiers> {
    const resolved = await this.contextResolver.resolveIdentifiers(dto);
    return {
      enrollmentId: resolved.enrollmentId,
      courseSectionId: resolved.courseSectionId,
    };
  }

  async resolveBatchIdentifiers(
    detailDtos: CreateEnrollmentDetailDto[],
  ): Promise<Array<{ dto: CreateEnrollmentDetailDto; identifiers: ResolvedIdentifiers }>> {
    if (!detailDtos?.length) {
      throw new BadRequestException('At least one enrollment detail is required');
    }

    const items: Array<{
      dto: CreateEnrollmentDetailDto;
      identifiers: ResolvedIdentifiers;
    }> = [];
    const seenPairs = new Set<string>();

    for (const dto of detailDtos) {
      const identifiers = await this.resolveIdentifiers(dto);
      const compositeKey = `${identifiers.enrollmentId}:${identifiers.courseSectionId}`;
      if (seenPairs.has(compositeKey)) {
        throw new DuplicateEnrollmentError(
          identifiers.enrollmentId,
          identifiers.courseSectionId,
        );
      }
      seenPairs.add(compositeKey);
      items.push({ dto, identifiers });
    }

    return items;
  }

  extractPersistableFields(dto: CreateEnrollmentDetailDto): Record<string, any> {
    const excludedKeys = new Set([
      'student_code',
      'term_name',
      'course_code',
      'group_label',
      'degree_program_code',
      'study_plan_version',
      'enrollment_id',
      'course_section_id',
    ]);
    const persistableFields: Record<string, any> = {};
    for (const [key, value] of Object.entries(dto ?? {})) {
      if (!excludedKeys.has(key)) {
        persistableFields[key] = value;
      }
    }
    return persistableFields;
  }
}

