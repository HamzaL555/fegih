import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export function requestContext(request: Request, response: Response, next: NextFunction) {
  const incomingId = request.header('x-request-id');
  request.requestId = incomingId && /^[a-zA-Z0-9._-]{8,100}$/.test(incomingId) ? incomingId : randomUUID();
  response.setHeader('x-request-id', request.requestId);
  next();
}
