import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AISummaryResponse {
  summary: string;
  keyPoints: string[];
  suggestedActions: string[];
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  generatedAt: string;
}

@Injectable()
export class AISummaryService {
  constructor(private prisma: PrismaService) {}

  /**
   * Genera un resumen inteligente de todas las interacciones de un cliente usando IA
   */
  async generateClientSummary(phone: string): Promise<AISummaryResponse> {
    // Obtener todas las interacciones del cliente
    const normalizedPhone = this.normalizePhoneForSearch(phone);
    
    const interactions = await this.prisma.interaction.findMany({
      where: {
        OR: [
          { from: { contains: normalizedPhone } },
          { to: { contains: normalizedPhone } },
          { providerConversationId: { contains: normalizedPhone } },
        ],
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        callDetail: true,
      },
      orderBy: { startedAt: 'desc' },
    });

    if (interactions.length === 0) {
      return {
        summary: 'No hay interacciones registradas para este cliente.',
        keyPoints: [],
        suggestedActions: ['Iniciar contacto con el cliente'],
        sentiment: 'NEUTRAL',
        generatedAt: new Date().toISOString(),
      };
    }

    // Preparar contexto para la IA
    const context = this.prepareContext(interactions);

    // Generar resumen usando OpenAI o servicio de IA
    try {
      const aiResponse = await this.callAI(context);
      return {
        ...aiResponse,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[AISummaryService] Error generando resumen con IA:', error);
      // Fallback: generar resumen básico sin IA
      return this.generateFallbackSummary(interactions);
    }
  }

  /**
   * Prepara el contexto de todas las interacciones para enviar a la IA
   */
  private prepareContext(interactions: any[]): string {
    let context = `Resumen de interacciones del cliente:\n\n`;
    
    interactions.forEach((interaction, index) => {
      const date = new Date(interaction.startedAt || interaction.createdAt).toLocaleDateString('es-AR');
      const time = new Date(interaction.startedAt || interaction.createdAt).toLocaleTimeString('es-AR');
      
      context += `Interacción ${index + 1} (${date} ${time}):\n`;
      context += `- Canal: ${interaction.channel}\n`;
      context += `- Dirección: ${interaction.direction}\n`;
      context += `- Estado: ${interaction.status}\n`;
      context += `- Resultado: ${interaction.outcome || 'N/A'}\n`;
      
      if (interaction.intent) {
        context += `- Intención: ${interaction.intent}\n`;
      }
      
      if (interaction.assignedAgent) {
        context += `- Agente: ${interaction.assignedAgent}\n`;
      }

      // Mensajes de WhatsApp/SMS
      if (interaction.messages && interaction.messages.length > 0) {
        context += `- Mensajes (${interaction.messages.length}):\n`;
        interaction.messages.forEach((msg: any) => {
          const msgTime = new Date(msg.createdAt).toLocaleTimeString('es-AR');
          context += `  [${msgTime}] ${msg.direction === 'INBOUND' ? 'Cliente' : 'Sistema'}: ${msg.text || '(sin texto)'}\n`;
        });
      }

      // Detalles de llamada
      if (interaction.callDetail) {
        if (interaction.callDetail.transcriptText) {
          context += `- Transcripción: ${interaction.callDetail.transcriptText.substring(0, 500)}...\n`;
        }
        if (interaction.callDetail.summary) {
          context += `- Resumen: ${interaction.callDetail.summary}\n`;
        }
        if (interaction.callDetail.durationSec) {
          context += `- Duración: ${Math.floor(interaction.callDetail.durationSec / 60)}m ${interaction.callDetail.durationSec % 60}s\n`;
        }
      }

      context += '\n';
    });

    return context;
  }

  /**
   * Llama a la API de OpenAI para generar el resumen
   */
  private async callAI(context: string): Promise<Omit<AISummaryResponse, 'generatedAt'>> {
    const apiKey = process.env.OPENAI_API_KEY;
    const apiUrl = process.env.OPENAI_API_URL || 'https://api.openai.com/v1';

    if (!apiKey) {
      throw new Error('OPENAI_API_KEY no configurada');
    }

    const prompt = `Eres un asistente experto en análisis de interacciones de clientes en un banco. 
Analiza las siguientes interacciones y genera un resumen inteligente.

INSTRUCCIONES:
1. Genera un resumen ejecutivo de 2-3 párrafos que explique el contexto general de todas las interacciones
2. Identifica 3-5 puntos clave importantes
3. Sugiere 2-4 acciones concretas y específicas que el agente debería tomar
4. Determina el sentimiento general: POSITIVE, NEUTRAL, o NEGATIVE

Responde SOLO con un JSON válido en este formato exacto:
{
  "summary": "Resumen ejecutivo de 2-3 párrafos...",
  "keyPoints": ["Punto clave 1", "Punto clave 2", "Punto clave 3"],
  "suggestedActions": ["Acción 1", "Acción 2", "Acción 3"],
  "sentiment": "POSITIVE|NEUTRAL|NEGATIVE"
}

INTERACCIONES:
${context}`;

    try {
      const response = await fetch(`${apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Eres un experto en análisis de interacciones bancarias. Responde siempre con JSON válido.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 1500,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
      }

      const data: any = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No se recibió contenido de OpenAI');
      }

      // Parsear JSON de la respuesta
      const parsed = JSON.parse(content);

      return {
        summary: parsed.summary || 'No se pudo generar resumen',
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
        suggestedActions: Array.isArray(parsed.suggestedActions) ? parsed.suggestedActions : [],
        sentiment: ['POSITIVE', 'NEUTRAL', 'NEGATIVE'].includes(parsed.sentiment)
          ? parsed.sentiment
          : 'NEUTRAL',
      };
    } catch (error: any) {
      console.error('[AISummaryService] Error llamando a OpenAI:', error);
      throw error;
    }
  }

  /**
   * Genera un resumen básico sin IA como fallback
   */
  private generateFallbackSummary(interactions: any[]): AISummaryResponse {
    const totalInteractions = interactions.length;
    const calls = interactions.filter((i) => i.channel === 'CALL').length;
    const whatsapp = interactions.filter((i) => i.channel === 'WHATSAPP').length;
    const sms = interactions.filter((i) => i.channel === 'SMS').length;
    const resolved = interactions.filter((i) => i.outcome === 'RESOLVED').length;
    const lastInteraction = interactions[0];
    const lastDate = new Date(lastInteraction.startedAt || lastInteraction.createdAt);

    const daysSinceLast = Math.floor(
      (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const summary = `El cliente tiene un total de ${totalInteractions} interacciones registradas: ${calls} llamadas, ${whatsapp} conversaciones de WhatsApp y ${sms} SMS. ${resolved > 0 ? `Se han resuelto ${resolved} interacciones.` : 'No hay interacciones resueltas.'} La última interacción fue hace ${daysSinceLast} ${daysSinceLast === 1 ? 'día' : 'días'}.`;

    const keyPoints: string[] = [];
    if (totalInteractions > 0) {
      keyPoints.push(`Total de ${totalInteractions} interacciones registradas`);
    }
    if (resolved > 0) {
      keyPoints.push(`${resolved} interacciones resueltas`);
    }
    if (daysSinceLast > 7) {
      keyPoints.push(`Última interacción hace ${daysSinceLast} días`);
    }

    const suggestedActions: string[] = [];
    if (daysSinceLast > 7) {
      suggestedActions.push('Contactar al cliente para seguimiento');
    }
    if (resolved === 0 && totalInteractions > 0) {
      suggestedActions.push('Revisar interacciones pendientes');
    }
    suggestedActions.push('Continuar monitoreo de interacciones');

    return {
      summary,
      keyPoints,
      suggestedActions,
      sentiment: resolved > 0 ? 'POSITIVE' : 'NEUTRAL',
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Normaliza un número de teléfono para búsqueda
   */
  private normalizePhoneForSearch(phone: string): string {
    let normalized = decodeURIComponent(phone);
    normalized = normalized.replace(/[\s\-\(\)\.]/g, '');
    normalized = normalized.replace(/^\+/, '');
    return normalized;
  }
}
