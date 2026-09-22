import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { UsageService } from './usage.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller(['api/usage', 'usage'])
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

  /** Global aggregated dashboard stats */
  @Public()
  @Get('global-stats')
  getGlobalStats(@Query('filterGroupId') filterGroupId?: string) {
    return this.usage.getGlobalDashboardStats(filterGroupId);
  }

  /** Global all users stats */
  @Public()
  @Get('users')
  getAllUsersStats() {
    return this.usage.getAllUsersStats();
  }

  /** Raw user report access data export */
  @Public()
  @Get('raw-access')
  getRawAccess(@Query('groupId') groupId?: string) {
    return this.usage.getRawUserReportAccess(groupId);
  }

  /** Detailed breakdown for a specific user */
  @Public()
  @Get('users/:email')
  getUserDetails(@Param('email') email: string) {
    return this.usage.getUserDetails(email);
  }

  /** Multi-dimensional filtered analytics */
  @Public()
  @Get('dashboard-analytics')
  getDashboardAnalytics(
    @Query('groupId') groupId?: string,
    @Query('reportName') reportName?: string,
    @Query('email') email?: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('date') date?: string,
  ) {
    return this.usage.getDashboardAnalytics({
      groupId,
      reportName,
      email,
      year,
      month,
      date,
    });
  }

  /** Access Level & Inactive / Unused Access Audit */
  @Public()
  @Get('access-utilization')
  getAccessUtilization(
    @Query('groupId') groupId?: string,
    @Query('reportName') reportName?: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('date') date?: string,
  ) {
    return this.usage.getAccessUtilization(groupId, reportName, year, month, date);
  }

  /** Export multi-worksheet Excel workbook */
  @Public()
  @Get('export-excel')
  async exportExcel(
    @Res() res: Response,
    @Query('groupId') groupId?: string,
    @Query('reportName') reportName?: string,
    @Query('email') email?: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('date') date?: string,
  ) {
    const buffer = await this.usage.exportUsageExcelSheets({
      groupId,
      reportName,
      email,
      year,
      month,
      date,
    });
    const filename = `Usage_Analytics_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}

