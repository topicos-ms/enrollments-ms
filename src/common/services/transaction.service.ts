import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

export interface TransactionCallback<T> {
  (manager: EntityManager): Promise<T>;
}

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  constructor(private readonly dataSource: DataSource) {}

  async executeTransaction<T>(
    callback: TransactionCallback<T>,
    timeoutMs = 5000,
  ): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();
      await queryRunner.startTransaction('READ COMMITTED');

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Transacción timeout después de ${timeoutMs}ms`)), timeoutMs);
      });

      const result = await Promise.race([
        callback(queryRunner.manager),
        timeoutPromise,
      ]);

      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      try {
        await queryRunner.rollbackTransaction();
      } catch (rollbackError) {
        this.logger.error('Error durante rollback', rollbackError as Error);
      }
      throw error;
    } finally {
      try {
        await queryRunner.release();
      } catch (releaseError) {
        this.logger.error('Error liberando QueryRunner', releaseError as Error);
      }
    }
  }

  async executeWithRetry<T>(
    callback: TransactionCallback<T>,
    maxRetries = 3,
    timeoutMs = 5000,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeTransaction(callback, timeoutMs);
      } catch (error) {
        lastError = error as Error;
        if (!this.shouldRetry(error) || attempt === maxRetries) {
          throw error;
        }
        const delay = Math.min(100 * Math.pow(2, attempt - 1), 1000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError ?? new Error('Transaction failed');
  }

  private shouldRetry(error: any): boolean {
    if (!error?.code) return false;
    return ['40001', '40P01', '55P03'].includes(error.code);
  }
}
