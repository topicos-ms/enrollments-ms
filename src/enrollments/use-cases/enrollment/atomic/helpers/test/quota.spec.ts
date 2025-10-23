import { NotFoundException } from '@nestjs/common';
import { CourseSectionQuotaService } from '../quota.service';
import { QuotaExceededError } from '../../../../../domain/errors';
import { CourseSection } from '../../../../../entities/external/course-section.entity';
import { EntityManager } from 'typeorm';

// 🔹 Utilidad para mockear el QueryBuilder de TypeORM
function createMockQueryBuilder<T = any>() {
  const qb: any = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(), // Postgres only
    execute: jest.fn(),
  };
  return qb as jest.Mocked<{
    update: (...args: any[]) => any;
    set: (...args: any[]) => any;
    where: (...args: any[]) => any;
    andWhere: (...args: any[]) => any;
    returning: (...args: any[]) => any;
    execute: () => Promise<any>;
  }>;
}

describe('CourseSectionQuotaService', () => {
  let service: CourseSectionQuotaService;

  beforeEach(() => {
    service = new CourseSectionQuotaService();
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // getWithLockOrThrow
  // ---------------------------------------------------------------------------
  describe('getWithLockOrThrow', () => {
    let manager: jest.Mocked<EntityManager>;

    beforeEach(() => {
      manager = { findOne: jest.fn() } as unknown as jest.Mocked<EntityManager>;
    });

    it('retorna la sección cuando existe (usa lock pesimista)', async () => {
      const id = 'sec-1';
      const found = { id, quota_available: 3 } as CourseSection;
      manager.findOne.mockResolvedValue(found);

      const result = await service.getWithLockOrThrow(manager, id);

      expect(result).toEqual(found);
      expect(manager.findOne).toHaveBeenCalledWith(
        CourseSection,
        expect.objectContaining({
          where: { id },
          lock: expect.objectContaining({ mode: 'pessimistic_write' }),
        }),
      );
    });

    it('lanza NotFoundException si no existe', async () => {
      const id = 'missing';
      manager.findOne.mockResolvedValue(null);

      await expect(service.getWithLockOrThrow(manager, id)).rejects.toThrow(
        new NotFoundException(`Sección de curso con ID ${id} no encontrada`),
      );
    });

    it('propaga errores inesperados del manager', async () => {
      const boom = new Error('db down');
      manager.findOne.mockRejectedValue(boom);

      await expect(service.getWithLockOrThrow(manager, 'sec-2')).rejects.toBe(boom);
    });
  });

  // ---------------------------------------------------------------------------
  // ensureAvailableOrThrow
  // ---------------------------------------------------------------------------
  describe('ensureAvailableOrThrow', () => {
    it('no lanza si hay cupo (> 0)', () => {
      expect(() =>
        service.ensureAvailableOrThrow({ id: 'sec', quota_available: 1 } as any),
      ).not.toThrow();
    });

    it('lanza QuotaExceededError si cupo <= 0', () => {
      expect(() =>
        service.ensureAvailableOrThrow({ id: 'sec', quota_available: 0 } as any),
      ).toThrow(QuotaExceededError);

      expect(() =>
        service.ensureAvailableOrThrow({ id: 'sec', quota_available: -1 } as any),
      ).toThrow(QuotaExceededError);
    });

    it('lanza también si quota_available es null/undefined', () => {
      expect(() =>
        service.ensureAvailableOrThrow({ id: 'sec', quota_available: undefined } as any),
      ).toThrow(QuotaExceededError);
      expect(() =>
        service.ensureAvailableOrThrow({ id: 'sec', quota_available: null } as any),
      ).toThrow(QuotaExceededError);
    });
  });

  // ---------------------------------------------------------------------------
  // decrementAndReturn
  // ---------------------------------------------------------------------------
  describe('decrementAndReturn', () => {
    let manager: jest.Mocked<EntityManager>;
    let qb: ReturnType<typeof createMockQueryBuilder>;

    beforeEach(() => {
      qb = createMockQueryBuilder();
      manager = { 
        createQueryBuilder: jest.fn().mockReturnValue(qb),
      } as unknown as jest.Mocked<EntityManager>;
    });

    it('decrementa en 1 y retorna el nuevo quota', async () => {
      const id = 'sec-1';
      qb.execute.mockResolvedValue({
        affected: 1,
        raw: [{ quota_available: 2 }],
      });

      const newQuota = await service.decrementAndReturn(manager, id);

      expect(newQuota).toBe(2);
      expect(manager.createQueryBuilder).toHaveBeenCalled();
      expect(qb.update).toHaveBeenCalledWith(CourseSection);
      expect(qb.where).toHaveBeenCalledWith('id = :id', { id });
      expect(qb.andWhere).toHaveBeenCalledWith('quota_available > 0');
      expect(qb.returning).toHaveBeenCalledWith(['quota_available']);
      expect(qb.execute).toHaveBeenCalledTimes(1);
    });

    it('lanza QuotaExceededError si no afectó filas (sin cupo)', async () => {
      qb.execute.mockResolvedValue({ affected: 0, raw: [] });
      await expect(service.decrementAndReturn(manager, 'sec-2')).rejects.toThrow(
        QuotaExceededError,
      );
    });

    it('retorna 0 si el driver no devuelve raw', async () => {
      qb.execute.mockResolvedValue({ affected: 1, raw: [] });
      const result = await service.decrementAndReturn(manager, 'sec-3');
      expect(result).toBe(0);
    });

    it('propaga errores inesperados del QueryBuilder', async () => {
      const boom = new Error('deadlock');
      qb.execute.mockRejectedValue(boom);
      await expect(service.decrementAndReturn(manager, 'sec-4')).rejects.toBe(boom);
    });
  });
});