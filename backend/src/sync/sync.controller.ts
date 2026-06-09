import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { SyncService } from './sync.service';
import { PowerBiService } from '../powerbi/powerbi.service';
import { UpsertService } from '../db/upsert.service';
import { REPORT_MAP } from './report-map.config';

@Controller('api')
export class SyncController {
  constructor(
    private readonly sync: SyncService,
    private readonly powerbi: PowerBiService,
    private readonly upsert: UpsertService,
  ) {}

  /** The configured requests (what the UI lets you sync). */
  @Get('reports')
  reports() {
    return REPORT_MAP.map((e) => ({
      request: e.request,
      dashboardName: e.dashboardName,
      targetTable: e.targetTable,
      businessKeys: e.businessKeys,
    }));
  }

  /** Live list of dashboards from Power BI (handy for filling in the config). */
  @Get('dashboards')
  dashboards() {
    return this.powerbi.listAllDashboards();
  }

  /** Trigger a sync for one configured request. */
  @Post('sync/:request')
  syncOne(@Param('request') request: string) {
    return this.sync.syncOne(decodeURIComponent(request));
  }

  /** Trigger a sync for everything. */
  @Post('sync')
  syncAll() {
    return this.sync.syncAll();
  }

  /** Recent sync run history. */
  @Get('runs')
  async runs() {
    await this.upsert.ensureSyncLogTable();
    return this.upsert.recentRuns();
  }
}
