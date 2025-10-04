import { Injectable } from '@nestjs/common';
import { Repository, SelectQueryBuilder, FindManyOptions, ObjectLiteral } from 'typeorm';
import { PaginationDto, PaginatedResultDto } from '../dto';

@Injectable()
export class PaginationService {
  async paginate<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResultDto<T>> {
    const { page = 1, limit = 10 } = paginationDto;
    const take = Math.max(limit, 1);
    const skip = (page - 1) * take;

    queryBuilder.skip(skip).take(take);

    const [data, total] = await queryBuilder.getManyAndCount();
    const totalPages = Math.max(Math.ceil(total / take), 1);

    return {
      data,
      pagination: {
        page,
        limit: take,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  async paginateRepository<T extends ObjectLiteral>(
    repository: Repository<T>,
    paginationDto: PaginationDto,
    options: FindManyOptions<T> = {},
  ): Promise<PaginatedResultDto<T>> {
    const { page = 1, limit = 10 } = paginationDto;
    const take = Math.max(limit, 1);
    const skip = (page - 1) * take;

    const [data, total] = await repository.findAndCount({
      ...options,
      skip,
      take,
    });

    const totalPages = Math.max(Math.ceil(total / take), 1);

    return {
      data,
      pagination: {
        page,
        limit: take,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }
}
