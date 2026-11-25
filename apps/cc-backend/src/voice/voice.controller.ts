import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VoiceService } from './voice.service';

@ApiTags('Voz')
@Controller('voice')
export class VoiceController {
  constructor(private voice: VoiceService) {}

  @Get('signed-url')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Signed URL (operadores autenticados)' })
  signedUrl() {
    return this.voice.getSignedUrl();
  }

  @Get('public/session')
  @ApiOperation({
    summary: 'Sesión pública para la webapp del teléfono del paciente',
  })
  publicSession() {
    return this.voice.getPublicSession();
  }

  @Post('public/end-call')
  @ApiOperation({
    summary:
      'Al colgar: sincroniza la conversación desde ElevenLabs y registra la llamada',
  })
  endCall(
    @Body()
    body: {
      conversationId: string;
      callerPhone?: string;
      durationSec?: number;
    },
  ) {
    return this.voice.syncFromConversation({
      conversationId: body.conversationId,
      callerPhone: body.callerPhone,
      durationSec: body.durationSec,
    });
  }
}
