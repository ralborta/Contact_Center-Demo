import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

export const ROLES_KEY = 'roles';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>(
      ROLES_KEY,
      context.getHandler(),
    );
    if (!requiredRoles?.length) {
      return true;
    }
    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user;
    if (!user?.profile) {
      throw new ForbiddenException('Acceso denegado');
    }
    const hasRole = requiredRoles.includes(user.profile);
    if (!hasRole) {
      throw new ForbiddenException('No tiene permisos para esta acción');
    }
    return true;
  }
}
