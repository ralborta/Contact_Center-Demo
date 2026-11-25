import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AppointmentChannel,
  AppointmentStatus,
  ChangeOrigin,
} from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AppointmentsService } from './appointments.service';
import { AvailabilityService } from './availability.service';

@ApiTags('Citas (consola)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(
    private appointments: AppointmentsService,
    private availability: AvailabilityService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar citas' })
  list(
    @Query('status') status?: AppointmentStatus,
    @Query('doctorId') doctorId?: string,
    @Query('specialtyId') specialtyId?: string,
    @Query('patientId') patientId?: string,
    @Query('needsReschedule') needsReschedule?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.appointments.list({
      status,
      doctorId,
      specialtyId,
      patientId,
      needsReschedule:
        needsReschedule === 'true' ? true : needsReschedule === 'false' ? false : undefined,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Get('availability/search')
  @ApiOperation({ summary: 'Buscar slots libres (consola)' })
  searchAvailability(
    @Query('specialtyId') specialtyId?: string,
    @Query('doctorId') doctorId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('period') period?: 'morning' | 'afternoon' | 'any',
  ) {
    return this.availability.findAvailable({
      specialtyId,
      doctorId,
      from: from ? new Date(from) : new Date(),
      to: to ? new Date(to) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      period: period || 'any',
      limit: 40,
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.appointments.getById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear cita desde consola' })
  create(
    @Body() body: { patientId: string; slotId: string; reason?: string; notes?: string },
    @CurrentUser() user: any,
  ) {
    return this.appointments.reserve({
      patientId: body.patientId,
      slotId: body.slotId,
      channel: AppointmentChannel.CONSOLE,
      origin: ChangeOrigin.OPERATOR,
      actorId: user?.id,
      reason: body.reason,
      notes: body.notes,
    });
  }

  @Post('doctor/:doctorId/block')
  @ApiOperation({ summary: 'Bloquear agenda del doctor y cancelar afectados' })
  block(
    @Param('doctorId') doctorId: string,
    @Body() body: { from: string; to: string; reason: string },
    @CurrentUser() user: any,
  ) {
    return this.appointments.blockDoctorAgenda({
      doctorId,
      from: new Date(body.from),
      to: new Date(body.to),
      reason: body.reason,
      actorId: user?.id,
    });
  }

  @Post(':id/reschedule')
  reschedule(
    @Param('id') id: string,
    @Body() body: { newSlotId: string; reason?: string },
    @CurrentUser() user: any,
  ) {
    return this.appointments.reschedule({
      appointmentId: id,
      newSlotId: body.newSlotId,
      origin: ChangeOrigin.OPERATOR,
      actorId: user?.id,
      reason: body.reason,
    });
  }

  @Post(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() body: { reason?: string; byDoctor?: boolean; blockSlot?: boolean },
    @CurrentUser() user: any,
  ) {
    if (body.byDoctor) {
      return this.appointments.cancelByDoctor({
        appointmentId: id,
        actorId: user?.id,
        reason: body.reason || 'Cancelada por el doctor',
        blockSlot: body.blockSlot,
      });
    }
    return this.appointments.cancelByPatient({
      appointmentId: id,
      origin: ChangeOrigin.OPERATOR,
      actorId: user?.id,
      reason: body.reason,
    });
  }
}
