import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SpecialtiesService } from './specialties.service';

@ApiTags('Especialidades')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('specialties')
export class SpecialtiesController {
  constructor(private specialties: SpecialtiesService) {}

  @Get()
  list() {
    return this.specialties.list();
  }

  @Post()
  create(@Body() body: { code: string; name: string; description?: string }) {
    return this.specialties.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.specialties.update(id, body);
  }
}
