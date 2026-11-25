import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DoctorStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DoctorsService } from './doctors.service';

@ApiTags('Doctores')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('doctors')
export class DoctorsController {
  constructor(private doctors: DoctorsService) {}

  @Get()
  list(@Query('specialtyId') specialtyId?: string) {
    return this.doctors.list(specialtyId);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.doctors.get(id);
  }

  @Post()
  create(@Body() body: any) {
    return this.doctors.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.doctors.update(id, body);
  }

  @Post(':id/schedules')
  schedules(@Param('id') id: string, @Body() body: { schedules: any[] }) {
    return this.doctors.setSchedules(id, body.schedules || []);
  }

  @Post(':id/exceptions')
  exception(@Param('id') id: string, @Body() body: any) {
    return this.doctors.addException({ ...body, doctorId: id });
  }

  @Get(':id/agenda')
  agenda(@Param('id') id: string, @Query('from') from: string, @Query('to') to: string) {
    const f = from || new Date().toISOString();
    const t = to || new Date(Date.now() + 7 * 86400000).toISOString();
    return this.doctors.agenda(id, f, t);
  }

  @Post(':id/generate-slots')
  generate(@Param('id') id: string, @Body() body: { weeks?: number }) {
    return this.doctors.generateSlots(id, body.weeks ?? 4);
  }

  @Patch(':id/status')
  status(@Param('id') id: string, @Body() body: { status: DoctorStatus }) {
    return this.doctors.setStatus(id, body.status);
  }
}
