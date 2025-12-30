import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InteractionsService } from '../interactions/interactions.service';
import { AuditService } from '../audit/audit.service';
import { BuilderBotAdapter } from '../adapters/builderbot.adapter';
import { Channel, Direction, InteractionStatus, Provider } from '@prisma/client';

@ApiTags('WhatsApp')
@Controller('whatsapp')
export class WhatsAppController {
  private builderBotAdapter: BuilderBotAdapter;

  constructor(
    private interactionsService: InteractionsService,
    private auditService: AuditService,
  ) {
    this.builderBotAdapter = new BuilderBotAdapter();
  }

  @Post('send')
  @ApiOperation({ summary: 'Enviar mensaje WhatsApp vía builderbot' })
  async sendMessage(
    @Body() body: { providerConversationId: string; to: string; text: string },
  ) {
    const result = await this.builderBotAdapter.sendMessage(
      body.providerConversationId,
      body.to,
      body.text,
    );

    // Buscar o crear Interaction
    const interaction = await this.interactionsService.upsertInteraction({
      channel: Channel.WHATSAPP,
      direction: Direction.OUTBOUND,
      provider: Provider.BUILDERBOT,
      providerConversationId: body.providerConversationId,
      from: 'system',
      to: body.to,
      status: InteractionStatus.IN_PROGRESS,
    });

    // Crear Message
    await this.interactionsService.createMessage({
      interactionId: interaction.id,
      channel: Channel.WHATSAPP,
      direction: Direction.OUTBOUND,
      providerMessageId: result.messageId,
      text: body.text,
      sentAt: new Date(),
    });

    // Audit log
    await this.auditService.log({
      actorType: 'SYSTEM',
      action: 'wa.send',
      entityType: 'Interaction',
      entityId: interaction.id,
      metadata: { messageId: result.messageId },
    });

    return { success: true, messageId: result.messageId };
  }
}
