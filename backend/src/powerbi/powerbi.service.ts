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

  async listAllDashboards(): Promise<PbiDashboard[]> {
    const groups = await this.listGroups();
    const all: PbiDashboard[] = [];
    const http = await this.client();
    
    const CHUNK_SIZE = 10;
    for (let i = 0; i < groups.length; i += CHUNK_SIZE) {
      const chunk = groups.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map(async (g) => {
          try {
            const { data } = await http.get(`/groups/${g.id}/dashboards`);
            for (const d of data.value || []) {
              all.push({
                id: d.id,
                displayName: d.displayName,
                groupId: g.id,
                groupName: g.name,
              });
            }
          } catch (e) {
            this.logger.warn(`Could not read dashboards for workspace ${g.name}: ${e}`);
          }
        })
      );
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
    
    const CHUNK_SIZE = 10;
    for (let i = 0; i < groups.length; i += CHUNK_SIZE) {
      const chunk = groups.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map(async (g) => {
          let access: PbiAccessEntry[] = [];
          try {
            access = await this.listGroupUsers(g.id);
          } catch (e) {
            this.logger.warn(`Could not read users for workspace ${g.name}: ${e}`);
          }
          try {
            const { data } = await http.get(`/groups/${g.id}/reports`);
            for (const r of data.value || []) {
              const lowerName = (r.name || '').toLowerCase();
              if (
                lowerName.includes('usage metric') ||
                lowerName.includes('report usage') ||
                lowerName.includes('usage metrics')
              ) {
                continue;
              }
              out.push({
                id: r.id,
                name: r.name,
                reportType: r.reportType,
                webUrl: r.webUrl,
                datasetId: r.datasetId,
                workspaceId: g.id,
                workspaceName: g.name,
                downloadable: r.reportType === 'PowerBIReport',
                access,
              });
            }
          } catch (e) {
            this.logger.warn(`Could not read reports for workspace ${g.name}: ${e}`);
          }
        })
      );
    }
    return out;
  }

  /** Flattened user-per-workspace rows, for syncing principals into Postgres. */
  async allWorkspaceUsers(): Promise<PbiWorkspaceUser[]> {
    const groups = await this.listGroups();
    const out: PbiWorkspaceUser[] = [];
    
    const CHUNK_SIZE = 10;
    for (let i = 0; i < groups.length; i += CHUNK_SIZE) {
      const chunk = groups.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map(async (g) => {
          try {
            const users = await this.listGroupUsers(g.id);
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
          } catch (e) {
            this.logger.warn(`Could not read users for workspace ${g.name}: ${e}`);
          }
        })
      );
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
        const newKey = m ? m[1] : k;
        clean[newKey] = typeof v === 'number' && !Number.isInteger(v) 
          ? Number(v.toFixed(2)) 
          : v;
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
  async getDatasetColumns(datasetId: string, includeHidden = false): Promise<
    {
      table: string;
      name: string;
      dataType: string;
      isKey: boolean;
      isHidden?: boolean;
    }[]
  > {
    const rows = await this.executeQueryByDataset(
      datasetId,
      'EVALUATE INFO.VIEW.COLUMNS()',
    );
    // Power BI auto-creates internal date hierarchy tables; drop those
    const isInternalTable = (t: string) =>
      /^LocalDateTable_/.test(t) ||
      /^DateTableTemplate_/.test(t);
    return rows
      .filter(
        (r) =>
          (includeHidden || r.IsHidden !== true) &&
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
        isHidden: r.IsHidden === true,
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

    // Deduplicate group-by columns to prevent DAX error: "specified more than once in SUMMARIZECOLUMNS"
    const uniqueCols = Array.from(new Set(groupCols.filter((c) => c && c.trim() !== '')));
    for (const c of uniqueCols) {
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

    // Deduplicate measures
    const uniqueMeasures = Array.from(new Set(measures.filter((m) => m && m.trim() !== '')));
    for (const m of uniqueMeasures) {
      args.push(`"${m}", [${m.replace(/]/g, ']]')}]`);
    }

    const inner = `SUMMARIZECOLUMNS(${args.join(', ')})`;
    // Memory governance guard: use a safe limit (default 20,000 if unconstrained) and order by first measure/column
    const cap = limit && limit > 0 ? limit : 20000;
    let orderExpr = '';
    if (uniqueMeasures.length > 0) {
      orderExpr = `[${uniqueMeasures[0].replace(/]/g, ']]')}]`;
    } else if (uniqueCols.length > 0) {
      orderExpr = `${t}[${uniqueCols[0].replace(/]/g, ']]')}]`;
    }

    return orderExpr
      ? `EVALUATE TOPN(${cap}, ${inner}, ${orderExpr}, DESC)`
      : `EVALUATE TOPN(${cap}, ${inner})`;
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

    // Deduplicate projection columns
    const uniqueCols = Array.from(new Set(columns.filter((c) => c && c.trim() !== '')));
    const parts = uniqueCols
      .map((c) => {
        const col = c.replace(/]/g, ']]');
        return `"${c}", ${t}[${col}]`;
      })
      .join(', ');
    const inner = `SELECTCOLUMNS(${tableExpr}, ${parts})`;
    const cap = limit && limit > 0 ? limit : 50000;
    return `EVALUATE TOPN(${cap}, ${inner})`;
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

  /**
   * Pull columns from multiple tables and merge the results (column union).
   * Rows from each table are appended; columns not present in a given table
   * are filled with null. A `_source_table` meta-column is added so the UI
   * can distinguish origin.
   */
  async getReportDataMulti(
    datasetId: string,
    tables: string[],
    columns: string[],
    limit = 500,
    filter?: DataFilter,
    measures: string[] = [],
  ): Promise<Record<string, any>[]> {
    // Attempt to map columns to their owning tables so we only query
    // columns that actually belong to each target table.
    let tableColsMap: Record<string, Set<string>> = {};
    try {
      const datasetCols = await this.getDatasetColumns(datasetId);
      for (const item of datasetCols) {
        if (!tableColsMap[item.table]) {
          tableColsMap[item.table] = new Set();
        }
        tableColsMap[item.table].add(item.name);
      }
    } catch (e) {
      tableColsMap = {};
    }

    const results = await Promise.all(
      tables.map(async (table) => {
        try {
          // Filter requested columns to only those that belong to this table.
          // Fall back to all columns if table mapping is unavailable.
          const hasMap = tableColsMap[table] && tableColsMap[table].size > 0;
          const tableCols = hasMap
            ? columns.filter((c) => tableColsMap[table].has(c))
            : columns;

          const uniqueTableCols = Array.from(new Set(tableCols));

          // If this table has no selected columns and no measures, skip querying it
          if (uniqueTableCols.length === 0 && measures.length === 0) {
            return [];
          }

          const rows = await this.getReportData(
            datasetId,
            table,
            uniqueTableCols,
            limit,
            filter,
            measures,
          );
          return rows.map((r) => ({ ...r, _source_table: table }));
        } catch (err) {
          this.logger.warn(`Multi-table fetch: skipped table "${table}": ${err}`);
          return [];
        }
      }),
    );

    // Collect all column keys across all result sets.
    const allKeys = new Set<string>();
    for (const rows of results) {
      for (const row of rows) {
        for (const k of Object.keys(row)) allKeys.add(k);
      }
    }

    // Merge: fill missing columns with null.
    const merged: Record<string, any>[] = [];
    for (const rows of results) {
      for (const row of rows as Record<string, any>[]) {
        const full: Record<string, any> = {};
        for (const k of allKeys) {
          full[k] = row[k] ?? null;
        }
        merged.push(full);
      }
    }
    return merged;
  }

  /**
   * Fetches refresh schedule configurations & latest refresh status for all datasets
   * across all workspaces accessible by the tenant service principal.
   */
  async listAllDatasetRefreshSchedules(): Promise<PbiDatasetRefreshInfo[]> {
    const groups = await this.listGroups();
    const http = await this.client();
    const allDatasets: { groupId: string; groupName: string; ds: any }[] = [];

    // 1. Collect all datasets across workspaces in parallel chunks
    const GROUP_CHUNK = 5;
    for (let i = 0; i < groups.length; i += GROUP_CHUNK) {
      const chunk = groups.slice(i, i + GROUP_CHUNK);
      await Promise.all(
        chunk.map(async (g) => {
          try {
            const { data } = await http.get(`/groups/${g.id}/datasets`);
            for (const ds of data.value || []) {
              const lower = (ds.name || '').toLowerCase();
              if (lower.includes('usage metric') || lower.includes('report usage')) continue;
              allDatasets.push({ groupId: g.id, groupName: g.name, ds });
            }
          } catch (e) {
            this.logger.warn(`Could not read datasets for group ${g.name}: ${e}`);
          }
        }),
      );
    }

    // 2. Fetch refresh schedules & latest refresh info with concurrency pool
    const results: PbiDatasetRefreshInfo[] = [];
    const DS_CHUNK = 6;
    for (let i = 0; i < allDatasets.length; i += DS_CHUNK) {
      const chunk = allDatasets.slice(i, i + DS_CHUNK);
      const chunkResults = await Promise.all(
        chunk.map(async ({ groupId, groupName, ds }) => {
          let schedule = {
            enabled: false,
            days: [] as string[],
            times: [] as string[],
            timeZone: '',
          };
          try {
            const { data: s } = await http.get(`/groups/${groupId}/datasets/${ds.id}/refreshSchedule`);
            schedule = {
              enabled: !!s.enabled,
              days: s.days || [],
              times: s.times || [],
              timeZone: s.localTimeZoneId || '',
            };
          } catch (e) {}

          let lastRefresh: any = null;
          try {
            const { data: r } = await http.get(`/groups/${groupId}/datasets/${ds.id}/refreshes?$top=1`);
            if (r.value && r.value.length > 0) {
              lastRefresh = r.value[0];
            }
          } catch (e) {}

          const info: PbiDatasetRefreshInfo = {
            datasetId: ds.id,
            datasetName: ds.name,
            workspaceId: groupId,
            workspaceName: groupName,
            isRefreshable: !!ds.isRefreshable,
            configuredBy: ds.configuredBy,
            scheduleEnabled: schedule.enabled,
            scheduleDays: schedule.days,
            scheduleTimes: schedule.times,
            timeZone: schedule.timeZone,
            lastRefreshStatus: lastRefresh?.status || null,
            lastRefreshStartTime: lastRefresh?.startTime || null,
            lastRefreshEndTime: lastRefresh?.endTime || null,
            lastRefreshType: lastRefresh?.refreshType || null,
            lastRefreshError: lastRefresh?.serviceExceptionJson || null,
          };
          return info;
        }),
      );
      results.push(...chunkResults);
    }

    // Sort by workspace name, then dataset name
    return results.sort((a, b) =>
      a.workspaceName.localeCompare(b.workspaceName) || a.datasetName.localeCompare(b.datasetName),
    );
  }

  /**
   * Look up the real-time refresh status of a specific dataset directly from Power BI API.
   */
  async getDatasetRefreshStatus(
    datasetId: string,
    groupId?: string,
  ): Promise<{
    status: 'Completed' | 'Failed' | 'InProgress' | 'Unknown';
    startTime?: string;
    endTime?: string;
    refreshType?: string;
    error?: string;
  } | null> {
    const http = await this.client();
    let targetGroupId = groupId;
    if (!targetGroupId) {
      const groups = await this.listGroups();
      for (const g of groups) {
        try {
          const { data } = await http.get(`/groups/${g.id}/datasets`);
          if ((data.value || []).some((d: any) => d.id === datasetId)) {
            targetGroupId = g.id;
            break;
          }
        } catch (e) {}
      }
    }
    if (!targetGroupId) return null;

    try {
      const { data } = await http.get(
        `/groups/${targetGroupId}/datasets/${datasetId}/refreshes?$top=1`,
      );
      if (data.value && data.value.length > 0) {
        const item = data.value[0];
        return {
          status: item.status || 'Unknown',
          startTime: item.startTime,
          endTime: item.endTime,
          refreshType: item.refreshType,
          error: item.serviceExceptionJson || undefined,
        };
      }
    } catch (e) {}
    return null;
  }

  /**
   * Retrieves all directory users across all workspaces in the tenant.
   * De-duplicated by email, with service principals filtered out.
   */
  async listDirectoryUsers(): Promise<PbiDirectoryUser[]> {
    const groups = await this.listGroups();
    const userMap = new Map<string, PbiDirectoryUser>();

    const isServicePrincipal = (disp = '', em = '', pType = '') => {
      const d = (disp || '').toLowerCase();
      const e = (em || '').toLowerCase();
      const pt = (pType || '').toLowerCase();
      const isGuid = (s: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
      return (
        pt === 'app' ||
        pt === 'serviceprincipal' ||
        d.includes('serviceprincipal') ||
        d.includes('powerbi-api') ||
        e.includes('powerbi-api') ||
        e.includes('serviceprincipal') ||
        isGuid(d) ||
        isGuid(e) ||
        isGuid(e.split('@')[0])
      );
    };

    const CHUNK_SIZE = 5;
    for (let i = 0; i < groups.length; i += CHUNK_SIZE) {
      const chunk = groups.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map(async (g) => {
          try {
            const users = await this.listGroupUsers(g.id);
            for (const u of users) {
              if (isServicePrincipal(u.name, u.email, u.principalType)) continue;
              const em = (u.email || '').toLowerCase().trim();
              if (em && !userMap.has(em)) {
                userMap.set(em, {
                  name: u.name && u.name !== u.email ? u.name : em,
                  email: em,
                  role: u.role || 'Member',
                  principalType: u.principalType || 'User',
                  workspaceName: g.name,
                });
              }
            }
          } catch (e) {}
        }),
      );
    }

    return Array.from(userMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }
}

export interface PbiDirectoryUser {
  name: string;
  email: string;
  role?: string;
  workspaceName?: string;
  principalType?: string;
}

export interface PbiDatasetRefreshInfo {
  datasetId: string;
  datasetName: string;
  workspaceId: string;
  workspaceName: string;
  isRefreshable: boolean;
  configuredBy?: string;
  scheduleEnabled: boolean;
  scheduleDays: string[];
  scheduleTimes: string[];
  timeZone: string;
  lastRefreshStatus?: string | null;
  lastRefreshStartTime?: string | null;
  lastRefreshEndTime?: string | null;
  lastRefreshType?: string | null;
  lastRefreshError?: string | null;
}

