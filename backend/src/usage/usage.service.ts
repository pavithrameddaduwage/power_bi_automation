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
    await this.ensureTablesExist();

    // Helper to extract workspace display names mapping from listUsageReports
    let workspaceMap = new Map<string, string>();
    try {
      const reports = await this.listUsageReports();
      for (const r of reports) {
        workspaceMap.set(r.groupId, r.groupName);
      }
    } catch {}

    const filterClause = filterGroupId ? `WHERE group_id = '${filterGroupId}'` : '';

    // 1. Top 10 Workspaces
    const topWorkspacesQuery = await this.pool.query(`
      SELECT group_id, COALESCE(MAX(group_name), '') as group_name, SUM(views) as views
      FROM usage_user_activity
      GROUP BY group_id
      ORDER BY views DESC
      LIMIT 10
    `);
    const topWorkspaces = topWorkspacesQuery.rows.map(r => ({
      name: workspaceMap.get(r.group_id) || (r.group_name && r.group_name.trim() !== '' ? r.group_name : r.group_id),
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
      FROM usage_user_activity
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
      FROM usage_user_activity
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
      FROM usage_user_activity
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
      SELECT group_id, COALESCE(MAX(group_name), '') as group_name, SUM(views) as views
      FROM usage_user_activity
      GROUP BY group_id
      ORDER BY views ASC
      LIMIT 5
    `);
    const leastWorkspaces = leastWorkspacesQuery.rows.map(r => ({
      name: workspaceMap.get(r.group_id) || (r.group_name && r.group_name.trim() !== '' ? r.group_name : r.group_id),
      views: Number(r.views)
    }));

    // 6. Least Used Reports
    const leastReportsQuery = await this.pool.query(`
      SELECT report_name, SUM(views) as views
      FROM usage_user_activity
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
      FROM usage_user_activity
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
      FROM usage_user_activity
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
        FROM usage_user_activity
        ${filterClause}
      `);
      totalViews = Number(totalViewsQuery.rows[0]?.views || 0);

      const viewersQuery = await this.pool.query(`
        SELECT COUNT(DISTINCT LOWER(TRIM(email))) as count
        FROM usage_user_activity
        ${filterClause}
      `);
      totalViewers = Number(viewersQuery.rows[0]?.count || 0);

      const reportsQuery = await this.pool.query(`
        SELECT COUNT(DISTINCT report_name) as count
        FROM usage_user_activity
        ${filterClause}
      `);
      totalReportsCount = Number(reportsQuery.rows[0]?.count || 0);

      const wsQuery = await this.pool.query(`
        SELECT COUNT(DISTINCT group_id) as count
        FROM usage_user_activity
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
    await this.ensureTablesExist();
    try {
      let query = `
        SELECT date, COALESCE(NULLIF(group_name, ''), group_id) as "Workspace Name", report_name as "Report Name", page_name as "Page Name", email as "User Email", views as "Views"
        FROM usage_user_activity
      `;
      const params = [];
      if (groupId) {
        query += ` WHERE group_id = $1`;
        params.push(groupId);
      }
      query += ` ORDER BY date DESC, report_name ASC, email ASC`;

      const result = await this.pool.query(query, params);
      return result.rows;
    } catch (e) {
      this.logger.error('Failed to fetch raw user report access', e);
      return [];
    }
  }

  /** Get aggregated stats for all users */
  async getAllUsersStats() {
    await this.ensureTablesExist();
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
      FROM usage_user_activity
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
    await this.ensureTablesExist();
    let workspaceMap = new Map<string, string>();
    try {
      const reports = await this.listUsageReports();
      for (const r of reports) {
        workspaceMap.set(r.groupId, r.groupName);
      }
    } catch {}

    const normalizedEmail = (email || '').toLowerCase().trim();

    // 1. Exact daily view counts for the user
    const historicalViewsQuery = await this.pool.query(`
      SELECT TO_CHAR(date, 'YYYY-MM-DD') as date, SUM(views) as views
      FROM usage_user_activity
      WHERE LOWER(TRIM(email)) = $1
      GROUP BY date
      ORDER BY date ASC
    `, [normalizedEmail]);

    // 2. Exact daily report access records
    const dailyReportAccessQuery = await this.pool.query(`
      SELECT group_id, COALESCE(MAX(group_name), '') as group_name, report_name, TO_CHAR(date, 'YYYY-MM-DD') as date, SUM(views) as views
      FROM usage_user_activity
      WHERE LOWER(TRIM(email)) = $1
      GROUP BY group_id, report_name, date
      ORDER BY date DESC, views DESC
    `, [normalizedEmail]);

    // 3. Exact daily page tab access records
    const dailyPageAccessQuery = await this.pool.query(`
      SELECT group_id, COALESCE(MAX(group_name), '') as group_name, report_name, page_name, TO_CHAR(date, 'YYYY-MM-DD') as date, SUM(views) as views
      FROM usage_user_activity
      WHERE LOWER(TRIM(email)) = $1
      GROUP BY group_id, report_name, page_name, date
      ORDER BY date DESC, views DESC
    `, [normalizedEmail]);

    // 4. All-time aggregate report access
    const reportAccessQuery = await this.pool.query(`
      SELECT report_name, SUM(views) as views, TO_CHAR(MAX(date), 'YYYY-MM-DD') as last_accessed
      FROM usage_user_activity
      WHERE LOWER(TRIM(email)) = $1
      GROUP BY report_name
      ORDER BY views DESC
    `, [normalizedEmail]);

    // 5. All-time aggregate page access
    const pageAccessQuery = await this.pool.query(`
      SELECT page_name, report_name, SUM(views) as views, TO_CHAR(MAX(date), 'YYYY-MM-DD') as last_accessed
      FROM usage_user_activity
      WHERE LOWER(TRIM(email)) = $1
      GROUP BY page_name, report_name
      ORDER BY views DESC
    `, [normalizedEmail]);

    const historicalViews = historicalViewsQuery.rows.map(r => ({
      date: r.date,
      views: Number(r.views)
    }));

    const dailyReportAccess = dailyReportAccessQuery.rows.map(r => ({
      groupId: r.group_id,
      workspaceName: workspaceMap.get(r.group_id) || (r.group_name && r.group_name.trim() !== '' ? r.group_name : r.group_id),
      reportName: r.report_name,
      date: r.date,
      views: Number(r.views)
    }));

    const dailyPageAccess = dailyPageAccessQuery.rows.map(r => ({
      groupId: r.group_id,
      workspaceName: workspaceMap.get(r.group_id) || (r.group_name && r.group_name.trim() !== '' ? r.group_name : r.group_id),
      reportName: r.report_name,
      pageName: r.page_name,
      date: r.date,
      views: Number(r.views)
    }));

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
      dailyReportAccess,
      dailyPageAccess,
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
          'Report views'[Date],
          'Report views'[UserAgent],
          "TotalViews", COUNT('Report views'[UserAgent])
        )`,
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
          Views[Date],
          Views[Platform],
          "TotalViews", SUM(Views[GranularViewsCount])
        )
        ORDER BY Views[Date] ASC`,
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
        const rawEmail = String(r['Report views[UserId]'] ?? '');
        const email = rawEmail.toLowerCase().trim();
        const namePart = email.split('@')[0] || 'User';
        return {
          givenName: namePart.charAt(0).toUpperCase() + namePart.slice(1),
          familyName: '',
          email,
          date: String(r['Report views[Date]'] ?? '').slice(0, 10),
          views: Number(r['[TotalViews]'] ?? 0),
        };
      } else {
        const rawEmail = String(r['Users[UserPrincipalName]'] ?? '');
        return {
          givenName: String(r['Users[GivenName]'] ?? ''),
          familyName: String(r['Users[FamilyName]'] ?? ''),
          email: rawEmail.toLowerCase().trim(),
          date: String(r['Views[Date]'] ?? '').slice(0, 10),
          views: Number(r['[TotalViews]'] ?? 0),
        };
      }
    }).filter(r => r.email && r.date);

    const viewsByPlatform = viewsByPlatformRows.map((r) => {
      const label = String(r[isClassic ? 'Report views[UserAgent]' : 'Views[Platform]'] ?? 'Unknown');
      const date = String(r[isClassic ? 'Report views[Date]' : 'Views[Date]'] ?? '').slice(0, 10);
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
        date: date || undefined
      };
    });

    const reportViews = reportViewsRows.map((r) => ({
      reportName: String(r[isClassic ? 'Report views[ReportName]' : 'Reports[DisplayName]'] ?? 'Unknown'),
      date: String(r[isClassic ? 'Report views[Date]' : 'Views[Date]'] ?? '').slice(0, 10),
      views: Number(r['[TotalViews]'] ?? 0),
    })).filter(r => r.reportName && r.date);

    let pageViews = pageViewsRows.map((r) => ({
      pageName: String(r[isClassic ? 'Report views[ReportName]' : 'Views[ReportPage]'] ?? 'Unknown'),
      reportName: String(r[isClassic ? 'Report views[ReportName]' : 'Reports[DisplayName]'] ?? 'Unknown'),
      date: String(r[isClassic ? 'Report views[Date]' : 'Views[Date]'] ?? '').slice(0, 10),
      views: Number(r['[TotalViews]'] ?? 0),
    })).filter(r => r.pageName && r.date);

    if (!pageViews.length && reportViews.length) {
      pageViews = reportViews.map(r => ({
        pageName: r.reportName,
        reportName: r.reportName,
        date: r.date,
        views: r.views
      }));
    }

    const userReportAccess = userReportAccessRows.map((r) => {
      if (isClassic) {
        const rawEmail = String(r['Report views[UserId]'] ?? '');
        const email = rawEmail.toLowerCase().trim();
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
        const rawEmail = String(r['Users[UserPrincipalName]'] ?? '');
        return {
          givenName: String(r['Users[GivenName]'] ?? ''),
          familyName: String(r['Users[FamilyName]'] ?? ''),
          email: rawEmail.toLowerCase().trim(),
          reportName: String(r['Reports[DisplayName]'] ?? 'Unknown'),
          date: String(r['Views[Date]'] ?? '').slice(0, 10),
          views: Number(r['[TotalViews]'] ?? 0),
        };
      }
    }).filter(r => r.email && r.reportName && r.date);

    let userPageAccess = userPageAccessRows.map((r) => {
      if (isClassic) {
        const rawEmail = String(r['Report views[UserId]'] ?? '');
        const email = rawEmail.toLowerCase().trim();
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
        const rawEmail = String(r['Users[UserPrincipalName]'] ?? '');
        return {
          givenName: String(r['Users[GivenName]'] ?? ''),
          familyName: String(r['Users[FamilyName]'] ?? ''),
          email: rawEmail.toLowerCase().trim(),
          reportName: String(r['Reports[DisplayName]'] ?? 'Unknown'),
          pageName: String(r['Views[ReportPage]'] ?? 'Unknown'),
          date: String(r['Views[Date]'] ?? '').slice(0, 10),
          views: Number(r['[TotalViews]'] ?? 0),
        };
      }
    }).filter(r => r.email && r.pageName && r.date);

    if (!userPageAccess.length && userReportAccess.length) {
      userPageAccess = userReportAccess.map(r => ({
        ...r,
        pageName: r.reportName
      }));
    }

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
      viewsByPlatform,
      reportViews,
      pageViews,
      userReportAccess,
      userPageAccess,
    };
  }

  private async ensureTablesExist() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS usage_user_activity (
        id bigserial PRIMARY KEY,
        group_id text NOT NULL,
        group_name text DEFAULT '',
        dataset_id text NOT NULL,
        email text NOT NULL,
        given_name text DEFAULT '',
        family_name text DEFAULT '',
        report_name text NOT NULL DEFAULT 'Unknown',
        page_name text NOT NULL DEFAULT 'Unknown',
        date date NOT NULL,
        views integer NOT NULL DEFAULT 1,
        platform text DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (group_id, dataset_id, email, report_name, page_name, date)
      );

      CREATE INDEX IF NOT EXISTS idx_usage_user_activity_email ON usage_user_activity (email);
      CREATE INDEX IF NOT EXISTS idx_usage_user_activity_group_id ON usage_user_activity (group_id);
      CREATE INDEX IF NOT EXISTS idx_usage_user_activity_date ON usage_user_activity (date);
      CREATE INDEX IF NOT EXISTS idx_usage_user_activity_report_name ON usage_user_activity (report_name);
    `);

    // Auto-migrate from legacy tables if they exist
    try {
      await this.pool.query(`
        DO $$
        BEGIN
          -- 1. Migrate from usage_user_page_access
          IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'usage_user_page_access') THEN
            INSERT INTO usage_user_activity (group_id, dataset_id, email, given_name, family_name, report_name, page_name, date, views, updated_at)
            SELECT group_id, dataset_id, email, given_name, family_name, report_name, page_name, date, views, now()
            FROM usage_user_page_access
            ON CONFLICT (group_id, dataset_id, email, report_name, page_name, date)
            DO UPDATE SET
              views = EXCLUDED.views,
              given_name = COALESCE(NULLIF(EXCLUDED.given_name, ''), usage_user_activity.given_name),
              family_name = COALESCE(NULLIF(EXCLUDED.family_name, ''), usage_user_activity.family_name),
              updated_at = now();
          END IF;

          -- 2. Migrate from usage_user_report_access
          IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'usage_user_report_access') THEN
            INSERT INTO usage_user_activity (group_id, dataset_id, email, given_name, family_name, report_name, page_name, date, views, updated_at)
            SELECT group_id, dataset_id, email, given_name, family_name, report_name, report_name, date, views, now()
            FROM usage_user_report_access
            ON CONFLICT (group_id, dataset_id, email, report_name, page_name, date)
            DO UPDATE SET
              views = EXCLUDED.views,
              updated_at = now();
          END IF;

          -- 3. Migrate from usage_views_by_user
          IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'usage_views_by_user') THEN
            INSERT INTO usage_user_activity (group_id, dataset_id, email, given_name, family_name, report_name, page_name, date, views, updated_at)
            SELECT group_id, dataset_id, email, given_name, family_name, 'General Usage', 'Overview', date, views, now()
            FROM usage_views_by_user
            ON CONFLICT (group_id, dataset_id, email, report_name, page_name, date)
            DO NOTHING;
          END IF;
        END $$;
      `);
    } catch (migErr: any) {
      this.logger.warn(`Legacy migration skipped or completed: ${migErr?.message || migErr}`);
    }
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
    // 1. Ensure the single unified table exists
    await this.ensureTablesExist();

    // Map workspace name if available
    let workspaceName = '';
    try {
      const reports = await this.listUsageReports();
      const match = reports.find(r => r.groupId === groupId);
      if (match) workspaceName = match.groupName;
    } catch {}

    // Prepare consolidated entries for usage_user_activity
    const userActivityMap = new Map<string, {
      groupId: string;
      groupName: string;
      datasetId: string;
      email: string;
      givenName: string;
      familyName: string;
      reportName: string;
      pageName: string;
      date: string;
      views: number;
    }>();

    // 1. Ingest detailed userPageAccess
    for (const a of data.userPageAccess) {
      if (!a.email || !a.date) continue;
      const key = `${groupId}|${datasetId}|${a.email.toLowerCase().trim()}|${a.reportName || 'Unknown'}|${a.pageName || 'Unknown'}|${a.date}`;
      userActivityMap.set(key, {
        groupId,
        groupName: workspaceName,
        datasetId,
        email: a.email.toLowerCase().trim(),
        givenName: a.givenName || '',
        familyName: a.familyName || '',
        reportName: a.reportName || 'Unknown',
        pageName: a.pageName || 'Unknown',
        date: a.date,
        views: a.views || 1,
      });
    }

    // 2. Ingest userReportAccess (if not already captured in userPageAccess)
    for (const r of data.userReportAccess) {
      if (!r.email || !r.date) continue;
      const email = r.email.toLowerCase().trim();
      const reportName = r.reportName || 'Unknown';
      const prefix = `${groupId}|${datasetId}|${email}|${reportName}|`;
      const hasPageEntry = Array.from(userActivityMap.keys()).some(k => k.startsWith(prefix) && k.endsWith(`|${r.date}`));
      if (!hasPageEntry) {
        const key = `${groupId}|${datasetId}|${email}|${reportName}|${reportName}|${r.date}`;
        userActivityMap.set(key, {
          groupId,
          groupName: workspaceName,
          datasetId,
          email,
          givenName: r.givenName || '',
          familyName: r.familyName || '',
          reportName,
          pageName: reportName,
          date: r.date,
          views: r.views || 1,
        });
      }
    }

    // 3. Ingest viewsByUser (if user+date not captured above)
    for (const u of data.viewsByUser) {
      if (!u.email || !u.date) continue;
      const email = u.email.toLowerCase().trim();
      const prefix = `${groupId}|${datasetId}|${email}|`;
      const hasAnyEntry = Array.from(userActivityMap.keys()).some(k => k.startsWith(prefix) && k.endsWith(`|${u.date}`));
      if (!hasAnyEntry) {
        const key = `${groupId}|${datasetId}|${email}|General Usage|Overview|${u.date}`;
        userActivityMap.set(key, {
          groupId,
          groupName: workspaceName,
          datasetId,
          email,
          givenName: u.givenName || '',
          familyName: u.familyName || '',
          reportName: 'General Usage',
          pageName: 'Overview',
          date: u.date,
          views: u.views || 1,
        });
      }
    }

    // 4. Batch UPSERT into usage_user_activity
    const records = Array.from(userActivityMap.values());
    for (const item of records) {
      await this.pool.query(`
        INSERT INTO usage_user_activity (
          group_id, group_name, dataset_id, email, given_name, family_name,
          report_name, page_name, date, views, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
        ON CONFLICT (group_id, dataset_id, email, report_name, page_name, date)
        DO UPDATE SET
          views = EXCLUDED.views,
          given_name = COALESCE(NULLIF(EXCLUDED.given_name, ''), usage_user_activity.given_name),
          family_name = COALESCE(NULLIF(EXCLUDED.family_name, ''), usage_user_activity.family_name),
          group_name = COALESCE(NULLIF(EXCLUDED.group_name, ''), usage_user_activity.group_name),
          updated_at = now();
      `, [
        item.groupId,
        item.groupName,
        item.datasetId,
        item.email,
        item.givenName,
        item.familyName,
        item.reportName,
        item.pageName,
        item.date,
        item.views
      ]);
    }

    this.logger.log(`Successfully persisted ${records.length} activity records to unified table usage_user_activity for dataset ${datasetId}.`);
  }

  /** Unified multi-dimensional analytics for the dashboard */
  async getDashboardAnalytics(filters: {
    groupId?: string;
    reportName?: string;
    email?: string;
    year?: string | number;
    month?: string | number;
    date?: string;
  } = {}) {
    await this.ensureTablesExist();

    let workspaceMap = new Map<string, string>();
    try {
      const reports = await this.listUsageReports();
      for (const r of reports) {
        workspaceMap.set(r.groupId, r.groupName);
      }
    } catch {}

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    // Filter out internal usage metric report names from standard reporting
    conditions.push(`(report_name NOT ILIKE '%usage%metric%' AND report_name NOT ILIKE '%report usage%')`);

    if (filters.groupId && filters.groupId.trim() !== '') {
      conditions.push(`group_id = $${paramIdx++}`);
      params.push(filters.groupId.trim());
    }

    if (filters.reportName && filters.reportName.trim() !== '') {
      conditions.push(`report_name = $${paramIdx++}`);
      params.push(filters.reportName.trim());
    }

    if (filters.email && filters.email.trim() !== '') {
      conditions.push(`LOWER(TRIM(email)) = LOWER(TRIM($${paramIdx++}))`);
      params.push(filters.email.trim());
    }

    if (filters.year && String(filters.year).trim() !== '') {
      conditions.push(`EXTRACT(YEAR FROM date) = $${paramIdx++}`);
      params.push(Number(filters.year));
    }

    if (filters.month && String(filters.month).trim() !== '') {
      conditions.push(`EXTRACT(MONTH FROM date) = $${paramIdx++}`);
      params.push(Number(filters.month));
    }

    if (filters.date && filters.date.trim() !== '') {
      conditions.push(`TO_CHAR(date, 'YYYY-MM-DD') = $${paramIdx++}`);
      params.push(filters.date.trim());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 1. Overall KPIs
    const kpiQuery = await this.pool.query(`
      SELECT 
        COALESCE(SUM(views), 0) as total_views,
        COUNT(DISTINCT LOWER(TRIM(email))) as total_viewers,
        COUNT(DISTINCT report_name) as total_reports,
        COUNT(DISTINCT page_name) as total_pages,
        COUNT(DISTINCT group_id) as total_workspaces
      FROM usage_user_activity
      ${whereClause}
    `, params);

    const totalViews = Number(kpiQuery.rows[0]?.total_views || 0);
    const totalViewers = Number(kpiQuery.rows[0]?.total_viewers || 0);
    const totalReports = Number(kpiQuery.rows[0]?.total_reports || 0);
    const totalPages = Number(kpiQuery.rows[0]?.total_pages || 0);
    const totalWorkspaces = Number(kpiQuery.rows[0]?.total_workspaces || 0);

    // 2. Top Report
    const topReportQuery = await this.pool.query(`
      SELECT report_name, SUM(views) as views
      FROM usage_user_activity
      ${whereClause}
      GROUP BY report_name
      ORDER BY views DESC
      LIMIT 1
    `, params);
    const topReport = topReportQuery.rows[0] ? {
      name: topReportQuery.rows[0].report_name,
      views: Number(topReportQuery.rows[0].views)
    } : null;

    // 3. Most Active User
    const topUserQuery = await this.pool.query(`
      SELECT 
        LOWER(TRIM(email)) as email,
        COALESCE(
          MAX(CASE WHEN given_name IS NOT NULL AND TRIM(given_name) != '' AND LOWER(TRIM(given_name)) != LOWER(TRIM(email)) AND (family_name IS NOT NULL AND TRIM(family_name) != '') THEN TRIM(given_name || ' ' || family_name) END),
          MAX(CASE WHEN given_name IS NOT NULL AND TRIM(given_name) != '' AND LOWER(TRIM(given_name)) != LOWER(TRIM(email)) THEN TRIM(given_name) END),
          MAX(TRIM(given_name)),
          LOWER(TRIM(email))
        ) as name,
        SUM(views) as views
      FROM usage_user_activity
      ${whereClause}
      GROUP BY LOWER(TRIM(email))
      ORDER BY views DESC
      LIMIT 1
    `, params);
    const mostActiveUser = topUserQuery.rows[0] ? {
      name: topUserQuery.rows[0].name,
      email: topUserQuery.rows[0].email,
      views: Number(topUserQuery.rows[0].views)
    } : null;

    // 4. Page-wise / Tab-wise Usage (Single diagram)
    const pageUsageQuery = await this.pool.query(`
      SELECT 
        page_name,
        report_name,
        SUM(views) as views,
        COUNT(DISTINCT LOWER(TRIM(email))) as viewers,
        TO_CHAR(MAX(date), 'YYYY-MM-DD') as last_accessed
      FROM usage_user_activity
      ${whereClause}
      GROUP BY page_name, report_name
      ORDER BY views DESC
    `, params);

    const maxPageViews = pageUsageQuery.rows.length > 0 ? Number(pageUsageQuery.rows[0].views) : 1;
    const pageUsage = pageUsageQuery.rows.map(r => {
      const views = Number(r.views);
      return {
        pageName: r.page_name,
        reportName: r.report_name,
        views,
        viewers: Number(r.viewers),
        lastAccessed: r.last_accessed,
        percent: totalViews > 0 ? Math.round((views / totalViews) * 100) : 0,
        relativePercent: maxPageViews > 0 ? Math.round((views / maxPageViews) * 100) : 0
      };
    });

    // 5. User-wise Analysis & Activity
    const userUsageQuery = await this.pool.query(`
      SELECT 
        LOWER(TRIM(email)) as email,
        COALESCE(
          MAX(CASE WHEN given_name IS NOT NULL AND TRIM(given_name) != '' AND LOWER(TRIM(given_name)) != LOWER(TRIM(email)) AND (family_name IS NOT NULL AND TRIM(family_name) != '') THEN TRIM(given_name || ' ' || family_name) END),
          MAX(CASE WHEN given_name IS NOT NULL AND TRIM(given_name) != '' AND LOWER(TRIM(given_name)) != LOWER(TRIM(email)) THEN TRIM(given_name) END),
          MAX(TRIM(given_name)),
          LOWER(TRIM(email))
        ) as name,
        SUM(views) as views,
        TO_CHAR(MAX(date), 'YYYY-MM-DD') as last_accessed,
        COUNT(DISTINCT report_name) as reports_count,
        COUNT(DISTINCT page_name) as pages_count
      FROM usage_user_activity
      ${whereClause}
      GROUP BY LOWER(TRIM(email))
      ORDER BY views DESC
    `, params);

    const userPagesQuery = await this.pool.query(`
      SELECT 
        LOWER(TRIM(email)) as email,
        page_name,
        report_name,
        SUM(views) as views,
        TO_CHAR(MAX(date), 'YYYY-MM-DD') as last_accessed
      FROM usage_user_activity
      ${whereClause}
      GROUP BY LOWER(TRIM(email)), page_name, report_name
      ORDER BY views DESC
    `, params);

    const userPagesMap = new Map<string, Array<{ pageName: string; reportName: string; views: number; lastAccessed: string }>>();
    for (const row of userPagesQuery.rows) {
      const em = row.email;
      if (!userPagesMap.has(em)) {
        userPagesMap.set(em, []);
      }
      userPagesMap.get(em)!.push({
        pageName: row.page_name,
        reportName: row.report_name,
        views: Number(row.views),
        lastAccessed: row.last_accessed
      });
    }

    const userUsage = userUsageQuery.rows.map(r => ({
      email: r.email,
      name: r.name,
      views: Number(r.views),
      lastAccessed: r.last_accessed,
      reportsCount: Number(r.reports_count),
      pagesCount: Number(r.pages_count),
      pages: userPagesMap.get(r.email) || []
    }));

    // 6. Views Timeline (Daily trend)
    const timelineQuery = await this.pool.query(`
      SELECT TO_CHAR(date, 'YYYY-MM-DD') as date, SUM(views) as views
      FROM usage_user_activity
      ${whereClause}
      GROUP BY date
      ORDER BY date ASC
    `, params);
    const viewsTimeline = timelineQuery.rows.map(r => ({
      date: r.date,
      views: Number(r.views)
    }));

    // 7. Dynamic Filter Options (populated from DB + live workspaces)
    const wsFilterQuery = await this.pool.query(`
      SELECT DISTINCT group_id, COALESCE(MAX(group_name), '') as group_name
      FROM usage_user_activity
      GROUP BY group_id
      ORDER BY group_name ASC
    `);
    const availableWorkspaces = wsFilterQuery.rows.map(r => ({
      groupId: r.group_id,
      groupName: workspaceMap.get(r.group_id) || (r.group_name && r.group_name.trim() !== '' ? r.group_name : r.group_id)
    }));

    const reportFilterWhere = filters.groupId ? `WHERE group_id = '${filters.groupId}' AND report_name NOT ILIKE '%usage%metric%' AND report_name NOT ILIKE '%report usage%'` : `WHERE report_name NOT ILIKE '%usage%metric%' AND report_name NOT ILIKE '%report usage%'`;
    const repFilterQuery = await this.pool.query(`
      SELECT DISTINCT report_name, group_id
      FROM usage_user_activity
      ${reportFilterWhere}
      ORDER BY report_name ASC
    `);
    const availableReports = repFilterQuery.rows.map(r => ({
      reportName: r.report_name,
      groupId: r.group_id
    }));

    const userFilterConditions = [`(report_name NOT ILIKE '%usage%metric%' AND report_name NOT ILIKE '%report usage%')`];
    if (filters.groupId) userFilterConditions.push(`group_id = '${filters.groupId}'`);
    if (filters.reportName) userFilterConditions.push(`report_name = '${filters.reportName}'`);
    const userFilterWhere = `WHERE ${userFilterConditions.join(' AND ')}`;

    const usersFilterQuery = await this.pool.query(`
      SELECT 
        LOWER(TRIM(email)) as email,
        COALESCE(
          MAX(CASE WHEN given_name IS NOT NULL AND TRIM(given_name) != '' AND LOWER(TRIM(given_name)) != LOWER(TRIM(email)) AND (family_name IS NOT NULL AND TRIM(family_name) != '') THEN TRIM(given_name || ' ' || family_name) END),
          MAX(CASE WHEN given_name IS NOT NULL AND TRIM(given_name) != '' AND LOWER(TRIM(given_name)) != LOWER(TRIM(email)) THEN TRIM(given_name) END),
          MAX(TRIM(given_name)),
          LOWER(TRIM(email))
        ) as name
      FROM usage_user_activity
      ${userFilterWhere}
      GROUP BY LOWER(TRIM(email))
      ORDER BY name ASC
    `);
    const isServicePrincipal = (displayName: string = '', email: string = '', principalType: string = '') => {
      const pType = (principalType || '').toLowerCase();
      const disp = (displayName || '').toLowerCase();
      const em = (email || '').toLowerCase();
      const isGuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
      return (
        pType === 'app' ||
        pType === 'serviceprincipal' ||
        disp.includes('serviceprincipal') ||
        disp.includes('powerbi-api') ||
        em.includes('powerbi-api') ||
        em.includes('serviceprincipal') ||
        isGuid(disp) ||
        isGuid(em) ||
        isGuid(em.split('@')[0])
      );
    };

    const availableUsers = usersFilterQuery.rows
      .filter(r => !isServicePrincipal(r.name, r.email))
      .map(r => ({
        email: r.email,
        name: r.name
      }));

    const yearsQuery = await this.pool.query(`
      SELECT DISTINCT EXTRACT(YEAR FROM date)::integer as year
      FROM usage_user_activity
      ORDER BY year DESC
    `);
    const availableYears = yearsQuery.rows.map(r => r.year);

    const dateConditions = [];
    if (filters.year) dateConditions.push(`EXTRACT(YEAR FROM date) = ${Number(filters.year)}`);
    if (filters.month) dateConditions.push(`EXTRACT(MONTH FROM date) = ${Number(filters.month)}`);
    const dateWhere = dateConditions.length > 0 ? `WHERE ${dateConditions.join(' AND ')}` : '';
    const datesQuery = await this.pool.query(`
      SELECT DISTINCT TO_CHAR(date, 'YYYY-MM-DD') as date
      FROM usage_user_activity
      ${dateWhere}
      ORDER BY date DESC
    `);
    const availableDates = datesQuery.rows.map(r => r.date);

    return {
      kpis: {
        totalViews,
        totalViewers,
        totalReports,
        totalPages,
        totalWorkspaces,
        topReport,
        mostActiveUser
      },
      pageUsage,
      userUsage,
      viewsTimeline,
      filterOptions: {
        workspaces: availableWorkspaces,
        reports: availableReports,
        users: availableUsers,
        years: availableYears,
        dates: availableDates
      }
    };
  }

  /** Access Level and Unused Access Audit */
  async getAccessUtilization(groupId?: string, reportName?: string) {
    await this.ensureTablesExist();

    const isServicePrincipal = (displayName: string = '', email: string = '', principalType: string = '') => {
      const pType = (principalType || '').toLowerCase();
      const disp = (displayName || '').toLowerCase();
      const em = (email || '').toLowerCase();
      const isGuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
      return (
        pType === 'app' ||
        pType === 'serviceprincipal' ||
        disp.includes('serviceprincipal') ||
        disp.includes('powerbi-api') ||
        em.includes('powerbi-api') ||
        em.includes('serviceprincipal') ||
        isGuid(disp) ||
        isGuid(em) ||
        isGuid(em.split('@')[0])
      );
    };

    let workspaceName = '';
    let rawAccessUsers: WorkspaceUser[] = [];

    if (groupId && groupId.trim() !== '') {
      try {
        rawAccessUsers = await this.getWorkspaceUsers(groupId);
        const reports = await this.listUsageReports();
        const match = reports.find(r => r.groupId === groupId);
        if (match) workspaceName = match.groupName;
      } catch (err: any) {
        this.logger.warn(`Could not fetch group users for ${groupId}: ${err?.message}`);
      }
    } else {
      try {
        const reports = await this.listUsageReports();
        const seenWorkspaces = new Set<string>();
        for (const r of reports) {
          if (!seenWorkspaces.has(r.groupId)) {
            seenWorkspaces.add(r.groupId);
            try {
              const uList = await this.getWorkspaceUsers(r.groupId);
              rawAccessUsers.push(...uList);
            } catch {}
          }
        }
      } catch (err: any) {
        this.logger.warn(`Could not fetch all group users: ${err?.message}`);
      }
    }

    const accessUserMap = new Map<string, WorkspaceUser>();
    for (const u of rawAccessUsers) {
      if (isServicePrincipal(u.displayName, u.email, u.principalType)) {
        continue;
      }
      const em = (u.email || '').toLowerCase().trim();
      if (em) {
        if (!accessUserMap.has(em) || (u.role && u.role !== 'Unknown' && accessUserMap.get(em)?.role === 'Unknown')) {
          accessUserMap.set(em, u);
        }
      }
    }

    const conditions = [`(report_name NOT ILIKE '%usage%metric%' AND report_name NOT ILIKE '%report usage%')`];
    const params: any[] = [];
    let pIdx = 1;
    if (groupId && groupId.trim() !== '') {
      conditions.push(`group_id = $${pIdx++}`);
      params.push(groupId.trim());
    }
    if (reportName && reportName.trim() !== '') {
      conditions.push(`report_name = $${pIdx++}`);
      params.push(reportName.trim());
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const activityQuery = await this.pool.query(`
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
      FROM usage_user_activity
      ${whereClause}
      GROUP BY LOWER(TRIM(email))
    `, params);

    const activityMap = new Map<string, { name: string; views: number; lastAccessed: string }>();
    for (const row of activityQuery.rows) {
      if (isServicePrincipal(row.name, row.email)) {
        continue;
      }
      activityMap.set(row.email, {
        name: row.name,
        views: Number(row.views),
        lastAccessed: row.last_accessed
      });
    }

    for (const [em, act] of activityMap.entries()) {
      if (!accessUserMap.has(em)) {
        accessUserMap.set(em, {
          displayName: act.name || em,
          email: em,
          role: 'Viewer',
          principalType: 'User'
        });
      }
    }

    const annotatedUsers = [];
    for (const [em, u] of accessUserMap.entries()) {
      if (isServicePrincipal(u.displayName, u.email, u.principalType)) {
        continue;
      }
      const act = activityMap.get(em);
      const views = act ? act.views : 0;
      const lastAccessed = act ? act.lastAccessed : null;
      // Active user criteria: must have views and last accessed in current year 2026
      const isActiveIn2026 = Boolean(
        views > 0 && 
        lastAccessed && 
        lastAccessed.startsWith('2026')
      );
      annotatedUsers.push({
        displayName: u.displayName && u.displayName !== u.email ? u.displayName : (act?.name || u.displayName || em),
        email: em,
        role: u.role || 'Viewer',
        principalType: u.principalType || 'User',
        views,
        lastAccessed,
        status: isActiveIn2026 ? 'active' : 'unused'
      });
    }

    annotatedUsers.sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'active' ? -1 : 1;
      }
      return b.views - a.views;
    });

    const totalUsers = annotatedUsers.length;
    const activeUsers = annotatedUsers.filter(u => u.status === 'active').length;
    const unusedUsers = annotatedUsers.filter(u => u.status === 'unused').length;
    const unusedRate = totalUsers > 0 ? Math.round((unusedUsers / totalUsers) * 100) : 0;

    return {
      totalUsers,
      activeUsers,
      unusedUsers,
      unusedRate,
      users: annotatedUsers,
      workspaceName,
      reportName
    };
  }
}
