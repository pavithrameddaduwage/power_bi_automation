import { Injectable, Logger } from '@nestjs/common';
import { PowerBiService } from '../powerbi/powerbi.service';
import { UpsertService } from '../db/upsert.service';
import {
  REPORT_MAP,
  ReportMapEntry,
  findReportEntry,
} from './report-map.config';

export interface SyncResult {
  request: string;
  targetTable: string;
  snapshotDate: string;
  rowsWritten: number;
  dashboard: string;
  datasetId: string;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly powerbi: PowerBiService,
    private readonly upsert: UpsertService,
  ) {}

  /** Snapshot date = the most recent Wednesday on/before today (the refresh day). */
  private currentSnapshotDate(): string {
    const d = new Date();
    const day = d.getUTCDay(); // 0 Sun .. 6 Sat; Wednesday = 3
    const back = (day - 3 + 7) % 7;
    d.setUTCDate(d.getUTCDate() - back);
    return d.toISOString().slice(0, 10);
  }

  /** Run the full pipeline for one configured request, e.g. "inventory amazon". */
  async syncOne(request: string): Promise<SyncResult> {
    const entry = findReportEntry(request);
    if (!entry) {
      throw new Error(`No report-map entry for request "${request}".`);
    }
    await this.upsert.ensureSyncLogTable();

    try {
      const result = await this.runEntry(entry);
      await this.upsert.logRun({
        request: entry.request,
        targetTable: entry.targetTable,
        snapshotDate: result.snapshotDate,
        rowsWritten: result.rowsWritten,
        status: 'success',
      });
      return result;
    } catch (err: any) {
      await this.upsert.logRun({
        request: entry.request,
        targetTable: entry.targetTable,
        status: 'error',
        error: err?.message ?? String(err),
      });
      throw err;
    }
  }

  /** Run every configured request. Continues past individual failures. */
  async syncAll(): Promise<{ results: SyncResult[]; errors: string[] }> {
    const results: SyncResult[] = [];
    const errors: string[] = [];
    for (const entry of REPORT_MAP) {
      try {
        results.push(await this.syncOne(entry.request));
      } catch (err: any) {
        errors.push(`${entry.request}: ${err?.message ?? err}`);
      }
    }
    return { results, errors };
  }

  private async runEntry(entry: ReportMapEntry): Promise<SyncResult> {
    // 1. Identify the dashboard.
    const dashboard = await this.powerbi.findDashboardByName(
      entry.dashboardName,
    );
    if (!dashboard) {
      throw new Error(`Dashboard "${entry.dashboardName}" not found.`);
    }

    // 2. Resolve the dataset(s) behind the dashboard's reports.
    const sources = await this.powerbi.resolveDatasetsForDashboard(dashboard);
    if (sources.length === 0) {
      throw new Error(
        `No datasets resolved for dashboard "${dashboard.displayName}".`,
      );
    }

    // 3. Pull rows via DAX. Use the first dataset that has the target table.
    const dax = entry.daxQuery ?? `EVALUATE '${entry.daxTable}'`;
    let rows: Record<string, any>[] | null = null;
    let usedDatasetId = '';
    for (const src of sources) {
      try {
        rows = await this.powerbi.executeQuery(src.groupId, src.datasetId, dax);
        usedDatasetId = src.datasetId;
        break;
      } catch (e) {
        // Table may not exist in this dataset; try the next one.
        this.logger.warn(
          `DAX failed on dataset ${src.datasetId}, trying next. ${e}`,
        );
      }
    }
    if (rows === null) {
      throw new Error(
        `Could not run DAX for "${entry.request}" on any dataset.`,
      );
    }

    // 4. Ensure the target table, then upsert this week's snapshot.
    const snapshotDate = this.currentSnapshotDate();
    await this.upsert.ensureTable(entry);
    const rowsWritten = await this.upsert.upsertRows(entry, rows, snapshotDate);

    return {
      request: entry.request,
      targetTable: entry.targetTable,
      snapshotDate,
      rowsWritten,
      dashboard: dashboard.displayName,
      datasetId: usedDatasetId,
    };
  }
}
