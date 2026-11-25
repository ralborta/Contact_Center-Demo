import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Auth por secreto compartido para server tools del agente de voz.
 * Header: X-Agent-Secret (o X-Webhook-Token como alias).
 */
@Injectable()
export class AgentAuthGuard implements CanActivate {
  constructor(private config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const secret =
      req.headers['x-agent-secret'] ||
      req.headers['x-webhook-token'] ||
      '';
    const expected =
      this.config.get<string>('AGENT_API_SECRET') ||
      this.config.get<string>('ELEVENLABS_WEBHOOK_TOKEN') ||
      '';

    if (!expected) {
      // En desarrollo sin secreto configurado, permitir (con warning en logs)
      if (process.env.NODE_ENV !== 'production') return true;
      throw new UnauthorizedException('AGENT_API_SECRET no configurado');
    }
    if (!secret || secret !== expected) {
      throw new UnauthorizedException('Secreto de agente inválido');
    }
    return true;
  }
}
