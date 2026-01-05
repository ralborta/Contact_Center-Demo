import { Controller, Post, Body, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InteractionsService } from '../interactions/interactions.service';
import { AuditService } from '../audit/audit.service';
import { TwilioAdapter } from '../adapters/twilio.adapter';
import { OtpService } from '../otp/otp.service';
import { Channel, Direction, InteractionStatus, Provider, OtpPurpose } from '@prisma/client';

@ApiTags('SMS')
@Controller('sms')
export class SmsController {
  private readonly logger = new Logger(SmsController.name);
  private readonly twilioAdapter: TwilioAdapter;

  constructor(
    private interactionsService: InteractionsService,
    private auditService: AuditService,
    private otpService: OtpService,
  ) {
    this.twilioAdapter = new TwilioAdapter();
  }

  @Post('send')
  @ApiOperation({ summary: 'Enviar SMS personalizado' })
  async sendSms(
    @Body() body: { to: string; message: string; customerRef?: string },
  ) {
    if (!body.to || !body.message) {
      throw new BadRequestException('to y message son requeridos');
    }

    this.logger.log(`📤 Enviando SMS personalizado a ${body.to}`);
    this.logger.log(`📋 Datos del SMS:`, {
      to: body.to,
      messageLength: body.message.length,
      customerRef: body.customerRef,
    });

    try {
      const result = await this.twilioAdapter.sendSms(body.to, body.message);
      this.logger.log(`✅ SMS enviado a Twilio: MessageId=${result.providerMessageId}`);

      // Buscar o crear Interaction
      this.logger.log(`💾 Creando/actualizando interacción SMS...`);
      let interaction;
      try {
        // Para SMS, usamos el número de teléfono como providerConversationId
        interaction = await this.interactionsService.upsertInteraction({
          channel: Channel.SMS,
          direction: Direction.OUTBOUND,
          provider: Provider.TWILIO,
          providerConversationId: body.to, // Usar el número como conversationId
          from: 'system',
          to: body.to,
          status: InteractionStatus.IN_PROGRESS,
          customerRef: body.customerRef,
        });
        this.logger.log(`✅ Interacción SMS creada/actualizada: ${interaction.id}`);
      } catch (error: any) {
        this.logger.error(`❌ ERROR creando/actualizando interacción SMS:`, error);
        this.logger.error(`❌ Stack trace:`, error.stack);
        throw error;
      }

      // Crear Message
      this.logger.log(`💬 Creando mensaje SMS...`);
      try {
        await this.interactionsService.createMessage({
          interactionId: interaction.id,
          channel: Channel.SMS,
          direction: Direction.OUTBOUND,
          providerMessageId: result.providerMessageId,
          text: body.message,
          sentAt: new Date(),
        });
        this.logger.log(`✅ Mensaje SMS creado exitosamente`);
      } catch (error: any) {
        this.logger.error(`❌ ERROR creando mensaje SMS:`, error);
        throw error;
      }

      // Audit log
      try {
        await this.auditService.log({
          actorType: 'SYSTEM',
          action: 'sms.send',
          entityType: 'Interaction',
          entityId: interaction.id,
          metadata: { messageId: result.providerMessageId, type: 'custom' },
        });
      } catch (error: any) {
        this.logger.error(`⚠️ Error en audit log (no crítico):`, error);
      }

      this.logger.log(`✅ SMS enviado exitosamente: Interaction ${interaction.id}, MessageId: ${result.providerMessageId}`);

      return { success: true, messageId: result.providerMessageId, interactionId: interaction.id };
    } catch (error: any) {
      this.logger.error(`❌ Error al enviar SMS a ${body.to}:`, error);
      
      // Verificar si es un error de configuración de Twilio
      if (error.message?.includes('Twilio client not initialized') || error.message?.includes('TWILIO_FROM_NUMBER')) {
        throw new InternalServerErrorException(
          'Twilio no está configurado correctamente. Verifica las variables de entorno: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER'
        );
      }

      throw new InternalServerErrorException(
        `Error al enviar SMS: ${error.message || 'Error desconocido'}`
      );
    }
  }

  @Post('otp')
  @ApiOperation({ summary: 'Enviar código OTP' })
  async sendOtp(
    @Body() body: { phone: string; purpose?: OtpPurpose; customerRef?: string },
  ) {
    if (!body.phone) {
      throw new BadRequestException('phone es requerido');
    }

    this.logger.log(`📤 Enviando código OTP a ${body.phone}`);

    const correlationId = `otp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const result = await this.otpService.createOtp({
      phone: body.phone,
      purpose: body.purpose || OtpPurpose.IDENTITY_VERIFICATION,
      correlationId,
    });

    this.logger.log(`✅ OTP creado y encolado: CorrelationId ${result.correlationId}, InteractionId ${result.interactionId}`);

    return {
      success: true,
      correlationId: result.correlationId,
      interactionId: result.interactionId,
    };
  }

  @Post('verification-link')
  @ApiOperation({ summary: 'Enviar link de verificación' })
  async sendVerificationLink(
    @Body() body: { to: string; customerRef?: string },
  ) {
    if (!body.to) {
      throw new BadRequestException('to es requerido');
    }

    this.logger.log(`📤 Enviando link de verificación a ${body.to}`);

    try {
      const verificationToken = `verify-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      // Link de prueba - puede ser cualquier URL de prueba
      const verificationUrl = `https://ejemplo.com/verificar/${verificationToken}`;
      
      const message = `Hola! Para verificar tu identidad, hacé click en este enlace: ${verificationUrl}`;

      this.logger.log(`📝 Mensaje generado: ${message.substring(0, 100)}...`);

      const result = await this.sendSms({
        to: body.to,
        message,
        customerRef: body.customerRef,
      });

      this.logger.log(`✅ Link de verificación enviado exitosamente`);
      return result;
    } catch (error: any) {
      this.logger.error(`❌ Error al enviar link de verificación a ${body.to}:`, error);
      this.logger.error(`❌ Stack trace:`, error.stack);
      
      // Si el error ya es una excepción HTTP, re-lanzarla
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
        throw error;
      }
      
      // Si no, crear una nueva excepción con el mensaje del error
      throw new InternalServerErrorException(
        `Error al enviar link de verificación: ${error.message || 'Error desconocido'}`
      );
    }
  }

  @Post('onboarding')
  @ApiOperation({ summary: 'Enviar link de onboarding' })
  async sendOnboardingLink(
    @Body() body: { to: string; customerRef?: string },
  ) {
    if (!body.to) {
      throw new BadRequestException('to es requerido');
    }

    this.logger.log(`📤 Enviando link de onboarding a ${body.to}`);

    try {
      const onboardingToken = `onboard-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const onboardingUrl = `${process.env.FRONTEND_URL || 'https://tu-frontend.vercel.app'}/onboarding/${onboardingToken}`;
      
      const message = `¡Bienvenido! Completá tu registro siguiendo este enlace: ${onboardingUrl}`;

      return await this.sendSms({
        to: body.to,
        message,
        customerRef: body.customerRef,
      });
    } catch (error: any) {
      this.logger.error(`❌ Error al enviar link de onboarding a ${body.to}:`, error);
      throw error; // Re-lanzar el error para que se maneje en el frontend
    }
  }

  @Post('activate-card')
  @ApiOperation({ summary: 'Enviar instructivo para activar tarjeta' })
  async sendActivateCard(
    @Body() body: { to: string; customerRef?: string },
  ) {
    if (!body.to) {
      throw new BadRequestException('to es requerido');
    }

    this.logger.log(`📤 Enviando instructivo de activación de tarjeta a ${body.to}`);

    try {
      const message = `Para activar tu tarjeta bancaria, llamá al 0800-XXX-XXXX o ingresá a www.tubanco.com.ar/activar-tarjeta`;

      return await this.sendSms({
        to: body.to,
        message,
        customerRef: body.customerRef,
      });
    } catch (error: any) {
      this.logger.error(`❌ Error al enviar instructivo de activación de tarjeta a ${body.to}:`, error);
      throw error; // Re-lanzar el error para que se maneje en el frontend
    }
  }
}
