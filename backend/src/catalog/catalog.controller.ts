import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PowerBiService } from '../powerbi/powerbi.service';
import { Public } from '../auth/decorators/public.decorator';

/**
 * Read-only views of the live Power BI tenant:
 *  - dashboards
 *  - reports, flagged downloadable, with the access list for each.
 */
@Controller('api/catalog')
export class CatalogController {
  constructor(private readonly powerbi: PowerBiService) {}

  /** Power BI dataset refresh schedules and latest refresh statuses across all workspaces */
  @Public()
  @Get('refresh-schedules')
  refreshSchedules() {
    return this.powerbi.listAllDatasetRefreshSchedules();
  }

  /** Live dashboards across all workspaces. */
  @Get('dashboards')
  dashboards() {
    return this.powerbi.listAllDashboards();
  }

  /**
   * Live reports + access. `?downloadableOnly=true` returns only the reports
   * that are in "downloadable mode".
   */
  @Get('reports')
  async reports(@Query('downloadableOnly') downloadableOnly?: string) {
    const all = await this.powerbi.reportsWithAccess();
    const isUsage = (name: string) => {
      const lower = (name || '').toLowerCase();
      return lower.includes('usage metric') || lower.includes('report usage') || lower.includes('usage metrics');
    };
    const nonUsage = all.filter((r) => !isUsage(r.name));
    if (downloadableOnly === 'true') {
      return nonUsage.filter((r) => r.downloadable);
    }
    return nonUsage;
  }

  /**
   * Columns (table + name + data type) of a report's dataset.
   * `?finalOnly=true` returns only the curated/combined report tables, hiding
   * the raw `public …` source views (the relationship/normalization layer).
   */
  @Get('datasets/:datasetId/columns')
  async columns(
    @Param('datasetId') datasetId: string,
    @Query('finalOnly') finalOnly?: string,
    @Query('includeHidden') includeHidden?: string,
  ) {
    const isIncludeHidden = includeHidden === 'true';
    const cols = await this.powerbi.getDatasetColumns(datasetId, isIncludeHidden);
    if (finalOnly === 'true' && !isIncludeHidden) {
      const curated = cols.filter((c) => !this.isSourceTable(c.table));
      // Keep tables that have at least 1 real column
      const counts = new Map<string, number>();
      for (const c of curated) {
        counts.set(c.table, (counts.get(c.table) ?? 0) + 1);
      }
      const MIN_FINAL_COLUMNS = 1;
      return curated.filter(
        (c) => (counts.get(c.table) ?? 0) >= MIN_FINAL_COLUMNS,
      );
    }
    return cols;
  }

  /** True for well-known Power BI internal/generated tables only. */
  private isSourceTable(table: string): boolean {
    const n = table.toLowerCase();
    return (
      // Power BI auto-generates hidden date tables:
      n.startsWith('localdatetable_') ||
      n.startsWith('datetabletemplate_') ||
      // Internal measure container tables:
      n === 'measures table' ||
      n.endsWith(' measures') ||
      // Underscore-prefixed internal tables:
      n.startsWith('_')
    );
    // NOTE: we deliberately NO LONGER drop tables whose names start with
    // 'public ' — those are often real user tables in the dataset.
  }

  /** Measures (DAX calculations) of a report's dataset, viewed separately. */
  @Get('datasets/:datasetId/measures')
  measures(@Param('datasetId') datasetId: string) {
    return this.powerbi.getDatasetMeasures(datasetId);
  }

  /** Pull the selected columns'/measures' data from Power BI (the "sync" step). */
  @Post('data')
  data(
    @Body()
    body: {
      datasetId: string;
      /** Single table (legacy) */
      table?: string;
      /** Multiple tables — takes precedence over `table` when supplied. */
      tables?: string[];
      columns: string[];
      measures?: string[];
      limit?: number;
      dateColumn?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    const tableList: string[] = body.tables?.length
      ? body.tables
      : body.table
      ? [body.table]
      : [];

    if (tableList.length === 0) {
      return [];
    }

    // Single table — original path (no merge overhead).
    if (tableList.length === 1) {
      return this.powerbi.getReportData(
        body.datasetId,
        tableList[0],
        body.columns,
        body.limit ?? 500,
        {
          dateColumn: body.dateColumn,
          dateFrom: body.dateFrom,
          dateTo: body.dateTo,
        },
        body.measures ?? [],
      );
    }

    // Multiple tables — fetch each then merge (column union, nulls for missing).
    return this.powerbi.getReportDataMulti(
      body.datasetId,
      tableList,
      body.columns,
      body.limit ?? 500,
      {
        dateColumn: body.dateColumn,
        dateFrom: body.dateFrom,
        dateTo: body.dateTo,
      },
      body.measures ?? [],
    );
  }
}
