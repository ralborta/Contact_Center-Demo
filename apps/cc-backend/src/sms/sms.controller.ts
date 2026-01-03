import { Controller, Post, Body, Logger, BadRequestException } from '@nestjs/common';
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

    const result = await this.twilioAdapter.sendSms(body.to, body.message);

    // Buscar o crear Interaction
    const interaction = await this.interactionsService.upsertInteraction({
      channel: Channel.SMS,
      direction: Direction.OUTBOUND,
      provider: Provider.TWILIO,
      from: 'system',
      to: body.to,
      status: InteractionStatus.IN_PROGRESS,
      customerRef: body.customerRef,
    });

    // Crear Message
    await this.interactionsService.createMessage({
      interactionId: interaction.id,
      channel: Channel.SMS,
      direction: Direction.OUTBOUND,
      providerMessageId: result.providerMessageId,
      text: body.message,
      sentAt: new Date(),
    });

    // Audit log
    await this.auditService.log({
      actorType: 'SYSTEM',
      action: 'sms.send',
      entityType: 'Interaction',
      entityId: interaction.id,
      metadata: { messageId: result.providerMessageId, type: 'custom' },
    });

    this.logger.log(`✅ SMS enviado exitosamente: Interaction ${interaction.id}, MessageId: ${result.providerMessageId}`);

    return { success: true, messageId: result.providerMessageId, interactionId: interaction.id };
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

    const verificationToken = `verify-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const verificationUrl = `${process.env.FRONTEND_URL || 'https://tu-frontend.vercel.app'}/verify/${verificationToken}`;
    
    const message = `Hola! Para verificar tu identidad, hacé click en este enlace: ${verificationUrl}`;

    return this.sendSms({
      to: body.to,
      message,
      customerRef: body.customerRef,
    });
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

    const onboardingToken = `onboard-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const onboardingUrl = `${process.env.FRONTEND_URL || 'https://tu-frontend.vercel.app'}/onboarding/${onboardingToken}`;
    
    const message = `¡Bienvenido! Completá tu registro siguiendo este enlace: ${onboardingUrl}`;

    return this.sendSms({
      to: body.to,
      message,
      customerRef: body.customerRef,
    });
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

    const message = `Para activar tu tarjeta bancaria, llamá al 0800-XXX-XXXX o ingresá a www.tubanco.com.ar/activar-tarjeta`;

    return this.sendSms({
      to: body.to,
      message,
      customerRef: body.customerRef,
    });
  }
}
