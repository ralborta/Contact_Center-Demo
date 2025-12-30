import * as twilio from 'twilio';

export class TwilioAdapter {
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly fromNumber: string;
  private readonly webhookToken: string;
  private client: twilio.Twilio;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || '';
    this.authToken = process.env.TWILIO_AUTH_TOKEN || '';
    this.fromNumber = process.env.TWILIO_FROM_NUMBER || '';
    this.webhookToken = process.env.TWILIO_WEBHOOK_TOKEN || '';

    if (this.accountSid && this.authToken) {
      this.client = twilio(this.accountSid, this.authToken);
    }
  }

  verifyToken(token: string): boolean {
    return token === this.webhookToken;
  }

  normalizeStatusPayload(payload: any): {
    messageSid: string;
    status: string;
    errorCode?: string;
    errorMessage?: string;
  } {
    return {
      messageSid: payload.MessageSid || payload.message_sid || payload.SmsSid || payload.sms_sid || '',
      status: payload.MessageStatus || payload.message_status || payload.Status || payload.status || 'unknown',
      errorCode: payload.ErrorCode || payload.error_code,
      errorMessage: payload.ErrorMessage || payload.error_message,
    };
  }

  async sendSms(to: string, body: string): Promise<{ providerMessageId: string }> {
    if (!this.client) {
      throw new Error('Twilio client not initialized');
    }

    const message = await this.client.messages.create({
      body,
      from: this.fromNumber,
      to,
    });

    return {
      providerMessageId: message.sid,
    };
  }
}
