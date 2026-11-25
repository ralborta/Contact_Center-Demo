import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class VoiceService {
  constructor(private config: ConfigService) {}

  async getSignedUrl() {
    const apiKey = this.config.get<string>('ELEVENLABS_API_KEY');
    const agentId =
      this.config.get<string>('ELEVENLABS_AGENT_ID') ||
      'agent_8301m89vh2zsf3jrcs1h3ej36nk2';
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'ELEVENLABS_API_KEY no configurada en el servidor',
      );
    }
    const url = new URL('https://api.elevenlabs.io/v1/convai/conversation/get-signed-url');
    url.searchParams.set('agent_id', agentId);
    const res = await fetch(url.toString(), {
      headers: { 'xi-api-key': apiKey },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new ServiceUnavailableException(
        `No se pudo obtener signed URL (${res.status}): ${text.slice(0, 200)}`,
      );
    }
    const data = (await res.json()) as { signed_url?: string };
    return {
      signedUrl: data.signed_url,
      agentId,
      defaultCallerPhone:
        this.config.get<string>('SIMULATOR_CALLER_PHONE') || '59170111222',
      hospitalName: 'Hospital Central La Paz',
    };
  }
}
