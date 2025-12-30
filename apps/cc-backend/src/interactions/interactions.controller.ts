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
  @ApiHeader({ name: 'X-Role', required: false })
  async findOne(
    @Param('id') id: string,
    @Query('includePII') includePII?: string,
    @Headers('x-role') role?: string,
  ) {
    const isAdmin = role === 'admin';
    const shouldMaskPII = process.env.PII_MASKING_ENABLED === 'true' && 
                         includePII !== 'true' && 
                         !isAdmin;

    const interaction = await this.interactionsService.findOne(id);

    if (!interaction) {
      return null;
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
}
