export class BuilderBotAdapter {
  private readonly webhookToken: string;
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.webhookToken = process.env.BUILDERBOT_WEBHOOK_TOKEN || '';
    this.apiUrl = process.env.BUILDERBOT_API_URL || '';
    this.apiKey = process.env.BUILDERBOT_API_KEY || '';
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

  async sendMessage(conversationId: string, to: string, text: string): Promise<{ success: boolean; messageId?: string }> {
    if (!this.apiUrl || !this.apiKey) {
      throw new Error('BuilderBot API not configured');
    }

    try {
      const response = await fetch(`${this.apiUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          to,
          text,
        }),
      });

      if (!response.ok) {
        throw new Error(`BuilderBot API error: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        messageId: data.message_id || data.id,
      };
    } catch (error) {
      throw new Error(`Failed to send message via BuilderBot: ${error.message}`);
    }
  }
}
