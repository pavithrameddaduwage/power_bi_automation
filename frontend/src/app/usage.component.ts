import { Component, OnInit, signal, computed, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  SyncApiService,
  UsageReportItem,
  WorkspaceUser,
  UsageAnalytics,
  GlobalDashboardStats,
  StatItem,
} from './sync.service';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-usage',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    :host {
      display: block;
      color: #0f172a;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    .compact-dashboard {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 4px 0 16px 0;
    }

    /* ── Header ── */
    .dash-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 2px;
    }

    .dash-title-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #2563eb;
      flex-shrink: 0;
    }

    .dash-title {
      font-size: 14.5px;
      font-weight: 700;
      color: #1e3a8a;
      letter-spacing: -0.2px;
    }

    .dash-controls {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .compact-select {
      height: 32px;
      background: #ffffff;
      border: 1.5px solid #cbd5e1;
      border-radius: 6px;
      padding: 0 30px 0 10px;
      font-size: 12.5px;
      font-weight: 500;
      color: #0f172a;
      cursor: pointer;
      outline: none;
      appearance: none;
      -webkit-appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23334155' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 8px center;
      transition: border-color 0.15s;
      width: 180px;
      max-width: 180px;
    }

    .compact-select:focus {
      border-color: #2563eb;
    }

    /* ── Top KPI Cards (5 compact cards in a single row) ── */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 12px;
    }

    @media (max-width: 1024px) {
      .kpi-grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    .kpi-card {
      background: #f0f7ff;
      border: 1.5px solid #bfdbfe;
      border-radius: 12px;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-height: 70px;
      box-shadow: 0 1px 2px rgba(37, 99, 235, 0.03);
    }

    .kpi-label {
      font-size: 11.5px;
      font-weight: 600;
      color: #2563eb;
      margin-bottom: 3px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .kpi-value {
      font-size: 25px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.1;
      letter-spacing: -0.4px;
    }

    .kpi-sub {
      font-size: 10.5px;
      color: #64748b;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 2px;
    }

    /* ── Middle Section (2 Columns) ── */
    .mid-grid {
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 14px;
    }

    @media (max-width: 900px) {
      .mid-grid {
        grid-template-columns: 1fr;
      }
    }

    .card-outlined {
      background: #ffffff;
      border: 1.5px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px 18px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
      display: flex;
      flex-direction: column;
    }

    .card-title {
      font-size: 13.5px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 12px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* Workspaces progress rows */
    .ws-row {
      margin-bottom: 10px;
    }

    .ws-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12.5px;
      margin-bottom: 3px;
    }

    .ws-name {
      font-weight: 600;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 78%;
    }

    .ws-views {
      font-weight: 700;
      color: #0f172a;
      font-variant-numeric: tabular-nums;
    }

    .bar-track {
      width: 100%;
      height: 6px;
      background: #f1f5f9;
      border-radius: 99px;
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      border-radius: 99px;
      transition: width 0.5s ease-out;
    }

    .section-sub {
      font-size: 11.5px;
      font-weight: 700;
      color: #64748b;
      margin: 12px 0 6px 0;
    }

    .report-pills {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .report-pill {
      background: #f8fafc;
      border: 1px solid #eef2f6;
      border-radius: 6px;
      padding: 7px 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .pill-name {
      font-size: 12px;
      font-weight: 600;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      padding-right: 8px;
    }

    .pill-views {
      font-size: 12.5px;
      font-weight: 700;
      color: #2563eb;
      font-variant-numeric: tabular-nums;
    }

    /* Top Users List (No internal scroll) */
    .users-scroll {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .user-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 3px 4px;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.12s;
    }

    .user-item:hover {
      background: #f8fafc;
    }

    .user-avatar {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: #60a5fa;
      color: #ffffff;
      font-size: 12.5px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .user-info {
      flex: 1;
      min-width: 0;
    }

    .user-name {
      font-size: 12.5px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .user-date {
      font-size: 11px;
      color: #64748b;
      font-weight: 500;
    }

    .user-views {
      font-size: 13px;
      font-weight: 700;
      color: #2563eb;
      font-variant-numeric: tabular-nums;
    }

    /* ── Bottom Section (3 Columns) ── */
    .bot-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
    }

    @media (max-width: 900px) {
      .bot-grid {
        grid-template-columns: 1fr;
      }
    }

    .card-tinted {
      background: #f0f7ff;
      border: 1.5px solid #bfdbfe;
      border-radius: 12px;
      padding: 16px 18px;
      box-shadow: 0 1px 3px rgba(37, 99, 235, 0.02);
      display: flex;
      flex-direction: column;
    }

    .card-tinted .card-title {
      color: #1e3a8a;
    }

    .page-list, .least-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .page-row-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 2px 0;
    }

    .page-meta {
      min-width: 0;
      flex: 1;
      padding-right: 8px;
    }

    .page-name-txt {
      font-size: 12.5px;
      font-weight: 700;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.2;
    }

    .page-sub-txt {
      font-size: 11px;
      color: #64748b;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .page-views-txt {
      font-size: 12.5px;
      font-weight: 700;
      color: #2563eb;
      font-variant-numeric: tabular-nums;
    }

    .least-row-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 2px 0;
    }

    .least-name-txt {
      font-size: 12px;
      font-weight: 500;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      padding-right: 8px;
      flex: 1;
    }

    .least-views-txt {
      font-size: 12.5px;
      font-weight: 700;
      color: #0f172a;
      font-variant-numeric: tabular-nums;
    }

    /* ── Single Report Drilldown ── */
    .drilldown-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .report-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 8px;
      background: #eff6ff;
      color: #2563eb;
      border: 1px solid #bfdbfe;
      border-radius: 6px;
      font-size: 11.5px;
      font-weight: 600;
    }

    .btn-back {
      height: 28px;
      background: #ffffff;
      color: #2563eb;
      border: 1.5px solid #93c5fd;
      font-size: 11.5px;
      font-weight: 600;
      padding: 0 10px;
      border-radius: 6px;
      cursor: pointer;
    }

    .btn-back:hover {
      background: #eff6ff;
    }

    .day-btn {
      padding: 3px 8px;
      border-radius: 5px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid #cbd5e1;
      background: #fff;
      color: #334155;
    }

    .day-btn.active {
      background: #2563eb;
      color: #fff;
      border-color: #2563eb;
    }

    .spinner {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid #dbeafe;
      border-top-color: #2563eb;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      vertical-align: middle;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Single Report Charts */
    .bar-chart-wrap { overflow: visible; width: 100%; padding-top: 15px; }
    .bar-chart { display: flex; align-items: flex-end; gap: 3px; height: 110px; width: 100%; }
    .bar-col { display: flex; flex-direction: column; align-items: center; gap: 2px; flex: 1; min-width: 0; }
    .bar-rect {
      width: 100%; background: linear-gradient(180deg, #f59e0b 0%, #fbbf24 100%);
      border-radius: 4px 4px 0 0; min-height: 4px; transition: opacity 0.15s;
    }
    .bar-rect:hover { opacity: 0.8; }
    .bar-lbl { font-size: 8px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .platform-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .platform-name { font-size: 11.5px; font-weight: 500; color: #0f172a; width: 80px; flex-shrink: 0; }
    .platform-bar-wrap { flex: 1; background: #eff6ff; border-radius: 99px; height: 7px; overflow: hidden; }
    .platform-bar-fill { height: 100%; background: linear-gradient(90deg, #2563eb, #60a5fa); border-radius: 99px; }
    .platform-count { font-size: 11.5px; font-weight: 700; color: #0f172a; width: 35px; text-align: right; }

    .data-tbl { width: 100%; border-collapse: collapse; font-size: 12px; }
    .data-tbl th {
      background: #f8fafc; color: #475569; font-weight: 600; padding: 6px 10px; text-align: left;
      border-bottom: 1px solid #e2e8f0; font-size: 11px;
    }
    .data-tbl td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; color: #0f172a; }

    /* Skeleton Loading State */
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    .skeleton-box {
      background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 12px;
      border: 1.5px solid #e2e8f0;
    }
  `],
  template: `
  <div class="compact-dashboard">
    <!-- Top Header -->
    <div class="dash-header" style="justify-content: flex-end;">
      <div class="dash-controls">
        <!-- Compact Workspace dropdown -->
        <select class="compact-select" [ngModel]="selectedGroupId()" (ngModelChange)="onWorkspaceChange($event)">
          <option value="">Select workspace</option>
          <option *ngFor="let ws of workspaces()" [value]="ws.groupId">{{ ws.groupName }}</option>
        </select>

        <!-- Compact Report dropdown -->
        <select class="compact-select" [ngModel]="selectedReportId()" (ngModelChange)="onReportChange($event)">
          <option value="">Select report</option>
          <option *ngFor="let r of reportsForWorkspace()" [value]="r.reportId">{{ r.reportName }}</option>
        </select>
      </div>
    </div>

    <!-- ──────────────── GLOBAL DASHBOARD OVERVIEW ──────────────── -->
    <ng-container *ngIf="!selectedReportId()">
      <!-- Skeleton Loading State (Only shown if totally empty and fetching for the first time) -->
      <div *ngIf="loadingGlobal() && !globalStats()" class="skeleton-dashboard">
        <div class="kpi-grid">
          <div class="skeleton-box" style="height:70px;" *ngFor="let _ of [1,2,3,4,5]"></div>
        </div>
        <div class="mid-grid" style="margin-top:14px;">
          <div class="skeleton-box" style="height:270px;"></div>
          <div class="skeleton-box" style="height:270px;"></div>
        </div>
        <div class="bot-grid" style="margin-top:14px;">
          <div class="skeleton-box" style="height:150px;"></div>
          <div class="skeleton-box" style="height:150px;"></div>
          <div class="skeleton-box" style="height:150px;"></div>
        </div>
      </div>

      <!-- Real Loaded Dashboard (Warm start: instant 0ms render) -->
      <ng-container *ngIf="globalStats() || !loadingGlobal()">
        <!-- Row 1: Top 5 Meaningful KPI Cards -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Total views</div>
            <div class="kpi-value">{{ displayTotalViews() | number }}</div>
            <div class="kpi-sub">Across all workspaces</div>
          </div>

        <div class="kpi-card">
          <div class="kpi-label">Unique Viewers</div>
          <div class="kpi-value">{{ displayTotalViewers() | number }}</div>
          <div class="kpi-sub">Active corporate users</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-label">Active Reports</div>
          <div class="kpi-value">{{ displayActiveReportsCount() | number }}</div>
          <div class="kpi-sub">In {{ displayWorkspacesCount() }} workspaces</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-label">Top report views</div>
          <div class="kpi-value">{{ displayTopReportViews() | number }}</div>
          <div class="kpi-sub" [title]="displayTopReportName()">{{ displayTopReportName() || 'Most viewed report' }}</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-label">Most active user</div>
          <div class="kpi-value">{{ displayMostActiveUserViews() | number }}</div>
          <div class="kpi-sub" [title]="displayMostActiveUserName()">{{ displayMostActiveUserName() || 'Peak viewer' }}</div>
        </div>
      </div>

      <!-- Row 2: Middle Section (2 Columns) -->
      <div class="mid-grid">
        <!-- Left: Top workspaces and reports -->
        <div class="card-outlined">
          <div class="card-title">
            <span>Top workspaces and reports</span>
          </div>

          <!-- Workspaces progress items -->
          <div class="ws-row" *ngFor="let ws of displayWorkspaces(); let i = index">
            <div class="ws-info">
              <span class="ws-name" [title]="ws.name">{{ ws.name }}</span>
              <span class="ws-views">{{ ws.views | number }}</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill" [style.width.%]="ws.percent" [style.background]="getWorkspaceBarColor(i)"></div>
            </div>
          </div>

          <!-- Top reports sub-section -->
          <div class="section-sub">Top reports</div>
          <div class="report-pills">
            <div class="report-pill" *ngFor="let rep of displayTopReports()">
              <span class="pill-name" [title]="rep.name">{{ rep.name }}</span>
              <span class="pill-views">{{ rep.views | number }}</span>
            </div>
          </div>
        </div>

        <!-- Right: Top 10 Users -->
        <div class="card-outlined">
          <div class="card-title">
            <span>Top users</span>
          </div>

          <div class="users-scroll">
            <div class="user-item" *ngFor="let u of displayTopUsers(); let i = index" (click)="navigateToUser.emit(u.email)">
              <div class="user-avatar" [style.background]="getUserAvatarStyle(u.name, i).bg" [style.color]="getUserAvatarStyle(u.name, i).color">
                {{ getUserInitial(u.name) }}
              </div>
              <div class="user-info">
                <div class="user-name" [title]="u.name">{{ u.name }}</div>
                <div class="user-date">{{ formatUserDate(u.lastAccessed) }}</div>
              </div>
              <div class="user-views">{{ u.views | number }}</div>
            </div>
            <div *ngIf="!displayTopUsers().length" style="color:#94a3b8; font-size:12px; text-align:center; padding:20px;">
              No users recorded yet.
            </div>
          </div>
        </div>
      </div>

      <!-- Row 3: Bottom Section (3 Columns) -->
      <div class="bot-grid">
        <!-- Card 1: Top pages (Outlined White) -->
        <div class="card-outlined">
          <div class="card-title">
            <span>Top pages</span>
          </div>
          <div class="page-list">
            <div class="page-row-item" *ngFor="let p of displayTopPages()">
              <div class="page-meta">
                <div class="page-name-txt" [title]="p.pageName">{{ p.pageName }}</div>
                <div class="page-sub-txt" [title]="p.reportName">{{ p.reportName }}</div>
              </div>
              <div class="page-views-txt">{{ p.views | number }}</div>
            </div>
            <div *ngIf="!displayTopPages().length" style="color:#94a3b8; font-size:11px; text-align:center; padding:10px;">
              No pages data.
            </div>
          </div>
        </div>

        <!-- Card 2: Least used reports (Outlined Blue Tinted) -->
        <div class="card-tinted">
          <div class="card-title">
            <span>Least used reports</span>
          </div>
          <div class="least-list">
            <div class="least-row-item" *ngFor="let r of displayLeastReports()">
              <span class="least-name-txt" [title]="r.name">{{ r.name }}</span>
              <span class="least-views-txt">{{ r.views | number }}</span>
            </div>
            <div *ngIf="!displayLeastReports().length" style="color:#94a3b8; font-size:11px; text-align:center; padding:10px;">
              No idle reports.
            </div>
          </div>
        </div>

        <!-- Card 3: Least used pages (Outlined Blue Tinted) -->
        <div class="card-tinted">
          <div class="card-title">
            <span>Least used pages</span>
          </div>
          <div class="least-list">
            <div class="least-row-item" *ngFor="let p of displayLeastPages()">
              <span class="least-name-txt" [title]="p.pageName">{{ p.pageName }}</span>
              <span class="least-views-txt">{{ p.views | number }}</span>
            </div>
            <div *ngIf="!displayLeastPages().length" style="color:#94a3b8; font-size:11px; text-align:center; padding:10px;">
              No idle pages.
            </div>
          </div>
        </div>
      </div>
      </ng-container>
    </ng-container>

    <!-- ──────────────── SINGLE REPORT DRILL-DOWN VIEW ──────────────── -->
    <ng-container *ngIf="selectedReportId()">
      <div class="drilldown-bar">
        <div class="report-badge">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path></svg>
          <span>{{ selectedReport()?.reportName }}</span>
        </div>

        <div style="display:flex; gap:8px; align-items:center;">
          <div class="day-btns" *ngIf="analytics()" style="display:flex; gap:4px;">
            <button class="day-btn" [class.active]="selectedDays() === 30" (click)="selectedDays.set(30)">1M</button>
            <button class="day-btn" [class.active]="selectedDays() === 60" (click)="selectedDays.set(60)">2M</button>
            <button class="day-btn" [class.active]="selectedDays() === 90" (click)="selectedDays.set(90)">3M</button>
          </div>
          <button class="btn-back" (click)="selectedReportId.set('')">
            ← Global Overview
          </button>
        </div>
      </div>

      <div *ngIf="loadingAnalytics()" style="text-align:center; padding:30px 0; color:#64748b; font-size:13px;">
        <span class="spinner"></span> Loading analytics…
      </div>

      <div *ngIf="analytics() && !loadingAnalytics()">
        <!-- Summary cards for this report -->
        <div class="kpi-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom:10px;">
          <div class="kpi-card">
            <div class="kpi-label">Report Views</div>
            <div class="kpi-value">{{ filteredTotalViews() | number }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Unique Viewers</div>
            <div class="kpi-value">{{ filteredTotalViewers() | number }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Days with Activity</div>
            <div class="kpi-value">{{ filteredViewsByDay().length }}</div>
          </div>
        </div>

        <div class="mid-grid">
          <!-- Views per Day -->
          <div class="card-outlined">
            <div class="card-title"><span>Views per Day</span></div>
            <div class="bar-chart-wrap" *ngIf="chartData().length; else noData">
              <div class="bar-chart">
                <div class="bar-col" *ngFor="let d of chartData()">
                  <div class="bar-rect" [style.height.px]="barHeight(d.views)"></div>
                  <div class="bar-lbl">{{ d.date | date:'M/d' }}</div>
                </div>
              </div>
            </div>
            <ng-template #noData><p style="color:#94a3b8; font-size:12px; text-align:center; padding:15px 0;">No view data.</p></ng-template>
          </div>

          <!-- Views by Platform -->
          <div class="card-outlined">
            <div class="card-title"><span>Views by Platform</span></div>
            <div *ngIf="filteredViewsByPlatform().length; else noPlat">
              <div class="platform-row" *ngFor="let p of filteredViewsByPlatform()">
                <span class="platform-name">{{ p.platform }}</span>
                <div class="platform-bar-wrap">
                  <div class="platform-bar-fill" [style.width.%]="platformPct(p.views)"></div>
                </div>
                <span class="platform-count">{{ p.views }}</span>
              </div>
            </div>
            <ng-template #noPlat><p style="color:#94a3b8; font-size:12px; text-align:center; padding:15px 0;">No platform data.</p></ng-template>
          </div>
        </div>

        <!-- Views by User -->
        <div class="card-outlined" style="margin-top:12px;">
          <div class="card-title">
            <span>Views by User</span>
            <span style="font-size:11px; font-weight:500; color:#64748b;">Click a user to view page breakdown</span>
          </div>
          <div style="max-height:160px; overflow-y:auto;">
            <table class="data-tbl">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th style="text-align:right;">Views</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let u of filteredViewsByUser()" (click)="toggleSelectedUser(u.email)" 
                    [style.background]="selectedUserEmail() === u.email ? '#fef3c7' : ''"
                    style="cursor:pointer; transition: background 0.15s;">
                  <td><strong>{{ (u.givenName + ' ' + u.familyName) | titlecase }}</strong></td>
                  <td style="color:#64748b;">{{ u.email }}</td>
                  <td style="text-align:right; font-weight:700; color:#2563eb;">{{ u.views | number }}</td>
                </tr>
                <tr *ngIf="!filteredViewsByUser().length">
                  <td colspan="3" style="text-align:center; color:#94a3b8; padding:15px;">No users found.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- User Pages Breakdown with Workspace Name & Last Accessed -->
          <div *ngIf="selectedUserEmail() && selectedUserDetails() as u" style="margin-top: 14px; border: 1.5px solid #fcd34d; border-radius: 8px; background: #fffdfa; padding: 14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom: 1px solid #fef3c7; padding-bottom: 8px;">
              <div style="display:flex; align-items:center; gap:8px; flex-wrap: wrap;">
                <span style="font-weight:700; color:#b45309; font-size:13px;">Pages Accessed by {{ u.name | titlecase }}</span>
                <span style="font-size:11px; font-weight:600; background:#fef3c7; color:#b45309; padding:2px 8px; border-radius:99px;">
                  Workspace: {{ selectedWorkspaceName() || 'Selected Workspace' }}
                </span>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <button (click)="navigateToUser.emit(u.email)" style="background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; border-radius:5px; font-size:11px; font-weight:600; padding:3px 8px; cursor:pointer;">
                  View Full Profile →
                </button>
                <button (click)="selectedUserEmail.set('')" style="background:none; border:none; color:#94a3b8; font-size:14px; cursor:pointer; font-weight:700;">✕</button>
              </div>
            </div>

            <div style="max-height: 180px; overflow-y: auto;">
              <table class="data-tbl">
                <thead>
                  <tr>
                    <th>Workspace Name</th>
                    <th>Report Name</th>
                    <th>Page / Tab Name</th>
                    <th style="text-align:right;">Views</th>
                    <th style="text-align:right;">Last Accessed</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let p of selectedUserPageList()">
                    <td><span style="font-weight:600; color:#1e40af;">{{ p.workspaceName }}</span></td>
                    <td>{{ p.reportName }}</td>
                    <td><strong style="color:#0f172a;">{{ p.pageName }}</strong></td>
                    <td style="text-align:right; font-weight:700; color:#2563eb;">{{ p.views | number }}</td>
                    <td style="text-align:right; color:#64748b; font-size:11px;">{{ formatAccessDate(p.lastAccessed) }}</td>
                  </tr>
                  <tr *ngIf="!selectedUserPageList().length">
                    <td colspan="5" style="text-align:center; color:#94a3b8; padding:15px;">No detailed page access recorded for this user in this workspace.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </ng-container>
  </div>
  `,
})
export class UsageComponent implements OnInit {
  @Output() navigateToUser = new EventEmitter<string>();

  allReports = signal<UsageReportItem[]>([]);
  analytics = signal<UsageAnalytics | null>(null);
  globalStats = signal<GlobalDashboardStats | null>(null);
  wsUsers = signal<WorkspaceUser[]>([]);
  loadingReports = signal(false);
  loadingAnalytics = signal(false);
  loadingGlobal = signal(false);
  errorMsg = signal('');

  selectedGroupId = signal('');
  selectedReportId = signal('');
  selectedDays = signal<number>(30);

  // Workspaces list for dropdown
  workspaces = computed(() => {
    const seen = new Map<string, string>();
    for (const r of this.allReports()) {
      if (!seen.has(r.groupId)) seen.set(r.groupId, r.groupName);
    }
    return Array.from(seen.entries())
      .map(([groupId, groupName]) => ({ groupId, groupName }))
      .sort((a, b) => a.groupName.localeCompare(b.groupName));
  });

  reportsForWorkspace = computed(() => {
    const groupId = this.selectedGroupId();
    if (!groupId) return this.allReports();
    return this.allReports().filter(r => r.groupId === groupId);
  });

  selectedReport = computed(() =>
    this.allReports().find(r => r.reportId === this.selectedReportId()) ?? null,
  );

  selectedUserEmail = signal<string>('');

  selectedWorkspaceName = computed(() => {
    const gid = this.selectedGroupId();
    if (!gid) return '';
    return this.workspaces().find(w => w.groupId === gid)?.groupName || '';
  });

  selectedUserDetails = computed(() => {
    const email = (this.selectedUserEmail() || '').toLowerCase().trim();
    if (!email) return null;
    const user = this.filteredViewsByUser().find(u => u.email.toLowerCase().trim() === email);
    if (user) {
      return { name: `${user.givenName} ${user.familyName}`.trim() || user.email, email: user.email };
    }
    return { name: email, email };
  });

  selectedUserPageList = computed(() => {
    const email = (this.selectedUserEmail() || '').toLowerCase().trim();
    if (!email) return [];
    const wsName = this.selectedWorkspaceName() || 'Selected Workspace';
    const rawAccess = this.analytics()?.userPageAccess ?? [];
    const rawReportAccess = this.analytics()?.userReportAccess ?? [];
    const activeDates = new Set(this.filteredViewsByDay().map(d => d.date));
    
    const map = new Map<string, { workspaceName: string; reportName: string; pageName: string; views: number; lastAccessed: string }>();

    // 1. Try page-level access first (case-insensitive email matching)
    for (const a of rawAccess) {
      if ((a.email || '').toLowerCase().trim() === email && (activeDates.size === 0 || activeDates.has(a.date))) {
        const key = `${a.reportName}|${a.pageName}`;
        const existing = map.get(key);
        if (existing) {
          existing.views += a.views;
          if (a.date && (!existing.lastAccessed || a.date > existing.lastAccessed)) {
            existing.lastAccessed = a.date;
          }
        } else {
          map.set(key, {
            workspaceName: wsName,
            reportName: a.reportName,
            pageName: a.pageName,
            views: a.views,
            lastAccessed: a.date
          });
        }
      }
    }

    // 2. Fallback to report-level access if no page-level entries matched
    if (map.size === 0) {
      for (const a of rawReportAccess) {
        if ((a.email || '').toLowerCase().trim() === email && (activeDates.size === 0 || activeDates.has(a.date))) {
          const key = `${a.reportName}|${a.reportName}`;
          const existing = map.get(key);
          if (existing) {
            existing.views += a.views;
            if (a.date && (!existing.lastAccessed || a.date > existing.lastAccessed)) {
              existing.lastAccessed = a.date;
            }
          } else {
            map.set(key, {
              workspaceName: wsName,
              reportName: a.reportName,
              pageName: a.reportName,
              views: a.views,
              lastAccessed: a.date
            });
          }
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => b.views - a.views);
  });

  toggleSelectedUser(email: string) {
    if (this.selectedUserEmail() === email) {
      this.selectedUserEmail.set('');
    } else {
      this.selectedUserEmail.set(email);
    }
  }

  // ── Dynamic Display Computed Properties for Global Dashboard ──
  displayTotalViews = computed(() => this.globalStats()?.totalViews || 0);
  displayTotalViewers = computed(() => this.globalStats()?.totalViewers || 0);
  displayActiveReportsCount = computed(() => {
    const count = this.globalStats()?.totalReportsCount;
    if (count !== undefined && count > 0) return count;
    return this.globalStats()?.topReports?.length || 0;
  });
  displayWorkspacesCount = computed(() => {
    const count = this.globalStats()?.totalWorkspacesCount;
    if (count !== undefined && count > 0) return count;
    return this.globalStats()?.topWorkspaces?.length || 0;
  });

  displayTopReportViews = computed(() => {
    const stats = this.globalStats();
    if (stats?.topReportViews && stats.topReportViews > 0) return stats.topReportViews;
    return stats?.topReports?.[0]?.views || 0;
  });

  displayTopReportName = computed(() => {
    const stats = this.globalStats();
    if (stats?.topReportName) return stats.topReportName;
    return stats?.topReports?.[0]?.name || '';
  });

  displayMostActiveUserViews = computed(() => {
    const stats = this.globalStats();
    if (stats?.mostActiveUserViews && stats.mostActiveUserViews > 0) return stats.mostActiveUserViews;
    return stats?.topUsers?.[0]?.views || 0;
  });

  displayMostActiveUserName = computed(() => {
    const stats = this.globalStats();
    if (stats?.mostActiveUserName) return stats.mostActiveUserName;
    return stats?.topUsers?.[0]?.name || '';
  });

  displayWorkspaces = computed(() => {
    const raw = this.globalStats()?.topWorkspaces || [];
    const list = raw.slice(0, 3);
    const max = Math.max(...list.map(w => w.views || 1), 1);
    return list.map(w => ({
      name: w.name || 'Workspace',
      views: w.views,
      percent: Math.max(6, Math.round((w.views / max) * 100)),
    }));
  });

  displayTopReports = computed(() => {
    const raw = this.globalStats()?.topReports || [];
    return raw.slice(0, 3);
  });

  // Top Users dynamically (top 5 to balance middle section height)
  displayTopUsers = computed(() => {
    const raw = this.globalStats()?.topUsers || [];
    return raw.slice(0, 5);
  });

  displayTopPages = computed(() => {
    const raw = this.globalStats()?.topPages || [];
    return raw.slice(0, 4);
  });

  displayLeastReports = computed(() => {
    const raw = this.globalStats()?.leastReports || [];
    return raw.slice(0, 4);
  });

  displayLeastPages = computed(() => {
    const raw = this.globalStats()?.leastPages || [];
    return raw.slice(0, 4);
  });

  // Helpers
  getWorkspaceBarColor(index: number): string {
    const colors = ['#1d6ef5', '#60a5fa', '#bfdbfe'];
    return colors[index % colors.length];
  }

  getUserInitial(name?: string): string {
    if (!name) return 'U';
    const clean = name.trim();
    return clean ? clean.charAt(0).toUpperCase() : 'U';
  }

  getUserAvatarStyle(name?: string, index: number = 0): { bg: string; color: string } {
    const pastels = [
      { bg: '#dbeafe', color: '#1d4ed8' }, // Soft Sky Blue
      { bg: '#ede9fe', color: '#6d28d9' }, // Lavender / Violet
      { bg: '#dcfce7', color: '#15803d' }, // Mint / Soft Emerald
      { bg: '#ffe4e6', color: '#be123c' }, // Soft Rose
      { bg: '#fef3c7', color: '#b45309' }, // Soft Amber / Peach
      { bg: '#ccfbf1', color: '#0f766e' }, // Soft Aqua / Teal
      { bg: '#fce7f3', color: '#be185d' }, // Soft Pink
      { bg: '#ffedd5', color: '#c2410c' }, // Warm Apricot
      { bg: '#e0e7ff', color: '#4338ca' }, // Soft Indigo
      { bg: '#ecfccb', color: '#3f6212' }, // Soft Sage / Lime
    ];

    if (!name) return pastels[index % pastels.length];
    let hash = 0;
    for (let j = 0; j < name.length; j++) {
      hash = name.charCodeAt(j) + ((hash << 5) - hash);
    }
    const colorIndex = Math.abs(hash) % pastels.length;
    return pastels[colorIndex];
  }

  formatUserDate(dateStr?: string): string {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  }

  filteredViewsByDay = computed(() => {
    const data = this.analytics()?.viewsByDay ?? [];
    if (!data.length) return [];
    const limit = this.selectedDays();
    const sorted = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const latestDate = new Date(sorted[sorted.length - 1].date);
    const cutoffDate = new Date(latestDate);
    cutoffDate.setDate(cutoffDate.getDate() - limit);
    cutoffDate.setHours(0, 0, 0, 0);
    return sorted.filter(d => new Date(d.date) >= cutoffDate);
  });

  chartData = computed(() => {
    const dailyData = this.filteredViewsByDay();
    if (this.selectedDays() <= 30) return dailyData;

    const weeklyMap = new Map<string, number>();
    for (const d of dailyData) {
      const dateObj = new Date(d.date);
      const day = dateObj.getDay();
      const diff = dateObj.getDate() - day;
      const weekStart = new Date(dateObj);
      weekStart.setDate(diff);

      const y = weekStart.getFullYear();
      const m = String(weekStart.getMonth() + 1).padStart(2, '0');
      const dayStr = String(weekStart.getDate()).padStart(2, '0');
      const weekKey = `${y}-${m}-${dayStr}`;
      weeklyMap.set(weekKey, (weeklyMap.get(weekKey) || 0) + d.views);
    }
    return Array.from(weeklyMap.keys()).sort().map(w => ({ date: w, views: weeklyMap.get(w)! }));
  });

  filteredTotalViews = computed(() =>
    this.filteredViewsByDay().reduce((sum, d) => sum + d.views, 0)
  );

  filteredViewsByUser = computed(() => {
    const rawUsers = this.analytics()?.viewsByUser ?? [];
    const activeDates = new Set(this.filteredViewsByDay().map(d => d.date));
    const userMap = new Map<string, { givenName: string; familyName: string; email: string; views: number }>();

    for (const u of rawUsers) {
      if (activeDates.has(u.date)) {
        const emailKey = (u.email || '').toLowerCase().trim();
        if (!emailKey) continue;
        const existing = userMap.get(emailKey);
        if (existing) {
          existing.views += u.views;
          // Prefer full names if available
          if ((!existing.givenName || existing.givenName === existing.email) && u.givenName && u.givenName !== u.email) {
            existing.givenName = u.givenName;
            existing.familyName = u.familyName;
          }
        } else {
          userMap.set(emailKey, {
            givenName: u.givenName,
            familyName: u.familyName,
            email: emailKey,
            views: u.views,
          });
        }
      }
    }
    return Array.from(userMap.values())
      .filter(u => u.views > 0)
      .sort((a, b) => b.views - a.views);
  });

  filteredTotalViewers = computed(() => this.filteredViewsByUser().length);

  filteredViewsByPlatform = computed(() => {
    const rawPlatforms = this.analytics()?.viewsByPlatform ?? [];
    if (!rawPlatforms.length) return [];
    const activeDates = new Set(this.filteredViewsByDay().map(d => d.date));
    const platformMap = new Map<string, number>();

    for (const p of rawPlatforms) {
      if (!p.date || activeDates.has(p.date) || activeDates.size === 0) {
        platformMap.set(p.platform, (platformMap.get(p.platform) || 0) + p.views);
      }
    }

    return Array.from(platformMap.entries())
      .map(([platform, views]) => ({ platform, views }))
      .sort((a, b) => b.views - a.views);
  });

  maxViews = computed(() => Math.max(...(this.chartData().map(d => d.views) ?? [0]), 1));
  barHeight(views: number): number {
    return Math.max(3, Math.round((views / this.maxViews()) * 100));
  }

  maxPlatformViews = computed(() => Math.max(...(this.filteredViewsByPlatform().map(p => p.views) ?? [0]), 1));
  platformPct(views: number): number {
    return Math.round((views / this.maxPlatformViews()) * 100);
  }

  constructor(private api: SyncApiService, private toast: ToastService) {}

  ngOnInit(): void {
    // 1. Instant Warm Start: Render from local cache immediately (0ms lag)
    const cachedStats = this.api.getCachedGlobalStats();
    if (cachedStats) {
      this.globalStats.set(cachedStats);
    } else {
      this.loadingGlobal.set(true);
    }

    const cachedReports = this.api.getCachedUsageReports();
    if (cachedReports && cachedReports.length) {
      this.allReports.set(cachedReports);
    } else {
      this.loadingReports.set(true);
    }

    // 2. Fetch fresh usage reports
    this.api.listUsageReports().subscribe({
      next: (reports) => {
        this.allReports.set(reports);
        this.api.setCachedUsageReports(reports);
        this.loadingReports.set(false);
      },
      error: () => {
        this.loadingReports.set(false);
      },
    });

    // 3. Silently revalidate dashboard metrics from backend
    this.loadGlobalStats();
  }

  loadGlobalStats(groupId?: string) {
    if (!this.globalStats()) {
      this.loadingGlobal.set(true);
    }
    this.api.getGlobalDashboardStats(groupId).subscribe({
      next: (stats) => {
        this.globalStats.set(stats);
        if (!groupId) {
          this.api.setCachedGlobalStats(stats);
        }
        this.loadingGlobal.set(false);
      },
      error: () => {
        this.loadingGlobal.set(false);
      },
    });
  }

  onWorkspaceChange(groupId: string) {
    this.selectedGroupId.set(groupId);
    this.selectedReportId.set('');
    this.analytics.set(null);
    this.loadGlobalStats(groupId || undefined);
  }

  onReportChange(reportId: string) {
    this.selectedReportId.set(reportId);
    if (!reportId) {
      this.analytics.set(null);
      return;
    }
    const r = this.allReports().find(x => x.reportId === reportId);
    if (r) {
      this.loadReport(r);
    }
  }

  private loadReport(r: UsageReportItem) {
    this.analytics.set(null);
    this.loadingAnalytics.set(true);
    this.api.getUsageAnalytics(r.groupId, r.datasetId).subscribe({
      next: (a) => {
        this.analytics.set(a);
        this.loadingAnalytics.set(false);
      },
      error: (e) => {
        this.loadingAnalytics.set(false);
        this.errorMsg.set('Failed to load analytics: ' + (e?.message ?? 'error'));
      },
    });
  }

  formatAccessDate(val?: string | null): string {
    if (!val) return 'N/A';
    const clean = String(val).trim().slice(0, 10);
    const parts = clean.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      if (month >= 1 && month <= 12 && !isNaN(day) && !isNaN(year)) {
        return `${months[month - 1]} ${day}, ${year}`;
      }
    }
    return String(val);
  }
}
