import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller()
export class SeedingController {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  @MessagePattern('enrollments.clearTestData')
  async clearTestData() {
    await this.dataSource.query(
      'TRUNCATE TABLE "enrollment_detail" CASCADE',
    );
    await this.dataSource.query('TRUNCATE TABLE "enrollment" CASCADE');
    return { success: true, message: 'Enrollments test data cleared' };
  }
}
