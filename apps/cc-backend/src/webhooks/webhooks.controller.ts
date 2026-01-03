import { Controller, Post, Body, Headers, RawBodyRequest, Req, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { Request } from 'express';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private webhooksService: WebhooksService) {}

  @Post('elevenlabs/call')
  @ApiOperation({ 
    summary: 'Webhook para eventos de llamadas ElevenLabs (tiempo real)',
    description: 'Recibe eventos en tiempo real de ElevenLabs. Responde rápidamente y procesa detalles de forma asíncrona para no bloquear.'
  })
  @ApiHeader({ name: 'X-Webhook-Token', required: false, description: 'Token de autenticación del webhook' })
  async handleElevenLabs(
    @Body() payload: any,
    @Headers('x-webhook-token') token: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    try {
      const result = await this.webhooksService.handleElevenLabs(payload, token);
      return result;
    } catch (error: any) {
      // Log del error pero responder con 200 para que ElevenLabs no reintente
      // (a menos que sea un error de autenticación)
      if (error instanceof UnauthorizedException) {
        throw error; // Re-lanzar errores de autenticación
      }
      console.error('[Webhook ElevenLabs] Error procesando webhook:', error);
      return { 
        success: false, 
        error: error.message,
        message: 'Error procesado, se intentará nuevamente en el próximo evento'
      };
    }
  }

  // Nota: El webhook de BuilderBot ahora está manejado por BuilderBotWebhookController
  // para tener mejor logging y validación específica del formato de BuilderBot.cloud

  @Post('twilio/sms/status')
  @ApiOperation({ summary: 'Webhook de status SMS de Twilio' })
  @ApiHeader({ name: 'X-Webhook-Token', required: false })
  async handleTwilioStatus(
    @Body() payload: any,
    @Headers('x-webhook-token') token: string,
  ) {
    return this.webhooksService.handleTwilioStatus(payload, token);
  }

  @Post('elevenlabs/call-init')
  @ApiOperation({ 
    summary: 'Webhook de inicio de llamada - Responde con variables dinámicas',
    description: 'Cuando ElevenLabs recibe una llamada, consulta este endpoint. Puedes responder con variables dinámicas, información del cliente, historial, etc. para personalizar el comportamiento del agente.'
  })
  @ApiHeader({ name: 'X-Webhook-Token', required: false, description: 'Token de autenticación del webhook' })
  async handleCallInit(
    @Body() payload: any,
    @Headers('x-webhook-token') token: string,
  ) {
    return this.webhooksService.handleCallInit(payload, token);
  }
}
