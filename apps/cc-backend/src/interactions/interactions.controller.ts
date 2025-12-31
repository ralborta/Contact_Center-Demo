import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiHeader } from '@nestjs/swagger';
import { InteractionsService } from './interactions.service';
import { PiiMasker } from '../adapters/pii-masker';
import { Channel, Direction, InteractionStatus } from '@prisma/client';

@ApiTags('Interactions')
@Controller('interactions')
export class InteractionsController {
  constructor(private interactionsService: InteractionsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar interacciones' })
  @ApiQuery({ name: 'channel', required: false, enum: Channel })
  @ApiQuery({ name: 'direction', required: false, enum: Direction })
  @ApiQuery({ name: 'status', required: false, enum: InteractionStatus })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'agent', required: false })
  @ApiQuery({ name: 'provider', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'includeAllEvents', required: false, type: Boolean })
  @ApiQuery({ name: 'includeAllMessages', required: false, type: Boolean })
  @ApiQuery({ name: 'includePII', required: false, type: Boolean })
  @ApiHeader({ name: 'X-Role', required: false })
  async findAll(
    @Query('channel') channel?: Channel,
    @Query('direction') direction?: Direction,
    @Query('status') status?: InteractionStatus,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('agent') agent?: string,
    @Query('provider') provider?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
    @Query('includeAllEvents') includeAllEvents?: string,
    @Query('includeAllMessages') includeAllMessages?: string,
    @Query('includePII') includePII?: string,
    @Headers('x-role') role?: string,
  ) {
    const isAdmin = role === 'admin';
    const shouldMaskPII = process.env.PII_MASKING_ENABLED === 'true' && 
                         includePII !== 'true' && 
                         !isAdmin;

    const interactions = await this.interactionsService.findAll({
      channel,
      direction,
      status,
      from,
      to,
      dateFrom,
      dateTo,
      agent,
      provider,
      limit: limit ? parseInt(limit) : undefined,
      skip: skip ? parseInt(skip) : undefined,
      includeAllEvents: includeAllEvents === 'true',
      includeAllMessages: includeAllMessages === 'true',
    });

    if (shouldMaskPII) {
      return interactions.map((interaction) => ({
        ...interaction,
        from: PiiMasker.maskPhone(interaction.from),
        to: PiiMasker.maskPhone(interaction.to),
      }));
    }

    return interactions;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de interacción' })
  @ApiQuery({ name: 'includePII', required: false, type: Boolean })
  @ApiQuery({ name: 'refreshDetails', required: false, type: Boolean })
  @ApiHeader({ name: 'X-Role', required: false })
  async findOne(
    @Param('id') id: string,
    @Query('includePII') includePII?: string,
    @Query('refreshDetails') refreshDetails?: string,
    @Headers('x-role') role?: string,
  ) {
    const isAdmin = role === 'admin';
    const shouldMaskPII = process.env.PII_MASKING_ENABLED === 'true' && 
                         includePII !== 'true' && 
                         !isAdmin;

    let interaction = await this.interactionsService.findOne(id);

    if (!interaction) {
      return null;
    }

    // Si se solicita refrescar detalles y es una llamada de ElevenLabs, obtener datos actualizados
    if (refreshDetails === 'true' && 
        interaction.provider === 'ELEVENLABS' && 
        interaction.callDetail?.elevenCallId) {
      try {
        await this.interactionsService.refreshCallDetails(
          interaction.id,
          interaction.callDetail.elevenCallId
        );
        // Recargar la interacción con los datos actualizados
        interaction = await this.interactionsService.findOne(id);
      } catch (error) {
        console.error('Error refreshing call details:', error);
        // Continuar con los datos existentes si falla
      }
    }

    if (shouldMaskPII) {
      return {
        ...interaction,
        from: PiiMasker.maskPhone(interaction.from),
        to: PiiMasker.maskPhone(interaction.to),
        messages: interaction.messages.map((msg) => ({
          ...msg,
          text: msg.text ? PiiMasker.maskPhone(msg.text) : msg.text,
        })),
      };
    }

    return interaction;
  }

  @Get('count')
  @ApiOperation({ summary: 'Contar interacciones' })
  @ApiQuery({ name: 'channel', required: false, enum: Channel })
  @ApiQuery({ name: 'direction', required: false, enum: Direction })
  @ApiQuery({ name: 'status', required: false, enum: InteractionStatus })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'agent', required: false })
  @ApiQuery({ name: 'provider', required: false })
  async count(
    @Query('channel') channel?: Channel,
    @Query('direction') direction?: Direction,
    @Query('status') status?: InteractionStatus,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('agent') agent?: string,
    @Query('provider') provider?: string,
  ) {
    const count = await this.interactionsService.count({
      channel,
      direction,
      status,
      from,
      to,
      dateFrom,
      dateTo,
      agent,
      provider,
    });

    return { count };
  }
}
