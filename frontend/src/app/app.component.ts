import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SyncApiService, ReportConfig, SyncRun } from './sync.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container">
      <h1>Power BI → PostgreSQL backup</h1>
      <p class="muted">
        Each sync pulls the report's table from Power BI and upserts it into
        Postgres, keyed on the business key + this week's snapshot date.
      </p>

      <div class="row-between">
        <h2>Configured reports</h2>
        <button class="secondary" (click)="syncAll()" [disabled]="busy()">
          {{ busy() ? 'Syncing…' : 'Sync all' }}
        </button>
      </div>

      <div class="card" *ngFor="let r of reports()">
        <div class="row-between">
          <div>
            <strong>{{ r.request }}</strong>
            <div class="tag">
              dashboard: {{ r.dashboardName }} · table: {{ r.targetTable }} ·
              key: {{ r.businessKeys.join(' + ') }}
            </div>
          </div>
          <button (click)="syncOne(r.request)" [disabled]="busy()">Sync</button>
        </div>
      </div>

      <h2>Recent runs</h2>
      <div class="card">
        <table>
          <thead>
            <tr>
              <th>Request</th><th>Table</th><th>Snapshot</th>
              <th>Rows</th><th>Status</th><th>When</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let run of runs()">
              <td>{{ run.request }}</td>
              <td>{{ run.target_table }}</td>
              <td>{{ run.snapshot_date }}</td>
              <td>{{ run.rows_written }}</td>
              <td [class]="'status-' + run.status">
                {{ run.status }}
                <span class="tag" *ngIf="run.error">— {{ run.error }}</span>
              </td>
              <td class="muted">{{ run.started_at | date: 'short' }}</td>
            </tr>
            <tr *ngIf="runs().length === 0">
              <td colspan="6" class="muted">No runs yet.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class AppComponent implements OnInit {
  reports = signal<ReportConfig[]>([]);
  runs = signal<SyncRun[]>([]);
  busy = signal(false);

  constructor(private api: SyncApiService) {}

  ngOnInit() {
    this.loadReports();
    this.loadRuns();
  }

  loadReports() {
    this.api.reports().subscribe((r) => this.reports.set(r));
  }
  loadRuns() {
    this.api.runs().subscribe((r) => this.runs.set(r));
  }

  syncOne(request: string) {
    this.busy.set(true);
    this.api.syncOne(request).subscribe({
      next: () => this.afterSync(),
      error: () => this.afterSync(),
    });
  }
  syncAll() {
    this.busy.set(true);
    this.api.syncAll().subscribe({
      next: () => this.afterSync(),
      error: () => this.afterSync(),
    });
  }
  private afterSync() {
    this.busy.set(false);
    this.loadRuns();
  }
}
