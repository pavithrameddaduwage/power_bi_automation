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
    .custom-tooltip {
      position: fixed;
      z-index: 10000;
      background: rgba(15, 23, 42, 0.9);
      color: white;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      pointer-events: none;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      white-space: pre-wrap;
      transform: translate(0, 0);
    }
    :host { display: block; }
    .page-header {
      margin-bottom: 24px;
    }
    .page-header h1 { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 4px 0; }
    .page-header p  { font-size: 13px; color: #000000; margin: 0; }

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

    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    .sum-card { background: #fff; padding: 20px; border-radius: 12px; border: none; border-top: 4px solid #3b82f6; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); display: flex; flex-direction: column; transition: transform 0.2s, box-shadow 0.2s; cursor: default; }
    .sum-card:hover { transform: translateY(-3px); box-shadow: 0 8px 12px -2px rgba(0,0,0,0.1); }
    .sum-label { font-size: 11px; font-weight: 700; color: #000000; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .sum-val { font-size: 28px; font-weight: 800; color: #1e293b; line-height: 1.1; }

    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
    @media (max-width: 860px) { .two-col { grid-template-columns: 1fr; } }

    .card {
      background: #fff; border: none; border-radius: 12px;
      padding: 18px 20px; box-shadow: 0 1px 6px rgba(29,110,245,0.07);
      margin-bottom: 16px;
    }
    .card h3 { font-size: 13px; font-weight: 700; color: #1d4ed8; margin: 0 0 14px 0; letter-spacing: .4px; }

    /* Bar chart */
    .bar-chart-wrap { overflow: visible; width: 100%; padding-top: 35px; margin-top: -15px; }
    .bar-chart { display: flex; align-items: flex-end; gap: 2px; height: 120px; width: 100%; }
    .bar-col { display: flex; flex-direction: column; align-items: center; gap: 2px; flex: 1; min-width: 0; position: relative; }
    
    .chart-tooltip {
      visibility: hidden; background-color: #1f2937; color: #fff; text-align: center;
      border-radius: 6px; padding: 6px 10px; position: absolute; z-index: 10;
      bottom: 100%; left: 50%; transform: translateX(-50%); margin-bottom: 8px;
      white-space: nowrap; font-size: 11px; opacity: 0; transition: opacity 0.15s, visibility 0.15s;
      pointer-events: none; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    }
    .chart-tooltip::after {
      content: ""; position: absolute; top: 100%; left: 50%; margin-left: -5px;
      border-width: 5px; border-style: solid; border-color: #1f2937 transparent transparent transparent;
    }
    .bar-col:hover .chart-tooltip { visibility: visible; opacity: 1; }
    .bar {
      width: 100%; background: linear-gradient(180deg, #f59e0b 0%, #fbbf24 100%);
      border-radius: 3px 3px 0 0; transition: opacity .15s; min-height: 2px;
    }
    .bar:hover { opacity: .75; }
    .bar-label { font-size: 8px; color: #000000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; text-align: center; }

    /* HBAR Charts Custom */
    .hbar-row-c { display: flex; align-items: center; gap: 16px; margin-bottom: 14px; }
    .hbar-label-c { width: 180px; font-size: 11px; font-weight: 600; color: #000000; text-align: right; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; max-width: none; line-height: 1.3; }
    .hbar-track-c { flex: 1; display: flex; align-items: center; gap: 8px; }
    .hbar-fill-c { height: 16px; background: #d97706; border-radius: 4px; transition: width 0.4s; min-width: 4px; }
    .hbar-val-c { font-size: 11px; font-weight: 600; color: #000000; }

    /* Role badges */
    .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 700; }
    .badge-admin    { background: #dbeafe; color: #1d4ed8; }
    .badge-member   { background: #dcfce7; color: #15803d; }
    .badge-contributor { background: #fef9c3; color: #854d0e; }
    .badge-viewer   { background: #f3f4f6; color: #000000; }

    /* Platform pills */
    .platform-list { display: flex; flex-direction: column; gap: 8px; }
    .platform-row  { display: flex; align-items: center; gap: 10px; }
    .platform-name { font-size: 12px; color: #000000; width: 90px; flex-shrink: 0; }
    .platform-bar-wrap { flex: 1; background: #eff6ff; border-radius: 99px; height: 8px; overflow: hidden; }
    .platform-bar-fill { height: 100%; background: linear-gradient(90deg, #1d6ef5, #60a5fa); border-radius: 99px; transition: width .4s; }
    .platform-count { font-size: 11px; color: #000000; width: 40px; text-align: right; }

    /* Unified Table Styles */
    .table-container {
      border: 1.5px solid #93c5fd;
      border-radius: 8px;
      overflow: hidden;
      background: white;
      margin-top: 8px;
    }
    .clean-table { width: 100%; border-collapse: collapse; font-size: 13px; text-transform: none; }
    .clean-table th {
      background: #e0f2fe;
      color: #1e40af;
      font-weight: 700;
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1px solid #93c5fd;
      white-space: nowrap;
      font-size: 13px;
      text-transform: none;
      letter-spacing: normal;
    }
    .clean-table td {
      text-align: left;
      padding: 12px 16px;
      border-bottom: 1px solid #e5e7eb;
      color: #000000;
      font-size: 13px;
      background: #ffffff;
      vertical-align: middle;
    }
    .clean-table tbody tr:last-child td { border-bottom: none; }
    .clean-table tbody tr:hover td { background: #f0f9ff; cursor: pointer; }

    /* Empty / loading */
    
    .pagination {
      display: flex; justify-content: space-between; align-items: center; padding: 12px 16px;
      background: #f8fafc; border-top: 1px solid #bfdbfe; font-size: 12px; font-weight: 600; color: #000000;
    }
    .pagination button {
      background: white; border: 1px solid #93c5fd; border-radius: 6px; padding: 4px 10px;
      cursor: pointer; color: #1e40af; font-weight: 600; transition: all 0.2s;
    }
    .pagination button:hover:not(:disabled) { background: #e0f2fe; border-color: #1d4ed8; }
    .pagination button:disabled { opacity: 0.5; cursor: not-allowed; color: #94a3b8; border-color: #cbd5e1; }

    .empty { text-align: center; color: #000000; font-size: 13px; padding: 40px 0; }
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
    .report-item-ws      { font-size: 11px; color: #000000; margin-top: 1px; }
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

    /* Premium UI Grid System */
    .premium-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }
    
    .section-header {
      font-size: 11px;
      font-weight: 700;
      color: #000000;
      margin: 24px 0 12px 0;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .section-header::before {
      content: '';
      display: block;
      width: 6px;
      height: 6px;
      background: #3b82f6;
      border-radius: 50%;
    }
    
    .card.premium-card {
      padding: 20px;
      border: none;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
      display: flex;
      flex-direction: column;
    }
    
    .premium-card h3 {
      font-size: 13px;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 16px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .badge-light {
      background: #eff6ff;
      color: #3b82f6;
      font-size: 10px;
      padding: 3px 8px;
      border-radius: 12px;
      font-weight: 600;
    }

    /* Donut Chart */
    .donut-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
    }
    .donut-chart {
      width: 200px;
      height: 200px;
      border-radius: 50%;
      position: relative;
      flex-shrink: 0;
    }
    .donut-hole {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 140px;
      height: 140px;
      background: #fff;
      border-radius: 50%;
    }
    .donut-legend {
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 100%;
    }
    .legend-item { display: flex; align-items: center; font-size: 11px; color: #000000; }
    .legend-dot { width: 10px; height: 10px; border-radius: 2px; margin-right: 12px; flex-shrink: 0; }
    .legend-name { flex: 1; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; max-width: none; line-height: 1.3; }
    .legend-value { font-weight: 600; color: #1e293b; width: 60px; text-align: right; }
    .donut-footer {
      margin-top: 16px;
      background: #ecfdf5;
      color: #047857;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      text-align: center;
    }

    /* Horizontal Bar Chart */
    .hbar-row {
      display: flex;
      flex-direction: column;
      margin-bottom: 12px;
    }
    .hbar-header {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      margin-bottom: 4px;
      color: #000000;
    }
    .hbar-bg {
      width: 100%;
      height: 10px;
      background: #f1f5f9;
      border-radius: 5px;
      overflow: hidden;
    }
    .hbar-fill {
      height: 100%;
      border-radius: 5px;
      transition: width 0.3s ease;
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
        <option value=""> Select Workspace </option>
        <option *ngFor="let ws of workspaces()" [value]="ws.groupId">{{ ws.groupName }}</option>
      </select>

      <!-- Report dropdown (filtered to selected workspace) -->
      <select [ngModel]="selectedReportId()" (ngModelChange)="onReportChange($event)"
              [disabled]="!selectedGroupId()">
        <option value=""> Select Report </option>
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
      <button style="display:flex;align-items:center;gap:6px; border: 1.5px solid #93c5fd; border-radius: 8px; padding: 6px 12px; font-size: 13px; background: #fff; color: #111827; outline: none; cursor: pointer; transition: all 0.2s;" (click)="showWorkspaceMembers.set(!showWorkspaceMembers())" onmouseover="this.style.borderColor='#1d6ef5'" onmouseout="this.style.borderColor='#93c5fd'">
        <span>Show Workspace Members ({{ wsUsers().length }})</span>
        <svg *ngIf="showWorkspaceMembers()" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.6"><polyline points="18 15 12 9 6 15"></polyline></svg>
        <svg *ngIf="!showWorkspaceMembers()" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.6"><polyline points="6 9 12 15 18 9"></polyline></svg>
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
    <div class="summary-grid">
      <div class="sum-card" style="border-top-color: #3b82f6;">
        <div class="sum-label">Total Views</div>
        <div class="sum-val">{{ filteredTotalViews() | number }}</div>
      </div>
      <div class="sum-card" style="border-top-color: #10b981;">
        <div class="sum-label">Unique Viewers</div>
        <div class="sum-val">{{ filteredTotalViewers() | number }}</div>
      </div>
      <div class="sum-card" style="border-top-color: #f59e0b;">
        <div class="sum-label">Days of Data</div>
        <div class="sum-val">{{ filteredViewsByDay().length }}</div>
      </div>
      <div class="sum-card" style="border-top-color: #8b5cf6;">
        <div class="sum-label">Workspace Users</div>
        <div class="sum-val">{{ wsUsers().length }}</div>
      </div>
    </div>

    <div class="two-col">
      <!-- Views per day/month chart -->
      <div class="card">
        <h3>Views per Day</h3>
        <div class="bar-chart-wrap" *ngIf="filteredViewsByDay().length; else noData">
          <div class="bar-chart">
            <div class="bar-col" *ngFor="let d of filteredViewsByDay()">
              
              <div class="bar" [style.height.px]="barHeight(d.views)"></div>
              <div class="bar-label">{{ d.date | date:'M/d/yy' }}</div>
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

      <div class="table-container">
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
    <div *ngIf="selectedUserDetails() as details" style="margin-top:24px;border: none;border-radius:12px;background:#fffdfa;padding:20px;box-shadow:var(--shadow-sm);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:1.5px solid #fef3c7;padding-bottom:12px;">
        <h3 style="margin:0;color:#b45309;font-weight:700;font-size:14px;letter-spacing:.5px;">
          Detailed Breakdown- {{ details.givenName }} {{ details.familyName }} 
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
          <div class="table-container" style="border-color:#f59e0b;scrollbar-color:#f59e0b #fef3c7;">
            <table>
              <thead><tr><th style="background:#f59e0b;border-bottom-color:#f59e0b;color:#ffffff;">Report / Dashboard Name</th><th style="background:#f59e0b;border-bottom-color:#f59e0b;color:#ffffff;">Views</th></tr></thead>
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
          <div class="table-container" style="border-color:#10b981;scrollbar-color:#10b981 #ecfdf5;">
            <table>
              <thead><tr><th style="background:#10b981;border-bottom-color:#10b981;color:#ffffff;">Tab Name</th><th style="background:#10b981;border-bottom-color:#10b981;color:#ffffff;">Dashboard / Report</th><th style="background:#10b981;border-bottom-color:#10b981;color:#ffffff;">Views</th></tr></thead>
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

        <div class="table-container">
          <table>
            <thead><tr><th>Name</th><th>Views</th></tr></thead>
            <tbody>
              <tr *ngFor="let r of filteredReportViews() | slice: pageReportViews()*10 : (pageReportViews()+1)*10">
                <td><strong>{{ r.reportName }}</strong></td>
                <td>{{ r.views | number }}</td>
              </tr>
              <tr *ngIf="!filteredReportViews().length">
                <td colspan="2" class="empty">No matching reports.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="pagination" *ngIf="filteredReportViews().length > 10">
          <button [disabled]="pageReportViews() === 0" (click)="pageReportViews.set(pageReportViews() - 1)">Previous</button>
          <span>Page {{ pageReportViews() + 1 }} of {{ Math.ceil(filteredReportViews().length / 10) }}</span>
          <button [disabled]="(pageReportViews() + 1) * 10 >= filteredReportViews().length" (click)="pageReportViews.set(pageReportViews() + 1)">Next</button>
        </div>
      </div>

      <!-- Views by Page -->
      <div class="card" *ngIf="filteredPageViews().length || pageSearch()">
        <h3>Views by Page Tab</h3>
        
        <!-- Search input for Page Tabs -->
        <input type="text" class="table-search-input" placeholder="Search page tabs..."
               [ngModel]="pageSearch()" (ngModelChange)="pageSearch.set($event)" />

        <div class="table-container">
          <table>
            <thead><tr><th>Tab Name</th><th>Dashboard / Report</th><th>Views</th></tr></thead>
            <tbody>
              <tr *ngFor="let p of filteredPageViews() | slice: pagePageViews()*10 : (pagePageViews()+1)*10">
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
        <div class="pagination" *ngIf="filteredPageViews().length > 10">
          <button [disabled]="pagePageViews() === 0" (click)="pagePageViews.set(pagePageViews() - 1)">Previous</button>
          <span>Page {{ pagePageViews() + 1 }} of {{ Math.ceil(filteredPageViews().length / 10) }}</span>
          <button [disabled]="(pagePageViews() + 1) * 10 >= filteredPageViews().length" (click)="pagePageViews.set(pagePageViews() + 1)">Next</button>
        </div>
      </div>
    </div>

  </ng-container>

    <!-- Global / Workspace-Filtered Aggregated Metrics Dashboard -->
  <ng-container *ngIf="!selectedReportId() && globalStats() as stats">
    <div style="margin-top:20px;">
      
      <div class="section-header">
        {{ selectedGroupId() ? 'WORKSPACE ANALYTICS SUMMARY' : 'GLOBAL WORKSPACE ANALYTICS OVERVIEW' }}
      </div>

      <div class="premium-grid">
        
        <!-- Card 1: Top Workspaces (Donut) -->
        <div class="card premium-card" *ngIf="!selectedGroupId()">
          <h3>Top Workspaces by Views</h3>
          <div class="donut-container" *ngIf="workspaceDonutSegments().length">
            <svg class="donut-chart" viewBox="0 0 200 200" style="background:none;">
              <path *ngFor="let p of getDonutPaths(workspaceDonutSegments())" [attr.d]="p.d" [attr.fill]="p.color" (mouseenter)="showTooltip($event, p.name + '\n' + p.views + ' views')" (mousemove)="moveTooltip($event)" (mouseleave)="hideTooltip()" style="transition: opacity 0.2s; cursor: pointer;" onmouseover="this.style.opacity=0.8" onmouseout="this.style.opacity=1"></path>
              <circle cx="100" cy="100" r="55" fill="#ffffff"></circle>
            </svg>
            <div class="donut-legend">
              <div class="legend-item" *ngFor="let s of workspaceDonutSegments()">
                <div class="legend-dot" [style.background]="s.color"></div>
                <div class="legend-name" [title]="s.name">{{ s.name }}</div>
                <div class="legend-value">{{ s.views | number }} &middot; {{ s.percent | number:'1.0-0' }}%</div>
              </div>
            </div>
          </div>
          <div class="donut-footer" *ngIf="workspaceDonutSegments().length">
            <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#10b981; margin-right:6px; margin-bottom:1px;"></span>
            {{ workspaceDonutSegments()[0].name }} leads with {{ workspaceDonutSegments()[0].views | number }} views &mdash; {{ workspaceDonutSegments()[0].percent | number:'1.0-0' }}% of top-5 volume
          </div>
        </div>

        <!-- Card 2: Top Users (Horizontal Bars) -->
        <div class="card premium-card">
          <h3>Top Users by Views <span class="badge-light">Top 10</span></h3>
          <div style="margin-bottom:12px;" *ngIf="topUsersHbars().length">
            <div class="hbar-row" *ngFor="let u of topUsersHbars().slice(0,5)" (mouseenter)="showTooltip($event, u.name + '\n' + u.views + ' views\nLast Access: ' + u.lastAccessed)" (mousemove)="moveTooltip($event)" (mouseleave)="hideTooltip()">
              <div class="hbar-header">
                <span style="font-weight:600; color:#1e293b;">{{ u.name }}</span>
              </div>
              <div class="hbar-bg">
                <div class="hbar-fill" style="background:#60a5fa;" [style.width.%]="u.percent"></div>
              </div>
            </div>
          </div>
          <div class="table-container"><table class="clean-table">
              <thead><tr><th>Name</th><th style="text-align:right;">Views</th><th style="text-align:right;">Last Accessed</th></tr></thead>
              <tbody>
                <tr *ngFor="let u of stats.topUsers | slice: pageTopUsers()*10 : (pageTopUsers()+1)*10">
                  <td><strong>{{ u.name }}</strong></td>
                  <td style="text-align:right;">{{ u.views | number }}</td>
                  <td style="text-align:right; color:#000000;">{{ u.lastAccessed | date:'mediumDate' }}</td>
                </tr>
              </tbody>
            </table></div>
          <div class="pagination" *ngIf="stats.topUsers.length > 10">
            <button [disabled]="pageTopUsers() === 0" (click)="pageTopUsers.set(pageTopUsers() - 1)">Previous</button>
            <span>Page {{ pageTopUsers() + 1 }} of {{ Math.ceil(stats.topUsers.length / 10) }}</span>
            <button [disabled]="(pageTopUsers() + 1) * 10 >= stats.topUsers.length" (click)="pageTopUsers.set(pageTopUsers() + 1)">Next</button>
          </div>
        </div>

        <!-- Card 3: Top Reports (Vertical Bar) -->
        <div class="card premium-card">
          <h3>Top Reports / Dashboards <span class="badge-light" style="background:#eff6ff;color:#3b82f6;">Views</span></h3>
                    <div style="margin-top:20px;">
            <div class="hbar-row-c" *ngFor="let r of stats.topReports.slice(0, 5)" (mouseenter)="showTooltip($event, r.name + '\n' + r.views + ' views')" (mousemove)="moveTooltip($event)" (mouseleave)="hideTooltip()">
              <div class="hbar-label-c" [title]="r.name">{{ r.name }}</div>
              <div class="hbar-track-c">
                <div class="hbar-fill-c" style="background: #3b82f6;" [style.width.%]="Math.max(2, (r.views / (stats.topReports[0]?.views || 1)) * 100)"></div>
                <div class="hbar-val-c">{{ r.views | number }}</div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Card 4: Top Pages (Table) -->
        <div class="card premium-card" style="grid-column: span 3;">
          <h3>Top Pages / Tabs <span class="badge-light">Views</span></h3>
          <table class="clean-table">
            <thead><tr><th>Tab</th><th>Parent Report</th><th style="text-align:right;">Views</th></tr></thead>
            <tbody>
              <tr *ngFor="let p of stats.topPages | slice: pageTopPages()*10 : (pageTopPages()+1)*10">
                <td><strong>{{ p.pageName }}</strong></td>
                <td>{{ p.reportName }}</td>
                <td style="text-align:right;">{{ p.views | number }}</td>
              </tr>
              <tr *ngIf="!stats.topPages.length"><td colspan="3" class="empty">No pages.</td></tr>
            </tbody>
          </table>
          <div class="pagination" *ngIf="stats.topPages.length > 10">
            <button [disabled]="pageTopPages() === 0" (click)="pageTopPages.set(pageTopPages() - 1)">Previous</button>
            <span>Page {{ pageTopPages() + 1 }} of {{ Math.ceil(stats.topPages.length / 10) }}</span>
            <button [disabled]="(pageTopPages() + 1) * 10 >= stats.topPages.length" (click)="pageTopPages.set(pageTopPages() + 1)">Next</button>
          </div>
        </div>

      </div>

      <div class="section-header" style="color:#d97706;">
        <span style="background:#f59e0b; width:6px; height:6px; border-radius:50%; display:block; margin-right:8px;"></span>
        LEAST USED COMPONENTS &mdash; IDLE WATCHLIST
      </div>

      <div class="premium-grid" style="grid-template-columns: repeat(2, 1fr);">
        
        <!-- Least Used Reports -->
        <div class="card premium-card">
          <h3>Least Used Reports <span class="badge-light" style="background:#fef3c7; color:#d97706;">Needs review</span></h3>
          <div style="margin-top:12px;">
            <div style="display:flex; align-items:center; margin-bottom:12px; gap:12px;" *ngFor="let r of leastReportsHbars()" (mouseenter)="showTooltip($event, r.name + '\n' + r.views + ' views')" (mousemove)="moveTooltip($event)" (mouseleave)="hideTooltip()">
              <div style="width:140px; font-size:11px; font-weight:600; color:#000000; text-align:right; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" [title]="r.name">
                {{ r.name }}
              </div>
              <div style="flex:1; display:flex; align-items:center; gap:8px;">
                <div style="height:14px; background:#f59e0b; border-radius:3px; min-width:4px;" [style.width.%]="r.percent"></div>
                <span style="font-size:11px; color:#000000;">{{ r.views | number }}</span>
              </div>
            </div>
            <div *ngIf="!leastReportsHbars().length" class="empty">No idle reports.</div>
          </div>
        </div>

        <!-- Least Used Pages -->
        <div class="card premium-card">
          <h3>Least Used Pages <span class="badge-light" style="background:#fef3c7; color:#d97706;">Needs review</span></h3>
          <table class="clean-table">
            <thead><tr><th>Tab</th><th>Parent Report</th><th style="text-align:right;">Views</th></tr></thead>
            <tbody>
              <tr *ngFor="let p of stats.leastPages">
                <td>
                  <span style="font-size:9px; background:#fef3c7; color:#d97706; padding:2px 6px; border-radius:4px; font-weight:700; margin-right:6px;">Idle</span>
                  <strong>{{ p.pageName }}</strong>
                </td>
                <td>{{ p.reportName }}</td>
                <td style="text-align:right;">{{ p.views | number }}</td>
              </tr>
              <tr *ngIf="!stats.leastPages?.length"><td colspan="3" class="empty">No idle pages.</td></tr>
            </tbody>
          </table>
        </div>

      </div>

    </div>
  </ng-container>
  `,
})
export class UsageComponent implements OnInit {
  // SVG Donut helpers
  getDonutPaths(segments: any[]) {
    let total = segments.reduce((sum, s) => sum + (s.views || 0), 0);
    if (total === 0) return [];
    
    let currentAngle = -90; // Start at top
    const cx = 100, cy = 100, r = 80;
    
    return segments.map(s => {
      const angle = ((s.views || 0) / total) * 360;
      const endAngle = currentAngle + angle;
      
      const x1 = cx + r * Math.cos(currentAngle * Math.PI / 180);
      const y1 = cy + r * Math.sin(currentAngle * Math.PI / 180);
      const x2 = cx + r * Math.cos(endAngle * Math.PI / 180);
      const y2 = cy + r * Math.sin(endAngle * Math.PI / 180);
      
      const largeArc = angle > 180 ? 1 : 0;
      let d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      
      if (angle === 360) {
        d = `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`;
      }
      
      const pathData = { d, color: s.color, name: s.name, views: s.views };
      currentAngle = endAngle;
      return pathData;
    });
  }

  Math = Math;
  pageUsers = signal(0);
  pageReportViews = signal(0);
  pagePageViews = signal(0);
  pageTopUsers = signal(0);
  pageTopPages = signal(0);

  tooltip = signal<{ show: boolean, text: string, x: number, y: number }>({ show: false, text: '', x: 0, y: 0 });
  showTooltip(event: MouseEvent, text: string) {
    this.tooltip.set({ show: true, text, x: event.clientX, y: event.clientY });
  }
  moveTooltip(event: MouseEvent) {
    if (this.tooltip().show) {
      this.tooltip.update(t => ({ ...t, x: event.clientX, y: event.clientY }));
    }
  }
  hideTooltip() {
    this.tooltip.update(t => ({ ...t, show: false }));
  }
  
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

  // Filter viewsByDay to show only the last N days chronologically.
  filteredViewsByDay = computed(() => {
    const data = this.analytics()?.viewsByDay ?? [];
    if (!data.length) return [];
    
    const limit = this.selectedDays();
    const latestDate = new Date(data[data.length - 1].date);
    const cutoffDate = new Date(latestDate);
    cutoffDate.setDate(cutoffDate.getDate() - limit);
    
    return data.filter(d => new Date(d.date) >= cutoffDate);
  });

  // Computed properties for the redesigned UI
  workspaceDonutSegments = computed(() => {
    const stats = this.globalStats();
    if (!stats || !stats.topWorkspaces || stats.topWorkspaces.length === 0) return [];
    
    // Take top 5
    const top5 = stats.topWorkspaces.slice(0, 5);
    const total = top5.reduce((acc: number, w: any) => acc + w.views, 0);
    
    let cumulativePercent = 0;
    const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#93c5fd', '#bae6fd'];
    
    return top5.map((w: any, i: number) => {
      const percent = total > 0 ? (w.views / total) * 100 : 0;
      const start = cumulativePercent;
      cumulativePercent += percent;
      return {
        ...w,
        color: colors[i % colors.length],
        percent,
        conicString: `${colors[i % colors.length]} ${start}% ${cumulativePercent}%`
      };
    });
  });

  workspaceDonutStyle = computed(() => {
    const segments = this.workspaceDonutSegments();
    if (!segments.length) return '';
    return `conic-gradient(${segments.map((s: any) => s.conicString).join(', ')})`;
  });

  topUsersHbars = computed(() => {
    const stats = this.globalStats();
    if (!stats || !stats.topUsers || stats.topUsers.length === 0) return [];
    const max = Math.max(...stats.topUsers.map((u: any) => u.views));
    return stats.topUsers.map((u: any) => ({
      ...u,
      percent: max > 0 ? (u.views / max) * 100 : 0
    }));
  });

  leastReportsHbars = computed(() => {
    const stats = this.globalStats();
    if (!stats || !stats.leastReports || stats.leastReports.length === 0) return [];
    const max = Math.max(...stats.leastReports.map((r: any) => r.views));
    // Scale so max bar is like 80% to leave room
    return stats.leastReports.map((r: any) => ({
      ...r,
      percent: max > 0 ? (r.views / max) * 80 : 0
    }));
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
