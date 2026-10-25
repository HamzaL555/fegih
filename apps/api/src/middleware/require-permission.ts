import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../lib/api-error.js';

export const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'EDITOR', 'ORDER_MANAGER', 'QUESTION_MANAGER'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export function requireAdmin(...roles: AdminRole[]) {
  return (request: Request, _response: Response, next: NextFunction) => {
    if (!request.user) return next(ApiError.unauthorized());
    if (!request.user.roles.some((role) => ADMIN_ROLES.includes(role as AdminRole))) return next(ApiError.forbidden('Administrator access is required'));
    if (roles.length && !request.user.roles.some((role) => roles.includes(role as AdminRole))) return next(ApiError.forbidden());
    next();
  };
}

export function requirePermission(...permissions: string[]) {
  return async (request: Request, _response: Response, next: NextFunction) => {
    if (!request.user) return next(ApiError.unauthorized());
    const roleLinks = await prisma.userRole.findMany({
      where: { userId: request.user.id },
      select: { role: { select: { permissions: { select: { permission: { select: { key: true } } } } } } },
    });
    const granted = new Set(roleLinks.flatMap((link) => link.role.permissions.map((item) => item.permission.key)));
    if (permissions.some((permission) => granted.has(permission))) return next();
    next(ApiError.forbidden());
  };
}
