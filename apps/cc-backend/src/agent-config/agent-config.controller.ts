import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AgentConfigService } from './agent-config.service';

@ApiTags('Configuración agente')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('agent-config')
export class AgentConfigController {
  constructor(private config: AgentConfigService) {}

  @Get()
  get() {
    return this.config.get();
  }

  @Patch()
  @Roles('ADMIN')
  update(@Body() body: any) {
    // Nunca devolver ni aceptar secretos en este endpoint
    const {
      hospitalName,
      greeting,
      businessHoursStart,
      businessHoursEnd,
      transferMessage,
      closedMessage,
      transferEnabled,
    } = body;
    return this.config.update({
      hospitalName,
      greeting,
      businessHoursStart,
      businessHoursEnd,
      transferMessage,
      closedMessage,
      transferEnabled,
    });
  }
}
