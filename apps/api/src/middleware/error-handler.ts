import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '../config/prisma-client.js';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { ApiError } from '../lib/api-error.js';
import { formatZodError } from '../lib/zod.js';

export function notFoundHandler(request: Request, _response: Response, next: NextFunction) {
  next(new ApiError(404, 'ROUTE_NOT_FOUND', `Route ${request.method} ${request.originalUrl} was not found`));
}

export function errorHandler(error: unknown, request: Request, response: Response, _next: NextFunction) {
  let normalized = error;

  if (error instanceof ZodError) {
    normalized = ApiError.badRequest('The submitted data is invalid', formatZodError(error));
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') normalized = ApiError.conflict('A record with the same unique value already exists', error.meta);
    if (error.code === 'P2025') normalized = ApiError.notFound();
    if (error.code === 'P2003') normalized = ApiError.badRequest('A related record does not exist');
    // P2028: the transaction was closed or timed out (common on pooled
    // connections when a transaction waits too long). It is transient, so the
    // client can safely retry instead of seeing a generic 500.
    if (error.code === 'P2028') normalized = new ApiError(503, 'DATABASE_TRANSACTION_FAILED', 'Əməliyyat tamamlanmadı. Zəhmət olmasa bir az sonra yenidən cəhd edin.', error.meta);
    // P2034: a write conflict or deadlock aborted the transaction. Retrying is
    // the documented remedy.
    if (error.code === 'P2034') normalized = new ApiError(409, 'TRANSACTION_CONFLICT', 'Eyni anda baş verən əməliyyat səbəbindən sorğu tamamlanmadı. Yenidən cəhd edin.', error.meta);
    // P2024: the connection pool timed out before a connection was available.
    if (error.code === 'P2024') normalized = new ApiError(503, 'DATABASE_UNAVAILABLE', 'Verilənlər bazası ilə əlaqə gözləniləndən uzun çəkdi. Yenidən cəhd edin.', error.meta);
  } else if (error instanceof Prisma.PrismaClientValidationError) {
    request.log?.error({ err: error, requestId: request.requestId }, 'Prisma validation error');
    normalized = ApiError.badRequest('Database validation failed');
  }

  const apiError = normalized instanceof ApiError
    ? normalized
    : new ApiError(500, 'INTERNAL_ERROR', 'An unexpected server error occurred');

  if (!(error instanceof ApiError)) {
    request.log?.error({ err: error, requestId: request.requestId }, 'Unhandled request error');
  }

  response.status(apiError.status).json({
    error: {
      code: apiError.code,
      message: apiError.message,
      details: apiError.details,
      requestId: request.requestId,
      ...(env.NODE_ENV === 'development' && !(normalized instanceof ApiError) ? { debug: String(error) } : {}),
    },
  });
}
