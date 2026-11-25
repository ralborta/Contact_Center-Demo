import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AgentAuthGuard } from './agent-auth.guard';
import { AgentService } from './agent.service';

@ApiTags('Agente de voz')
@Controller('agent')
@UseGuards(AgentAuthGuard)
@ApiHeader({ name: 'X-Agent-Secret', required: true, description: 'Secreto compartido del agente' })
export class AgentController {
  constructor(private agent: AgentService) {}

  @Post('identificar-paciente')
  @ApiOperation({ summary: 'Identificar o registrar paciente (teléfono/CI)' })
  identify(@Body() body: any) {
    return this.agent.identifyPatient(body);
  }

  @Get('especialidades')
  @ApiOperation({ summary: 'Listar especialidades activas' })
  specialties() {
    return this.agent.listSpecialties();
  }

  @Post('buscar-doctores')
  @ApiOperation({ summary: 'Buscar doctores por especialidad o nombre' })
  doctors(@Body() body: any) {
    return this.agent.searchDoctors(body);
  }

  @Post('disponibilidad')
  @ApiOperation({ summary: 'Consultar horarios libres' })
  availability(@Body() body: any) {
    return this.agent.checkAvailability(body);
  }

  @Post('reservar')
  @ApiOperation({ summary: 'Reservar cita en un slot' })
  reserve(@Body() body: any) {
    return this.agent.reserve(body);
  }

  @Post('citas-paciente')
  @ApiOperation({ summary: 'Listar citas activas del paciente' })
  listAppts(@Body() body: any) {
    return this.agent.listPatientAppointments(body);
  }

  @Post('reprogramar')
  @ApiOperation({ summary: 'Reprogramar cita a otro slot' })
  reschedule(@Body() body: any) {
    return this.agent.reschedule(body);
  }

  @Post('cancelar')
  @ApiOperation({ summary: 'Cancelar cita (paciente)' })
  cancel(@Body() body: any) {
    return this.agent.cancel(body);
  }
}
