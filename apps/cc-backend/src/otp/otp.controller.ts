import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { OtpService } from './otp.service';
import { CreateOtpDto } from './dto/create-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@ApiTags('OTP')
@Controller('otp')
export class OtpController {
  constructor(private otpService: OtpService) {}

  @Post()
  @ApiOperation({ summary: 'Crear OTP challenge y encolar envío SMS' })
  async createOtp(@Body() dto: CreateOtpDto) {
    return this.otpService.createOtp(dto);
  }

  @Post('verify')
  @ApiOperation({ summary: 'Verificar código OTP' })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.otpService.verifyOtp(dto.correlationId, dto.otp);
  }
}
