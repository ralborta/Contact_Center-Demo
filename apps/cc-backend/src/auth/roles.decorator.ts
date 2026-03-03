import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY } from './roles.guard';

/**
 * Decorator para restringir acceso por perfil.
 * @param roles - Slugs de perfiles permitidos (ej: 'ADMIN', 'AGENT')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
