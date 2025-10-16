import { EntityManager } from 'typeorm';
import {
  ValidationContext,
  ValidationReport,
} from '../validation-types';

export interface ValidationPolicy {
  evaluate(
    context: ValidationContext,
    manager?: EntityManager,
  ): Promise<ValidationReport>;
}
