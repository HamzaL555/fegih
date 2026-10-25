import { ZodError, type ZodType } from 'zod';
import { ApiError } from './api-error.js';

export function parse<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw ApiError.badRequest('The submitted data is invalid', formatZodError(result.error));
  }
  return result.data;
}

export function formatZodError(error: ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || 'root',
    code: issue.code,
    message: issue.message,
  }));
}
