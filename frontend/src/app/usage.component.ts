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
      display: flex; gap: 12px; align-items: center; justify-content: space-between; flex-wrap: wrap; margin-bottom: 20px; width: 100%;
    }
    .controls-row select {
      flex: 0 0 auto;
      width: 200px;
      border: 1.5px solid #93c5fd; border-radius: 8px;
      padding: 6px 12px; font-size: 13px; background: #fff;
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
      width: 100%; background: linear-gradient(180deg, #f59e0b 0%, #fbbf24 100%);
      border-radius: 3px 3px 0 0; transition: opacity .15s; min-height: 2px;
    }
    .bar:hover { opacity: .75; }
    .bar-label { font-size: 8px; color: #9ca3af; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; text-align: center; }

    /* Tables */
    .tbl-wrap {
      border: 1px solid #1d6ef5;
      border-radius: 8px;
      overflow: auto;
      max-height: 280px;
      scrollbar-width: thin;
      scrollbar-color: #1d6ef5 #f0f7ff;
    }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th {
      background: #1d6ef5;
      color: #ffffff;
      font-weight: 700;
      padding: 12px 16px;
      text-align: left;
      position: sticky;
      top: 0;
      z-index: 2;
      border-bottom: 2px solid #1d6ef5;
      white-space: nowrap;
      font-size: 14px;
    }
    td {
      text-align: left;
      padding: 12px 16px;
      border-bottom: 1px solid #eff6ff;
      color: #111827;
      font-size: 13px;
      background: #ffffff;
      vertical-align: middle;
    }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr:hover td { background: #f0f7ff; cursor: pointer; }

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
      padding: 6px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;
      border: 1.5px solid #93c5fd; background: #fff; color: #1d4ed8; transition: all .15s;
    }
    .day-btn.active { background: #1d6ef5; color: #fff; border-color: #1d6ef5; }
    .day-btn:hover:not(.active) { background: #eff6ff; }
    .table-search-input {
      width: 100%;
      border: 1.5px solid #dbeafe;
      border-radius: 8px;
      padding: 6px 12px;
      font-size: 13px;
      margin-bottom: 12px;
      outline: none;
      box-sizing: border-box;
      transition: border-color .15s;
    }
    .table-search-input:focus {
      border-color: #1d6ef5;
    }
  `],
  template: `
  <div class="page-header">
    <h1>Usage Reports</h1>
    <p>View Power BI usage metrics across all workspaces — views, viewers, and user access.</p>
  </div>

  <div class="controls-row">
    <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
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
        <button class="day-btn" [class.active]="selectedDays() === 30" (click)="selectedDays.set(30)">1 Month</button>
        <button class="day-btn" [class.active]="selectedDays() === 60" (click)="selectedDays.set(60)">2 Months</button>
        <button class="day-btn" [class.active]="selectedDays() === 90" (click)="selectedDays.set(90)">3 Months</button>
      </div>

      <span *ngIf="loadingAnalytics()"><span class="spinner"></span></span>
    </div>

    <!-- Workspace Members dropdown (Right Aligned) -->
    <div style="position:relative;" *ngIf="selectedGroupId() && wsUsers().length">
      <button class="day-btn" style="display:flex;align-items:center;gap:6px;" (click)="showWorkspaceMembers.set(!showWorkspaceMembers())">
        <span>Show Workspace Members ({{ wsUsers().length }})</span>
        <span>{{ showWorkspaceMembers() ? '▲' : '▼' }}</span>
      </button>

      <div *ngIf="showWorkspaceMembers()" 
           style="position:absolute; right:0; top:36px; z-index:100; border:1.5px solid #dbeafe; border-radius:8px; background:#fff; padding:12px; width:280px; max-height:220px; overflow-y:auto; box-shadow:var(--shadow-lg);">
        <div *ngFor="let u of wsUsers()" 
             style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid #f3f4f6; font-size:12px;">
          <span style="color:#111827; font-weight:600; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:160px;" [title]="u.displayName">{{ u.displayName }}</span>
          <span class="badge"
                [class.badge-admin]="u.role==='Admin'"
                [class.badge-member]="u.role==='Member'"
                [class.badge-contributor]="u.role==='Contributor'"
                [class.badge-viewer]="u.role==='Viewer'">
            {{ u.role }}
          </span>
        </div>
      </div>
    </div>
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
        <div class="value">{{ filteredTotalViews() | number }}</div>
      </div>
      <div class="summary-card">
        <div class="label">Unique Viewers</div>
        <div class="value">{{ filteredTotalViewers() | number }}</div>
      </div>
      <div class="summary-card">
        <div class="label">Days of Data</div>
        <div class="value">{{ filteredViewsByDay().length }}</div>
      </div>
      <div class="summary-card">
        <div class="label">Workspace Users</div>
        <div class="value">{{ wsUsers().length }}</div>
      </div>
    </div>

    <div class="two-col">
      <!-- Views per day/month chart -->
      <div class="card">
        <h3>{{ selectedDays() === 30 ? 'Views per Day' : 'Views per Month' }}</h3>
        <div class="bar-chart-wrap" *ngIf="filteredViewsByDay().length; else noData">
          <div class="bar-chart">
            <div class="bar-col" *ngFor="let d of filteredViewsByDay()">
              <div class="bar" [style.height.px]="barHeight(d.views)" [title]="d.date + ': ' + d.views + ' views'"></div>
              <div class="bar-label">{{ selectedDays() === 30 ? d.date.slice(5) : d.date }}</div>
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
      <p style="font-size:12px;color:#4b5563;margin-top:-6px;margin-bottom:12px;">Click a user's row below to view their detailed report and tab views breakdown.</p>
      
      <!-- Search input for Users -->
      <input type="text" class="table-search-input" placeholder="Search users by name or email..."
             [ngModel]="userSearch()" (ngModelChange)="userSearch.set($event)" />

      <div class="tbl-wrap">
        <table>
          <thead><tr>
            <th>Name</th>
            <th>Email</th>
            <th>Views</th>
          </tr></thead>
          <tbody>
            <tr *ngFor="let u of filteredViewsByUser()" 
                (click)="toggleSelectedUser(u.email)" 
                [style.background]="selectedUserEmail() === u.email ? '#eff6ff' : ''"
                [style.border-left]="selectedUserEmail() === u.email ? '4px solid #1d6ef5' : ''">
              <td><strong>{{ u.givenName }} {{ u.familyName }}</strong></td>
              <td>{{ u.email }}</td>
              <td>{{ u.views | number }}</td>
            </tr>
            <tr *ngIf="!filteredViewsByUser().length">
              <td colspan="3" class="empty">No user data found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Clicked User breakdown details container -->
    <div *ngIf="selectedUserDetails() as details" style="margin-top:24px;border: 1px solid #f59e0b;border-radius:12px;background:#fffdfa;padding:20px;box-shadow:var(--shadow-sm);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:1.5px solid #fef3c7;padding-bottom:12px;">
        <h3 style="margin:0;color:#b45309;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:.5px;">
          Detailed Breakdown: {{ details.givenName }} {{ details.familyName }} 
          <span *ngIf="details.lastAccessed" style="font-size:11px;font-weight:600;background:#fef3c7;color:#b45309;padding:2px 8px;border-radius:99px;margin-left:8px;text-transform:none;">
            Last accessed: {{ details.lastAccessed | date:'mediumDate' }}
          </span>
        </h3>
        <button class="day-btn" style="border-color:#f59e0b;color:#d97706;" (click)="selectedUserEmail.set('')">Close Breakdown</button>
      </div>

      <div class="two-col" style="margin-top:0;">
        <!-- User views by report -->
        <div class="card" style="margin:0;border-color:#f59e0b;">
          <h3 style="color:#d97706;">Reports / Dashboards Accessed</h3>
          <div class="tbl-wrap" style="border-color:#f59e0b;scrollbar-color:#f59e0b #fef3c7;">
            <table>
              <thead><tr><th style="background:#f59e0b;border-bottom-color:#f59e0b;">Report / Dashboard Name</th><th style="background:#f59e0b;border-bottom-color:#f59e0b;">Views</th></tr></thead>
              <tbody>
                <tr *ngFor="let r of selectedUserReportAccess()">
                  <td><span style="color:#b45309; font-weight:600;">{{ r.reportName }}</span></td>
                  <td>{{ r.views | number }}</td>
                </tr>
                <tr *ngIf="!selectedUserReportAccess().length">
                  <td colspan="2" class="empty">No report access.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- User views by page tab -->
        <div class="card" style="margin:0;border-color:#10b981;">
          <h3 style="color:#059669;">Page Tabs Viewed</h3>
          <div class="tbl-wrap" style="border-color:#10b981;scrollbar-color:#10b981 #ecfdf5;">
            <table>
              <thead><tr><th style="background:#10b981;border-bottom-color:#10b981;">Tab Name</th><th style="background:#10b981;border-bottom-color:#10b981;">Dashboard / Report</th><th style="background:#10b981;border-bottom-color:#10b981;">Views</th></tr></thead>
              <tbody>
                <tr *ngFor="let p of selectedUserPageAccess()">
                  <td><span style="color:#047857; font-weight:600;">{{ p.pageName }}</span></td>
                  <td><span style="font-size:12px;color:#4b5563;">{{ p.reportName }}</span></td>
                  <td>{{ p.views | number }}</td>
                </tr>
                <tr *ngIf="!selectedUserPageAccess().length">
                  <td colspan="3" class="empty">No page tab access.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Overall Reports and Pages breakdown side by side -->
    <div class="two-col" *ngIf="!selectedUserEmail()">
      <!-- Views by Report -->
      <div class="card" *ngIf="filteredReportViews().length || reportSearch()">
        <h3>Views by Report / Dashboard</h3>
        
        <!-- Search input for Reports -->
        <input type="text" class="table-search-input" placeholder="Search reports/dashboards..."
               [ngModel]="reportSearch()" (ngModelChange)="reportSearch.set($event)" />

        <div class="tbl-wrap">
          <table>
            <thead><tr><th>Name</th><th>Views</th></tr></thead>
            <tbody>
              <tr *ngFor="let r of filteredReportViews()">
                <td><strong>{{ r.reportName }}</strong></td>
                <td>{{ r.views | number }}</td>
              </tr>
              <tr *ngIf="!filteredReportViews().length">
                <td colspan="2" class="empty">No matching reports.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Views by Page -->
      <div class="card" *ngIf="filteredPageViews().length || pageSearch()">
        <h3>Views by Page Tab</h3>
        
        <!-- Search input for Page Tabs -->
        <input type="text" class="table-search-input" placeholder="Search page tabs..."
               [ngModel]="pageSearch()" (ngModelChange)="pageSearch.set($event)" />

        <div class="tbl-wrap">
          <table>
            <thead><tr><th>Tab Name</th><th>Dashboard / Report</th><th>Views</th></tr></thead>
            <tbody>
              <tr *ngFor="let p of filteredPageViews()">
                <td><strong>{{ p.pageName }}</strong></td>
                <td><span style="font-size:12px;color:#4b5563;">{{ p.reportName }}</span></td>
                <td>{{ p.views | number }}</td>
              </tr>
              <tr *ngIf="!filteredPageViews().length">
                <td colspan="3" class="empty">No matching page tabs.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

  </ng-container>



  <!-- Global / Workspace-Filtered Aggregated Metrics Dashboard -->
  <ng-container *ngIf="!selectedReportId() && globalStats() as stats">
    <div style="margin-top:20px;">
      <h2 style="font-size:16px;color:#1e3a8a;margin-bottom:16px;border-bottom:2px solid #dbeafe;padding-bottom:8px;">
        {{ selectedGroupId() ? 'Workspace Analytics Summary' : 'Global Workspace Analytics Overview' }}
      </h2>

      <!-- Top statistics grids -->
      <div class="two-col">
        <!-- Top 10 Workspaces (Only shown globally) -->
        <div class="card" *ngIf="!selectedGroupId()">
          <h3 style="color:#1d4ed8;">Top 10 Workspaces</h3>
          <div class="tbl-wrap" style="scrollbar-color:#3b82f6 #dbeafe;">
            <table>
              <thead><tr><th>Workspace Name</th><th>Views</th></tr></thead>
              <tbody>
                <tr *ngFor="let w of stats.topWorkspaces" [title]="w.name + ': ' + w.views + ' views'">
                  <td><strong>{{ w.name }}</strong></td>
                  <td>{{ w.views | number }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Top 10 Users -->
        <div class="card">
          <h3 style="color:#10b981;">Top 10 Users</h3>
          <div class="tbl-wrap" style="scrollbar-color:#10b981 #d1fae5; border-color:#10b981;">
            <table>
              <thead>
                <tr>
                  <th style="background:#10b981;border-bottom-color:#10b981;">Name</th>
                  <th style="background:#10b981;border-bottom-color:#10b981;">Views</th>
                  <th style="background:#10b981;border-bottom-color:#10b981;">Last Accessed</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let u of stats.topUsers" [title]="u.name + ' (' + u.email + '): ' + u.views + ' views. Last access: ' + (u.lastAccessed | date:'shortDate')">
                  <td><strong>{{ u.name }}</strong></td>
                  <td>{{ u.views | number }}</td>
                  <td style="font-size:12px;color:#4b5563;">{{ u.lastAccessed | date:'mediumDate' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="two-col">
        <!-- Top Reports -->
        <div class="card">
          <h3 style="color:#f59e0b;">Top Reports / Dashboards</h3>
          <div class="tbl-wrap" style="scrollbar-color:#f59e0b #fef3c7; border-color:#f59e0b;">
            <table>
              <thead>
                <tr>
                  <th style="background:#f59e0b;border-bottom-color:#f59e0b;">Report / Dashboard Name</th>
                  <th style="background:#f59e0b;border-bottom-color:#f59e0b;">Views</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let r of stats.topReports" [title]="r.name + ': ' + r.views + ' views'">
                  <td><strong>{{ r.name }}</strong></td>
                  <td>{{ r.views | number }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Top Pages -->
        <div class="card">
          <h3 style="color:#8b5cf6;">Top Pages / Tabs</h3>
          <div class="tbl-wrap" style="scrollbar-color:#8b5cf6 #ede9fe; border-color:#8b5cf6;">
            <table>
              <thead>
                <tr>
                  <th style="background:#8b5cf6;border-bottom-color:#8b5cf6;">Tab Name</th>
                  <th style="background:#8b5cf6;border-bottom-color:#8b5cf6;">Parent Report</th>
                  <th style="background:#8b5cf6;border-bottom-color:#8b5cf6;">Views</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let p of stats.topPages" [title]="p.pageName + ' > ' + p.reportName + ': ' + p.views + ' views'">
                  <td><strong>{{ p.pageName }}</strong></td>
                  <td style="font-size:12px;color:#4b5563;">{{ p.reportName }}</td>
                  <td>{{ p.views | number }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <h2 style="font-size:14px;color:#b91c1c;margin-top:24px;margin-bottom:16px;border-bottom:2px solid #fee2e2;padding-bottom:8px;">
        Least Used Components (Idle Watchlist)
      </h2>

      <div class="two-col">
        <!-- Least Used Reports -->
        <div class="card" style="border-color:#fca5a5;">
          <h3 style="color:#ef4444;">Least Used Reports</h3>
          <div class="tbl-wrap" style="scrollbar-color:#ef4444 #fee2e2; border-color:#ef4444;">
            <table>
              <thead>
                <tr>
                  <th style="background:#ef4444;border-bottom-color:#ef4444;">Report Name</th>
                  <th style="background:#ef4444;border-bottom-color:#ef4444;">Views</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let r of stats.leastReports" [title]="r.name + ': ' + r.views + ' views'">
                  <td><strong>{{ r.name }}</strong></td>
                  <td>{{ r.views | number }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Least Used Pages -->
        <div class="card" style="border-color:#fca5a5;">
          <h3 style="color:#ef4444;">Least Used Pages</h3>
          <div class="tbl-wrap" style="scrollbar-color:#ef4444 #fee2e2; border-color:#ef4444;">
            <table>
              <thead>
                <tr>
                  <th style="background:#ef4444;border-bottom-color:#ef4444;">Tab Name</th>
                  <th style="background:#ef4444;border-bottom-color:#ef4444;">Parent Report</th>
                  <th style="background:#ef4444;border-bottom-color:#ef4444;">Views</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let p of stats.leastPages" [title]="p.pageName + ' > ' + p.reportName + ': ' + p.views + ' views'">
                  <td><strong>{{ p.pageName }}</strong></td>
                  <td style="font-size:12px;color:#4b5563;">{{ p.reportName }}</td>
                  <td>{{ p.views | number }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  </ng-container>
  `,
})
export class UsageComponent implements OnInit {
  allReports = signal<UsageReportItem[]>([]);
  analytics = signal<UsageAnalytics | null>(null);
  globalStats = signal<any | null>(null);
  wsUsers = signal<WorkspaceUser[]>([]);
  loadingReports = signal(false);
  loadingAnalytics = signal(false);
  errorMsg = signal('');

  selectedGroupId = signal('');
  selectedReportId = signal('');
  selectedDays = signal<number>(30);
  selectedUserEmail = signal<string>('');
  showWorkspaceMembers = signal<boolean>(false);

  // Search signals for tables
  userSearch = signal<string>('');
  reportSearch = signal<string>('');
  pageSearch = signal<string>('');

  // Selected User Reports/Dashboards Breakdown
  selectedUserReportAccess = computed(() => {
    const email = this.selectedUserEmail();
    if (!email) return [];
    return this.filteredUserReportAccess().filter(a => a.email === email);
  });

  // Selected User Page Tab Breakdown
  selectedUserPageAccess = computed(() => {
    const email = this.selectedUserEmail();
    if (!email) return [];
    return this.filteredUserPageAccess().filter(a => a.email === email);
  });

  // Selected User Details object
  selectedUserDetails = computed(() => {
    const email = this.selectedUserEmail();
    if (!email) return null;
    return this.filteredViewsByUser().find(u => u.email === email) ?? null;
  });

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

  // Filter viewsByDay to show only the last N days (30, 60, or 90).
  // If 60 or 90 days range (2 or 3 months) is selected, aggregate into Month-level buckets.
  filteredViewsByDay = computed(() => {
    const data = this.analytics()?.viewsByDay ?? [];
    const limit = this.selectedDays();
    
    // Slice data to requested day range first
    let sliced = data;
    if (data.length > limit) {
      sliced = data.slice(-limit);
    }
    
    if (limit === 30) {
      // Return raw days
      return sliced;
    } else {
      // Group by Month (YYYY-MM)
      const monthMap = new Map<string, number>();
      for (const d of sliced) {
        const monthKey = d.date.slice(0, 7); // e.g. "2026-08"
        monthMap.set(monthKey, (monthMap.get(monthKey) ?? 0) + d.views);
      }
      
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];

      return Array.from(monthMap.entries()).map(([month, views]) => {
        const parts = month.split('-');
        const monthIdx = parseInt(parts[1], 10) - 1;
        const name = monthNames[monthIdx] || month;
        return {
          date: name, // label will be month name
          views
        };
      });
    }
  });

  // Calculate total views for selected day range
  filteredTotalViews = computed(() => {
    return this.filteredViewsByDay().reduce((sum, d) => sum + d.views, 0);
  });

  // Dynamically calculate user view counts for the selected day range.
  filteredViewsByUser = computed(() => {
    const rawUsers = this.analytics()?.viewsByUser ?? [];
    const activeDates = new Set(this.filteredViewsByDay().map(d => d.date));
    const query = this.userSearch().trim().toLowerCase();
    
    // Group and aggregate views by user email/details for the active dates
    const userMap = new Map<string, { givenName: string; familyName: string; email: string; views: number; lastAccessed?: string }>();
    
    for (const u of rawUsers) {
      if (activeDates.has(u.date)) {
        const existing = userMap.get(u.email);
        if (existing) {
          existing.views += u.views;
          if (u.date && (!existing.lastAccessed || u.date > existing.lastAccessed)) {
            existing.lastAccessed = u.date;
          }
        } else {
          userMap.set(u.email, {
            givenName: u.givenName,
            familyName: u.familyName,
            email: u.email,
            views: u.views,
            lastAccessed: u.date
          });
        }
      }
    }
    
    return Array.from(userMap.values())
      .filter(u => u.views > 0)
      .filter(u => !query || `${u.givenName} ${u.familyName}`.toLowerCase().includes(query) || u.email.toLowerCase().includes(query))
      .sort((a, b) => b.views - a.views);
  });

  filteredTotalViewers = computed(() => {
    return this.filteredViewsByUser().length;
  });

  // Dynamically calculate user views per report/dashboard for active dates
  // Dynamically calculate user views per report/dashboard for active dates
  filteredUserReportAccess = computed(() => {
    const rawAccess = this.analytics()?.userReportAccess ?? [];
    const activeDates = new Set(this.filteredViewsByDay().map(d => d.date));
    const accessMap = new Map<string, { givenName: string; familyName: string; email: string; reportName: string; views: number }>();

    for (const a of rawAccess) {
      if (activeDates.has(a.date)) {
        const key = `${a.email}|${a.reportName}`;
        const existing = accessMap.get(key);
        if (existing) {
          existing.views += a.views;
        } else {
          accessMap.set(key, {
            givenName: a.givenName,
            familyName: a.familyName,
            email: a.email,
            reportName: a.reportName,
            views: a.views
          });
        }
      }
    }

    return Array.from(accessMap.values())
      .filter(a => a.views > 0)
      .sort((a, b) => b.reportName.localeCompare(a.reportName) || b.views - a.views);
  });

  // Dynamically calculate user views per page/tab for active dates
  filteredUserPageAccess = computed(() => {
    const rawAccess = this.analytics()?.userPageAccess ?? [];
    const activeDates = new Set(this.filteredViewsByDay().map(d => d.date));
    const accessMap = new Map<string, { givenName: string; familyName: string; email: string; reportName: string; pageName: string; views: number }>();

    for (const a of rawAccess) {
      if (activeDates.has(a.date)) {
        const key = `${a.email}|${a.reportName}|${a.pageName}`;
        const existing = accessMap.get(key);
        if (existing) {
          existing.views += a.views;
        } else {
          accessMap.set(key, {
            givenName: a.givenName,
            familyName: a.familyName,
            email: a.email,
            reportName: a.reportName,
            pageName: a.pageName,
            views: a.views
          });
        }
      }
    }

    return Array.from(accessMap.values())
      .filter(a => a.views > 0)
      .sort((a, b) => a.reportName.localeCompare(b.reportName) || b.views - a.views);
  });

  // Dynamically calculate report-level views (DisplayName)
  filteredReportViews = computed(() => {
    const rawReports = this.analytics()?.reportViews ?? [];
    const activeDates = new Set(this.filteredViewsByDay().map(d => d.date));
    const reportMap = new Map<string, number>();
    const query = this.reportSearch().trim().toLowerCase();

    for (const r of rawReports) {
      if (activeDates.has(r.date)) {
        reportMap.set(r.reportName, (reportMap.get(r.reportName) ?? 0) + r.views);
      }
    }

    return Array.from(reportMap.entries())
      .map(([reportName, views]) => ({ reportName, views }))
      .filter(r => r.views > 0)
      .filter(r => !query || r.reportName.toLowerCase().includes(query))
      .sort((a, b) => b.views - a.views);
  });

  // Dynamically calculate page-level views (ReportPage)
  filteredPageViews = computed(() => {
    const rawPages = this.analytics()?.pageViews ?? [];
    const activeDates = new Set(this.filteredViewsByDay().map(d => d.date));
    const pageMap = new Map<string, { pageName: string; reportName: string; views: number }>();
    const query = this.pageSearch().trim().toLowerCase();

    for (const p of rawPages) {
      if (activeDates.has(p.date)) {
        const key = `${p.reportName}|${p.pageName}`;
        const existing = pageMap.get(key);
        if (existing) {
          existing.views += p.views;
        } else {
          pageMap.set(key, {
            pageName: p.pageName,
            reportName: p.reportName,
            views: p.views
          });
        }
      }
    }

    return Array.from(pageMap.values())
      .filter(p => p.views > 0)
      .filter(p => !query || p.pageName.toLowerCase().includes(query) || p.reportName.toLowerCase().includes(query))
      .sort((a, b) => a.reportName.localeCompare(b.reportName) || b.views - a.views);
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

    this.loadGlobalStats();
  }

  loadGlobalStats(groupId?: string) {
    this.api.getGlobalDashboardStats(groupId).subscribe({
      next: (stats) => this.globalStats.set(stats),
      error: () => this.globalStats.set(null)
    });
  }

  onWorkspaceChange(groupId: string) {
    this.selectedGroupId.set(groupId);
    this.selectedReportId.set('');
    this.selectedUserEmail.set('');
    this.showWorkspaceMembers.set(false);
    this.analytics.set(null);
    this.wsUsers.set([]);
    
    // Refresh stats filtered to workspace
    this.loadGlobalStats(groupId || undefined);

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
    this.selectedUserEmail.set('');
    const r = this.allReports().find(x => x.reportId === reportId);
    if (r) this.loadReport(r);
  }

  toggleSelectedUser(email: string) {
    if (this.selectedUserEmail() === email) {
      this.selectedUserEmail.set('');
    } else {
      this.selectedUserEmail.set(email);
    }
  }

  private loadReport(r: UsageReportItem) {
    this.selectedReportId.set(r.reportId);
    this.selectedUserEmail.set('');
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
