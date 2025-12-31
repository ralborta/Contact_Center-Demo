import { Controller, Post, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SyncService } from './sync.service';

@ApiTags('Sync')
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('full')
  @ApiOperation({ summary: 'Ejecutar sincronización completa manual (últimas 24 horas)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Límite de conversaciones a sincronizar (default: 500)' })
  async syncFull(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 500;
    return this.syncService.syncFull(limitNum);
  }
}
