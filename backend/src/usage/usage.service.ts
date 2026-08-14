import { Injectable, Logger } from '@nestjs/common';
import { PowerBiAuthService } from '../auth/powerbi-auth.service';
import axios, { AxiosInstance } from 'axios';

const API_BASE = 'https://api.powerbi.com/v1.0/myorg';

export interface UsageReport {
  reportId: string;
  reportName: string;
  datasetId: string;
  groupId: string;
  groupName: string;
  webUrl?: string;
}

export interface WorkspaceUser {
  displayName: string;
  email: string;
  role: string;
  principalType: string;
}

export interface ViewsByDay {
  date: string;
  views: number;
}

export interface ViewsByUser {
  givenName: string;
  familyName: string;
  email: string;
  views: number;
}

export interface UsageAnalytics {
  totalViews: number;
  totalViewers: number;
  viewsByDay: ViewsByDay[];
  viewsByUser: ViewsByUser[];
  viewsByPlatform: { platform: string; views: number }[];
  viewsByPage: { page: string; views: number }[];
}

@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);

  constructor(private readonly auth: PowerBiAuthService) {}

  private async client(): Promise<AxiosInstance> {
    const token = await this.auth.getAccessToken();
    return axios.create({
      baseURL: API_BASE,
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  /** Get all Usage Metric reports across all workspaces */
  async listUsageReports(): Promise<UsageReport[]> {
    const http = await this.client();
    const { data } = await http.get('/groups');
    const groups: { id: string; name: string }[] = data.value || [];

    const results: UsageReport[] = [];

    await Promise.all(
      groups.map(async (g) => {
        try {
          const { data: rData } = await http.get(`/groups/${g.id}/reports`);
          const reports: any[] = rData.value || [];
          for (const r of reports) {
            if (/usage|metric/i.test(r.name)) {
              results.push({
                reportId: r.id,
                reportName: r.name,
                datasetId: r.datasetId,
                groupId: g.id,
                groupName: g.name,
                webUrl: r.webUrl,
              });
            }
          }
        } catch (e) {
          this.logger.warn(`Could not read reports for workspace ${g.name}`);
        }
      }),
    );

    return results.sort((a, b) => a.groupName.localeCompare(b.groupName));
  }

  /** Workspace users with roles */
  async getWorkspaceUsers(groupId: string): Promise<WorkspaceUser[]> {
    const http = await this.client();
    const { data } = await http.get(`/groups/${groupId}/users`);
    return (data.value || []).map((u: any) => ({
      displayName: u.displayName ?? u.identifier ?? 'Unknown',
      email: u.emailAddress ?? u.identifier ?? '',
      role: u.groupUserAccessRight ?? 'Unknown',
      principalType: u.principalType ?? 'User',
    }));
  }

  /** Query usage analytics from the dataset behind a usage metric report */
  async getUsageAnalytics(groupId: string, datasetId: string): Promise<UsageAnalytics> {
    const http = await this.client();

    const runQuery = async (dax: string): Promise<any[]> => {
      try {
        const { data } = await http.post(
          `/groups/${groupId}/datasets/${datasetId}/executeQueries`,
          { queries: [{ query: dax }], serializerSettings: { includeNulls: true } },
        );
        return data?.results?.[0]?.tables?.[0]?.rows ?? [];
      } catch (e) {
        this.logger.warn(`DAX query failed: ${dax.slice(0, 60)}`);
        return [];
      }
    };

    // Views per day
    const viewsByDayRows = await runQuery(
      `EVALUATE SUMMARIZECOLUMNS(
        Views[Date],
        "TotalViews", SUM(Views[GranularViewsCount])
      )
      ORDER BY Views[Date] ASC`,
    );

    // Views by user (join Users table)
    const viewsByUserRows = await runQuery(
      `EVALUATE
      SUMMARIZECOLUMNS(
        Users[GivenName],
        Users[FamilyName],
        Users[UserPrincipalName],
        "TotalViews", CALCULATE(SUM(Views[GranularViewsCount]))
      )
      ORDER BY [TotalViews] DESC`,
    );

    // Views by platform
    const viewsByPlatformRows = await runQuery(
      `EVALUATE SUMMARIZECOLUMNS(
        Views[Platform],
        "TotalViews", SUM(Views[GranularViewsCount])
      )
      ORDER BY [TotalViews] DESC`,
    );

    // Views by page
    const viewsByPageRows = await runQuery(
      `EVALUATE TOPN(10,
        SUMMARIZECOLUMNS(
          Views[ReportPage],
          "TotalViews", SUM(Views[GranularViewsCount])
        ),
        [TotalViews], DESC
      )`,
    );

    const viewsByDay: ViewsByDay[] = viewsByDayRows.map((r) => ({
      date: String(r['Views[Date]'] ?? '').slice(0, 10),
      views: Number(r['[TotalViews]'] ?? 0),
    })).filter(r => r.date);

    const viewsByUser: ViewsByUser[] = viewsByUserRows.map((r) => ({
      givenName: String(r['Users[GivenName]'] ?? ''),
      familyName: String(r['Users[FamilyName]'] ?? ''),
      email: String(r['Users[UserPrincipalName]'] ?? ''),
      views: Number(r['[TotalViews]'] ?? 0),
    })).filter(r => r.email);

    const viewsByPlatform = viewsByPlatformRows.map((r) => ({
      platform: String(r['Views[Platform]'] ?? 'Unknown'),
      views: Number(r['[TotalViews]'] ?? 0),
    }));

    const viewsByPage = viewsByPageRows.map((r) => ({
      page: String(r['Views[ReportPage]'] ?? 'Unknown'),
      views: Number(r['[TotalViews]'] ?? 0),
    }));

    const totalViews = viewsByDay.reduce((s, r) => s + r.views, 0);
    const totalViewers = new Set(viewsByUser.map((u) => u.email)).size;

    return { totalViews, totalViewers, viewsByDay, viewsByUser, viewsByPlatform, viewsByPage };
  }
}
