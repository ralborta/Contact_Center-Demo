import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CampaignJobStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CampaignsService } from './campaigns.service';

@ApiTags('Campañas salientes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('campaigns')
export class CampaignsController {
  constructor(private campaigns: CampaignsService) {}

  @Get()
  list() {
    return this.campaigns.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.campaigns.get(id);
  }

  @Post('reminders')
  reminders(@Body() body: { hoursAhead?: number }) {
    return this.campaigns.createReminderCampaign(body.hoursAhead ?? 24);
  }

  @Post('confirmations')
  confirmations(@Body() body: { appointmentIds: string[] }) {
    return this.campaigns.createConfirmationCampaign(body.appointmentIds || []);
  }

  @Post(':id/start')
  start(@Param('id') id: string) {
    return this.campaigns.markRunning(id);
  }

  @Post(':id/complete')
  complete(@Param('id') id: string) {
    return this.campaigns.markCompleted(id);
  }

  @Patch('jobs/:jobId')
  updateJob(
    @Param('jobId') jobId: string,
    @Body() body: { status: CampaignJobStatus; notes?: string },
  ) {
    return this.campaigns.updateJobStatus(jobId, body.status, body.notes);
  }
}
