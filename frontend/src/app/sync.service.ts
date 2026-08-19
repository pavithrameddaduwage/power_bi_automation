import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

const API = 'http://localhost:3000/api';

export interface ReportConfig {
  request: string;
  dashboardName: string;
  targetTable: string;
  businessKeys: string[];
}
export interface SyncRun {
  id: number;
  request: string;
  target_table: string | null;
  snapshot_date: string | null;
  rows_written: number | null;
  status: string;
  error: string | null;
  started_at: string;
}
export interface EmailLog {
  id: number;
  recipients: string;
  subject: string;
  file_name?: string;
  file_size_bytes?: number;
  status: string;
  preview_url?: string;
  error?: string;
  sent_at: string;
}

export interface AccessEntry {
  name: string;
  email: string;
  role: string;
  principalType: string;
  canDownload: boolean;
}
export interface ReportWithAccess {
  id: string;
  name: string;
  reportType: string;
  webUrl?: string;
  datasetId?: string;
  workspaceId: string;
  workspaceName: string;
  downloadable: boolean;
  access: AccessEntry[];
}
export interface Dashboard {
  id: string;
  displayName: string;
  groupId: string;
  groupName: string;
}

export interface DatasetColumn {
  table: string;
  name: string;
  dataType: string;
  isKey?: boolean;
}
export interface DatasetMeasure {
  table: string;
  name: string;
  dataType: string;
}
export interface DynamicDataset {
  kind: string;
  label: string;
  table_name: string;
  owner: string | null;
  columns: { original: string; name: string; type: string }[];
  last_rows: number;
  locked: boolean;
  updated_at: string;
}
export interface UploadResult {
  table: string;
  kind: string;
  label: string;
  rowsWritten: number;
  totalRows: number;
  columns: { original: string; name: string; type: string }[];
}

export interface Job {
  id: number;
  name: string;
  report_name: string | null;
  dataset_id: string;
  source_table: string;
  columns: string[];
  target_table: string;
  mode: 'append' | 'upsert';
  business_keys: string[] | null;
  row_limit: number;
  owner: string | null;
  cron: string | null;
  enabled: boolean;
  last_run_at: string | null;
  last_status: string | null;
  last_rows: number | null;
}
export interface CreateJob {
  name: string;
  reportName?: string;
  datasetId: string;
  sourceTable: string;
  columns: string[];
  measures?: string[];
  targetTable: string;
  mode: 'append' | 'upsert';
  businessKeys?: string[];
  limit?: number;
  owner?: string;
  cron?: string;
  dateColumn?: string;
  dateFrom?: string;
  dateTo?: string;
  recipients?: string;
  emailSubject?: string;
}

/** A saved external database connection (password never returned). */
export interface DbConnection {
  id: number;
  label: string;
  host: string;
  port: number;
  dbname: string;
  username: string;
  is_active: boolean;
  created_at: string;
}

export interface NewDbDto {
  label?: string;
  host: string;
  port?: number;
  dbname: string;
  username: string;
  password: string;
}

@Injectable({ providedIn: 'root' })
export class SyncApiService {
  constructor(private http: HttpClient) {}

  // ── Fixed-schema backup (original) ──────────────────────────────
  reports(): Observable<ReportConfig[]> {
    return this.http.get<ReportConfig[]>(`${API}/reports`);
  }
  runs(): Observable<SyncRun[]> {
    return this.http.get<SyncRun[]>(`${API}/runs`);
  }
  syncOne(request: string): Observable<any> {
    return this.http.post(`${API}/sync/${encodeURIComponent(request)}`, {});
  }
  syncAll(): Observable<any> {
    return this.http.post(`${API}/sync`, {});
  }

  // ── Catalog: live dashboards + reports w/ access ────────────────
  dashboards(): Observable<Dashboard[]> {
    return this.http.get<Dashboard[]>(`${API}/catalog/dashboards`);
  }
  catalogReports(downloadableOnly = false): Observable<ReportWithAccess[]> {
    const params = downloadableOnly
      ? new HttpParams().set('downloadableOnly', 'true')
      : undefined;
    return this.http.get<ReportWithAccess[]>(`${API}/catalog/reports`, {
      params,
    });
  }
  datasetColumns(
    datasetId: string,
    finalOnly = false,
  ): Observable<DatasetColumn[]> {
    const params = finalOnly
      ? new HttpParams().set('finalOnly', 'true')
      : undefined;
    return this.http.get<DatasetColumn[]>(
      `${API}/catalog/datasets/${datasetId}/columns`,
      { params },
    );
  }
  datasetMeasures(datasetId: string): Observable<DatasetMeasure[]> {
    return this.http.get<DatasetMeasure[]>(
      `${API}/catalog/datasets/${datasetId}/measures`,
    );
  }
  reportData(
    datasetId: string,
    /** Single table (legacy) or multiple tables. */
    tables: string | string[],
    columns: string[],
    limit = 500,
    filter?: { dateColumn?: string; dateFrom?: string; dateTo?: string },
    measures: string[] = [],
  ): Observable<any[]> {
    const tableList = Array.isArray(tables) ? tables : [tables];
    const body: any = {
      datasetId,
      columns,
      measures,
      limit,
      ...filter,
    };
    if (tableList.length === 1) {
      body['table'] = tableList[0];
    } else {
      body['tables'] = tableList;
    }
    return this.http.post<any[]>(`${API}/catalog/data`, body);
  }

  // ── Dynamic uploads + principals ────────────────────────────────
  uploadReport(input: {
    reportName: string;
    owner: string;
    rows: any[];
    tableName?: string;
    mode?: 'append' | 'upsert';
    businessKeys?: string[];
    recipients?: string[];
    subject?: string;
  }): Observable<UploadResult> {
    return this.http.post<UploadResult>(`${API}/uploads/report`, input);
  }
  exportUrl(table: string): string {
    return `${API}/uploads/datasets/${table}/export`;
  }
  emailDataset(table: string, recipients: string[], subject: string): Observable<any> {
    return this.http.post(`${API}/uploads/datasets/${table}/email`, { recipients, subject });
  }
  emailHistory(): Observable<EmailLog[]> {
    return this.http.get<EmailLog[]>(`${API}/uploads/email-history`);
  }
  sendEmailReport(input: {
    reportName: string;
    rows: any[];
    recipients: string[];
    subject?: string;
  }): Observable<{ ok: boolean; count: number }> {
    console.log(input);
    return this.http.post<{ ok: boolean; count: number }>(`${API}/uploads/send-email-report`, input);
  }
  exportExcel(reportName: string, rows: any[]): Observable<Blob> {
    return this.http.post(`${API}/uploads/export-excel`, { reportName, rows }, { responseType: 'blob' });
  }
  getSmtpConfig(): Observable<{ host: string; port: number; username: string; fromAddress: string; isConfigured: boolean }> {
    return this.http.get<any>(`${API}/uploads/smtp-config`);
  }
  saveSmtpConfig(dto: { host: string; port: number; username: string; password?: string; fromAddress?: string }): Observable<{ ok: boolean; message: string }> {
    return this.http.post<any>(`${API}/uploads/smtp-config`, dto);
  }

  // ── Jobs ────────────────────────────────────────────────────────
  jobs(): Observable<Job[]> {
    return this.http.get<Job[]>(`${API}/jobs`);
  }
  createJob(job: CreateJob): Observable<Job> {
    return this.http.post<Job>(`${API}/jobs`, job);
  }
  runJob(id: number): Observable<any> {
    return this.http.post(`${API}/jobs/${id}/run`, {});
  }
  deleteJob(id: number): Observable<any> {
    return this.http.delete(`${API}/jobs/${id}`);
  }
  uploadPrincipals(owner: string, rows: any[]): Observable<UploadResult> {
    return this.http.post<UploadResult>(`${API}/uploads/principals`, {
      owner,
      rows,
    });
  }
  syncPrincipals(): Observable<UploadResult> {
    return this.http.post<UploadResult>(`${API}/uploads/principals/sync`, {});
  }
  datasets(): Observable<DynamicDataset[]> {
    return this.http.get<DynamicDataset[]>(`${API}/uploads/datasets`);
  }
  datasetRows(table: string, limit = 100): Observable<any[]> {
    const params = new HttpParams().set('limit', String(limit));
    return this.http.get<any[]>(`${API}/uploads/datasets/${table}/rows`, {
      params,
    });
  }

  // ── Auth / AD ───────────────────────────────────────────────────
  searchUsers(query: string): Observable<any[]> {
    return this.http.post<any[]>(`${API}/auth/searchUsers`, { searchkey: query });
  }

  // ── Last-sync ────────────────────────────────────────────────────
  getLastSync(table: string): Observable<{ lastSyncAt: string | null }> {
    return this.http.get<{ lastSyncAt: string | null }>(
      `${API}/uploads/datasets/${encodeURIComponent(table)}/last-sync`,
    );
  }

  // ── Database connections ─────────────────────────────────────────
  getDatabases(): Observable<DbConnection[]> {
    return this.http.get<DbConnection[]>(`${API}/databases`);
  }
  addDatabase(dto: NewDbDto): Observable<DbConnection> {
    return this.http.post<DbConnection>(`${API}/databases`, dto);
  }
  testDatabase(dto: NewDbDto): Observable<{ ok: boolean; error?: string }> {
    return this.http.post<{ ok: boolean; error?: string }>(`${API}/databases/test`, dto);
  }
  activateDatabase(id: number): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(`${API}/databases/${id}/activate`, {});
  }
  deactivateDatabase(id: number): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(`${API}/databases/${id}/deactivate`, {});
  }
  deleteDatabase(id: number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${API}/databases/${id}`);
  }

  // ── Usage Reports ────────────────────────────────────────────────
  listUsageReports(): Observable<UsageReportItem[]> {
    return this.http.get<UsageReportItem[]>(`${API}/usage/reports`);
  }
  getWorkspaceUsers(groupId: string): Observable<WorkspaceUser[]> {
    return this.http.get<WorkspaceUser[]>(`${API}/usage/workspace/${groupId}/users`);
  }
  getUsageAnalytics(groupId: string, datasetId: string): Observable<UsageAnalytics> {
    return this.http.get<UsageAnalytics>(`${API}/usage/analytics/${groupId}/${datasetId}`);
  }
  getGlobalDashboardStats(filterGroupId?: string): Observable<GlobalDashboardStats> {
    const url = filterGroupId ? `${API}/usage/global-stats?filterGroupId=${filterGroupId}` : `${API}/usage/global-stats`;
    return this.http.get<GlobalDashboardStats>(url);
  }
  getAllUsersStats(): Observable<AllUsersStat[]> {
    return this.http.get<AllUsersStat[]>(`${API}/usage/users`);
  }
  getUserDetails(email: string): Observable<UserDetailsBreakdown> {
    return this.http.get<UserDetailsBreakdown>(`${API}/usage/users/${encodeURIComponent(email)}`);
  }

  getRawUserReportAccess(groupId?: string): Observable<any[]> {
    let url = `${API}/usage/raw-access`;
    if (groupId) {
      url += `?groupId=${encodeURIComponent(groupId)}`;
    }
    return this.http.get<any[]>(url);
  }

  // ── Instant Cache for Dashboard Warm Start ──
  getCachedGlobalStats(): GlobalDashboardStats | null {
    try {
      const val = localStorage.getItem('pbi_cached_global_stats');
      return val ? JSON.parse(val) : null;
    } catch {
      return null;
    }
  }

  setCachedGlobalStats(stats: GlobalDashboardStats) {
    try {
      localStorage.setItem('pbi_cached_global_stats', JSON.stringify(stats));
    } catch {}
  }

  getCachedUsageReports(): UsageReportItem[] {
    try {
      const val = localStorage.getItem('pbi_cached_usage_reports');
      return val ? JSON.parse(val) : [];
    } catch {
      return [];
    }
  }

  setCachedUsageReports(reports: UsageReportItem[]) {
    try {
      localStorage.setItem('pbi_cached_usage_reports', JSON.stringify(reports));
    } catch {}
  }
}

// ── Usage Report interfaces ──────────────────────────────────────
export interface UsageReportItem {
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
export interface UsageAnalytics {
  totalViews: number;
  totalViewers: number;
  viewsByDay: { date: string; views: number }[];
  viewsByUser: { givenName: string; familyName: string; email: string; date: string; views: number }[];
  viewsByPlatform: { platform: string; views: number }[];
  reportViews: { reportName: string; date: string; views: number }[];
  pageViews: { pageName: string; reportName: string; date: string; views: number }[];
  userReportAccess: { givenName: string; familyName: string; email: string; reportName: string; date: string; views: number }[];
  userPageAccess: { givenName: string; familyName: string; email: string; reportName: string; pageName: string; date: string; views: number }[];
}

export interface StatItem {
  name?: string;
  pageName?: string;
  reportName?: string;
  email?: string;
  views: number;
  lastAccessed?: string;
}

export interface GlobalDashboardStats {
  totalViews?: number;
  totalViewers?: number;
  totalReportsCount?: number;
  totalWorkspacesCount?: number;
  topReportViews?: number;
  topReportName?: string;
  mostActiveUserViews?: number;
  mostActiveUserName?: string;
  topWorkspaces: StatItem[];
  topUsers: StatItem[];
  topReports: StatItem[];
  topPages: StatItem[];
  leastWorkspaces?: StatItem[];
  leastReports: StatItem[];
  leastPages: StatItem[];
  leastUsers?: StatItem[];
}

export interface AllUsersStat {
  email: string;
  name: string;
  views: number;
  lastAccessed: string;
}

export interface UserDetailsBreakdown {
  historicalViews: { date: string; views: number }[];
  reportAccess: { reportName: string; views: number; lastAccessed?: string }[];
  pageAccess: { pageName: string; reportName: string; views: number; lastAccessed?: string }[];
  totalDashboards: number;
  topReports: { reportName: string; views: number }[];
  leastReports: { reportName: string; views: number }[];
}


