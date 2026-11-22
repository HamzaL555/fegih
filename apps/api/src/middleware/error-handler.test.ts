import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '../config/prisma-client.js';
import { errorHandler } from './error-handler.js';

function knownError(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError('boom', {
    code,
    clientVersion: '6.19.0',
    meta,
  });
}

function createRequest() {
  return { log: { error: vi.fn() }, requestId: 'test-request' } as unknown as Request;
}

function createResponse() {
  const response = { status: vi.fn(), json: vi.fn() };
  response.status.mockReturnValue(response);
  return response;
}

function run(error: unknown) {
  const request = createRequest();
  const response = createResponse();
  errorHandler(error, request, response as unknown as Response, vi.fn() as unknown as NextFunction);
  return { request, response, body: response.json.mock.calls[0]?.[0] as { error: { code: string; message: string } } };
}

describe('errorHandler transaction errors', () => {
  it('maps a closed/timed-out transaction (P2028) to a retryable 503 with a clear message', () => {
    const { response, body } = run(knownError('P2028', { error: 'Transaction already closed' }));
    expect(response.status).toHaveBeenCalledWith(503);
    expect(body.error.code).toBe('DATABASE_TRANSACTION_FAILED');
    expect(body.error.message).toContain('yenidən cəhd edin');
  });

  it('maps a write conflict/deadlock (P2034) to a retryable 409', () => {
    const { response, body } = run(knownError('P2034', { error: 'write conflict' }));
    expect(response.status).toHaveBeenCalledWith(409);
    expect(body.error.code).toBe('TRANSACTION_CONFLICT');
    expect(body.error.message).toContain('Yenidən cəhd edin');
  });

  it('maps a pool timeout (P2024) to a 503', () => {
    const { response, body } = run(knownError('P2024'));
    expect(response.status).toHaveBeenCalledWith(503);
    expect(body.error.code).toBe('DATABASE_UNAVAILABLE');
  });

  it('keeps duplicate unique values (P2002) as a 409', () => {
    const { response, body } = run(knownError('P2002', { target: ['sessionQuestionId'] }));
    expect(response.status).toHaveBeenCalledWith(409);
    expect(body.error.code).toBe('CONFLICT');
  });

  it('does not leak an unknown error as a 500 with internals', () => {
    const { response, body } = run(new Error('secret internals'));
    expect(response.status).toHaveBeenCalledWith(500);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).not.toContain('secret internals');
  });
});
