import twilio from 'twilio';

export class TwilioAdapter {
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly fromNumber: string;
  private readonly webhookToken: string;
  private client: twilio.Twilio;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || '';
    this.authToken = process.env.TWILIO_AUTH_TOKEN || '';
    const fromNumberRaw = process.env.TWILIO_FROM_NUMBER || '';
    this.fromNumber = this.normalizePhoneNumber(fromNumberRaw);
    this.webhookToken = process.env.TWILIO_WEBHOOK_TOKEN || '';

    if (this.accountSid && this.authToken) {
      this.client = twilio(this.accountSid, this.authToken);
      console.log('[Twilio] Cliente inicializado:', {
        accountSid: this.accountSid.substring(0, 8) + '...',
        fromNumber: this.fromNumber,
      });
    } else {
      console.warn('[Twilio] ⚠️ Cliente NO inicializado - faltan credenciales');
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

  /**
   * Normaliza un número de teléfono al formato E.164 (internacional sin espacios)
   * Ejemplo: "+54 11 3456 7890" -> "+541134567890"
   */
  private normalizePhoneNumber(phone: string): string {
    // Remover todos los espacios, guiones, paréntesis y otros caracteres
    let normalized = phone.replace(/[\s\-\(\)\.]/g, '');
    
    // Asegurar que empiece con +
    if (!normalized.startsWith('+')) {
      // Si no tiene +, asumir que es un número local y agregar código de país
      // Por defecto, si no tiene +, agregar +54 (Argentina)
      normalized = '+54' + normalized;
    }
    
    return normalized;
  }

  async sendSms(to: string, body: string): Promise<{ providerMessageId: string }> {
    if (!this.client) {
      throw new Error('Twilio client not initialized. Verifica TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN');
    }

    if (!this.fromNumber) {
      throw new Error('TWILIO_FROM_NUMBER no configurado');
    }

    // Normalizar el número de teléfono
    const normalizedTo = this.normalizePhoneNumber(to);

    try {
      console.log('[Twilio] Enviando SMS:', {
        toOriginal: to,
        toNormalized: normalizedTo,
        from: this.fromNumber,
        bodyLength: body.length,
        bodyPreview: body.substring(0, 50) + (body.length > 50 ? '...' : ''),
      });

      const message = await this.client.messages.create({
        body,
        from: this.fromNumber,
        to: normalizedTo,
      });

      console.log('[Twilio] ✅ SMS enviado exitosamente:', {
        messageSid: message.sid,
        status: message.status,
        to: normalizedTo,
        price: message.price,
        priceUnit: message.priceUnit,
      });

      return {
        providerMessageId: message.sid,
      };
    } catch (error: any) {
      console.error('[Twilio] ❌ Error al enviar SMS:', {
        toOriginal: to,
        toNormalized: normalizedTo,
        from: this.fromNumber,
        error: error.message,
        code: error.code,
        status: error.status,
        moreInfo: error.moreInfo,
      });

      // Errores específicos de Twilio
      if (error.code === 21211) {
        throw new Error(`Número de teléfono inválido: ${to}. Verifica que el número esté en formato internacional (ej: +541234567890)`);
      }
      
      if (error.code === 21610) {
        throw new Error(`No se puede enviar SMS a este número. Si estás en modo trial de Twilio, solo puedes enviar a números verificados.`);
      }

      if (error.code === 21614) {
        throw new Error(`El número ${to} no es un número móvil válido. Twilio solo puede enviar SMS a números móviles.`);
      }

      if (error.status === 400) {
        throw new Error(`Error de validación de Twilio: ${error.message}. Verifica el formato del número y que tu cuenta tenga crédito.`);
      }

      throw new Error(`Error al enviar SMS vía Twilio: ${error.message}${error.code ? ` (Código: ${error.code})` : ''}`);
    }
  }
}
