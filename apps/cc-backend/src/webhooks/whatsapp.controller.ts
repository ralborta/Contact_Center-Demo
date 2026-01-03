import { Controller, Post, Body, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InteractionsService } from '../interactions/interactions.service';
import { AuditService } from '../audit/audit.service';
import { BuilderBotAdapter } from '../adapters/builderbot.adapter';
import { Channel, Direction, InteractionStatus, Provider } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('WhatsApp')
@Controller('whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);
  private builderBotAdapter: BuilderBotAdapter;

  constructor(
    private interactionsService: InteractionsService,
    private auditService: AuditService,
    private prisma: PrismaService,
  ) {
    this.builderBotAdapter = new BuilderBotAdapter();
  }

  @Post('send')
  @ApiOperation({ summary: 'Enviar mensaje WhatsApp vía builderbot' })
  async sendMessage(
    @Body() body: { providerConversationId: string; to: string; text: string; assignedAgent?: string },
  ) {
    this.logger.log(`📤 Enviando mensaje WhatsApp a ${body.to} (conversationId: ${body.providerConversationId})`);

    // Enviar mensaje vía BuilderBot
    const result = await this.builderBotAdapter.sendMessage(
      body.providerConversationId,
      body.to,
      body.text,
    );

    // Buscar interacción existente usando providerConversationId
    // Esto agrupa todos los mensajes (INBOUND y OUTBOUND) en la misma conversación
    let interaction = await this.prisma.interaction.findUnique({
      where: {
        provider_providerConversationId: {
          provider: Provider.BUILDERBOT,
          providerConversationId: body.providerConversationId,
        },
      },
    });

    // Si no existe, crear una nueva interacción
    if (!interaction) {
      this.logger.log(`📝 Creando nueva interacción para ${body.providerConversationId}`);
      interaction = await this.interactionsService.upsertInteraction({
        channel: Channel.WHATSAPP,
        direction: Direction.OUTBOUND, // Primera interacción es OUTBOUND si no hay historial
        provider: Provider.BUILDERBOT,
        providerConversationId: body.providerConversationId,
        from: 'system',
        to: body.to,
        status: InteractionStatus.IN_PROGRESS,
        assignedAgent: body.assignedAgent,
      });
    } else {
      // Si existe, actualizar el agente asignado si se proporciona
      if (body.assignedAgent) {
        interaction = await this.prisma.interaction.update({
          where: { id: interaction.id },
          data: {
            assignedAgent: body.assignedAgent,
            status: InteractionStatus.IN_PROGRESS,
            updatedAt: new Date(),
          },
        });
      }
      this.logger.log(`✅ Usando interacción existente: ${interaction.id}`);
    }

    // Crear Message OUTBOUND (del agente)
    await this.interactionsService.createMessage({
      interactionId: interaction.id,
      channel: Channel.WHATSAPP,
      direction: Direction.OUTBOUND,
      providerMessageId: result.messageId,
      text: body.text,
      sentAt: new Date(),
    });

    this.logger.log(`💬 Mensaje OUTBOUND guardado en Interaction ${interaction.id}`);

    // Audit log
    await this.auditService.log({
      actorType: 'AGENT',
      action: 'wa.send',
      entityType: 'Interaction',
      entityId: interaction.id,
      metadata: { messageId: result.messageId, agent: body.assignedAgent || 'system' },
    });

    return { success: true, messageId: result.messageId, interactionId: interaction.id };
  }
}
