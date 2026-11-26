/**
 * Capa de envío WhatsApp.
 * Por defecto: simulado (no sale a la red).
 * Más adelante se puede enchufar BuilderBot u otro proveedor real.
 */
export type WhatsappSendPayload = {
  to: string;
  body: string;
  conversationId: string;
  appointmentId?: string | null;
};

export type WhatsappSendResult = {
  ok: boolean;
  provider: string;
  providerMessageId?: string;
  simulated: boolean;
};

export interface WhatsappProvider {
  readonly name: string;
  send(payload: WhatsappSendPayload): Promise<WhatsappSendResult>;
}

export class SimulatedWhatsappProvider implements WhatsappProvider {
  readonly name = 'simulated';

  async send(payload: WhatsappSendPayload): Promise<WhatsappSendResult> {
    return {
      ok: true,
      provider: this.name,
      providerMessageId: `sim_${payload.conversationId}_${Date.now()}`,
      simulated: true,
    };
  }
}

export function resolveWhatsappProvider(name?: string): WhatsappProvider {
  const key = String(name || 'simulated').toLowerCase();
  // Futuro: if (key === 'builderbot') return new BuilderBotWhatsappProvider(...)
  void key;
  return new SimulatedWhatsappProvider();
}
