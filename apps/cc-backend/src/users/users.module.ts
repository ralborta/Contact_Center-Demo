import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { ProfilesService } from './profiles.service';
import { ProfilesController } from './profiles.controller';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController, ProfilesController],
  providers: [UsersService, ProfilesService],
  exports: [UsersService, ProfilesService],
})
export class UsersModule {}
