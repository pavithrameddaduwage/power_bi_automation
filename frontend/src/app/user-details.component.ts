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
    .page-header h1 { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 4px 0; }
    .page-header p  { font-size: 11px; color: #000000; margin: 0; }

    /* Premium Header */
    .profile-header {
      background: white;
      border: 1.5px solid #3b82f6;
      border-radius: 12px;
      padding: 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: #0f172a;
      margin-bottom: 24px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .profile-info { display: flex; align-items: center; gap: 16px; }
    .avatar {
      width: 48px; height: 48px; border-radius: 8px;
      background: #3b82f6; display: flex; align-items: center; justify-content: center;
      font-size: 18px; font-weight: 700; color: white;
      box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.5);
    }
    .profile-name { font-size: 18px; font-weight: 700; margin: 0; line-height: 1.2; color: #0f172a;}
    .profile-email { font-size: 11px; color: #000000; margin-top: 4px; }
    
    .btn-back {
      background: white; border: none;
      color: #334155; padding: 8px 16px; border-radius: 8px; font-size: 11px; font-weight: 600;
      cursor: pointer; transition: all 0.2s;
    }
    .btn-back:hover { background: #f8fafc; border-color: #cbd5e1; }

    /* Summary Cards */
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
    .sum-card {
      background: white; border-radius: 12px; padding: 20px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
      border: none; border-top: 4px solid #3b82f6;
    }
    .sum-label { font-size: 10px; font-weight: 700; color: #000000; letter-spacing: 0.5px; margin-bottom: 8px; text-transform: uppercase; }
    .sum-val { font-size: 28px; font-weight: 800; color: #0f172a; line-height: 1; }

    /* SVG Line Chart */
    .line-chart-svg { width: 100%; height: 180px; overflow: visible; }
    .chart-line { fill: none; stroke: #3b82f6; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
    .chart-area { fill: url(#blueGradient); opacity: 0.2; }
    .chart-bar { fill: #10b981; opacity: 0.5; width: 6px; rx: 3; transition: height 0.3s ease, y 0.3s ease; }
    .chart-bar:hover { opacity: 1; cursor: pointer; }
    
    .chart-grid-line { stroke: #e2e8f0; stroke-width: 1; }
    .chart-axis-text { font-size: 10px; fill: #000000; font-weight: 600; }

    /* Two Column Layout */
    .two-col-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }

    .premium-card {
      background: white; border-radius: 12px; padding: 24px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
      border: none; display: flex; flex-direction: column;
    }
    .premium-card h3 {
      font-size: 14px; font-weight: 700; color: #0f172a; margin: 0 0 20px 0;
      display: flex; justify-content: space-between; align-items: center;
    }
    .badge-light {
      background: #eff6ff; color: #3b82f6; font-size: 10px; padding: 4px 10px;
      border-radius: 12px; font-weight: 600; letter-spacing: 0.5px;
    }

    /* Donut Chart */
    .donut-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
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

    /* Vertical Bar Chart for Least Accessed */
    .vbar-chart { display: flex; align-items: flex-end; justify-content: space-around; height: 140px; padding-bottom: 0px; border-bottom: 2px solid #e2e8f0; margin-top: 16px; margin-bottom: 70px; }
    .vbar-col { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; width: 50px; height: 100%; }
    .vbar { background: #d97706; border-radius: 4px 4px 0 0; width: 36px; transition: height 0.4s ease; min-height: 4px; transform-origin: bottom; animation: scaleInY 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
    .vbar-label { position: absolute; top: calc(100% + 8px); right: 50%; transform: rotate(-45deg); transform-origin: top right; font-size: 10px; font-weight: 600; color: #000000; text-align: right; white-space: nowrap; width: 120px; overflow: hidden; text-overflow: ellipsis; }

    /* Horizontal Bar Chart */
    .hbar-row-c { display: flex; align-items: center; gap: 16px; margin-bottom: 14px; }
    .hbar-label-c { width: 180px; font-size: 11px; font-weight: 600; color: #000000; text-align: right; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; max-width: none; line-height: 1.3; }
    .hbar-track-c { flex: 1; display: flex; align-items: center; gap: 8px; }
    .hbar-fill-c { height: 14px; background: #d97706; border-radius: 3px; min-width: 4px; transition: width 0.4s ease; transform-origin: left; animation: scaleInX 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
    .hbar-val-c { font-size: 11px; color: #000000; font-weight: 600; width: 20px; }

    .hover-bg-slate-50:hover { background: #f8fafc; }
    
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

    .empty { text-align: center; color: #000000; font-size: 11px; padding: 40px 0; }
    .spinner { display:inline-block; width:18px; height:18px; border:3px solid #dbeafe; border-top-color:#1d6ef5; border-radius:50%; animation:spin .7s linear infinite; vertical-align:middle; }
    @keyframes spin { to { transform: rotate(360deg); } }

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
    <div style="margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between;">
      <div>
        <h2 style="font-size: 18px; font-weight: 700; color: #1e3a8a; margin: 0 0 4px 0;">User Details</h2>
        <div style="color: #000000; font-size: 11px;"></div>
      </div>
      <input type="text" class="table-search-input" style="width: 280px; margin: 0;" placeholder="Search user by name or email..."
             [ngModel]="userSearch()" (ngModelChange)="userSearch.set($event); userListPage.set(0)" />
    </div>



    <!-- User List -->
    <div *ngIf="loadingAll()" class="empty"><span class="spinner"></span> Loading user statistics...</div>
    <div *ngIf="errorMsg()" class="empty" style="color: #dc2626;">{{ errorMsg() }}</div>

    <div *ngIf="!loadingAll() && filteredUsers().length" class="card" style="padding: 0; overflow: hidden; border-radius: 12px; border: none; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
      <table class="clean-table" style="font-size: 11px;">
        <thead>
          <tr><th style="padding-left:24px;">User</th><th style="text-align:right;">Total Views</th><th style="text-align:right; padding-right:24px;">Last Accessed</th></tr>
        </thead>
        <tbody>
          <tr *ngFor="let u of filteredUsers() | slice: userListPage()*7 : (userListPage()+1)*7" style="cursor: pointer; transition: background 0.2s;" class="hover-bg-slate-50" (click)="selectUser(u)">
            <td style="padding-left:24px;">
              <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:36px; height:36px; border-radius:50%; background:#eff6ff; color:#3b82f6; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                  {{ u.name.charAt(0) }}
                </div>
                <div>
                  <div style="font-weight:600; color:#0f172a;">{{ u.name }}</div>
                  <div style="font-size:11px; color:#000000; margin-top:2px;">{{ u.email }}</div>
                </div>
              </div>
            </td>
            <td style="text-align:right; font-weight:600; color:#3b82f6;">{{ u.views | number }}</td>
            <td style="text-align:right; color:#000000; padding-right:24px;">{{ u.lastAccessed | date:'mediumDate' }}</td>
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
    <div *ngIf="loadingDetails()" class="empty" style="margin-top: 40px;"><span class="spinner"></span> Loading details for {{ selectedUser()?.name }}...</div>

    <div *ngIf="!loadingDetails() && userDetails() as details">
      <!-- Profile Header -->
      <div class="profile-header">
        <div class="profile-info">
          <div class="avatar">{{ initials() }}</div>
          <div>
            <h2 class="profile-name">{{ selectedUser()?.name }}</h2>
            <div class="profile-email">{{ selectedUser()?.email }}</div>
          </div>
        </div>
        <button class="btn-back" (click)="selectedUser.set(null); userDetails.set(null)">← Back to All Users</button>
      </div>

      <!-- Summary Grid -->
      <div class="summary-grid">
        <div class="sum-card" style="border-top-color: #3b82f6;">
          <div class="sum-label">Total Views</div>
          <div class="sum-val">{{ selectedUser()?.views | number }}</div>
        </div>
        <div class="sum-card" style="border-top-color: #10b981;">
          <div class="sum-label">Dashboards Accessed</div>
          <div class="sum-val">{{ details.totalDashboards }}</div>
        </div>
        <div class="sum-card" style="border-top-color: #f59e0b;">
          <div class="sum-label">Last Accessed</div>
          <div class="sum-val" style="font-size: 22px; padding-top: 4px;">{{ selectedUser()?.lastAccessed | date:'mediumDate' }}</div>
        </div>
      </div>

      <!-- SVG Line Chart Combo -->
      <div class="premium-card" style="margin-bottom: 24px;">
        <h3 style="margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; flex-wrap: nowrap; overflow: hidden; white-space: nowrap;">
          <span>Historical Views</span>
          <div style="display: flex; align-items: center; gap: 12px; margin-left: auto;">
            <select style="border: 1.5px solid #93c5fd; border-radius: 8px; padding: 6px 12px; font-size: 13px; background: #fff; color: #111827; outline: none; cursor: pointer; width: auto; flex-shrink: 0; appearance: auto;" [ngModel]="selectedYear()" (ngModelChange)="selectedYear.set($event)">
              <option value="2026">2026</option>
              <option value="2025">2025</option>
            </select>
            <span class="badge-light" style="white-space: nowrap; flex-shrink: 0;" *ngIf="historicalDateRange()">{{ historicalDateRange() }}</span>
          </div>
        </h3>
        <div style="display:flex; justify-content:flex-end; gap:16px; margin-bottom:16px; font-size:11px; font-weight:600; color:#000000;">
          <div style="display:flex; align-items:center; gap:6px;"><span style="width:12px; height:12px; border-radius:3px; background:#3b82f6;"></span> 4-week trend</div>
          <div style="display:flex; align-items:center; gap:6px;"><span style="width:12px; height:12px; border-radius:3px; background:#10b981; opacity:0.5;"></span> Weekly views</div>
        </div>
        
        <div style="position:relative; height: 180px; width: 100%;">
          <!-- SVG Chart -->
          <svg class="line-chart-svg" preserveAspectRatio="none" [attr.viewBox]="'0 0 1000 180'" style="width: 100%; height: 100%;">
            <defs>
              <linearGradient id="blueGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stop-color="#3b82f6" stop-opacity="1" />
                <stop offset="100%" stop-color="#3b82f6" stop-opacity="0" />
              </linearGradient>
            </defs>
            <!-- Grid Lines (Y-Axis) -->
            <ng-container *ngFor="let y of yAxisLabels()">
              <line class="chart-grid-line" x1="40" [attr.y1]="y.y" x2="1000" [attr.y2]="y.y" />
              <text class="chart-axis-text" x="0" [attr.y]="y.y + 4">{{ y.val }}</text>
            </ng-container>

            <!-- X-Axis Labels -->
            <ng-container *ngFor="let x of xAxisLabels()">
              <text class="chart-axis-text" [attr.x]="x.x" y="196" [attr.transform]="'rotate(-45 ' + x.x + ' 196)'">{{ x.label }}</text>
            </ng-container>

            <!-- Data Bars -->
            <ng-container *ngFor="let p of chartPoints()">
              <rect class="chart-bar animate-chart-bar" [attr.x]="p.x - 8" [attr.y]="p.y" width="16" [attr.height]="180 - p.y" (mouseenter)="showTooltip($event, p.date + '\n' + p.views + ' views')" (mousemove)="moveTooltip($event)" (mouseleave)="hideTooltip()"></rect>
            </ng-container>

            <!-- Data Line & Area -->
            <path class="chart-area animate-chart-area" style="pointer-events: none;" [attr.d]="chartAreaPath()" />
            <path class="chart-line animate-chart-line" style="pointer-events: none;" [attr.d]="chartLinePath()" />
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
          <h3>Least Accessed Reports </h3>
          <div class="table-container" style="margin-top: 16px;">
            <table class="clean-table">
              <thead><tr><th>Report Name</th><th style="text-align:right;">Views</th></tr></thead>
              <tbody>
                <tr *ngFor="let r of leastAccessedHbars()">
                  <td><strong>{{ r.name }}</strong></td>
                  <td style="text-align:right; font-weight:600; color:#d97706;">{{ r.views | number }}</td>
                </tr>
                <tr *ngIf="!leastAccessedHbars().length"><td colspan="2" class="empty">No idle reports.</td></tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <!-- Page Tabs Table -->
      <div class="premium-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h3 style="margin:0;">Page Tabs Accessed </h3>
          <input type="text" class="table-search-input" style="width:200px; margin:0;" placeholder="Search tabs..."
                 [ngModel]="pageSearch()" (ngModelChange)="pageSearch.set($event)" />
        </div>
        <div class="table-container"><table class="clean-table">
          <thead><tr><th>Tab</th><th>Dashboard / Report</th><th style="text-align:right;">Views</th></tr></thead>
          <tbody>
            <tr *ngFor="let p of filteredPageAccess() | slice: pagePageAccess()*10 : (pagePageAccess()+1)*10">
              <td><strong>{{ p.pageName }}</strong></td>
              <td style="color:#000000;">{{ p.reportName }}</td>
              <td style="text-align:right; font-weight:600; color:#3b82f6;">{{ p.views | number }}</td>
            </tr>
            <tr *ngIf="!filteredPageAccess().length"><td colspan="3" class="empty">No page tab access.</td></tr>
          </tbody>
        </table></div>
        <div class="pagination" *ngIf="filteredPageAccess().length > 10">
          <button [disabled]="pagePageAccess() === 0" (click)="pagePageAccess.set(pagePageAccess() - 1)">Previous</button>
          <span>Page {{ pagePageAccess() + 1 }} of {{ Math.ceil(filteredPageAccess().length / 10) }}</span>
          <button [disabled]="(pagePageAccess() + 1) * 10 >= filteredPageAccess().length" (click)="pagePageAccess.set(pagePageAccess() + 1)">Next</button>
        </div>
      </div>

    </div>
  </ng-container>

  <div *ngIf="tooltip().show" class="custom-tooltip" [style.left.px]="tooltip().x + 15" [style.top.px]="tooltip().y + 15">{{ tooltip().text }}</div>
`
})
export class UserDetailsComponent implements OnInit {
  userListPage = signal(0);
  userListTotalPages = computed(() => Math.ceil(this.filteredUsers().length / 7));
  selectedYear = signal('2026');

  historicalFilteredViews = computed(() => {
    const details = this.userDetails();
    if (!details || !details.historicalViews) return [];
    return details.historicalViews.filter(d => d.date.includes(this.selectedYear()));
  });
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
    if (!details) return [];
    const q = this.pageSearch().toLowerCase().trim();
    if (!q) return details.pageAccess;
    return details.pageAccess.filter(p => p.pageName.toLowerCase().includes(q) || p.reportName.toLowerCase().includes(q));
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

  yAxisLabels = computed(() => {
    const views = this.historicalFilteredViews();
    if (!views.length) return [];
    const maxViews = Math.max(...views.map((d: any) => d.views), 60);
    // Let's generate 4 grid lines
    const labels = [];
    for (let i = 0; i <= 4; i++) {
      const val = Math.round(maxViews - (i / 4) * maxViews);
      const y = 20 + (i / 4) * 160;
      labels.push({ val, y });
    }
    return labels;
  });

  xAxisLabels = computed(() => {
    const pts = this.chartPoints();
    if (!pts.length) return [];
    // Pick 5 evenly spaced points
    const labels = [];
    const count = 5;
    for (let i = 0; i < count; i++) {
      const index = Math.floor((i / (count - 1)) * (pts.length - 1));
      const p = pts[index];
      const d = new Date(p.date);
      labels.push({ x: p.x, label: `${d.getMonth() + 1}/${d.getDate()}` });
    }
    return labels;
  });

  chartPoints = computed(() => {
    const views = this.historicalFilteredViews();
    if (!views.length) return [];
    
    // Smooth out points across 1000px width, 180px height
    const maxViews = Math.max(...views.map(d => d.views), 60);
    const width = 1000;
    const height = 180;
    const paddingX = 40;
    
    return views.map((d, i, arr) => {
      const x = paddingX + (i / Math.max(1, arr.length - 1)) * (width - paddingX);
      const y = height - (d.views / maxViews) * height;
      return { x, y, views: d.views, date: d.date };
    });
  });

  chartLinePath = computed(() => {
    const pts = this.chartPoints();
    if (!pts.length) return '';
    // Bezier curve approximation
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const cx = (prev.x + curr.x) / 2;
      path += ` C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`;
    }
    return path;
  });

  chartAreaPath = computed(() => {
    const pts = this.chartPoints();
    if (!pts.length) return '';
    let path = this.chartLinePath();
    const width = 1000;
    const height = 180;
    path += ` L ${pts[pts.length - 1].x} ${height} L ${pts[0].x} ${height} Z`;
    return path;
  });

  topReportDonutSegments = computed(() => {
    const details = this.userDetails();
    if (!details || !details.topReports.length) return [];
    
    const top5 = details.topReports.slice(0, 5);
    const total = top5.reduce((acc, r) => acc + r.views, 0);
    let cumulativePercent = 0;
    const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#93c5fd', '#bae6fd'];
    
    return top5.map((r: any, i: number) => {
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
    if (!details || !details.leastReports.length) return [];
    const max = Math.max(...details.leastReports.map((r: any) => r.views), 10);
    return details.leastReports.map((r: any) => ({
      name: r.reportName,
      views: r.views,
      percent: (r.views / max) * 90 // max bar width 90%
    }));
  });

  ngOnInit() {
    this.api.getAllUsersStats().subscribe({
      next: (users) => {
        this.allUsers.set(users);
        this.loadingAll.set(false);
        // Auto-select user if navigated from Usage page
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
    this.errorMsg.set('');
  }
}
