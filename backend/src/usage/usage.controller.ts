import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { UsageService } from './usage.service';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller('api/usage')
@UseGuards(AuthGuard)
export class UsageController {
  constructor(private readonly usage: UsageService) {}

  /** All usage-metric reports across all workspaces */
  @Get('reports')
  listReports() {
    return this.usage.listUsageReports();
  }

  /** Workspace members + roles */
  @Get('workspace/:groupId/users')
  getWorkspaceUsers(@Param('groupId') groupId: string) {
    return this.usage.getWorkspaceUsers(groupId);
  }

  /** Usage analytics from the dataset behind a usage-metric report */
  @Get('analytics/:groupId/:datasetId')
  getAnalytics(
    @Param('groupId') groupId: string,
    @Param('datasetId') datasetId: string,
  ) {
    return this.usage.getUsageAnalytics(groupId, datasetId);
  }
}
