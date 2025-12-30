import { IsString, IsEnum, IsOptional, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OtpPurpose } from '@prisma/client';

export class CreateOtpDto {
  @ApiProperty({ description: 'Número de teléfono' })
  @IsString()
  phone: string;

  @ApiProperty({ enum: OtpPurpose, description: 'Propósito del OTP' })
  @IsEnum(OtpPurpose)
  purpose: OtpPurpose;

  @ApiProperty({ description: 'ID de correlación único' })
  @IsString()
  correlationId: string;

  @ApiProperty({ description: 'Datos adicionales para template', required: false })
  @IsOptional()
  @IsObject()
  templateData?: Record<string, any>;
}
