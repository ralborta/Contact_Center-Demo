import { Controller, Post, Body, Headers, RawBodyRequest, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { Request } from 'express';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private webhooksService: WebhooksService) {}

  @Post('elevenlabs/call')
  @ApiOperation({ summary: 'Webhook para eventos de llamadas ElevenLabs' })
  @ApiHeader({ name: 'X-Webhook-Token', required: false })
  async handleElevenLabs(
    @Body() payload: any,
    @Headers('x-webhook-token') token: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    return this.webhooksService.handleElevenLabs(payload, token);
  }

  @Post('builderbot/whatsapp')
  @ApiOperation({ summary: 'Webhook para mensajes WhatsApp de builderbot' })
  @ApiHeader({ name: 'X-Webhook-Token', required: false })
  async handleBuilderBot(
    @Body() payload: any,
    @Headers('x-webhook-token') token: string,
  ) {
    return this.webhooksService.handleBuilderBot(payload, token);
  }

  @Post('twilio/sms/status')
  @ApiOperation({ summary: 'Webhook de status SMS de Twilio' })
  @ApiHeader({ name: 'X-Webhook-Token', required: false })
  async handleTwilioStatus(
    @Body() payload: any,
    @Headers('x-webhook-token') token: string,
  ) {
    return this.webhooksService.handleTwilioStatus(payload, token);
  }
}
