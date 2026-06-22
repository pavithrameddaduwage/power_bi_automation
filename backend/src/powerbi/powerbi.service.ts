import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { PowerBiAuthService } from '../auth/powerbi-auth.service';

const API_BASE = 'https://api.powerbi.com/v1.0/myorg';

export interface PbiGroup {
  id: string;
  name: string;
}
export interface PbiDashboard {
  id: string;
  displayName: string;
  groupId: string;
  groupName: string;
}
export interface PbiTile {
  id: string;
  title?: string;
  reportId?: string;
  datasetId?: string;
}
export interface ResolvedReportSource {
  groupId: string;
  groupName: string;
  dashboardId: string;
  dashboardName: string;
  datasetId: string;
}
export interface PbiAccessEntry {
  name: string;
  email: string;
  role: string; // Admin | Member | Contributor | Viewer
  principalType: string; // User | Group | App
  canDownload: boolean;
}
export interface PbiReportWithAccess {
  id: string;
  name: string;
  reportType: string;
  webUrl?: string;
  datasetId?: string;
  workspaceId: string;
  workspaceName: string;
  downloadable: boolean;
  access: PbiAccessEntry[];
}
export interface PbiWorkspaceUser {
  workspace_id: string;
  workspace_name: string;
  display_name: string;
  email: string;
  role: string;
  principal_type: string;
  can_download: boolean;
}

export interface DataFilter {
  dateColumn?: string;
  dateFrom?: string; // 'YYYY-MM-DD'
  dateTo?: string; // 'YYYY-MM-DD'
}

/** Workspace roles that can export/download a report (PBIX / file export). */
const DOWNLOAD_ROLES = ['Admin', 'Member', 'Contributor'];

@Injectable()
export class PowerBiService {
  private readonly logger = new Logger(PowerBiService.name);

  constructor(private readonly auth: PowerBiAuthService) {}

  private async client(): Promise<AxiosInstance> {
    const token = await this.auth.getAccessToken();
    return axios.create({
      baseURL: API_BASE,
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  /** All workspaces the service principal is a member of. */
  async listGroups(): Promise<PbiGroup[]> {
    const http = await this.client();
    const { data } = await http.get('/groups');
    return (data.value || []).map((g: any) => ({ id: g.id, name: g.name }));
  }

  /** Every dashboard across every accessible workspace. */
  async listAllDashboards(): Promise<PbiDashboard[]> {
    const groups = await this.listGroups();
    const all: PbiDashboard[] = [];
    const http = await this.client();
    for (const g of groups) {
      const { data } = await http.get(`/groups/${g.id}/dashboards`);
      for (const d of data.value || []) {
        all.push({
          id: d.id,
          displayName: d.displayName,
          groupId: g.id,
          groupName: g.name,
        });
      }
    }
    return all;
  }

  /** Users (and their role) for one workspace. Needs the SP to be a member. */
  async listGroupUsers(groupId: string): Promise<PbiAccessEntry[]> {
    const http = await this.client();
    const { data } = await http.get(`/groups/${groupId}/users`);
    return (data.value || []).map((u: any) => ({
      name: u.displayName ?? u.identifier ?? 'unknown',
      email: u.emailAddress ?? u.identifier ?? '',
      role: u.groupUserAccessRight ?? 'Unknown',
      principalType: u.principalType ?? 'User',
      canDownload: DOWNLOAD_ROLES.includes(u.groupUserAccessRight),
    }));
  }

  /**
   * Every report across every workspace, each annotated with whether it is
   * downloadable and who has access (the workspace's users + their role). This
   * powers the "reports in downloadable mode + who can access each" view.
   */
  async reportsWithAccess(): Promise<PbiReportWithAccess[]> {
    const groups = await this.listGroups();
    const http = await this.client();
    const out: PbiReportWithAccess[] = [];
    for (const g of groups) {
      let access: PbiAccessEntry[] = [];
      try {
        access = await this.listGroupUsers(g.id);
      } catch (e) {
        this.logger.warn(`Could not read users for workspace ${g.name}: ${e}`);
      }
      const { data } = await http.get(`/groups/${g.id}/reports`);
      for (const r of data.value || []) {
        out.push({
          id: r.id,
          name: r.name,
          reportType: r.reportType,
          webUrl: r.webUrl,
          datasetId: r.datasetId,
          workspaceId: g.id,
          workspaceName: g.name,
          // PowerBIReport artifacts can be exported/downloaded; paginated &
          // others generally cannot.
          downloadable: r.reportType === 'PowerBIReport',
          access,
        });
      }
    }
    return out;
  }

  /** Flattened user-per-workspace rows, for syncing principals into Postgres. */
  async allWorkspaceUsers(): Promise<PbiWorkspaceUser[]> {
    const groups = await this.listGroups();
    const out: PbiWorkspaceUser[] = [];
    for (const g of groups) {
      let users: PbiAccessEntry[] = [];
      try {
        users = await this.listGroupUsers(g.id);
      } catch (e) {
        this.logger.warn(`Could not read users for workspace ${g.name}: ${e}`);
        continue;
      }
      for (const u of users) {
        out.push({
          workspace_id: g.id,
          workspace_name: g.name,
          display_name: u.name,
          email: u.email,
          role: u.role,
          principal_type: u.principalType,
          can_download: u.canDownload,
        });
      }
    }
    return out;
  }

  /** Case-insensitive fuzzy match of a dashboard by name (e.g. "inventory amazon"). */
  async findDashboardByName(name: string): Promise<PbiDashboard | null> {
    const needle = name.trim().toLowerCase();
    const dashboards = await this.listAllDashboards();
    // Prefer exact, then "contains", then token-overlap.
    const exact = dashboards.find(
      (d) => d.displayName.toLowerCase() === needle,
    );
    if (exact) return exact;
    const contains = dashboards.find((d) =>
      d.displayName.toLowerCase().includes(needle),
    );
    if (contains) return contains;
    const tokens = needle.split(/\s+/);
    return (
      dashboards.find((d) => {
        const t = d.displayName.toLowerCase();
        return tokens.every((tok) => t.includes(tok));
      }) || null
    );
  }

  /** Tiles pinned to a dashboard; each tile may reference a report + dataset. */
  async getDashboardTiles(
    groupId: string,
    dashboardId: string,
  ): Promise<PbiTile[]> {
    const http = await this.client();
    const { data } = await http.get(
      `/groups/${groupId}/dashboards/${dashboardId}/tiles`,
    );
    return (data.value || []).map((t: any) => ({
      id: t.id,
      title: t.title,
      reportId: t.reportId,
      datasetId: t.datasetId,
    }));
  }

  /**
   * Resolve a dashboard down to the dataset(s) behind it. The dataset is where
   * the real tables/rows live — dashboards only hold tiles pinned from reports.
   */
  async resolveDatasetsForDashboard(
    dashboard: PbiDashboard,
  ): Promise<ResolvedReportSource[]> {
    const tiles = await this.getDashboardTiles(
      dashboard.groupId,
      dashboard.id,
    );
    const datasetIds = Array.from(
      new Set(tiles.map((t) => t.datasetId).filter(Boolean) as string[]),
    );
    return datasetIds.map((datasetId) => ({
      groupId: dashboard.groupId,
      groupName: dashboard.groupName,
      dashboardId: dashboard.id,
      dashboardName: dashboard.displayName,
      datasetId,
    }));
  }

  /** List the table names available inside a dataset. */
  async listDatasetTables(
    groupId: string,
    datasetId: string,
  ): Promise<string[]> {
    const http = await this.client();
    const { data } = await http.get(
      `/groups/${groupId}/datasets/${datasetId}/tables`,
    );
    return (data.value || []).map((t: any) => t.name);
  }

  /**
   * Run a DAX query against a dataset and return rows.
   * Column keys come back as "TableName[ColumnName]"; we strip to "ColumnName".
   */
  async executeQuery(
    groupId: string,
    datasetId: string,
    dax: string,
  ): Promise<Record<string, any>[]> {
    const http = await this.client();
    const { data } = await http.post(
      `/groups/${groupId}/datasets/${datasetId}/executeQueries`,
      {
        queries: [{ query: dax }],
        serializerSettings: { includeNulls: true },
      },
    );
    return this.cleanRows(data?.results?.[0]?.tables?.[0]?.rows ?? []);
  }

  /** Strip the "Table[Col]" / "[Col]" wrapper from DAX result keys. */
  private cleanRows(rawRows: Record<string, any>[]): Record<string, any>[] {
    return rawRows.map((row) => {
      const clean: Record<string, any> = {};
      for (const [k, v] of Object.entries(row)) {
        const m = k.match(/\[(.+)\]$/);
        clean[m ? m[1] : k] = v;
      }
      return clean;
    });
  }

  /**
   * Run DAX against a dataset by id only (no workspace). Needed because many
   * reports point at a shared dataset that lives in a different workspace, where
   * the group-scoped executeQueries returns "Invalid dataset or workspace".
   */
  async executeQueryByDataset(
    datasetId: string,
    dax: string,
  ): Promise<Record<string, any>[]> {
    const http = await this.client();
    try {
      const { data } = await http.post(`/datasets/${datasetId}/executeQueries`, {
        queries: [{ query: dax }],
        serializerSettings: { includeNulls: true },
      });
      return this.cleanRows(data?.results?.[0]?.tables?.[0]?.rows ?? []);
    } catch (err: any) {
      const errBody = err?.response?.data?.error;
      // Power BI nests the real reason in a few different places depending on the
      // failure; dig out the most specific one we can find.
      const pbiErr = errBody?.['pbi.error'];
      const detail =
        pbiErr?.details?.find((d: any) => d?.detail?.value)?.detail?.value ||
        pbiErr?.details?.[0]?.detail?.value ||
        pbiErr?.code ||
        errBody?.message ||
        err.message;
      // Log the full body once so the underlying cause is never hidden again.
      this.logger.error(
        `executeQueries failed (dataset ${datasetId}): ${JSON.stringify(
          err?.response?.data ?? err?.message,
        )}\nDAX: ${dax}`,
      );
      throw new Error(`DAX failed: ${detail}`);
    }
  }

  /**
   * Columns of a dataset (table + name + data type), via the DAX INFO function.
   * Hidden and internal RowNumber columns are dropped.
   */
  async getDatasetColumns(datasetId: string): Promise<
    {
      table: string;
      name: string;
      dataType: string;
      isKey: boolean;
    }[]
  > {
    const rows = await this.executeQueryByDataset(
      datasetId,
      'EVALUATE INFO.VIEW.COLUMNS()',
    );
    // Power BI auto-creates hidden date tables behind every date column; drop
    // those (and other internal tables) so the user only sees real tables.
    const isInternalTable = (t: string) =>
      /^LocalDateTable_/.test(t) ||
      /^DateTableTemplate_/.test(t) ||
      t.startsWith('_');
    return rows
      .filter(
        (r) =>
          r.IsHidden !== true &&
          !String(r.Name ?? '').startsWith('RowNumber') &&
          !isInternalTable(String(r.Table ?? '')),
      )
      .map((r) => ({
        table: String(r.Table ?? ''),
        name: String(r.Name ?? ''),
        dataType: String(r.DataType ?? 'Text'),
        // The model marks identifying columns as key/unique — use them to
        // suggest business keys so recurring syncs upsert instead of duplicate.
        isKey: r.IsKey === true || r.IsUnique === true,
      }))
      .filter((c) => c.table && c.name);
  }

  /**
   * Measures of a dataset (table + name + data type). Measures are DAX
   * calculations (totals, ratios, %), not stored columns — they must be
   * evaluated grouped by columns, so they're surfaced separately.
   */
  async getDatasetMeasures(
    datasetId: string,
  ): Promise<{ table: string; name: string; dataType: string }[]> {
    const rows = await this.executeQueryByDataset(
      datasetId,
      'EVALUATE INFO.VIEW.MEASURES()',
    );
    return rows
      .filter((r) => r.IsHidden !== true)
      .map((r) => ({
        table: String(r.Table ?? ''),
        name: String(r.Name ?? ''),
        dataType: String(r.DataType ?? 'Number'),
      }))
      .filter((m) => m.name);
  }

  /**
   * Build a SUMMARIZECOLUMNS query: group by the chosen columns and compute the
   * chosen measures. Group-by columns are optional when measures are present
   * (measures-only gives the grand totals).
   */
  private buildMeasureQuery(
    table: string,
    groupCols: string[],
    measures: string[],
    limit: number,
    filter?: DataFilter,
  ): string {
    const t = `'${table.replace(/'/g, "''")}'`;
    const args: string[] = [];
    for (const c of groupCols) {
      args.push(`${t}[${c.replace(/]/g, ']]')}]`);
    }
    if (filter?.dateColumn && (filter.dateFrom || filter.dateTo)) {
      const col = filter.dateColumn.replace(/]/g, ']]');
      const from = this.daxDate(filter.dateFrom);
      const to = this.daxDate(filter.dateTo);
      const conds: string[] = [];
      if (from) conds.push(`${t}[${col}] >= ${from}`);
      if (to) conds.push(`${t}[${col}] <= ${to}`);
      if (conds.length) {
        args.push(`FILTER(ALL(${t}[${col}]), ${conds.join(' && ')})`);
      }
    }
    for (const m of measures) {
      args.push(`"${m}", [${m.replace(/]/g, ']]')}]`);
    }
    const inner = `SUMMARIZECOLUMNS(${args.join(', ')})`;
    return limit && limit > 0
      ? `EVALUATE TOPN(${limit}, ${inner})`
      : `EVALUATE ${inner}`;
  }

  /** An optional date-range filter applied to one date/datetime column. */
  private daxDate(iso?: string): string | null {
    if (!iso) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    return m ? `DATE(${+m[1]}, ${+m[2]}, ${+m[3]})` : null;
  }

  /** Build a SELECTCOLUMNS DAX projection for the chosen table + columns. */
  private buildProjection(
    table: string,
    columns: string[],
    limit: number,
    filter?: DataFilter,
  ): string {
    const t = `'${table.replace(/'/g, "''")}'`;

    // Optionally filter the base table by a date range before projecting.
    let tableExpr = t;
    if (filter?.dateColumn && (filter.dateFrom || filter.dateTo)) {
      const col = filter.dateColumn.replace(/]/g, ']]');
      const from = this.daxDate(filter.dateFrom);
      const to = this.daxDate(filter.dateTo);
      const conds: string[] = [];
      if (from) conds.push(`${t}[${col}] >= ${from}`);
      if (to) conds.push(`${t}[${col}] <= ${to}`);
      if (conds.length) tableExpr = `FILTER(${t}, ${conds.join(' && ')})`;
    }

    const parts = columns
      .map((c) => {
        const col = c.replace(/]/g, ']]');
        return `"${c}", ${t}[${col}]`;
      })
      .join(', ');
    const inner = `SELECTCOLUMNS(${tableExpr}, ${parts})`;
    // limit <= 0 means "all rows" (no TOPN cap).
    return limit && limit > 0
      ? `EVALUATE TOPN(${limit}, ${inner})`
      : `EVALUATE ${inner}`;
  }

  /** Pull the selected columns of one table from a dataset (the "sync" step). */
  async getReportData(
    datasetId: string,
    table: string,
    columns: string[],
    limit = 500,
    filter?: DataFilter,
    measures: string[] = [],
  ): Promise<Record<string, any>[]> {
    const cols = Array.isArray(columns) ? columns : [];
    const meas = Array.isArray(measures) ? measures : [];
    if (!table) throw new Error('table is required.');
    if (cols.length === 0 && meas.length === 0) {
      throw new Error('Select at least one column or measure.');
    }
    // Measures must be grouped → SUMMARIZECOLUMNS. Plain columns → SELECTCOLUMNS.
    const dax =
      meas.length > 0
        ? this.buildMeasureQuery(table, cols, meas, limit, filter)
        : this.buildProjection(table, cols, limit, filter);
    return this.executeQueryByDataset(datasetId, dax);
  }
}
