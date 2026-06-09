import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

@Injectable({ providedIn: 'root' })
export class SyncApiService {
  constructor(private http: HttpClient) {}

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
}
