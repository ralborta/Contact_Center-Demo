export class BuilderBotAdapter {
  private readonly webhookToken: string;
  private readonly apiBaseUrl: string;
  private readonly apiKey: string;
  private readonly botId: string;

  constructor() {
    this.webhookToken = process.env.BUILDERBOT_WEBHOOK_TOKEN || '';
    this.apiBaseUrl = process.env.BUILDERBOT_BASE_URL || 'https://app.builderbot.cloud';
    this.apiKey = process.env.BUILDERBOT_API_KEY || '';
    this.botId = process.env.BUILDERBOT_BOT_ID || '';
  }

  verifyToken(token: string): boolean {
    return token === this.webhookToken;
  }

  normalizePayload(payload: any): {
    messageId?: string;
    threadId?: string;
    conversationId?: string;
    from?: string;
    to?: string;
    text?: string;
    mediaUrl?: string;
    timestamp?: Date;
  } {
    const normalized: any = {};

    // IDs
    normalized.messageId = payload.message_id || payload.id || payload.messageId;
    normalized.threadId = payload.thread_id || payload.threadId || payload.conversation?.id;
    normalized.conversationId = payload.conversation_id || payload.conversationId || payload.chat?.id;

    // From/To
    normalized.from = payload.from || payload.phone || payload.phone_number || payload.wa_id;
    normalized.to = payload.to || payload.destination || payload.recipient || 'unknown';

    // Content
    normalized.text = payload.text || payload.body || payload.message?.text || payload.content;
    normalized.mediaUrl = payload.media_url || payload.mediaUrl || payload.media?.url || payload.attachment?.url;

    // Timestamp
    if (payload.timestamp || payload.created_at || payload.date) {
      normalized.timestamp = new Date(payload.timestamp || payload.created_at || payload.date);
    } else {
      normalized.timestamp = new Date();
    }

    return normalized;
  }

  /**
   * Enviar mensaje via BuilderBot.cloud API v2
   * Docs: https://app.builderbot.cloud/api/v2/{botId}/messages
   */
  async sendMessage(conversationId: string, to: string, text: string, mediaUrl?: string): Promise<{ success: boolean; messageId?: string }> {
    if (!this.apiKey || !this.botId) {
      throw new Error('BuilderBot API not configured (BUILDERBOT_API_KEY and BUILDERBOT_BOT_ID required)');
    }

    const url = `${this.apiBaseUrl}/api/v2/${this.botId}/messages`;

    const body: Record<string, any> = {
      messages: {
        content: text,
      },
      number: to,
      checkIfExists: false,
    };

    if (mediaUrl) {
      body.messages.mediaUrl = mediaUrl;
    }

    try {
      console.log('[BuilderBot] Enviando mensaje:', {
        url,
        number: to,
        messageLength: text.length,
        hasMediaUrl: !!mediaUrl,
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-builderbot': this.apiKey,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`BuilderBot API error (${response.status}): ${errorText}`);
      }

      const data: any = await response.json();
      console.log('[BuilderBot] ✅ Mensaje enviado exitosamente');
      
      return {
        success: true,
        messageId: data.message_id || data.id || `bb-${Date.now()}`,
      };
    } catch (error: any) {
      console.error('[BuilderBot] ❌ Error al enviar mensaje:', error.message);
      throw new Error(`Failed to send message via BuilderBot: ${error.message}`);
    }
  }
}
