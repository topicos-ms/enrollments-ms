import { Injectable, OnModuleDestroy } from '@nestjs/common';

interface CompletedOperation<T> {
  data: T;
  timestamp: number;
}

export interface IdempotencyResult<T> {
  data: T;
  isNew: boolean;
}

@Injectable()
export class IdempotencyService implements OnModuleDestroy {
  private readonly operationsInProgress = new Map<string, Promise<any>>();
  private readonly completedOperations = new Map<string, CompletedOperation<any>>();
  private cleanupInterval: NodeJS.Timeout;

  private readonly ttlMs = 60 * 60 * 1000;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 15 * 60 * 1000);
  }

  async executeWithIdempotency<T>(
    key: string,
    operation: () => Promise<T>,
  ): Promise<IdempotencyResult<T>> {
    const cached = this.completedOperations.get(key);
    if (cached) {
      return { data: cached.data, isNew: false };
    }

    const inFlight = this.operationsInProgress.get(key);
    if (inFlight) {
      const result = await inFlight;
      return { data: result, isNew: false };
    }

    const execution = this.executeOperation(operation);
    this.operationsInProgress.set(key, execution);

    try {
      const result = await execution;
      this.completedOperations.set(key, { data: result, timestamp: Date.now() });
      return { data: result, isNew: true };
    } finally {
      this.operationsInProgress.delete(key);
    }
  }

  getStats() {
    return {
      operationsInProgress: this.operationsInProgress.size,
      completedOperations: this.completedOperations.size,
    };
  }

  onModuleDestroy() {
    clearInterval(this.cleanupInterval);
  }

  private async executeOperation<T>(operation: () => Promise<T>): Promise<T> {
    return operation();
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, value] of this.completedOperations.entries()) {
      if (now - value.timestamp > this.ttlMs) {
        this.completedOperations.delete(key);
      }
    }
  }
}
