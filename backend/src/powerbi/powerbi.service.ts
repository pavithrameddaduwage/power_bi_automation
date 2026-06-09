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
    const rawRows: Record<string, any>[] =
      data?.results?.[0]?.tables?.[0]?.rows ?? [];
    return rawRows.map((row) => {
      const clean: Record<string, any> = {};
      for (const [k, v] of Object.entries(row)) {
        const m = k.match(/\[(.+)\]$/);
        clean[m ? m[1] : k] = v;
      }
      return clean;
    });
  }
}
