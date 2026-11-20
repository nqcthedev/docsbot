/** Errors that are safe to show to API clients. Anything else is reported as a generic 500. */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (what = 'Resource') => new AppError('not_found', `${what} not found`, 404);
export const forbidden = (message = 'Forbidden') => new AppError('forbidden', message, 403);
