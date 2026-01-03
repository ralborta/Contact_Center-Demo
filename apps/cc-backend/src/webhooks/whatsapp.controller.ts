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

  /**
   * Normaliza un número de teléfono al formato usado en providerConversationId
   * Remueve espacios, guiones, paréntesis, etc.
   */
  private normalizePhoneNumber(phone: string): string {
    // Remover todos los espacios, guiones, paréntesis y otros caracteres
    let normalized = phone.replace(/[\s\-\(\)\.]/g, '');
    
    // Si no tiene +, agregarlo (asumiendo que es un número internacional)
    if (!normalized.startsWith('+')) {
      // Si empieza con 54 (Argentina), agregar +
      if (normalized.startsWith('54')) {
        normalized = '+' + normalized;
      } else {
        // Por defecto, agregar +54 para Argentina
        normalized = '+54' + normalized;
      }
    }
    
    return normalized;
  }

  @Post('send')
  @ApiOperation({ summary: 'Enviar mensaje WhatsApp vía builderbot' })
  async sendMessage(
    @Body() body: { providerConversationId?: string; to: string; text: string; assignedAgent?: string },
  ) {
    // Normalizar el número de teléfono para que coincida con el formato usado en los mensajes entrantes
    const normalizedTo = this.normalizePhoneNumber(body.to);
    // Si no se proporciona providerConversationId, usar el número normalizado
    const providerConversationId = body.providerConversationId || normalizedTo;

    this.logger.log(`📤 Enviando mensaje WhatsApp a ${body.to} (normalized: ${normalizedTo}, conversationId: ${providerConversationId})`);

    // Enviar mensaje vía BuilderBot
    const result = await this.builderBotAdapter.sendMessage(
      providerConversationId,
      normalizedTo,
      body.text,
    );

    // Buscar interacción existente usando providerConversationId normalizado
    // Esto agrupa todos los mensajes (INBOUND y OUTBOUND) en la misma conversación
    let interaction = await this.prisma.interaction.findUnique({
      where: {
        provider_providerConversationId: {
          provider: Provider.BUILDERBOT,
          providerConversationId: providerConversationId,
        },
      },
    });

    // Si no se encuentra, intentar buscar por el número normalizado sin el +
    if (!interaction && providerConversationId.startsWith('+')) {
      const withoutPlus = providerConversationId.substring(1);
      interaction = await this.prisma.interaction.findUnique({
        where: {
          provider_providerConversationId: {
            provider: Provider.BUILDERBOT,
            providerConversationId: withoutPlus,
          },
        },
      });
      
      // Si se encuentra con el formato sin +, actualizar para usar el formato con +
      if (interaction) {
        this.logger.log(`⚠️ Encontrada interacción con formato sin +, actualizando providerConversationId`);
        interaction = await this.prisma.interaction.update({
          where: { id: interaction.id },
          data: {
            providerConversationId: providerConversationId,
          },
        });
      }
    }

    // Si no existe, crear una nueva interacción
    if (!interaction) {
      this.logger.log(`📝 Creando nueva interacción para ${providerConversationId}`);
      interaction = await this.interactionsService.upsertInteraction({
        channel: Channel.WHATSAPP,
        direction: Direction.OUTBOUND, // Primera interacción es OUTBOUND si no hay historial
        provider: Provider.BUILDERBOT,
        providerConversationId: providerConversationId,
        from: 'system',
        to: normalizedTo,
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
    const message = await this.interactionsService.createMessage({
      interactionId: interaction.id,
      channel: Channel.WHATSAPP,
      direction: Direction.OUTBOUND,
      providerMessageId: result.messageId,
      text: body.text,
      sentAt: new Date(),
    });

    this.logger.log(`💬 Mensaje OUTBOUND guardado: MessageId=${message.id}, InteractionId=${interaction.id}, Direction=${Direction.OUTBOUND}, Text="${body.text.substring(0, 50)}..."`);
    this.logger.log(`📊 Estado actual de la interacción: providerConversationId=${providerConversationId}, normalizedTo=${normalizedTo}`);

    // Verificar que el mensaje se guardó correctamente y contar mensajes en la interacción
    const messageCount = await this.prisma.message.count({
      where: { interactionId: interaction.id },
    });
    
    const inboundCount = await this.prisma.message.count({
      where: { 
        interactionId: interaction.id,
        direction: Direction.INBOUND,
      },
    });
    
    const outboundCount = await this.prisma.message.count({
      where: { 
        interactionId: interaction.id,
        direction: Direction.OUTBOUND,
      },
    });
    
    this.logger.log(`✅ Verificación: Interaction ${interaction.id} tiene ${messageCount} mensajes totales (INBOUND: ${inboundCount}, OUTBOUND: ${outboundCount})`);

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
