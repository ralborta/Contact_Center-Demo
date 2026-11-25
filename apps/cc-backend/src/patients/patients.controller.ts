import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PatientsService } from './patients.service';

@ApiTags('Pacientes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('patients')
export class PatientsController {
  constructor(private patients: PatientsService) {}

  @Get()
  list(@Query('q') q?: string) {
    return this.patients.list(q);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.patients.getById(id);
  }

  @Post()
  create(@Body() body: any) {
    return this.patients.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.patients.update(id, body);
  }
}
