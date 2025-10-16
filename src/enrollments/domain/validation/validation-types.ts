export interface ValidationIssue<TDetails = Record<string, unknown>> {
  code: string;
  message: string;
  details?: TDetails;
}

export interface ValidationReport<TDetails = Record<string, unknown>> {
  errors: Array<ValidationIssue<TDetails>>;
  warnings: Array<ValidationIssue<TDetails>>;
}

export interface ValidationContext {
  studentId: string;
  courseSectionId: string;
  termId: string;
}

export interface ValidationAggregate {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
