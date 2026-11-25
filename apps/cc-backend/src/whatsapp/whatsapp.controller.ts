import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WhatsappChatStatus, WhatsappSendMode } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { WhatsappService } from './whatsapp.service';

@ApiTags('WhatsApp')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('whatsapp')
export class WhatsappController {
  constructor(private whatsapp: WhatsappService) {}

  @Get('config')
  @ApiOperation({ summary: 'Configuración de confirmaciones WhatsApp' })
  getConfig() {
    return this.whatsapp.getConfig();
  }

  @Patch('config')
  @ApiOperation({ summary: 'Actualizar configuración de confirmaciones' })
  updateConfig(
    @Body()
    body: {
      enabled?: boolean;
      mode?: WhatsappSendMode;
      hoursBefore?: number;
      dayBeforeTime?: string;
      intervalMinutes?: number;
      sendWindowStart?: string;
      sendWindowEnd?: string;
      messageTemplate?: string;
      provider?: string;
    },
  ) {
    return this.whatsapp.updateConfig(body);
  }

  @Get('metrics')
  metrics() {
    return this.whatsapp.metrics();
  }

  @Get('conversations')
  list(@Query('status') status?: WhatsappChatStatus) {
    return this.whatsapp.listConversations(status);
  }

  @Get('conversations/:id')
  get(@Param('id') id: string) {
    return this.whatsapp.getConversation(id);
  }

  @Get('conversations/:id/options')
  options(@Param('id') id: string) {
    return this.whatsapp.getRescheduleOptions(id);
  }

  @Post('conversations/:id/simulate-reply')
  @ApiOperation({
    summary: 'Simular respuesta del paciente (confirmar / cancelar / cambiar)',
  })
  simulate(
    @Param('id') id: string,
    @Body() body: { action: 'confirm' | 'cancel' | 'reschedule'; newSlotId?: string },
  ) {
    return this.whatsapp.simulatePatientReply({
      conversationId: id,
      action: body.action,
      newSlotId: body.newSlotId,
    });
  }

  @Post('run-now')
  @ApiOperation({ summary: 'Ejecutar el proceso de envíos ahora (demo)' })
  runNow() {
    return this.whatsapp.runSchedulerPass(true);
  }

  @Post('seed-demo')
  @ApiOperation({ summary: 'Sembrar conversaciones demo (idempotente)' })
  seedDemo() {
    return this.whatsapp.seedDemoConversations();
  }

  @Post('doctor/cancel')
  @ApiOperation({
    summary: 'Cancelar cita por doctor y avisar por WhatsApp con alternativas',
  })
  doctorCancel(
    @Body() body: { appointmentId: string; reason: string },
    @CurrentUser() user: any,
  ) {
    return this.whatsapp.doctorCancelWithNotice({
      appointmentId: body.appointmentId,
      reason: body.reason || 'Cambio de agenda del doctor',
      actorId: user?.id,
    });
  }

  @Post('doctor/reschedule')
  @ApiOperation({
    summary: 'Pedir reprogramación por doctor y ofrecer alternativas por WhatsApp',
  })
  doctorReschedule(
    @Body() body: { appointmentId: string; reason: string },
    @CurrentUser() user: any,
  ) {
    return this.whatsapp.doctorRescheduleWithNotice({
      appointmentId: body.appointmentId,
      reason: body.reason || 'El doctor necesita cambiar el horario',
      actorId: user?.id,
    });
  }
}
