import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
  @ApiProperty({ description: 'ID de correlación' })
  @IsString()
  @IsNotEmpty()
  correlationId: string;

  @ApiProperty({ description: 'Código OTP de 6 dígitos' })
  @IsString()
  @IsNotEmpty()
  otp: string;
}
