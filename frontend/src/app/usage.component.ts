import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  SyncApiService,
  UsageReportItem,
  WorkspaceUser,
  UsageAnalytics,
} from './sync.service';

@Component({
  selector: 'app-usage',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    :host { display: block; }
    .page-header {
      margin-bottom: 24px;
    }
    .page-header h1 { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 4px 0; }
    .page-header p  { font-size: 13px; color: #6b7280; margin: 0; }

    .controls-row {
      display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 20px;
    }
    .controls-row select {
      flex: 1; min-width: 220px; max-width: 380px;
      border: 1.5px solid #93c5fd; border-radius: 8px;
      padding: 8px 12px; font-size: 13px; background: #fff;
      color: #111827; outline: none; cursor: pointer;
    }
    .controls-row select:focus { border-color: #1d6ef5; }

    .summary-cards {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 14px; margin-bottom: 24px;
    }
    .summary-card {
      background: #fff; border: 1.5px solid #93c5fd; border-radius: 12px;
      padding: 16px 20px; box-shadow: 0 1px 6px rgba(29,110,245,0.07);
    }
    .summary-card .label { font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: .5px; }
    .summary-card .value { font-size: 28px; font-weight: 800; color: #1d4ed8; margin-top: 4px; line-height: 1.1; }

    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
    @media (max-width: 860px) { .two-col { grid-template-columns: 1fr; } }

    .card {
      background: #fff; border: 1.5px solid #93c5fd; border-radius: 12px;
      padding: 18px 20px; box-shadow: 0 1px 6px rgba(29,110,245,0.07);
      margin-bottom: 16px;
    }
    .card h3 { font-size: 13px; font-weight: 700; color: #1d4ed8; margin: 0 0 14px 0; text-transform: uppercase; letter-spacing: .4px; }

    /* Bar chart — fills width, no overflow */
    .bar-chart-wrap { overflow: hidden; width: 100%; }
    .bar-chart { display: flex; align-items: flex-end; gap: 2px; height: 120px; width: 100%; }
    .bar-col { display: flex; flex-direction: column; align-items: center; gap: 2px; flex: 1; min-width: 0; }
    .bar {
      width: 100%; background: linear-gradient(180deg, #1d6ef5 0%, #60a5fa 100%);
      border-radius: 3px 3px 0 0; transition: opacity .15s; min-height: 2px;
    }
    .bar:hover { opacity: .75; }
    .bar-label { font-size: 8px; color: #9ca3af; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; text-align: center; }

    /* Tables */
    .tbl-wrap { border: 1.5px solid #93c5fd; border-radius: 10px; overflow: auto; max-height: 320px; scrollbar-width: thin; scrollbar-color: #93c5fd #f0f7ff; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #dbeafe; color: #1d4ed8; font-weight: 700; padding: 10px 14px; text-align: left; position: sticky; top: 0; z-index: 2; border-bottom: 2px solid #93c5fd; white-space: nowrap; box-shadow: 0 2px 4px rgba(29,110,245,0.08); }
    td { padding: 10px 14px; border-bottom: 1px solid #eff6ff; color: #111827; vertical-align: middle; }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr:hover td { background: #eff6ff; }

    /* Role badges */
    .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 700; }
    .badge-admin    { background: #dbeafe; color: #1d4ed8; }
    .badge-member   { background: #dcfce7; color: #15803d; }
    .badge-contributor { background: #fef9c3; color: #854d0e; }
    .badge-viewer   { background: #f3f4f6; color: #374151; }

    /* Platform pills */
    .platform-list { display: flex; flex-direction: column; gap: 8px; }
    .platform-row  { display: flex; align-items: center; gap: 10px; }
    .platform-name { font-size: 12px; color: #374151; width: 90px; flex-shrink: 0; }
    .platform-bar-wrap { flex: 1; background: #eff6ff; border-radius: 99px; height: 8px; overflow: hidden; }
    .platform-bar-fill { height: 100%; background: linear-gradient(90deg, #1d6ef5, #60a5fa); border-radius: 99px; transition: width .4s; }
    .platform-count { font-size: 11px; color: #6b7280; width: 40px; text-align: right; }

    /* Empty / loading */
    .empty { text-align: center; color: #9ca3af; font-size: 13px; padding: 40px 0; }
    .spinner { display:inline-block; width:18px; height:18px; border:3px solid #dbeafe; border-top-color:#1d6ef5; border-radius:50%; animation:spin .7s linear infinite; vertical-align:middle; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .report-list { display: flex; flex-direction: column; gap: 6px; }
    .report-item {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 12px; border: 1.5px solid #e0f2fe; border-radius: 8px;
      background: #f0f9ff; cursor: pointer; transition: background .15s, border-color .15s;
    }
    .report-item:hover   { background: #dbeafe; border-color: #93c5fd; }
    .report-item.active  { background: #dbeafe; border-color: #1d6ef5; }
    .report-item-name    { font-size: 13px; font-weight: 600; color: #1e3a5f; }
    .report-item-ws      { font-size: 11px; color: #6b7280; margin-top: 1px; }
    .btn-link { background:none; border:none; color:#1d6ef5; font-size:12px; cursor:pointer; text-decoration:underline; padding:0; }
    .day-btns { display: flex; gap: 4px; }
    .day-btn {
      padding: 6px 14px; border-radius: 7px; font-size: 12px; font-weight: 600; cursor: pointer;
      border: 1.5px solid #93c5fd; background: #fff; color: #1d4ed8; transition: all .15s;
    }
    .day-btn.active { background: #1d6ef5; color: #fff; border-color: #1d6ef5; }
    .day-btn:hover:not(.active) { background: #eff6ff; }
  `],
  template: `
  <div class="page-header">
    <h1>Usage Reports</h1>
    <p>View Power BI usage metrics across all workspaces — views, viewers, and user access.</p>
  </div>

  <div class="controls-row">
    <!-- Workspace dropdown -->
    <select [ngModel]="selectedGroupId()" (ngModelChange)="onWorkspaceChange($event)">
      <option value="">— Select Workspace —</option>
      <option *ngFor="let ws of workspaces()" [value]="ws.groupId">{{ ws.groupName }}</option>
    </select>

    <!-- Report dropdown (filtered to selected workspace) -->
    <select [ngModel]="selectedReportId()" (ngModelChange)="onReportChange($event)"
            [disabled]="!selectedGroupId()">
      <option value="">— Select Report —</option>
      <option *ngFor="let r of reportsForWorkspace()" [value]="r.reportId">{{ r.reportName }}</option>
    </select>

    <!-- Day range toggle -->
    <div class="day-btns" *ngIf="analytics()">
      <button class="day-btn" [class.active]="selectedDays() === 30" (click)="selectedDays.set(30)">30 Days</button>
      <button class="day-btn" [class.active]="selectedDays() === 60" (click)="selectedDays.set(60)">60 Days</button>
      <button class="day-btn" [class.active]="selectedDays() === 90" (click)="selectedDays.set(90)">90 Days</button>
    </div>

    <span *ngIf="loadingAnalytics()"><span class="spinner"></span></span>
  </div>

  <!-- Loading reports -->
  <div *ngIf="loadingReports()" class="empty"><span class="spinner"></span> Loading workspaces…</div>
  <div *ngIf="errorMsg()" class="empty" style="color:#dc2626;">{{ errorMsg() }}</div>

  <!-- Analytics section (shown once a report is selected and loaded) -->
  <ng-container *ngIf="analytics() && !loadingAnalytics()">

    <!-- Summary cards -->
    <div class="summary-cards">
      <div class="summary-card">
        <div class="label">Total Views</div>
        <div class="value">{{ analytics()!.totalViews | number }}</div>
      </div>
      <div class="summary-card">
        <div class="label">Unique Viewers</div>
        <div class="value">{{ analytics()!.totalViewers | number }}</div>
      </div>
      <div class="summary-card">
        <div class="label">Days of Data</div>
        <div class="value">{{ analytics()!.viewsByDay.length }}</div>
      </div>
      <div class="summary-card">
        <div class="label">Workspace Users</div>
        <div class="value">{{ wsUsers().length }}</div>
      </div>
    </div>

    <div class="two-col">
      <!-- Views per day chart -->
      <div class="card">
        <h3>Views per Day</h3>
        <div class="bar-chart-wrap" *ngIf="filteredViewsByDay().length; else noData">
          <div class="bar-chart">
            <div class="bar-col" *ngFor="let d of filteredViewsByDay()">
              <div class="bar" [style.height.px]="barHeight(d.views)" [title]="d.date + ': ' + d.views + ' views'"></div>
              <div class="bar-label">{{ d.date.slice(5) }}</div>
            </div>
          </div>
        </div>
        <ng-template #noData><p class="empty">No view data available.</p></ng-template>
      </div>

      <!-- Platform breakdown -->
      <div class="card">
        <h3>Views by Platform</h3>
        <div class="platform-list" *ngIf="analytics()!.viewsByPlatform.length; else noPlat">
          <div class="platform-row" *ngFor="let p of analytics()!.viewsByPlatform">
            <span class="platform-name">{{ p.platform }}</span>
            <div class="platform-bar-wrap">
              <div class="platform-bar-fill" [style.width.%]="platformPct(p.views)"></div>
            </div>
            <span class="platform-count">{{ p.views }}</span>
          </div>
        </div>
        <ng-template #noPlat><p class="empty">No platform data.</p></ng-template>
      </div>
    </div>

    <!-- Views by user -->
    <div class="card">
      <h3>Views by User</h3>
      <div class="tbl-wrap">
        <table>
          <thead><tr>
            <th>Name</th>
            <th>Email</th>
            <th>Views</th>
          </tr></thead>
          <tbody>
            <tr *ngFor="let u of analytics()!.viewsByUser">
              <td><strong>{{ u.givenName }} {{ u.familyName }}</strong></td>
              <td>{{ u.email }}</td>
              <td>{{ u.views | number }}</td>
            </tr>
            <tr *ngIf="!analytics()!.viewsByUser.length">
              <td colspan="3" class="empty">No user data.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Pages breakdown -->
    <div class="card" *ngIf="analytics()!.viewsByPage.length">
      <h3>Views by Report Page</h3>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Page</th><th>Views</th></tr></thead>
          <tbody>
            <tr *ngFor="let p of analytics()!.viewsByPage">
              <td>{{ p.page }}</td>
              <td>{{ p.views | number }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

  </ng-container>

  <!-- Workspace Users section (shown whenever a workspace is selected) -->
  <div class="card" *ngIf="selectedGroupId() && wsUsers().length">
    <h3>Workspace Members — {{ selectedWorkspaceName() }}</h3>
    <div class="tbl-wrap">
      <table>
        <thead><tr>
          <th>Name</th>
          <th>Email</th>
          <th>Role</th>
          <th>Type</th>
        </tr></thead>
        <tbody>
          <tr *ngFor="let u of wsUsers()">
            <td><strong>{{ u.displayName }}</strong></td>
            <td>{{ u.email }}</td>
            <td>
              <span class="badge"
                [class.badge-admin]="u.role==='Admin'"
                [class.badge-member]="u.role==='Member'"
                [class.badge-contributor]="u.role==='Contributor'"
                [class.badge-viewer]="u.role==='Viewer'">
                {{ u.role }}
              </span>
            </td>
            <td>{{ u.principalType }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Empty state -->
  <div *ngIf="!loadingReports() && !selectedGroupId() && !errorMsg()" class="card empty">
    Select a workspace and report above to view usage metrics.
  </div>
  `,
})
export class UsageComponent implements OnInit {
  allReports = signal<UsageReportItem[]>([]);
  analytics = signal<UsageAnalytics | null>(null);
  wsUsers = signal<WorkspaceUser[]>([]);
  loadingReports = signal(false);
  loadingAnalytics = signal(false);
  errorMsg = signal('');

  selectedGroupId = signal('');
  selectedReportId = signal('');
  selectedDays = signal<number>(30);

  // Unique workspaces from all reports
  workspaces = computed(() => {
    const seen = new Map<string, string>();
    for (const r of this.allReports()) {
      if (!seen.has(r.groupId)) seen.set(r.groupId, r.groupName);
    }
    return Array.from(seen.entries())
      .map(([groupId, groupName]) => ({ groupId, groupName }))
      .sort((a, b) => a.groupName.localeCompare(b.groupName));
  });

  reportsForWorkspace = computed(() =>
    this.allReports().filter(r => r.groupId === this.selectedGroupId()),
  );

  selectedReport = computed(() =>
    this.allReports().find(r => r.reportId === this.selectedReportId()) ?? null,
  );

  selectedWorkspaceName = computed(() =>
    this.workspaces().find(w => w.groupId === this.selectedGroupId())?.groupName ?? '',
  );

  // Filter viewsByDay to show only the last N days (30, 60, or 90)
  filteredViewsByDay = computed(() => {
    const data = this.analytics()?.viewsByDay ?? [];
    const limit = this.selectedDays();
    if (data.length <= limit) return data;
    return data.slice(-limit);
  });

  // Bar chart helpers
  maxViews = computed(() => Math.max(...(this.filteredViewsByDay().map(d => d.views) ?? [0]), 1));
  barHeight(views: number): number {
    return Math.max(4, Math.round((views / this.maxViews()) * 110));
  }

  maxPlatformViews = computed(() => Math.max(...(this.analytics()?.viewsByPlatform.map(p => p.views) ?? [0]), 1));
  platformPct(views: number): number {
    return Math.round((views / this.maxPlatformViews()) * 100);
  }

  constructor(private api: SyncApiService) {}

  ngOnInit(): void {
    this.loadingReports.set(true);
    this.api.listUsageReports().subscribe({
      next: (reports) => {
        this.allReports.set(reports);
        this.loadingReports.set(false);
      },
      error: (e) => {
        this.errorMsg.set('Failed to load usage reports: ' + (e?.message ?? 'Unknown error'));
        this.loadingReports.set(false);
      },
    });
  }

  onWorkspaceChange(groupId: string) {
    this.selectedGroupId.set(groupId);
    this.selectedReportId.set('');
    this.analytics.set(null);
    this.wsUsers.set([]);
    if (!groupId) return;

    // Load workspace users
    this.api.getWorkspaceUsers(groupId).subscribe({
      next: (u) => this.wsUsers.set(u),
      error: () => this.wsUsers.set([]),
    });

    // Auto-select first report
    const first = this.reportsForWorkspace()[0];
    if (first) this.loadReport(first);
  }

  onReportChange(reportId: string) {
    this.selectedReportId.set(reportId);
    const r = this.allReports().find(x => x.reportId === reportId);
    if (r) this.loadReport(r);
  }

  private loadReport(r: UsageReportItem) {
    this.selectedReportId.set(r.reportId);
    this.analytics.set(null);
    this.loadingAnalytics.set(true);
    this.api.getUsageAnalytics(r.groupId, r.datasetId).subscribe({
      next: (a) => {
        this.analytics.set(a);
        this.loadingAnalytics.set(false);
      },
      error: (e) => {
        this.loadingAnalytics.set(false);
        this.errorMsg.set('Failed to load analytics: ' + (e?.message ?? 'check backend logs'));
      },
    });
  }
}
