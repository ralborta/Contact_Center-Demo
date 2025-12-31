import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { InteractionsService } from './interactions.service';
import { ElevenLabsAdapter } from '../adapters/elevenlabs.adapter';

@ApiTags('ElevenLabs')
@Controller('elevenlabs')
export class ElevenLabsController {
  private elevenLabsAdapter: ElevenLabsAdapter;

  constructor(private interactionsService: InteractionsService) {
    this.elevenLabsAdapter = new ElevenLabsAdapter();
  }

  @Get('conversations/:conversationId')
  @ApiOperation({ summary: 'Obtener transcripción y resumen de una conversación de ElevenLabs' })
  async getConversationDetails(@Param('conversationId') conversationId: string) {
    try {
      const details = await this.elevenLabsAdapter.fetchCallDetails(conversationId);
      
      return {
        success: true,
        conversationId,
        transcript: details.transcriptText,
        summary: details.summary,
        source: 'elevenlabs-api',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('audio/:conversationId')
  @ApiOperation({ summary: 'Obtener audio de una conversación de ElevenLabs' })
  async getAudio(
    @Param('conversationId') conversationId: string,
    @Res() res: Response,
  ) {
    try {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      const apiUrl = process.env.ELEVENLABS_API_URL || 'https://api.elevenlabs.io';

      if (!apiKey) {
        return res.status(500).json({ error: 'ELEVENLABS_API_KEY not configured' });
      }

      // Obtener audio desde ElevenLabs
      const audioResponse = await fetch(
        `${apiUrl}/v1/convai/conversations/${conversationId}/audio`,
        {
          headers: {
            'xi-api-key': apiKey,
            'Accept': 'audio/mpeg',
          },
        }
      );

      if (!audioResponse.ok) {
        return res.status(audioResponse.status).json({ error: 'Audio no disponible' });
      }

      const audioBuffer = await audioResponse.arrayBuffer();

      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', audioBuffer.byteLength.toString());
      res.setHeader('Cache-Control', 'private, max-age=3600');
      
      return res.send(Buffer.from(audioBuffer));
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}
