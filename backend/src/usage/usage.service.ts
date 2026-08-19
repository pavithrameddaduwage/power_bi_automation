import { Injectable, Logger, Inject } from '@nestjs/common';
import { PowerBiAuthService } from '../auth/powerbi-auth.service';
import axios, { AxiosInstance } from 'axios';
import { PG_POOL } from '../db/database.module';
import { Pool } from 'pg';

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
  date: string;
  views: number;
}

export interface UserReportAccess {
  givenName: string;
  familyName: string;
  email: string;
  reportName: string;
  date: string;
  views: number;
}

export interface UserPageAccess {
  givenName: string;
  familyName: string;
  email: string;
  reportName: string;
  pageName: string;
  date: string;
  views: number;
}

export interface UsageAnalytics {
  totalViews: number;
  totalViewers: number;
  viewsByDay: ViewsByDay[];
  viewsByUser: ViewsByUser[];
  viewsByPlatform: { platform: string; views: number }[];
  reportViews: { reportName: string; date: string; views: number }[];
  pageViews: { pageName: string; reportName: string; date: string; views: number }[];
  userReportAccess: UserReportAccess[];
  userPageAccess: UserPageAccess[];
}

@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly auth: PowerBiAuthService
  ) {}

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

  /** Fetch global dashboard metrics and stats from PG database */
  async getGlobalDashboardStats(filterGroupId?: string) {
    // Helper to extract workspace display names mapping from listUsageReports
    let workspaceMap = new Map<string, string>();
    try {
      const reports = await this.listUsageReports();
      for (const r of reports) {
        workspaceMap.set(r.groupId, r.groupName);
      }
    } catch {}

    const filterClause = filterGroupId ? `WHERE group_id = '${filterGroupId}'` : '';
    const filterAndClause = filterGroupId ? `AND group_id = '${filterGroupId}'` : '';

    // 1. Top 10 Workspaces
    const topWorkspacesQuery = await this.pool.query(`
      SELECT group_id, SUM(views) as views
      FROM usage_views_by_day
      GROUP BY group_id
      ORDER BY views DESC
      LIMIT 10
    `);
    const topWorkspaces = topWorkspacesQuery.rows.map(r => ({
      name: workspaceMap.get(r.group_id) || r.group_id,
      views: Number(r.views)
    }));

    // 2. Top 10 Users (Grouped strictly by email, picking best display name)
    const topUsersQuery = await this.pool.query(`
      SELECT 
        LOWER(TRIM(email)) as email,
        COALESCE(
          MAX(CASE WHEN given_name IS NOT NULL AND TRIM(given_name) != '' AND LOWER(TRIM(given_name)) != LOWER(TRIM(email)) AND (family_name IS NOT NULL AND TRIM(family_name) != '') THEN TRIM(given_name || ' ' || family_name) END),
          MAX(CASE WHEN given_name IS NOT NULL AND TRIM(given_name) != '' AND LOWER(TRIM(given_name)) != LOWER(TRIM(email)) THEN TRIM(given_name) END),
          MAX(TRIM(given_name)),
          LOWER(TRIM(email))
        ) as name,
        SUM(views) as views,
        TO_CHAR(MAX(date), 'YYYY-MM-DD') as last_accessed
      FROM usage_views_by_user
      ${filterClause}
      GROUP BY LOWER(TRIM(email))
      ORDER BY views DESC
      LIMIT 10
    `);
    const topUsers = topUsersQuery.rows.map(r => ({
      email: r.email,
      name: r.name,
      views: Number(r.views),
      lastAccessed: r.last_accessed
    }));

    // 3. Top Reports / Dashboards
    const topReportsQuery = await this.pool.query(`
      SELECT report_name, SUM(views) as views
      FROM usage_views_by_report
      ${filterClause}
      GROUP BY report_name
      ORDER BY views DESC
      LIMIT 10
    `);
    const topReports = topReportsQuery.rows.map(r => ({
      name: r.report_name,
      views: Number(r.views)
    }));

    // 4. Top Pages
    const topPagesQuery = await this.pool.query(`
      SELECT page_name, report_name, SUM(views) as views
      FROM usage_views_by_page
      ${filterClause}
      GROUP BY page_name, report_name
      ORDER BY views DESC
      LIMIT 10
    `);
    const topPages = topPagesQuery.rows.map(r => ({
      pageName: r.page_name,
      reportName: r.report_name,
      views: Number(r.views)
    }));

    // 5. Least Used Workspace
    const leastWorkspacesQuery = await this.pool.query(`
      SELECT group_id, SUM(views) as views
      FROM usage_views_by_day
      GROUP BY group_id
      ORDER BY views ASC
      LIMIT 5
    `);
    const leastWorkspaces = leastWorkspacesQuery.rows.map(r => ({
      name: workspaceMap.get(r.group_id) || r.group_id,
      views: Number(r.views)
    }));

    // 6. Least Used Reports
    const leastReportsQuery = await this.pool.query(`
      SELECT report_name, SUM(views) as views
      FROM usage_views_by_report
      ${filterClause}
      GROUP BY report_name
      ORDER BY views ASC
      LIMIT 5
    `);
    const leastReports = leastReportsQuery.rows.map(r => ({
      name: r.report_name,
      views: Number(r.views)
    }));

    // 7. Least Used Pages
    const leastPagesQuery = await this.pool.query(`
      SELECT page_name, report_name, SUM(views) as views
      FROM usage_views_by_page
      ${filterClause}
      GROUP BY page_name, report_name
      ORDER BY views ASC
      LIMIT 5
    `);
    const leastPages = leastPagesQuery.rows.map(r => ({
      pageName: r.page_name,
      reportName: r.report_name,
      views: Number(r.views)
    }));

    // 8. Least Accessed Users (Inactive Watchlist)
    const leastUsersQuery = await this.pool.query(`
      SELECT 
        LOWER(TRIM(email)) as email,
        COALESCE(
          MAX(CASE WHEN given_name IS NOT NULL AND TRIM(given_name) != '' AND LOWER(TRIM(given_name)) != LOWER(TRIM(email)) AND (family_name IS NOT NULL AND TRIM(family_name) != '') THEN TRIM(given_name || ' ' || family_name) END),
          MAX(CASE WHEN given_name IS NOT NULL AND TRIM(given_name) != '' AND LOWER(TRIM(given_name)) != LOWER(TRIM(email)) THEN TRIM(given_name) END),
          MAX(TRIM(given_name)),
          LOWER(TRIM(email))
        ) as name,
        SUM(views) as views,
        TO_CHAR(MAX(date), 'YYYY-MM-DD') as last_accessed
      FROM usage_views_by_user
      ${filterClause}
      GROUP BY LOWER(TRIM(email))
      ORDER BY last_accessed ASC
      LIMIT 5
    `);
    const leastUsers = leastUsersQuery.rows.map(r => ({
      email: r.email,
      name: r.name,
      views: Number(r.views),
      lastAccessed: r.last_accessed
    }));

    // Total views, Total Viewers, Total Reports, Total Workspaces
    let totalViews = 0;
    let totalViewers = 0;
    let totalReportsCount = 0;
    let totalWorkspacesCount = 0;

    try {
      const totalViewsQuery = await this.pool.query(`
        SELECT COALESCE(SUM(views), 0) as views
        FROM usage_views_by_day
        ${filterClause}
      `);
      totalViews = Number(totalViewsQuery.rows[0]?.views || 0);

      const viewersQuery = await this.pool.query(`
        SELECT COUNT(DISTINCT email) as count
        FROM usage_views_by_user
        ${filterClause}
      `);
      totalViewers = Number(viewersQuery.rows[0]?.count || 0);

      const reportsQuery = await this.pool.query(`
        SELECT COUNT(DISTINCT report_name) as count
        FROM usage_views_by_report
        ${filterClause}
      `);
      totalReportsCount = Number(reportsQuery.rows[0]?.count || 0);

      const wsQuery = await this.pool.query(`
        SELECT COUNT(DISTINCT group_id) as count
        FROM usage_views_by_day
      `);
      totalWorkspacesCount = Number(wsQuery.rows[0]?.count || 0);
    } catch {}

    const topReportViews = topReports.length > 0 ? topReports[0].views : 0;
    const topReportName = topReports.length > 0 ? topReports[0].name : '';
    const mostActiveUserViews = topUsers.length > 0 ? topUsers[0].views : 0;
    const mostActiveUserName = topUsers.length > 0 ? topUsers[0].name : '';

    return {
      totalViews,
      totalViewers,
      totalReportsCount,
      totalWorkspacesCount,
      topReportViews,
      topReportName,
      mostActiveUserViews,
      mostActiveUserName,
      topWorkspaces,
      topUsers,
      topReports,
      topPages,
      leastWorkspaces,
      leastReports,
      leastPages,
      leastUsers
    };
  }
  async getRawUserReportAccess(groupId?: string) {
    try {
      let query = `
        SELECT date, group_id as "Workspace Name", report_name as "Report Name", email as "User Email", views as "Views"
        FROM usage_user_report_access
      `;
      const params = [];
      if (groupId) {
        query += ` WHERE group_id = $1`;
        params.push(groupId);
      }
      query += ` ORDER BY date DESC, "Report Name" ASC, "User Email" ASC`;

      const result = await this.pool.query(query, params);
      return result.rows;
    } catch (e) {
      this.logger.error('Failed to fetch raw user report access', e);
      return [];
    }
  }


  /** Get aggregated stats for all users */
  async getAllUsersStats() {
    const query = await this.pool.query(`
      SELECT 
        LOWER(TRIM(email)) as email,
        COALESCE(
          MAX(CASE WHEN given_name IS NOT NULL AND TRIM(given_name) != '' AND LOWER(TRIM(given_name)) != LOWER(TRIM(email)) AND (family_name IS NOT NULL AND TRIM(family_name) != '') THEN TRIM(given_name || ' ' || family_name) END),
          MAX(CASE WHEN given_name IS NOT NULL AND TRIM(given_name) != '' AND LOWER(TRIM(given_name)) != LOWER(TRIM(email)) THEN TRIM(given_name) END),
          MAX(TRIM(given_name)),
          LOWER(TRIM(email))
        ) as name,
        SUM(views) as views,
        TO_CHAR(MAX(date), 'YYYY-MM-DD') as last_accessed
      FROM usage_views_by_user
      GROUP BY LOWER(TRIM(email))
      ORDER BY views DESC
    `);
    
    return query.rows.map(r => ({
      email: r.email,
      name: r.name,
      views: Number(r.views),
      lastAccessed: r.last_accessed
    }));
  }

  /** Get detailed usage breakdown for a specific user */
  async getUserDetails(email: string) {
    const normalizedEmail = (email || '').toLowerCase().trim();
    const historicalViewsQuery = await this.pool.query(`
      SELECT date, SUM(views) as views
      FROM usage_views_by_user
      WHERE LOWER(TRIM(email)) = $1
      GROUP BY date
      ORDER BY date ASC
    `, [normalizedEmail]);

    const reportAccessQuery = await this.pool.query(`
      SELECT report_name, SUM(views) as views, TO_CHAR(MAX(date), 'YYYY-MM-DD') as last_accessed
      FROM usage_user_report_access
      WHERE LOWER(TRIM(email)) = $1
      GROUP BY report_name
      ORDER BY views DESC
    `, [normalizedEmail]);

    const pageAccessQuery = await this.pool.query(`
      SELECT page_name, report_name, SUM(views) as views, TO_CHAR(MAX(date), 'YYYY-MM-DD') as last_accessed
      FROM usage_user_page_access
      WHERE LOWER(TRIM(email)) = $1
      GROUP BY page_name, report_name
      ORDER BY views DESC
    `, [normalizedEmail]);

    const historicalViews = historicalViewsQuery.rows.map(r => {
      const d = new Date(r.date);
      const iso = isNaN(d.getTime()) ? String(r.date) : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      return {
        date: iso,
        views: Number(r.views)
      };
    });

    const fallbackLastAccessed = historicalViews.length ? historicalViews[historicalViews.length - 1].date : null;

    const reportAccess = reportAccessQuery.rows.map(r => ({
      reportName: r.report_name,
      views: Number(r.views),
      lastAccessed: r.last_accessed || fallbackLastAccessed || null
    }));

    const pageAccess = pageAccessQuery.rows.map(r => ({
      pageName: r.page_name,
      reportName: r.report_name,
      views: Number(r.views),
      lastAccessed: r.last_accessed || fallbackLastAccessed || null
    }));

    const totalDashboards = reportAccess.length;
    const topReports = reportAccess.slice(0, 5);
    const leastReports = [...reportAccess].sort((a, b) => a.views - b.views).slice(0, 5);

    return {
      historicalViews,
      reportAccess,
      pageAccess,
      totalDashboards,
      topReports,
      leastReports
    };
  }

  /** Query usage analytics from the dataset behind a usage metric report (works with upgraded and classic formats) */
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
        return [];
      }
    };

    // 1. Detect if it's the classic model by trying to query 'Report views'
    const classicCheck = await runQuery('EVALUATE TOPN(1, \'Report views\')');
    const isClassic = classicCheck.length > 0;

    let viewsByDayRows: any[] = [];
    let viewsByUserRows: any[] = [];
    let viewsByPlatformRows: any[] = [];
    let reportViewsRows: any[] = [];
    let pageViewsRows: any[] = [];
    let userReportAccessRows: any[] = [];
    let userPageAccessRows: any[] = [];

    if (isClassic) {
      this.logger.log(`Querying classic usage metrics dataset: ${datasetId}`);
      // Classic queries
      viewsByDayRows = await runQuery(
        `EVALUATE SUMMARIZECOLUMNS(
          'Report views'[Date],
          "TotalViews", COUNT('Report views'[Date])
        )
        ORDER BY 'Report views'[Date] ASC`,
      );

      // In classic models, summarize directly by Date and UserId
      viewsByUserRows = await runQuery(
        `EVALUATE
        SUMMARIZECOLUMNS(
          'Report views'[Date],
          'Report views'[UserId],
          "TotalViews", COUNT('Report views'[UserId])
        )`,
      );

      viewsByPlatformRows = await runQuery(
        `EVALUATE SUMMARIZECOLUMNS(
          'Report views'[UserAgent],
          "TotalViews", COUNT('Report views'[UserAgent])
        )
        ORDER BY [TotalViews] DESC`,
      );

      // Classic query: group by Report views Date and ReportName (Report views)
      reportViewsRows = await runQuery(
        `EVALUATE
        SUMMARIZECOLUMNS(
          'Report views'[Date],
          'Report views'[ReportName],
          "TotalViews", COUNT('Report views'[ReportName])
        )`,
      );
      // Classic models do not have sub-pages tracked separately usually, so we default page views to match report views
      pageViewsRows = reportViewsRows;

      // Classic UserReportAccess: group by Date, ReportName, UserId
      userReportAccessRows = await runQuery(
        `EVALUATE
        SUMMARIZECOLUMNS(
          'Report views'[Date],
          'Report views'[ReportName],
          'Report views'[UserId],
          "TotalViews", COUNT('Report views'[UserId])
        )`
      );
      // Classic models do not have pages separate from Reports, default userPageAccess to match report access
      userPageAccessRows = userReportAccessRows;
    } else {
      this.logger.log(`Querying upgraded usage metrics dataset: ${datasetId}`);
      // Upgraded queries
      viewsByDayRows = await runQuery(
        `EVALUATE SUMMARIZECOLUMNS(
          Views[Date],
          "TotalViews", SUM(Views[GranularViewsCount])
        )
        ORDER BY Views[Date] ASC`,
      );

      viewsByUserRows = await runQuery(
        `EVALUATE
        SUMMARIZECOLUMNS(
          Views[Date],
          Users[GivenName],
          Users[FamilyName],
          Users[UserPrincipalName],
          "TotalViews", SUM(Views[GranularViewsCount])
        )`,
      );

      viewsByPlatformRows = await runQuery(
        `EVALUATE SUMMARIZECOLUMNS(
          Views[Platform],
          "TotalViews", SUM(Views[GranularViewsCount])
        )
        ORDER BY [TotalViews] DESC`,
      );

      // Upgraded query: group by Date and Reports DisplayName
      reportViewsRows = await runQuery(
        `EVALUATE
        SUMMARIZECOLUMNS(
          Views[Date],
          Reports[DisplayName],
          "TotalViews", SUM(Views[GranularViewsCount])
        )`,
      );

      // Upgraded query: group by Date, Reports DisplayName, and Views ReportPage
      pageViewsRows = await runQuery(
        `EVALUATE
        SUMMARIZECOLUMNS(
          Views[Date],
          Reports[DisplayName],
          Views[ReportPage],
          "TotalViews", SUM(Views[GranularViewsCount])
        )`,
      );

      // Upgraded UserReportAccess: group by Date, DisplayName, UserPrincipalName
      userReportAccessRows = await runQuery(
        `EVALUATE
        SUMMARIZECOLUMNS(
          Views[Date],
          Reports[DisplayName],
          Users[UserPrincipalName],
          Users[GivenName],
          Users[FamilyName],
          "TotalViews", SUM(Views[GranularViewsCount])
        )`
      );

      // Upgraded UserPageAccess: group by Date, Reports DisplayName, ReportPage, UserPrincipalName
      userPageAccessRows = await runQuery(
        `EVALUATE
        SUMMARIZECOLUMNS(
          Views[Date],
          Reports[DisplayName],
          Views[ReportPage],
          Users[UserPrincipalName],
          Users[GivenName],
          Users[FamilyName],
          "TotalViews", SUM(Views[GranularViewsCount])
        )`
      );
    }

    const viewsByDay: ViewsByDay[] = viewsByDayRows.map((r) => ({
      date: String(r[isClassic ? 'Report views[Date]' : 'Views[Date]'] ?? '').slice(0, 10),
      views: Number(r['[TotalViews]'] ?? 0),
    })).filter(r => r.date);

    const viewsByUser: ViewsByUser[] = viewsByUserRows.map((r) => {
      if (isClassic) {
        const email = String(r['Report views[UserId]'] ?? '');
        const namePart = email.split('@')[0] || 'User';
        return {
          givenName: namePart.charAt(0).toUpperCase() + namePart.slice(1),
          familyName: '',
          email,
          date: String(r['Report views[Date]'] ?? '').slice(0, 10),
          views: Number(r['[TotalViews]'] ?? 0),
        };
      } else {
        return {
          givenName: String(r['Users[GivenName]'] ?? ''),
          familyName: String(r['Users[FamilyName]'] ?? ''),
          email: String(r['Users[UserPrincipalName]'] ?? ''),
          date: String(r['Views[Date]'] ?? '').slice(0, 10),
          views: Number(r['[TotalViews]'] ?? 0),
        };
      }
    }).filter(r => r.email && r.date);

    const viewsByPlatform = viewsByPlatformRows.map((r) => {
      const label = String(r[isClassic ? 'Report views[UserAgent]' : 'Views[Platform]'] ?? 'Unknown');
      // Normalize user agents to simpler platform names for classic view
      let platform = label;
      if (isClassic) {
        if (/windows/i.test(label)) platform = 'Windows';
        else if (/macintosh|mac os/i.test(label)) platform = 'Mac';
        else if (/iphone|ipad/i.test(label)) platform = 'iOS Mobile';
        else if (/android/i.test(label)) platform = 'Android Mobile';
        else platform = 'Web Browser';
      }
      return {
        platform,
        views: Number(r['[TotalViews]'] ?? 0),
      };
    });

    // Aggregate platforms to avoid duplicate entries after normalization
    const platformMap = new Map<string, number>();
    for (const p of viewsByPlatform) {
      platformMap.set(p.platform, (platformMap.get(p.platform) ?? 0) + p.views);
    }
    const aggregatedPlatforms = Array.from(platformMap.entries()).map(([platform, views]) => ({
      platform,
      views,
    })).sort((a, b) => b.views - a.views);

    const reportViews = reportViewsRows.map((r) => ({
      reportName: String(r[isClassic ? 'Report views[ReportName]' : 'Reports[DisplayName]'] ?? 'Unknown'),
      date: String(r[isClassic ? 'Report views[Date]' : 'Views[Date]'] ?? '').slice(0, 10),
      views: Number(r['[TotalViews]'] ?? 0),
    })).filter(r => r.reportName && r.date);

    const pageViews = pageViewsRows.map((r) => ({
      pageName: String(r[isClassic ? 'Report views[ReportName]' : 'Views[ReportPage]'] ?? 'Unknown'),
      reportName: String(r[isClassic ? 'Report views[ReportName]' : 'Reports[DisplayName]'] ?? 'Unknown'),
      date: String(r[isClassic ? 'Report views[Date]' : 'Views[Date]'] ?? '').slice(0, 10),
      views: Number(r['[TotalViews]'] ?? 0),
    })).filter(r => r.pageName && r.date);

    const userReportAccess = userReportAccessRows.map((r) => {
      if (isClassic) {
        const email = String(r['Report views[UserId]'] ?? '');
        const namePart = email.split('@')[0] || 'User';
        return {
          givenName: namePart.charAt(0).toUpperCase() + namePart.slice(1),
          familyName: '',
          email,
          reportName: String(r['Report views[ReportName]'] ?? 'Unknown'),
          date: String(r['Report views[Date]'] ?? '').slice(0, 10),
          views: Number(r['[TotalViews]'] ?? 0),
        };
      } else {
        return {
          givenName: String(r['Users[GivenName]'] ?? ''),
          familyName: String(r['Users[FamilyName]'] ?? ''),
          email: String(r['Users[UserPrincipalName]'] ?? ''),
          reportName: String(r['Reports[DisplayName]'] ?? 'Unknown'),
          date: String(r['Views[Date]'] ?? '').slice(0, 10),
          views: Number(r['[TotalViews]'] ?? 0),
        };
      }
    }).filter(r => r.email && r.reportName && r.date);

    const userPageAccess = userPageAccessRows.map((r) => {
      if (isClassic) {
        const email = String(r['Report views[UserId]'] ?? '');
        const namePart = email.split('@')[0] || 'User';
        return {
          givenName: namePart.charAt(0).toUpperCase() + namePart.slice(1),
          familyName: '',
          email,
          reportName: String(r['Report views[ReportName]'] ?? 'Unknown'),
          pageName: String(r['Report views[ReportName]'] ?? 'Unknown'),
          date: String(r['Report views[Date]'] ?? '').slice(0, 10),
          views: Number(r['[TotalViews]'] ?? 0),
        };
      } else {
        return {
          givenName: String(r['Users[GivenName]'] ?? ''),
          familyName: String(r['Users[FamilyName]'] ?? ''),
          email: String(r['Users[UserPrincipalName]'] ?? ''),
          reportName: String(r['Reports[DisplayName]'] ?? 'Unknown'),
          pageName: String(r['Views[ReportPage]'] ?? 'Unknown'),
          date: String(r['Views[Date]'] ?? '').slice(0, 10),
          views: Number(r['[TotalViews]'] ?? 0),
        };
      }
    }).filter(r => r.email && r.pageName && r.date);

    const totalViews = viewsByDay.reduce((s, r) => s + r.views, 0);
    const totalViewers = new Set(viewsByUser.map((u) => u.email)).size;

    // Trigger historical data persistence
    await this.saveHistoricalUsageData(groupId, datasetId, {
      viewsByDay,
      viewsByUser,
      reportViews,
      pageViews,
      userReportAccess,
      userPageAccess
    }).catch(err => this.logger.error('Failed to save historical usage data', err));

    return {
      totalViews,
      totalViewers,
      viewsByDay,
      viewsByUser,
      viewsByPlatform: aggregatedPlatforms,
      reportViews,
      pageViews,
      userReportAccess,
      userPageAccess,
    };
  }

  private async saveHistoricalUsageData(
    groupId: string,
    datasetId: string,
    data: {
      viewsByDay: ViewsByDay[];
      viewsByUser: ViewsByUser[];
      reportViews: { reportName: string; date: string; views: number }[];
      pageViews: { pageName: string; reportName: string; date: string; views: number }[];
      userReportAccess: UserReportAccess[];
      userPageAccess: UserPageAccess[];
    }
  ) {
    // 1. Ensure historical storage tables exist in Postgres
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS usage_views_by_day (
        group_id text NOT NULL,
        dataset_id text NOT NULL,
        date date NOT NULL,
        views integer NOT NULL,
        PRIMARY KEY (group_id, dataset_id, date)
      );
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS usage_views_by_user (
        group_id text NOT NULL,
        dataset_id text NOT NULL,
        email text NOT NULL,
        given_name text,
        family_name text,
        date date NOT NULL,
        views integer NOT NULL,
        PRIMARY KEY (group_id, dataset_id, email, date)
      );
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS usage_views_by_report (
        group_id text NOT NULL,
        dataset_id text NOT NULL,
        report_name text NOT NULL,
        date date NOT NULL,
        views integer NOT NULL,
        PRIMARY KEY (group_id, dataset_id, report_name, date)
      );
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS usage_views_by_page (
        group_id text NOT NULL,
        dataset_id text NOT NULL,
        page_name text NOT NULL,
        report_name text NOT NULL,
        date date NOT NULL,
        views integer NOT NULL,
        PRIMARY KEY (group_id, dataset_id, page_name, report_name, date)
      );
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS usage_user_report_access (
        group_id text NOT NULL,
        dataset_id text NOT NULL,
        email text NOT NULL,
        given_name text,
        family_name text,
        report_name text NOT NULL,
        date date NOT NULL,
        views integer NOT NULL,
        PRIMARY KEY (group_id, dataset_id, email, report_name, date)
      );
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS usage_user_page_access (
        group_id text NOT NULL,
        dataset_id text NOT NULL,
        email text NOT NULL,
        given_name text,
        family_name text,
        report_name text NOT NULL,
        page_name text NOT NULL,
        date date NOT NULL,
        views integer NOT NULL,
        PRIMARY KEY (group_id, dataset_id, email, report_name, page_name, date)
      );
    `);

    // 2. Perform Batch Upserts for viewsByDay
    for (const d of data.viewsByDay) {
      await this.pool.query(`
        INSERT INTO usage_views_by_day (group_id, dataset_id, date, views)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (group_id, dataset_id, date)
        DO UPDATE SET views = EXCLUDED.views;
      `, [groupId, datasetId, d.date, d.views]);
    }

    // 3. Perform Batch Upserts for viewsByUser
    for (const u of data.viewsByUser) {
      await this.pool.query(`
        INSERT INTO usage_views_by_user (group_id, dataset_id, email, given_name, family_name, date, views)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (group_id, dataset_id, email, date)
        DO UPDATE SET views = EXCLUDED.views, given_name = EXCLUDED.given_name, family_name = EXCLUDED.family_name;
      `, [groupId, datasetId, u.email, u.givenName, u.familyName, u.date, u.views]);
    }

    // 4. Perform Batch Upserts for reportViews
    for (const r of data.reportViews) {
      await this.pool.query(`
        INSERT INTO usage_views_by_report (group_id, dataset_id, report_name, date, views)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (group_id, dataset_id, report_name, date)
        DO UPDATE SET views = EXCLUDED.views;
      `, [groupId, datasetId, r.reportName, r.date, r.views]);
    }

    // 5. Perform Batch Upserts for pageViews
    for (const p of data.pageViews) {
      await this.pool.query(`
        INSERT INTO usage_views_by_page (group_id, dataset_id, page_name, report_name, date, views)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (group_id, dataset_id, page_name, report_name, date)
        DO UPDATE SET views = EXCLUDED.views;
      `, [groupId, datasetId, p.pageName, p.reportName, p.date, p.views]);
    }

    // 6. Perform Batch Upserts for userReportAccess
    for (const a of data.userReportAccess) {
      await this.pool.query(`
        INSERT INTO usage_user_report_access (group_id, dataset_id, email, given_name, family_name, report_name, date, views)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (group_id, dataset_id, email, report_name, date)
        DO UPDATE SET views = EXCLUDED.views, given_name = EXCLUDED.given_name, family_name = EXCLUDED.family_name;
      `, [groupId, datasetId, a.email, a.givenName, a.familyName, a.reportName, a.date, a.views]);
    }

    // 7. Perform Batch Upserts for userPageAccess
    for (const a of data.userPageAccess) {
      await this.pool.query(`
        INSERT INTO usage_user_page_access (group_id, dataset_id, email, given_name, family_name, report_name, page_name, date, views)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (group_id, dataset_id, email, report_name, page_name, date)
        DO UPDATE SET views = EXCLUDED.views, given_name = EXCLUDED.given_name, family_name = EXCLUDED.family_name;
      `, [groupId, datasetId, a.email, a.givenName, a.familyName, a.reportName, a.pageName, a.date, a.views]);
    }

    this.logger.log(`Successfully persisted historical usage dataset ${datasetId} to Postgres.`);
  }
}
