export abstract class DomainError<TDetails = unknown> extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: TDetails,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
