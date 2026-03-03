import { IsString, IsNotEmpty, MinLength, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'agente1' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;

  @ApiProperty({ example: 'uuid-del-perfil', description: 'ID del perfil (Profile)' })
  @IsUUID()
  @IsNotEmpty()
  profileId: string;

  @ApiPropertyOptional()
  @IsOptional()
  active?: boolean;
}
