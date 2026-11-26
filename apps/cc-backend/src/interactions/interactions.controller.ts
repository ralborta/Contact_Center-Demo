import {
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Direction, InteractionStatus } from '@prisma/client';
import { createReadStream } from 'fs';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { InteractionsService } from './interactions.service';
import { RecordingsService } from './recordings.service';

@ApiTags('Llamadas')
@ApiBearerAuth()
@Controller('interactions')
@UseGuards(JwtAuthGuard)
export class InteractionsController {
  constructor(
    private interactions: InteractionsService,
    private recordings: RecordingsService,
  ) {}

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

  @Post('recordings/backfill')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'Backfill idempotente: baja audios de ElevenLabs para CALL sin grabación',
  })
  backfillRecordings(@Query('limit') limit?: string) {
    return this.recordings.backfill(limit ? parseInt(limit, 10) : 200);
  }

  @Get(':id/recording')
  @ApiOperation({ summary: 'Reproducir / descargar grabación de la llamada' })
  async getRecording(
    @Param('id') id: string,
    @Headers('range') range: string | undefined,
    @Res({ passthrough: false }) res: Response,
  ) {
    const { stream, size, contentType, filePath } =
      await this.recordings.openRecordingStream(id);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="llamada-${id}.mp3"`,
    );

    if (range) {
      const m = /^bytes=(\d*)-(\d*)$/i.exec(range.trim());
      if (m) {
        const start = m[1] ? parseInt(m[1], 10) : 0;
        const end = m[2] ? parseInt(m[2], 10) : size - 1;
        if (
          !Number.isNaN(start) &&
          !Number.isNaN(end) &&
          start >= 0 &&
          end < size &&
          start <= end
        ) {
          const chunkSize = end - start + 1;
          res.status(206);
          res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
          res.setHeader('Content-Length', String(chunkSize));
          createReadStream(filePath, { start, end }).pipe(res);
          return;
        }
      }
    }

    res.setHeader('Content-Length', String(size));
    stream.pipe(res);
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
