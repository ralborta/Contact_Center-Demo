import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { AgentService } from './agent.service';

@ApiTags('Webhooks agente')
@Controller('webhooks')
export class AgentWebhooksController {
  constructor(
    private agent: AgentService,
    private config: ConfigService,
  ) {}

  private assertAuth(params: {
    token?: string;
    signature?: string;
    rawBody?: Buffer | string;
  }) {
    const expectedToken =
      this.config.get<string>('AGENT_API_SECRET') ||
      this.config.get<string>('ELEVENLABS_WEBHOOK_TOKEN') ||
      '';
    const hmacSecret =
      this.config.get<string>('ELEVENLABS_WEBHOOK_SECRET') || '';

    if (expectedToken && params.token && params.token === expectedToken) {
      return;
    }

    if (hmacSecret && params.signature && params.rawBody) {
      if (this.verifyElevenLabsHmac(hmacSecret, params.signature, params.rawBody)) {
        return;
      }
    }

    if (!expectedToken && !hmacSecret) {
      if (process.env.NODE_ENV === 'production') {
        throw new UnauthorizedException('Secreto no configurado');
      }
      return;
    }

    throw new UnauthorizedException('Token o firma inválidos');
  }

  /** Verifica firma HMAC de ElevenLabs: header ElevenLabs-Signature t=...,v0=... */
  private verifyElevenLabsHmac(
    secret: string,
    header: string,
    rawBody: Buffer | string,
  ): boolean {
    try {
      const parts = Object.fromEntries(
        header.split(',').map((p) => {
          const [k, ...rest] = p.trim().split('=');
          return [k, rest.join('=')];
        }),
      );
      const timestamp = parts.t;
      const hash = parts.v0;
      if (!timestamp || !hash) return false;

      const body =
        typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
      const payload = `${timestamp}.${body}`;
      const digest = createHmac('sha256', secret).update(payload).digest('hex');
      const a = Buffer.from(digest, 'utf8');
      const b = Buffer.from(hash, 'utf8');
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  @Post('voice/call-init')
  @HttpCode(200)
  @ApiOperation({ summary: 'Inicio de llamada — variables dinámicas del paciente' })
  @ApiHeader({ name: 'X-Webhook-Token', required: false })
  callInit(
    @Body() body: any,
    @Headers('x-webhook-token') token: string,
    @Headers('elevenlabs-signature') signature: string,
    @Req() req: any,
  ) {
    this.assertAuth({
      token,
      signature,
      rawBody: req.rawBody || JSON.stringify(body),
    });
    return this.agent.handleCallInit(body);
  }

  @Post('voice/post-call')
  @HttpCode(200)
  @ApiOperation({ summary: 'Post-llamada — guarda transcripción, resumen y resultado' })
  @ApiHeader({ name: 'X-Webhook-Token', required: false })
  @ApiHeader({ name: 'ElevenLabs-Signature', required: false })
  postCall(
    @Body() body: any,
    @Headers('x-webhook-token') token: string,
    @Headers('elevenlabs-signature') signature: string,
    @Req() req: any,
  ) {
    this.assertAuth({
      token,
      signature,
      rawBody: req.rawBody || JSON.stringify(body),
    });
    return this.agent.handlePostCall(body);
  }

  /** Alias de compatibilidad */
  @Post('elevenlabs/call-init')
  callInitAlias(
    @Body() body: any,
    @Headers('x-webhook-token') token: string,
    @Headers('elevenlabs-signature') signature: string,
    @Req() req: any,
  ) {
    return this.callInit(body, token, signature, req);
  }

  @Post('elevenlabs/call')
  postCallAlias(
    @Body() body: any,
    @Headers('x-webhook-token') token: string,
    @Headers('elevenlabs-signature') signature: string,
    @Req() req: any,
  ) {
    return this.postCall(body, token, signature, req);
  }
}
