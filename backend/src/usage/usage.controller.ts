import { Controller, Get, Param } from '@nestjs/common';
import { UsageService } from './usage.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('api/usage')
export class UsageController {
  constructor(private readonly usage: UsageService) {}

  /** All usage-metric reports across all workspaces */
  @Public()
  @Get('reports')
  listReports() {
    return this.usage.listUsageReports();
  }

  /** Workspace members + roles */
  @Public()
  @Get('workspace/:groupId/users')
  getWorkspaceUsers(@Param('groupId') groupId: string) {
    return this.usage.getWorkspaceUsers(groupId);
  }

  /** Usage analytics from the dataset behind a usage-metric report */
  @Public()
  @Get('analytics/:groupId/:datasetId')
  getAnalytics(
    @Param('groupId') groupId: string,
    @Param('datasetId') datasetId: string,
  ) {
    return this.usage.getUsageAnalytics(groupId, datasetId);
  }
}
