import { Component, OnInit, signal, computed, inject, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SyncApiService, AllUsersStat, UserDetailsBreakdown } from './sync.service';

@Component({
  selector: 'app-user-details',
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
    .page-header { margin-bottom: 24px; }
    .page-header h1 { font-size: 22px; font-weight: 700; color: #1e293b; margin: 0 0 4px 0; }
    .page-header p  { font-size: 12px; color: #64748b; margin: 0; }

    /* Light Pastel Header */
    .profile-header {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 20px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: #0f172a;
      margin-bottom: 24px;
      box-shadow: 0 2px 6px -1px rgba(0, 0, 0, 0.03);
    }
    .profile-info { display: flex; align-items: center; gap: 16px; }
    .avatar {
      width: 48px; height: 48px; border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      font-size: 17px; font-weight: 700;
      box-shadow: none;
    }
    .profile-name { font-size: 18px; font-weight: 700; margin: 0; line-height: 1.2; color: #0f172a; }
    .profile-email { font-size: 12px; color: #64748b; margin-top: 3px; font-weight: 500; }
    
    .btn-back {
      background: #eff6ff;
      color: #2563eb;
      border: 1px solid #bfdbfe;
      padding: 7px 16px; border-radius: 8px; font-size: 12px; font-weight: 600;
      cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
      transition: all 0.2s; box-shadow: 0 1px 2px rgba(37, 99, 235, 0.05);
    }
    .btn-back:hover {
      background: #dbeafe;
      color: #1d4ed8;
      border-color: #93c5fd;
      transform: translateY(-1px);
    }

    .btn-historical {
      background: #fef3c7;
      color: #92400e;
      border: 1px solid #fde68a;
      padding: 7px 16px; border-radius: 8px; font-size: 12px; font-weight: 600;
      cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
      transition: all 0.2s; box-shadow: 0 1px 2px rgba(217, 119, 6, 0.05);
    }
    .btn-historical:hover {
      background: #fde68a;
      color: #78350f;
      border-color: #fcd34d;
      transform: translateY(-1px);
    }

    /* Summary Cards with soft pastel top borders */
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
    .sum-card {
      background: white; border-radius: 14px; padding: 20px 22px;
      box-shadow: 0 2px 6px -1px rgba(0, 0, 0, 0.03);
      border: 1px solid #e2e8f0;
    }
    .sum-card.pastel-blue { border-top: 3.5px solid #93c5fd; }
    .sum-card.pastel-green { border-top: 3.5px solid #6ee7b7; }
    .sum-card.pastel-amber { border-top: 3.5px solid #fde68a; }
    .sum-card.pastel-purple { border-top: 3.5px solid #c4b5fd; }
    
    .sum-label { font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 0.5px; margin-bottom: 8px; text-transform: uppercase; }
    .sum-val { font-size: 28px; font-weight: 800; color: #1e293b; line-height: 1.1; }

    /* SVG Line Chart (kept yellow bars) */
    .line-chart-svg { width: 100%; height: 180px; overflow: visible; }
    .chart-line { fill: none; stroke: #93c5fd; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
    .chart-bar { fill: #f59e0b; opacity: 0.9; rx: 4px; ry: 4px; transition: opacity 0.2s, height 0.3s ease; }
    .chart-bar:hover { fill: #d97706; opacity: 1; cursor: pointer; }
    
    .chart-grid-line { stroke: #f1f5f9; stroke-width: 1; }
    .chart-axis-text { font-size: 10px; fill: #64748b; font-weight: 600; }

    /* Two Column Layout */
    .two-col-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }

    .premium-card {
      background: white; border-radius: 14px; padding: 22px;
      box-shadow: 0 2px 6px -1px rgba(0, 0, 0, 0.03);
      border: 1px solid #e2e8f0; display: flex; flex-direction: column;
    }
    .premium-card h3 {
      font-size: 14px; font-weight: 700; color: #1e293b; margin: 0 0 18px 0;
      display: flex; justify-content: space-between; align-items: center;
    }
    .badge-light {
      background: #f8fafc; color: #64748b; font-size: 11px; padding: 4px 10px;
      border-radius: 8px; font-weight: 600; letter-spacing: 0.3px; border: 1px solid #e2e8f0;
    }

    /* Donut Chart */
    .donut-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
    }
    .donut-chart {
      width: 190px;
      height: 190px;
      border-radius: 50%;
      position: relative;
      flex-shrink: 0;
    }
    .donut-hole {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 130px;
      height: 130px;
      background: #fff;
      border-radius: 50%;
    }
    .donut-legend {
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 100%;
    }
    .legend-item { display: flex; align-items: center; font-size: 12px; color: #334155; }
    .legend-dot { width: 10px; height: 10px; border-radius: 3px; margin-right: 10px; flex-shrink: 0; }
    .legend-name { flex: 1; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; max-width: none; line-height: 1.3; font-weight: 500; }
    .legend-value { font-weight: 600; color: #64748b; width: 60px; text-align: right; }

    /* Tables in User Details with Blue Table Headers */
    .table-container {
      border: 1px solid #bfdbfe;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 1px 4px rgba(29, 110, 245, 0.05);
      background: #ffffff;
    }
    .clean-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      background: #ffffff;
    }
    .clean-table th {
      text-align: left;
      padding: 11px 16px;
      background: #dbeafe;
      color: #1d4ed8;
      font-weight: 700;
      font-size: 12px;
      white-space: nowrap;
      border-bottom: 2px solid #93c5fd;
      position: sticky;
      top: 0;
      z-index: 2;
    }
    .clean-table td {
      text-align: left;
      padding: 11px 16px;
      border-bottom: 1px solid #eff6ff;
      color: #334155;
      font-size: 12px;
      background: #ffffff;
      vertical-align: middle;
    }
    .clean-table tbody tr:hover td { background: #f8fafc; }
    .clean-table tbody tr:last-child td { border-bottom: none; }

    .table-search-input {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      color: #1e293b;
      padding: 7px 12px;
      font-size: 12px;
      outline: none;
      transition: all 0.2s;
    }
    .table-search-input:focus {
      background: #ffffff;
      border-color: #93c5fd;
      box-shadow: 0 0 0 3px rgba(147, 197, 253, 0.2);
    }

    .badge-pastel-blue {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 6px;
      background: #eff6ff;
      color: #2563eb;
      font-size: 11px;
      font-weight: 600;
    }
    .badge-pastel-amber {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 6px;
      background: #fef3c7;
      color: #92400e;
      font-size: 11px;
      font-weight: 600;
    }

    .hover-bg-slate-50:hover { background: #f8fafc; }
    
    .pagination {
      display: flex; justify-content: space-between; align-items: center; padding: 10px 16px;
      background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; font-weight: 500; color: #64748b;
    }
    .pagination button {
      background: white; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px 12px;
      cursor: pointer; color: #334155; font-weight: 600; font-size: 11.5px; transition: all 0.15s;
    }
    .pagination button:hover:not(:disabled) { background: #f1f5f9; color: #0f172a; border-color: #cbd5e1; }
    .pagination button:disabled { opacity: 0.4; cursor: not-allowed; color: #94a3b8; border-color: #e2e8f0; }

    .empty { text-align: center; color: #64748b; font-size: 12px; padding: 40px 0; }
    .spinner { display:inline-block; width:18px; height:18px; border:3px solid #e2e8f0; border-top-color:#93c5fd; border-radius:50%; animation:spin .7s linear infinite; vertical-align:middle; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .day-btns { display: flex; gap: 4px; }
    .day-btn {
      padding: 5px 12px; border-radius: 8px; font-size: 11.5px; font-weight: 600; cursor: pointer;
      border: 1px solid #e2e8f0; background: #f8fafc; color: #64748b; transition: all .15s;
    }
    .day-btn.active { background: #eff6ff; color: #2563eb; border-color: #bfdbfe; font-weight: 700; }
    .day-btn:hover:not(.active) { background: #f1f5f9; color: #1e293b; border-color: #cbd5e1; }

    /* Animations */
    @keyframes drawLine {
      from { stroke-dashoffset: 1000; }
      to { stroke-dashoffset: 0; }
    }
    @keyframes fadeInSlide {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-chart-line {
      stroke-dasharray: 1000;
      stroke-dashoffset: 1000;
      animation: drawLine 1.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
    }
    .animate-chart-area {
      animation: fadeInSlide 1s ease-out forwards;
    }
    @keyframes scaleInY {
      from { transform: scaleY(0); }
      to { transform: scaleY(1); }
    }
    .animate-chart-bar {
      transform-origin: bottom;
      animation: scaleInY 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
    }
    @keyframes scaleInX {
      from { transform: scaleX(0); }
      to { transform: scaleX(1); }
    }
    .animate-bar-x {
      transform-origin: left;
      animation: scaleInX 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
    }
    .animate-donut {
      animation: fadeInSlide 0.6s ease-out forwards;
    }
  `],

  template: `
  <ng-container *ngIf="selectedUser() === null">
    <div style="margin-bottom: 24px; display: flex; align-items: center; justify-content: flex-end;">
      <input type="text" class="table-search-input" style="width: 280px; margin: 0;" placeholder="Search user by name or email..."
             [ngModel]="userSearch()" (ngModelChange)="userSearch.set($event); userListPage.set(0)" />
    </div>

    <!-- User List -->
    <div *ngIf="loadingAll()" class="empty"><span class="spinner"></span> Loading user statistics...</div>
    <div *ngIf="errorMsg()" class="empty" style="color: #dc2626;">{{ errorMsg() }}</div>

    <div *ngIf="!loadingAll() && filteredUsers().length" class="table-container">
      <table class="clean-table">
        <thead>
          <tr><th style="padding-left:24px;">User</th><th style="text-align:right;">Total Views</th><th style="text-align:right; padding-right:24px;">Last Accessed</th></tr>
        </thead>
        <tbody>
          <tr *ngFor="let u of filteredUsers() | slice: userListPage()*7 : (userListPage()+1)*7; let i = index" style="cursor: pointer;" class="hover-bg-slate-50" (click)="selectUser(u)">
            <td style="padding-left:24px;">
              <div style="display:flex; align-items:center; gap:12px;">
                <div [style.background]="getUserAvatarStyle(u.name, i).bg" [style.color]="getUserAvatarStyle(u.name, i).color" style="width:36px; height:36px; border-radius:10px; font-weight:700; font-size:13px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                  {{ u.name.charAt(0) | uppercase }}
                </div>
                <div>
                  <div style="font-weight:600; color:#0f172a;">{{ u.name | titlecase }}</div>
                  <div style="font-size:11.5px; color:#64748b; margin-top:2px;">{{ u.email }}</div>
                </div>
              </div>
            </td>
            <td style="text-align:right;">
              <span class="badge-pastel-blue">{{ u.views | number }}</span>
            </td>
            <td style="text-align:right; color:#64748b; font-size:11.5px; padding-right:24px;">{{ formatAccessDate(u.lastAccessed) }}</td>
          </tr>
        </tbody>
      </table>
      <div class="pagination" *ngIf="filteredUsers().length > 7">
        <button [disabled]="userListPage() === 0" (click)="userListPage.set(userListPage() - 1)">Previous</button>
        <span>Page {{ userListPage() + 1 }} of {{ userListTotalPages() }}</span>
        <button [disabled]="(userListPage() + 1) * 7 >= filteredUsers().length" (click)="userListPage.set(userListPage() + 1)">Next</button>
      </div>
    </div>
    <div *ngIf="!loadingAll() && !filteredUsers().length && !errorMsg()" class="empty">No users found matching your search.</div>
  </ng-container>

  <ng-container *ngIf="selectedUser()">
    <div *ngIf="loadingDetails()" class="empty" style="margin-top: 40px;"><span class="spinner"></span> Loading details for {{ selectedUser()?.name | titlecase }}...</div>

    <div *ngIf="!loadingDetails() && userDetails() as details">
      <!-- Profile Header -->
      <div class="profile-header">
        <div class="profile-info">
          <div class="avatar" [style.background]="getUserAvatarStyle(selectedUser()?.name).bg" [style.color]="getUserAvatarStyle(selectedUser()?.name).color">{{ initials() }}</div>
          <div>
            <h2 class="profile-name">{{ selectedUser()?.name | titlecase }}</h2>
            <div class="profile-email">{{ selectedUser()?.email }}</div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <button *ngIf="!showHistoricalView()" class="btn-historical" (click)="openHistoricalView()">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            View Historical Data
          </button>
          <button class="btn-back" (click)="clearSelected()">Back to All Users</button>
        </div>
      </div>

      <!-- ── STANDARD USER PROFILE VIEW ── -->
      <ng-container *ngIf="!showHistoricalView()">
        <!-- Summary Grid -->
        <div class="summary-grid">
          <div class="sum-card pastel-blue">
            <div class="sum-label">Total Views</div>
            <div class="sum-val">{{ filteredTotalViews() | number }}</div>
          </div>
          <div class="sum-card pastel-green">
            <div class="sum-label">Dashboards Accessed</div>
            <div class="sum-val">{{ filteredDashboardsAccessed() }}</div>
          </div>
          <div class="sum-card pastel-amber">
            <div class="sum-label">Last Accessed</div>
            <div class="sum-val" style="font-size: 22px; padding-top: 4px;">
              <ng-container *ngIf="filteredLastAccessed(); else noAccess">
                {{ formatAccessDate(filteredLastAccessed()) }}
              </ng-container>
              <ng-template #noAccess>N/A</ng-template>
            </div>
          </div>
        </div>

        <!-- SVG Bar Chart (Historical Views) -->
        <div class="premium-card" style="margin-bottom: 24px;">
          <h3 style="margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; flex-wrap: nowrap; overflow: hidden; white-space: nowrap;">
            <span>Historical Views</span>
            <div style="display: flex; align-items: center; gap: 12px; margin-left: auto;">
              <div class="day-btns">
                <button class="day-btn" [class.active]="selectedDays() === 30 && !selectedDate()" (click)="setDaysRange(30)">1 Month</button>
                <button class="day-btn" [class.active]="selectedDays() === 60 && !selectedDate()" (click)="setDaysRange(60)">2 Months</button>
                <button class="day-btn" [class.active]="selectedDays() === 90 && !selectedDate()" (click)="setDaysRange(90)">3 Months</button>
              </div>
              <span class="badge-light" style="white-space: nowrap; flex-shrink: 0;" *ngIf="historicalDateRange()">{{ historicalDateRange() }}</span>
            </div>
          </h3>
          <div style="display:flex; justify-content:flex-end; gap:16px; margin-bottom:16px; font-size:11.5px; font-weight:600; color:#64748b;">
            <div style="display:flex; align-items:center; gap:6px;"><span style="width:10px; height:10px; border-radius:3px; background:#f59e0b;"></span> Daily Views</div>
          </div>
          
          <div style="position:relative; height: 200px; width: 100%;">
            <!-- SVG Chart -->
            <svg class="line-chart-svg" preserveAspectRatio="none" [attr.viewBox]="'0 0 1000 200'" style="width: 100%; height: 100%; overflow: visible;">
              <!-- Grid Lines (Y-Axis) -->
              <ng-container *ngFor="let y of yAxisLabels()">
                <line class="chart-grid-line" x1="35" [attr.y1]="y.y" x2="975" [attr.y2]="y.y" />
                <text class="chart-axis-text" x="0" [attr.y]="y.y + 4">{{ y.val }}</text>
              </ng-container>

              <!-- X-Axis Labels -->
              <ng-container *ngFor="let x of xAxisLabels()">
                <text class="chart-axis-text" [attr.x]="x.x" y="190" [attr.text-anchor]="x.anchor">{{ x.label }}</text>
              </ng-container>

              <!-- Data Bars (Preserved Yellow #f59e0b) -->
              <ng-container *ngFor="let p of chartPoints()">
                <rect class="chart-bar animate-chart-bar"
                  [attr.x]="p.x - p.halfWidth"
                  [attr.y]="p.y"
                  [attr.width]="p.barWidth"
                  [attr.height]="p.barHeight"
                  rx="4" ry="4"
                  [style.fill]="p.isSelected ? '#d97706' : (p.views > 0 ? '#f59e0b' : '#e2e8f0')"
                  [style.stroke]="p.isSelected ? '#78350f' : 'none'"
                  [style.stroke-width]="p.isSelected ? '2px' : '0'"
                  [style.opacity]="selectedDate() && !p.isSelected ? (p.views > 0 ? '0.35' : '0.2') : '1'"
                  style="cursor: pointer; transition: all 0.2s;"
                  (click)="p.views > 0 ? toggleDaySelection(p.date) : null"
                  (mouseenter)="showTooltip($event, (p.isSelected ? '★ Active Day: ' : '') + p.date + '\n' + (p.views > 0 ? p.views + ' views' + (p.isSelected ? '\n(Click to show all range)' : '\n(Click to filter details to this day)') : '0 views'))"
                  (mousemove)="moveTooltip($event)"
                  (mouseleave)="hideTooltip()">
                </rect>
              </ng-container>
            </svg>
          </div>
        </div>

        <!-- Two Col for Reports -->
        <div class="two-col-grid">
          <!-- Top Dashboards -->
          <div class="premium-card">
            <h3>Top Dashboards & Reports</h3>
            <div class="donut-container" *ngIf="topReportDonutSegments().length">
              <svg class="donut-chart animate-donut" viewBox="0 0 200 200" style="background:none;">
                <path *ngFor="let p of getDonutPaths(topReportDonutSegments())" [attr.d]="p.d" [attr.fill]="p.color" (mouseenter)="showTooltip($event, p.name + '\n' + p.views + ' views')" (mousemove)="moveTooltip($event)" (mouseleave)="hideTooltip()" style="transition: opacity 0.2s; cursor: pointer;" onmouseover="this.style.opacity=0.8" onmouseout="this.style.opacity=1"></path>
                <circle cx="100" cy="100" r="55" fill="#ffffff"></circle>
              </svg>
              <div class="donut-legend">
                <div class="legend-item" *ngFor="let s of topReportDonutSegments()">
                  <div class="legend-dot" [style.background]="s.color"></div>
                  <div class="legend-name" [title]="s.name">{{ s.name }}</div>
                  <div class="legend-value">{{ s.views | number }}</div>
                </div>
              </div>
            </div>
            <div *ngIf="!topReportDonutSegments().length" class="empty">No reports accessed.</div>
          </div>

          <!-- Least Accessed -->
          <div class="premium-card">
            <h3>Least Accessed Reports</h3>
            <div class="table-container" style="margin-top: 10px;">
              <table class="clean-table">
                <thead><tr><th>Report Name</th><th style="text-align:right;">Views</th></tr></thead>
                <tbody>
                  <tr *ngFor="let r of leastAccessedHbars()">
                    <td><strong>{{ r.name }}</strong></td>
                    <td style="text-align:right;">
                      <span class="badge-pastel-amber">{{ r.views | number }}</span>
                    </td>
                  </tr>
                  <tr *ngIf="!leastAccessedHbars().length"><td colspan="2" class="empty">No idle reports.</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Page Tabs Table -->
        <div class="premium-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
            <h3 style="margin:0;">Page Tabs Accessed</h3>
            <input type="text" class="table-search-input" style="width:300px; margin:0;" placeholder="Search tab, report, or date..."
                   [ngModel]="pageSearch()" (ngModelChange)="pageSearch.set($event); pagePageAccess.set(0)" />
          </div>
          <div class="table-container"><table class="clean-table">
            <thead>
              <tr>
                <th style="padding-left:24px;">Tab</th>
                <th>Dashboard / Report</th>
                <th style="text-align:right;">Views</th>
                <th style="text-align:right; padding-right:24px;">Last Accessed</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let p of filteredPageAccess() | slice: pagePageAccess()*10 : (pagePageAccess()+1)*10">
                <td style="padding-left:24px;"><strong>{{ p.pageName }}</strong></td>
                <td style="color:#475569;">{{ p.reportName }}</td>
                <td style="text-align:right;">
                  <span class="badge-pastel-blue">{{ p.views | number }}</span>
                </td>
                <td style="text-align:right; color:#64748b; padding-right:24px; font-size:11.5px;">
                  {{ formatAccessDate(p.lastAccessed) }}
                </td>
              </tr>
              <tr *ngIf="!filteredPageAccess().length"><td colspan="4" class="empty">No page tab access.</td></tr>
            </tbody>
          </table></div>
          <div class="pagination" *ngIf="filteredPageAccess().length > 10">
            <button [disabled]="pagePageAccess() === 0" (click)="pagePageAccess.set(pagePageAccess() - 1)">Previous</button>
            <span>Page {{ pagePageAccess() + 1 }} of {{ Math.ceil(filteredPageAccess().length / 10) }}</span>
            <button [disabled]="(pagePageAccess() + 1) * 10 >= filteredPageAccess().length" (click)="pagePageAccess.set(pagePageAccess() + 1)">Next</button>
          </div>
        </div>
      </ng-container>

      <!-- ── MULTI-YEAR & MONTH-WISE HISTORICAL ANALYTICS VIEW ── -->
      <ng-container *ngIf="showHistoricalView()">
        <!-- Top Bar with Year Selector -->
        <div style="display:flex; justify-content:space-between; align-items:center; background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; padding:14px 20px; margin-bottom:20px; box-shadow: 0 1px 3px rgba(0,0,0,0.02); flex-wrap:wrap; gap:12px;">
          <div style="display:flex; align-items:center; gap:12px;">
            <button class="btn-back" (click)="showHistoricalView.set(false)">Back to Profile</button>
            <div>
              <div style="font-size:15px; font-weight:700; color:#0f172a; display:flex; align-items:center; gap:8px;">
                <span>Annual &amp; Monthly Usage History</span>
                <span class="badge-pastel-amber">{{ selectedHistoricalYear() }}</span>
              </div>
              <div style="font-size:11.5px; color:#64748b;">Month-by-month and daily historical trends</div>
            </div>
          </div>

          <!-- Year Selector Dropdown -->
          <div style="display:flex; align-items:center; gap:8px;">
            <label style="font-size:12px; font-weight:600; color:#475569;">Select Year:</label>
            <select class="table-search-input" style="font-size:12px; font-weight:600; padding:6px 12px; border-radius:8px; cursor:pointer;"
              [ngModel]="selectedHistoricalYear()" (ngModelChange)="setHistoricalYear($event)">
              <option *ngFor="let y of availableYears()" [value]="y">{{ y }}</option>
            </select>
          </div>
        </div>

        <!-- Annual Summary Cards -->
        <div class="summary-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom:20px;">
          <div class="sum-card pastel-amber">
            <div class="sum-label">Total Views in {{ selectedHistoricalYear() }}</div>
            <div class="sum-val">{{ yearlyTotalViews() | number }}</div>
          </div>
          <div class="sum-card pastel-blue">
            <div class="sum-label">Active Months</div>
            <div class="sum-val">{{ yearlyActiveMonthsCount() }} <span style="font-size:14px; font-weight:500; color:#64748b;">/ 12</span></div>
          </div>
          <div class="sum-card pastel-green">
            <div class="sum-label">Peak Month</div>
            <div class="sum-val" style="font-size:18px; padding-top:4px;" [title]="yearlyPeakMonth() ? yearlyPeakMonth()!.name + ' (' + (yearlyPeakMonth()!.views | number) + ' views)' : 'N/A'">
              {{ yearlyPeakMonth() ? yearlyPeakMonth()!.name + ' (' + (yearlyPeakMonth()!.views | number) + ')' : 'N/A' }}
            </div>
          </div>
          <div class="sum-card pastel-purple">
            <div class="sum-label">Reports Accessed in {{ selectedHistoricalYear() }}</div>
            <div class="sum-val">{{ yearlyUniqueReportsCount() }}</div>
          </div>
        </div>

        <!-- 12-Month Bar Chart (Jan to Dec) (Yellow Bars) -->
        <div class="premium-card" style="margin-bottom: 24px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <div>
              <h3 style="margin:0;">Monthly Views — {{ selectedHistoricalYear() }}</h3>
              <div style="font-size:11.5px; color:#64748b; margin-top:2px;">Click on any month bar to inspect daily views, reports, and page tabs</div>
            </div>
            <div style="display:flex; align-items:center; gap:6px; font-size:11.5px; font-weight:600; color:#64748b;">
              <span style="width:10px; height:10px; border-radius:3px; background:#f59e0b;"></span> Monthly Views
            </div>
          </div>

          <div style="position:relative; height: 210px; width: 100%;">
            <svg class="line-chart-svg" preserveAspectRatio="none" viewBox="0 0 1000 210" style="width:100%; height:100%;">
              <!-- Y-Axis Grid Lines -->
              <ng-container *ngFor="let y of yearlyYAxisLabels()">
                <line class="chart-grid-line" x1="40" [attr.y1]="y.y" x2="1000" [attr.y2]="y.y" />
                <text class="chart-axis-text" x="0" [attr.y]="y.y + 4">{{ y.val }}</text>
              </ng-container>

              <!-- 12 Month Bars (Jan to Dec) -->
              <ng-container *ngFor="let m of monthlyChartPoints()">
                <rect class="chart-bar animate-chart-bar"
                  [attr.x]="m.x - 22"
                  [attr.y]="m.y"
                  width="44"
                  [attr.height]="Math.max(4, 180 - m.y)"
                  rx="6" ry="6"
                  [style.fill]="m.isSelected ? '#d97706' : (m.views > 0 ? '#f59e0b' : '#f1f5f9')"
                  [style.stroke]="m.isSelected ? '#78350f' : 'none'"
                  [style.stroke-width]="m.isSelected ? '2px' : '0'"
                  [style.opacity]="selectedHistoricalMonth() !== null && !m.isSelected ? '0.35' : '1'"
                  style="cursor: pointer; transition: all 0.2s;"
                  (click)="toggleHistoricalMonth(m.month)"
                  (mouseenter)="showTooltip($event, m.monthName + ' ' + selectedHistoricalYear() + '\n' + m.views + ' views\n(Click to view month breakdown)')"
                  (mousemove)="moveTooltip($event)"
                  (mouseleave)="hideTooltip()">
                </rect>

                <!-- Month Name Text -->
                <text class="chart-axis-text" [attr.x]="m.x" y="200" text-anchor="middle"
                  [style.font-weight]="m.isSelected ? '700' : '600'"
                  [style.fill]="m.isSelected ? '#d97706' : '#64748b'">{{ m.monthName }}</text>
              </ng-container>
            </svg>
          </div>
        </div>

        <!-- Month Drilldown Panel (when a month is selected) -->
        <div *ngIf="selectedHistoricalMonth() !== null" class="month-drilldown-section" style="margin-bottom:24px;">
          <div class="premium-card" style="border: 1px solid #fde68a; background: #fffdfa;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid #fef3c7; padding-bottom:12px; flex-wrap:wrap; gap:10px;">
              <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:15px; font-weight:700; color:#0f172a;">
                  {{ getMonthName(selectedHistoricalMonth()!) }} {{ selectedHistoricalYear() }} Usage Details
                </span>
                <span class="badge-pastel-amber">
                  {{ selectedMonthTotalViews() | number }} Views
                </span>
              </div>
              <button class="btn-back" style="font-size:11.5px; padding:5px 12px;" (click)="selectedHistoricalMonth.set(null)">
                ✕ Close Month View
              </button>
            </div>

            <!-- Month Daily Views Chart -->
            <div *ngIf="selectedMonthDailyViews().length" style="margin-bottom:24px;">
              <div style="font-size:12px; font-weight:600; color:#64748b; margin-bottom:8px;">Daily Views in {{ getMonthName(selectedHistoricalMonth()!) }} {{ selectedHistoricalYear() }}</div>
              <div style="position:relative; height: 160px; width: 100%;">
                <svg class="line-chart-svg" preserveAspectRatio="none" viewBox="0 0 1000 160" style="width:100%; height:100%;">
                  <ng-container *ngFor="let p of selectedMonthDailyChartPoints()">
                    <rect class="chart-bar animate-chart-bar"
                      [attr.x]="p.x - 8"
                      [attr.y]="p.y"
                      width="16"
                      [attr.height]="Math.max(3, 135 - p.y)"
                      rx="3" ry="3"
                      fill="#f59e0b"
                      (mouseenter)="showTooltip($event, p.date + '\n' + p.views + ' views')"
                      (mousemove)="moveTooltip($event)"
                      (mouseleave)="hideTooltip()">
                    </rect>
                    <text class="chart-axis-text" [attr.x]="p.x" y="152" text-anchor="middle" style="font-size:9.5px;">{{ p.day }}</text>
                  </ng-container>
                </svg>
              </div>
            </div>
            <div *ngIf="!selectedMonthDailyViews().length" class="empty" style="padding:20px 0;">No daily activity recorded in this month.</div>

            <!-- Two Col: Reports in this Month + Page Tabs in this Month -->
            <div class="two-col-grid" style="margin-bottom:10px;">
              <!-- Top Reports in this Month -->
              <div class="premium-card" style="background:#ffffff; border:1px solid #e2e8f0;">
                <h3 style="font-size:13px;">Reports Accessed in {{ getMonthName(selectedHistoricalMonth()!) }}</h3>
                <div class="table-container" style="margin-top: 10px;">
                  <table class="clean-table">
                    <thead><tr><th>Report Name</th><th style="text-align:right;">Views</th></tr></thead>
                    <tbody>
                      <tr *ngFor="let r of selectedMonthTopReports()">
                        <td><strong>{{ r.reportName }}</strong></td>
                        <td style="text-align:right;">
                          <span class="badge-pastel-amber">{{ r.views | number }}</span>
                        </td>
                      </tr>
                      <tr *ngIf="!selectedMonthTopReports().length"><td colspan="2" class="empty">No reports accessed in this month.</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Page Tabs Table in this Month -->
              <div class="premium-card" style="background:#ffffff; border:1px solid #e2e8f0;">
                <h3 style="font-size:13px;">Page Tabs in {{ getMonthName(selectedHistoricalMonth()!) }}</h3>
                <div class="table-container" style="margin-top: 10px;">
                  <table class="clean-table">
                    <thead>
                      <tr>
                        <th>Page / Tab</th>
                        <th>Report</th>
                        <th style="text-align:right;">Views</th>
                        <th style="text-align:right;">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let p of selectedMonthPageAccess()">
                        <td><strong>{{ p.pageName }}</strong></td>
                        <td><span style="color:#475569;">{{ p.reportName }}</span></td>
                        <td style="text-align:right;">
                          <span class="badge-pastel-amber">{{ p.views | number }}</span>
                        </td>
                        <td style="text-align:right; color:#64748b; font-size:11.5px;">{{ formatAccessDate(p.lastAccessed) }}</td>
                      </tr>
                      <tr *ngIf="!selectedMonthPageAccess().length"><td colspan="4" class="empty">No pages accessed in this month.</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          </div>
        </div>
      </ng-container>

    </div>
  </ng-container>

  <div *ngIf="tooltip().show" class="custom-tooltip" [style.left.px]="tooltip().x + 15" [style.top.px]="tooltip().y + 15">{{ tooltip().text }}</div>
`
})
export class UserDetailsComponent implements OnInit {
  userListPage = signal(0);
  userListTotalPages = computed(() => Math.ceil(this.filteredUsers().length / 7));
  selectedDays = signal<number>(30);
  selectedDate = signal<string | null>(null);

  // Multi-Year Historical View States
  showHistoricalView = signal(false);
  selectedHistoricalYear = signal<number>(2026);
  selectedHistoricalMonth = signal<number | null>(null);

  openHistoricalView() {
    const years = this.availableYears();
    if (years.length) {
      this.selectedHistoricalYear.set(years[0]);
    }
    this.selectedHistoricalMonth.set(null);
    this.showHistoricalView.set(true);
  }

  setHistoricalYear(year: any) {
    this.selectedHistoricalYear.set(Number(year));
    this.selectedHistoricalMonth.set(null);
  }

  toggleHistoricalMonth(m: number) {
    if (this.selectedHistoricalMonth() === m) {
      this.selectedHistoricalMonth.set(null);
    } else {
      this.selectedHistoricalMonth.set(m);
    }
  }

  availableYears = computed(() => {
    const details = this.userDetails();
    const yearsSet = new Set<number>();
    const currentYear = new Date().getFullYear();
    yearsSet.add(currentYear);
    yearsSet.add(currentYear - 1);
    if (details?.historicalViews) {
      for (const h of details.historicalViews) {
        const y = new Date(h.date).getFullYear();
        if (!isNaN(y)) yearsSet.add(y);
      }
    }
    return Array.from(yearsSet).sort((a, b) => b - a);
  });

  monthlyViewsForYear = computed(() => {
    const year = this.selectedHistoricalYear();
    const details = this.userDetails();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const months = monthNames.map((name, i) => ({ month: i + 1, monthName: name, views: 0 }));

    if (!details?.historicalViews) return months;

    for (const h of details.historicalViews) {
      const d = new Date(h.date);
      if (d.getFullYear() === year) {
        const mIdx = d.getMonth();
        if (mIdx >= 0 && mIdx < 12) {
          months[mIdx].views += h.views;
        }
      }
    }
    return months;
  });

  yearlyTotalViews = computed(() => this.monthlyViewsForYear().reduce((acc, m) => acc + m.views, 0));
  yearlyActiveMonthsCount = computed(() => this.monthlyViewsForYear().filter(m => m.views > 0).length);

  yearlyPeakMonth = computed(() => {
    const months = this.monthlyViewsForYear().filter(m => m.views > 0);
    if (!months.length) return null;
    const sorted = [...months].sort((a, b) => b.views - a.views);
    return { name: sorted[0].monthName, views: sorted[0].views };
  });

  yearlyUniqueReportsCount = computed(() => {
    const year = this.selectedHistoricalYear();
    const details = this.userDetails();
    if (!details) return 0;
    const reports = new Set<string>();
    if (details.dailyReportAccess) {
      for (const r of details.dailyReportAccess) {
        if (new Date(r.date).getFullYear() === year && r.views > 0) {
          reports.add(r.reportName);
        }
      }
    }
    return reports.size;
  });

  monthlyChartPoints = computed(() => {
    const months = this.monthlyViewsForYear();
    const maxViews = Math.max(...months.map(m => m.views), 10);
    const width = 1000;
    const height = 180;
    const paddingX = 60;
    const selMonth = this.selectedHistoricalMonth();

    return months.map((m, i) => {
      const x = paddingX + (i / 11) * (width - paddingX * 2);
      const y = height - (m.views / maxViews) * height;
      return {
        month: m.month,
        monthName: m.monthName,
        views: m.views,
        x,
        y,
        isSelected: m.month === selMonth
      };
    });
  });

  yearlyYAxisLabels = computed(() => {
    const months = this.monthlyViewsForYear();
    const maxViews = Math.max(...months.map(m => m.views), 10);
    const labels = [];
    for (let i = 0; i <= 4; i++) {
      const val = Math.round(maxViews - (i / 4) * maxViews);
      const y = 20 + (i / 4) * 160;
      labels.push({ val, y });
    }
    return labels;
  });

  selectedMonthDailyViews = computed(() => {
    const year = this.selectedHistoricalYear();
    const month = this.selectedHistoricalMonth();
    if (month === null) return [];
    const details = this.userDetails();
    if (!details?.historicalViews) return [];

    return details.historicalViews
      .filter(h => {
        const d = new Date(h.date);
        return d.getFullYear() === year && (d.getMonth() + 1) === month;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  });

  selectedMonthTotalViews = computed(() => this.selectedMonthDailyViews().reduce((acc, d) => acc + d.views, 0));

  selectedMonthDailyChartPoints = computed(() => {
    const list = this.selectedMonthDailyViews();
    if (!list.length) return [];
    const maxViews = Math.max(...list.map(d => d.views), 10);
    const width = 1000;
    const height = 135;
    const paddingX = 40;

    return list.map((d, i, arr) => {
      const x = paddingX + (i / Math.max(1, arr.length - 1)) * (width - paddingX * 2);
      const y = height - (d.views / maxViews) * height;
      const day = new Date(d.date).getDate();
      return { x, y, views: d.views, date: d.date, day };
    });
  });

  selectedMonthTopReports = computed(() => {
    const year = this.selectedHistoricalYear();
    const month = this.selectedHistoricalMonth();
    if (month === null) return [];
    const details = this.userDetails();
    if (!details) return [];

    const reportMap = new Map<string, number>();
    if (details.dailyReportAccess) {
      for (const r of details.dailyReportAccess) {
        const d = new Date(r.date);
        if (d.getFullYear() === year && (d.getMonth() + 1) === month && r.views > 0) {
          reportMap.set(r.reportName, (reportMap.get(r.reportName) || 0) + r.views);
        }
      }
    }
    return Array.from(reportMap.entries())
      .map(([reportName, views]) => ({ reportName, views }))
      .sort((a, b) => b.views - a.views);
  });

  selectedMonthPageAccess = computed(() => {
    const year = this.selectedHistoricalYear();
    const month = this.selectedHistoricalMonth();
    if (month === null) return [];
    const details = this.userDetails();
    if (!details) return [];

    const pageMap = new Map<string, { pageName: string; reportName: string; views: number; dates: string[] }>();
    if (details.dailyPageAccess) {
      for (const p of details.dailyPageAccess) {
        const d = new Date(p.date);
        if (d.getFullYear() === year && (d.getMonth() + 1) === month && p.views > 0) {
          const key = `${p.pageName}:::${p.reportName}`;
          const existing = pageMap.get(key);
          if (existing) {
            existing.views += p.views;
            existing.dates.push(p.date);
          } else {
            pageMap.set(key, {
              pageName: p.pageName,
              reportName: p.reportName,
              views: p.views,
              dates: [p.date]
            });
          }
        }
      }
    }

    return Array.from(pageMap.values()).map(p => {
      p.dates.sort();
      return {
        pageName: p.pageName,
        reportName: p.reportName,
        views: p.views,
        lastAccessed: p.dates[p.dates.length - 1]
      };
    }).sort((a, b) => b.views - a.views);
  });

  getMonthName(m: number): string {
    const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return names[m - 1] || `Month ${m}`;
  }

  setDaysRange(days: number) {
    this.selectedDays.set(days);
    this.selectedDate.set(null);
  }

  toggleDaySelection(date: string) {
    if (this.selectedDate() === date) {
      this.selectedDate.set(null);
    } else {
      this.selectedDate.set(date);
    }
  }

  selectedDayViews = computed(() => {
    const date = this.selectedDate();
    if (!date) return 0;
    const match = this.userDetails()?.historicalViews.find(h => h.date === date);
    return match?.views || 0;
  });

  historicalFilteredViews = computed(() => {
    const details = this.userDetails();
    if (!details || !details.historicalViews || !details.historicalViews.length) return [];
    
    const views = details.historicalViews;
    const map = new Map(views.map(v => [v.date, Number(v.views) || 0]));
    
    // Determine the latest date in the dataset
    let maxDateStr = views[0].date;
    for (const v of views) {
      if (v.date > maxDateStr) maxDateStr = v.date;
    }
    
    const [y, m, d] = maxDateStr.slice(0, 10).split('-').map(Number);
    const limit = this.selectedDays();
    
    const result = [];
    for (let i = limit - 1; i >= 0; i--) {
      const cur = new Date(Date.UTC(y, m - 1, d - i));
      const curStr = cur.toISOString().slice(0, 10);
      result.push({
        date: curStr,
        views: map.get(curStr) || 0
      });
    }
    return result;
  });

  activeDates = computed<Set<string>>(() => {
    const single = this.selectedDate();
    if (single) {
      return new Set([single]);
    }
    const views = this.historicalFilteredViews();
    return new Set(views.map(v => v.date));
  });

  // SVG Donut helpers
  getDonutPaths(segments: any[]) {
    let total = segments.reduce((sum, s) => sum + (s.views || 0), 0);
    if (total === 0) return [];
    
    let currentAngle = -90;
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
  pagePageAccess = signal(0);

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
  
  @Input() preSelectEmail: string | null = null;

  api = inject(SyncApiService);

  allUsers = signal<AllUsersStat[]>([]);
  loadingAll = signal(true);
  errorMsg = signal('');
  userSearch = signal('');
  pageSearch = signal('');

  selectedUser = signal<AllUsersStat | null>(null);
  userDetails = signal<UserDetailsBreakdown | null>(null);
  loadingDetails = signal(false);

  filteredUsers = computed(() => {
    const q = this.userSearch().toLowerCase().trim();
    if (!q) return this.allUsers();
    return this.allUsers().filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  });

  filteredPageAccess = computed(() => {
    const details = this.userDetails();
    if (!details || this.filteredTotalViews() === 0) return [];
    const dates = this.activeDates();

    let list: { pageName: string; reportName: string; views: number; lastAccessed?: string }[] = [];

    if (details.dailyPageAccess && details.dailyPageAccess.length) {
      const pageMap = new Map<string, { pageName: string; reportName: string; views: number; dates: string[] }>();
      for (const p of details.dailyPageAccess) {
        if (dates.has(p.date) && p.views > 0) {
          const key = `${p.pageName}:::${p.reportName}`;
          const existing = pageMap.get(key);
          if (existing) {
            existing.views += p.views;
            existing.dates.push(p.date);
          } else {
            pageMap.set(key, {
              pageName: p.pageName,
              reportName: p.reportName,
              views: p.views,
              dates: [p.date]
            });
          }
        }
      }

      list = Array.from(pageMap.values()).map(p => {
        p.dates.sort();
        const last = p.dates[p.dates.length - 1];
        return {
          pageName: p.pageName,
          reportName: p.reportName,
          views: p.views,
          lastAccessed: last
        };
      });
    } else {
      list = details.pageAccess.map(p => ({ ...p }));
    }

    const q = this.pageSearch().toLowerCase().trim();
    if (q) {
      list = list.filter(p => {
        const matchesName = p.pageName.toLowerCase().includes(q) || p.reportName.toLowerCase().includes(q);
        let matchesDate = false;
        if (p.lastAccessed) {
          const raw = String(p.lastAccessed).toLowerCase();
          const d = new Date(p.lastAccessed);
          const formatted = isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toLowerCase();
          matchesDate = raw.includes(q) || formatted.includes(q);
        }
        return matchesName || matchesDate;
      });
    }

    return list.sort((a, b) => b.views - a.views);
  });

  filteredTotalViews = computed(() => {
    const dates = this.activeDates();
    const details = this.userDetails();
    if (!details || !details.historicalViews) return 0;
    return details.historicalViews
      .filter(d => dates.has(d.date))
      .reduce((sum, d) => sum + d.views, 0);
  });
  
  filteredLastAccessed = computed(() => {
    const single = this.selectedDate();
    if (single) return single;
    const details = this.userDetails();
    if (!details || !details.historicalViews) return null;
    const dates = this.activeDates();
    const activeViews = details.historicalViews.filter(d => dates.has(d.date) && d.views > 0);
    if (!activeViews.length) return null;
    return activeViews[activeViews.length - 1].date;
  });
  
  filteredDashboardsAccessed = computed(() => {
    const details = this.userDetails();
    if (!details || this.filteredTotalViews() === 0) return 0;
    const dates = this.activeDates();

    if (details.dailyReportAccess && details.dailyReportAccess.length) {
      const activeReports = new Set(
        details.dailyReportAccess.filter(r => dates.has(r.date) && r.views > 0).map(r => r.reportName)
      );
      return activeReports.size;
    }
    if (details.dailyPageAccess && details.dailyPageAccess.length) {
      const activeReports = new Set(
        details.dailyPageAccess.filter(p => dates.has(p.date) && p.views > 0).map(p => p.reportName)
      );
      return activeReports.size;
    }
    return details.reportAccess.length;
  });

  initials = computed(() => {
    const user = this.selectedUser();
    if (!user) return '??';
    return user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  });

  historicalDateRange = computed(() => {
    const views = this.historicalFilteredViews();
    if (!views.length) return '';
    const first = new Date(views[0].date);
    const last = new Date(views[views.length - 1].date);
    const opts: Intl.DateTimeFormatOptions = { month: 'short', year: 'numeric' };
    if (first.getFullYear() === last.getFullYear()) {
      return `${first.toLocaleDateString('en-US', { month: 'short' })} — ${last.toLocaleDateString('en-US', opts)}`;
    }
    return `${first.toLocaleDateString('en-US', opts)} — ${last.toLocaleDateString('en-US', opts)}`;
  });

  formatDateLabel(dateStr: string): string {
    if (!dateStr) return '';
    const clean = dateStr.slice(0, 10);
    const parts = clean.split('-');
    if (parts.length === 3) {
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      return `${month}/${day}`;
    }
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  yAxisLabels = computed(() => {
    const views = this.historicalFilteredViews();
    if (!views.length) return [];
    const maxViews = Math.max(...views.map((d: any) => d.views), 10);
    const labels = [];
    for (let i = 0; i <= 4; i++) {
      const val = Math.round(maxViews - (i / 4) * maxViews);
      const y = 20 + (i / 4) * 145;
      labels.push({ val, y });
    }
    return labels;
  });

  xAxisLabels = computed(() => {
    const pts = this.chartPoints();
    if (!pts.length) return [];
    const labels = [];
    const count = Math.min(5, pts.length);
    if (count === 1) {
      const p = pts[0];
      labels.push({ x: p.x, label: this.formatDateLabel(p.date), anchor: 'middle' });
      return labels;
    }
    for (let i = 0; i < count; i++) {
      const index = Math.floor((i / (count - 1)) * (pts.length - 1));
      const p = pts[index];
      let anchor = 'middle';
      let x = p.x;
      if (i === 0) {
        anchor = 'start';
        x = Math.max(35, p.x - p.halfWidth);
      } else if (i === count - 1) {
        anchor = 'end';
        x = Math.min(975, p.x + p.halfWidth + 4);
      }
      labels.push({ x, label: this.formatDateLabel(p.date), anchor });
    }
    return labels;
  });

  chartPoints = computed(() => {
    const views = this.historicalFilteredViews();
    if (!views.length) return [];
    
    const maxViews = Math.max(...views.map(d => d.views), 10);
    const width = 1000;
    const baseHeight = 168;
    const paddingLeft = 45;
    const paddingRight = 45;
    const availableWidth = width - paddingLeft - paddingRight;
    const selDate = this.selectedDate();
    const barWidth = views.length <= 35 ? 18 : (views.length <= 65 ? 10 : 6);
    const halfWidth = barWidth / 2;
    
    return views.map((d, i, arr) => {
      const x = paddingLeft + (i / Math.max(1, arr.length - 1)) * availableWidth;
      const barHeight = d.views > 0 ? Math.max(5, (d.views / maxViews) * 145) : 2.5;
      const y = baseHeight - barHeight;
      return {
        x,
        y,
        barHeight,
        views: d.views,
        date: d.date,
        barWidth,
        halfWidth,
        isSelected: d.date === selDate
      };
    });
  });

  topReportDonutSegments = computed(() => {
    const details = this.userDetails();
    if (!details || this.filteredTotalViews() === 0) return [];
    const dates = this.activeDates();

    const reportMap = new Map<string, number>();

    if (details.dailyReportAccess && details.dailyReportAccess.length) {
      for (const r of details.dailyReportAccess) {
        if (dates.has(r.date) && r.views > 0) {
          reportMap.set(r.reportName, (reportMap.get(r.reportName) || 0) + r.views);
        }
      }
    } else if (details.dailyPageAccess && details.dailyPageAccess.length) {
      for (const p of details.dailyPageAccess) {
        if (dates.has(p.date) && p.views > 0) {
          reportMap.set(p.reportName, (reportMap.get(p.reportName) || 0) + p.views);
        }
      }
    } else {
      for (const r of details.reportAccess) {
        reportMap.set(r.reportName, r.views);
      }
    }

    const sorted = Array.from(reportMap.entries())
      .map(([name, views]) => ({ reportName: name, views }))
      .sort((a, b) => b.views - a.views);

    const top5 = sorted.slice(0, 5);
    const total = top5.reduce((acc, r) => acc + r.views, 0);
    let cumulativePercent = 0;
    const colors = ['#93c5fd', '#6ee7b7', '#c4b5fd', '#fde68a', '#fbcfe8'];
    
    return top5.map((r, i) => {
      const percent = total > 0 ? (r.views / total) * 100 : 0;
      const start = cumulativePercent;
      cumulativePercent += percent;
      return {
        name: r.reportName,
        views: r.views,
        color: colors[i % colors.length],
        percent,
        conicString: `${colors[i % colors.length]} ${start}% ${cumulativePercent}%`
      };
    });
  });

  topReportDonutStyle = computed(() => {
    const segments = this.topReportDonutSegments();
    if (!segments.length) return '';
    return `conic-gradient(${segments.map((s: any) => s.conicString).join(', ')})`;
  });

  leastAccessedHbars = computed(() => {
    const details = this.userDetails();
    if (!details || this.filteredTotalViews() === 0) return [];
    const dates = this.activeDates();

    const reportMap = new Map<string, number>();

    if (details.dailyReportAccess && details.dailyReportAccess.length) {
      for (const r of details.dailyReportAccess) {
        if (dates.has(r.date) && r.views > 0) {
          reportMap.set(r.reportName, (reportMap.get(r.reportName) || 0) + r.views);
        }
      }
    } else if (details.dailyPageAccess && details.dailyPageAccess.length) {
      for (const p of details.dailyPageAccess) {
        if (dates.has(p.date) && p.views > 0) {
          reportMap.set(p.reportName, (reportMap.get(p.reportName) || 0) + p.views);
        }
      }
    } else {
      for (const r of details.leastReports) {
        reportMap.set(r.reportName, r.views);
      }
    }

    const sorted = Array.from(reportMap.entries())
      .map(([name, views]) => ({ name, views }))
      .sort((a, b) => a.views - b.views);

    return sorted.slice(0, 5);
  });

  ngOnInit() {
    this.api.getAllUsersStats().subscribe({
      next: (users) => {
        this.allUsers.set(users);
        this.loadingAll.set(false);
        if (this.preSelectEmail) {
          const match = users.find(u => u.email === this.preSelectEmail);
          if (match) { this.selectUser(match); }
        }
      },
      error: (err) => {
        this.errorMsg.set('Failed to load users.');
        this.loadingAll.set(false);
      }
    });
  }

  selectUser(u: AllUsersStat) {
    this.selectedUser.set(u);
    this.selectedDate.set(null);
    this.showHistoricalView.set(false);
    this.loadingDetails.set(true);
    this.api.getUserDetails(u.email).subscribe({
      next: (details) => {
        this.userDetails.set(details);
        this.loadingDetails.set(false);
      },
      error: () => {
        this.errorMsg.set('Failed to load user details.');
        this.loadingDetails.set(false);
      }
    });
  }

  clearSelected() {
    this.selectedUser.set(null);
    this.userDetails.set(null);
    this.selectedDate.set(null);
    this.showHistoricalView.set(false);
    this.errorMsg.set('');
  }

  formatAccessDate(val?: string | null): string {
    if (!val) {
      val = this.filteredLastAccessed();
      if (!val) return 'N/A';
    }
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

  getUserAvatarStyle(name?: string, index: number = 0): { bg: string; color: string } {
    const pastels = [
      { bg: '#dbeafe', color: '#1d4ed8' },
      { bg: '#ede9fe', color: '#6d28d9' },
      { bg: '#dcfce7', color: '#15803d' },
      { bg: '#ffe4e6', color: '#be123c' },
      { bg: '#fef3c7', color: '#b45309' },
      { bg: '#ccfbf1', color: '#0f766e' },
      { bg: '#fce7f3', color: '#be185d' },
      { bg: '#ffedd5', color: '#c2410c' },
      { bg: '#e0e7ff', color: '#4338ca' },
      { bg: '#ecfccb', color: '#3f6212' },
    ];

    if (!name) return pastels[index % pastels.length];
    let hash = 0;
    for (let j = 0; j < name.length; j++) {
      hash = name.charCodeAt(j) + ((hash << 5) - hash);
    }
    const colorIndex = Math.abs(hash) % pastels.length;
    return pastels[colorIndex];
  }
}
