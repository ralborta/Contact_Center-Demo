import {
  Controller,
  Delete,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Direction, InteractionStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { InteractionsService } from './interactions.service';

@ApiTags('Llamadas')
@ApiBearerAuth()
@Controller('interactions')
@UseGuards(JwtAuthGuard)
export class InteractionsController {
  constructor(private interactions: InteractionsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar llamadas' })
  findAll(
    @Query('direction') direction?: Direction,
    @Query('status') status?: InteractionStatus,
    @Query('from') from?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    return this.interactions.findAll({
      direction,
      status,
      from,
      dateFrom,
      dateTo,
      limit: limit ? parseInt(limit, 10) : undefined,
      skip: skip ? parseInt(skip, 10) : undefined,
    });
  }

  @Get('metrics')
  metrics() {
    return this.interactions.getMetrics();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.interactions.findOne(id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.interactions.delete(id);
  }
}
