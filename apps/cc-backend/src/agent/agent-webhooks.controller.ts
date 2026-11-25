import { Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AgentService } from './agent.service';

@ApiTags('Webhooks agente')
@Controller('webhooks')
export class AgentWebhooksController {
  constructor(
    private agent: AgentService,
    private config: ConfigService,
  ) {}

  private assertToken(token?: string) {
    const expected =
      this.config.get<string>('AGENT_API_SECRET') ||
      this.config.get<string>('ELEVENLABS_WEBHOOK_TOKEN') ||
      '';
    if (!expected) {
      if (process.env.NODE_ENV === 'production') {
        throw new UnauthorizedException('Secreto no configurado');
      }
      return;
    }
    if (!token || token !== expected) {
      throw new UnauthorizedException('Token inválido');
    }
  }

  @Post('voice/call-init')
  @ApiOperation({ summary: 'Inicio de llamada — variables dinámicas del paciente' })
  @ApiHeader({ name: 'X-Webhook-Token', required: false })
  callInit(@Body() body: any, @Headers('x-webhook-token') token: string) {
    this.assertToken(token);
    return this.agent.handleCallInit(body);
  }

  @Post('voice/post-call')
  @ApiOperation({ summary: 'Post-llamada — guarda transcripción, resumen y resultado' })
  @ApiHeader({ name: 'X-Webhook-Token', required: false })
  postCall(@Body() body: any, @Headers('x-webhook-token') token: string) {
    this.assertToken(token);
    return this.agent.handlePostCall(body);
  }

  /** Alias de compatibilidad */
  @Post('elevenlabs/call-init')
  callInitAlias(@Body() body: any, @Headers('x-webhook-token') token: string) {
    return this.callInit(body, token);
  }

  @Post('elevenlabs/call')
  postCallAlias(@Body() body: any, @Headers('x-webhook-token') token: string) {
    return this.postCall(body, token);
  }
}
