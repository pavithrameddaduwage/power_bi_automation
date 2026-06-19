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
    table: string,
    columns: string[],
    limit = 500,
    filter?: { dateColumn?: string; dateFrom?: string; dateTo?: string },
    measures: string[] = [],
  ): Observable<any[]> {
    return this.http.post<any[]>(`${API}/catalog/data`, {
      datasetId,
      table,
      columns,
      measures,
      limit,
      ...filter,
    });
  }

  // ── Dynamic uploads + principals ────────────────────────────────
  uploadReport(input: {
    reportName: string;
    owner: string;
    rows: any[];
    tableName?: string;
    mode?: 'append' | 'upsert';
    businessKeys?: string[];
  }): Observable<UploadResult> {
    return this.http.post<UploadResult>(`${API}/uploads/report`, input);
  }
  exportUrl(table: string): string {
    return `${API}/uploads/datasets/${table}/export`;
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
}
