import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PowerBiService } from '../powerbi/powerbi.service';

/**
 * Read-only views of the live Power BI tenant:
 *  - dashboards
 *  - reports, flagged downloadable, with the access list for each.
 */
@Controller('api/catalog')
export class CatalogController {
  constructor(private readonly powerbi: PowerBiService) {}

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
    if (downloadableOnly === 'true') {
      return all.filter((r) => r.downloadable);
    }
    return all;
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
  ) {
    const cols = await this.powerbi.getDatasetColumns(datasetId);
    if (finalOnly === 'true') {
      const curated = cols.filter((c) => !this.isSourceTable(c.table));
      // Keep only tables that actually map data together — drop tiny helper /
      // measure / sort tables (1–3 columns).
      const counts = new Map<string, number>();
      for (const c of curated) {
        counts.set(c.table, (counts.get(c.table) ?? 0) + 1);
      }
      const MIN_FINAL_COLUMNS = 4;
      return curated.filter(
        (c) => (counts.get(c.table) ?? 0) >= MIN_FINAL_COLUMNS,
      );
    }
    return cols;
  }

  /** True for raw source views / internal helper tables (not a "final" report). */
  private isSourceTable(table: string): boolean {
    const n = table.toLowerCase();
    return (
      n.startsWith('public ') ||
      n.startsWith('localdatetable') ||
      n.startsWith('datetabletemplate') ||
      n === 'measures table' ||
      n.endsWith(' measures')
    );
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
      table: string;
      columns: string[];
      measures?: string[];
      limit?: number;
      dateColumn?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    return this.powerbi.getReportData(
      body.datasetId,
      body.table,
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
