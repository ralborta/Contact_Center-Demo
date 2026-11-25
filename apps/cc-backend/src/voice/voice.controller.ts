import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VoiceService } from './voice.service';

@ApiTags('Voz / simulador')
@Controller('voice')
export class VoiceController {
  constructor(private voice: VoiceService) {}

  @Get('signed-url')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Signed URL para el simulador (no expone la API key)',
  })
  signedUrl() {
    return this.voice.getSignedUrl();
  }
}
