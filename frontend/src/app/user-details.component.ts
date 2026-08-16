import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SyncApiService, AllUsersStat, UserDetailsBreakdown } from './sync.service';

@Component({
  selector: 'app-user-details',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    :host { display: block; }
    .page-header { margin-bottom: 24px; }
    .page-header h1 { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 4px 0; }
    .page-header p  { font-size: 13px; color: #6b7280; margin: 0; }

    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
    @media (max-width: 860px) { .two-col { grid-template-columns: 1fr; } }
    
    .card {
      background: #fff; border: 1.5px solid #93c5fd; border-radius: 12px;
      padding: 18px 20px; box-shadow: 0 1px 6px rgba(29,110,245,0.07);
      margin-bottom: 16px;
    }
    .card h3 { font-size: 13px; font-weight: 700; color: #1d4ed8; margin: 0 0 14px 0; letter-spacing: .4px; }

    /* Tables */
    .tbl-wrap {
      border: 1px solid #1d6ef5;
      border-radius: 8px;
      overflow: auto;
      max-height: 400px;
      scrollbar-width: thin;
      scrollbar-color: #1d6ef5 #f0f7ff;
    }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th {
      background: #1d6ef5; color: #ffffff; font-weight: 700;
      padding: 12px 16px; text-align: left; position: sticky; top: 0;
      z-index: 2; border-bottom: 2px solid #1d6ef5; white-space: nowrap; font-size: 14px;
    }
    td {
      text-align: left; padding: 12px 16px; border-bottom: 1px solid #eff6ff;
      color: #111827; font-size: 13px; background: #ffffff; vertical-align: middle;
    }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr.clickable:hover td { background: #f0f7ff; cursor: pointer; }

    .empty { text-align: center; color: #9ca3af; font-size: 13px; padding: 40px 0; }
    .spinner { display:inline-block; width:18px; height:18px; border:3px solid #dbeafe; border-top-color:#1d6ef5; border-radius:50%; animation:spin .7s linear infinite; vertical-align:middle; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .table-search-input {
      width: 100%; border: 1.5px solid #dbeafe; border-radius: 8px;
      padding: 6px 12px; font-size: 13px; margin-bottom: 12px;
      outline: none; box-sizing: border-box; transition: border-color .15s;
    }
    .table-search-input:focus { border-color: #1d6ef5; }

    .day-btn {
      padding: 6px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;
      border: 1.5px solid #93c5fd; background: #fff; color: #1d4ed8; transition: all .15s;
    }
    .day-btn:hover { background: #eff6ff; }

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
    .bar-label { font-size: 8px; color: #9ca3af; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; text-align: center; }

    .summary-cards {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 14px; margin-bottom: 24px;
    }
    .summary-card {
      background: #fff; border: 1.5px solid #f59e0b; border-radius: 12px;
      padding: 16px 20px; box-shadow: 0 1px 6px rgba(245,158,11,0.07);
    }
    .summary-card .label { font-size: 11px; font-weight: 600; color: #6b7280; letter-spacing: .5px; }
    .summary-card .value { font-size: 28px; font-weight: 800; color: #d97706; margin-top: 4px; line-height: 1.1; }
  `],
  template: `
  <div class="page-header">
    <h1>User Details</h1>
    <p>View detailed historical access and breakdown for all Power BI users.</p>
  </div>

  <div *ngIf="loadingAll()" class="empty"><span class="spinner"></span> Loading users...</div>
  <div *ngIf="errorMsg()" class="empty" style="color:#dc2626;">{{ errorMsg() }}</div>

  <ng-container *ngIf="!loadingAll() && !errorMsg()">
    <!-- List of Users -->
    <div class="card" *ngIf="!selectedUser()">
      <h3>All Power BI Users</h3>
      <input type="text" class="table-search-input" placeholder="Search users by name or email..."
             [ngModel]="userSearch()" (ngModelChange)="userSearch.set($event)" />

      <div class="tbl-wrap">
        <table>
          <thead><tr>
            <th>Name</th>
            <th>Email</th>
            <th>Total Views</th>
            <th>Last Accessed</th>
          </tr></thead>
          <tbody>
            <tr *ngFor="let u of filteredUsers()" class="clickable" (click)="selectUser(u)">
              <td><strong>{{ u.name }}</strong></td>
              <td>{{ u.email }}</td>
              <td>{{ u.views | number }}</td>
              <td style="color:#6b7280; font-size:12px;">{{ u.lastAccessed | date:'mediumDate' }}</td>
            </tr>
            <tr *ngIf="!filteredUsers().length">
              <td colspan="4" class="empty">No matching users found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Detailed User Breakdown -->
    <div *ngIf="selectedUser() as u" style="border: 1px solid #f59e0b; border-radius: 12px; background: #fffdfa; padding: 20px; box-shadow: var(--shadow-sm);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1.5px solid #fef3c7; padding-bottom:12px;">
        <div>
          <h3 style="margin:0; color:#b45309; font-weight:700; font-size:16px; letter-spacing:.5px;">
            {{ u.name }}
          </h3>
          <div style="font-size:12px; color:#92400e; margin-top:2px;">{{ u.email }}</div>
        </div>
        <button class="day-btn" style="border-color:#f59e0b; color:#d97706;" (click)="clearSelected()">Back to All Users</button>
      </div>

      <div *ngIf="loadingDetails()" class="empty"><span class="spinner"></span> Loading user details...</div>
      
      <ng-container *ngIf="!loadingDetails() && userDetails() as details">
        <div class="summary-cards">
          <div class="summary-card">
            <div class="label">Total Views</div>
            <div class="value">{{ u.views | number }}</div>
          </div>
          <div class="summary-card">
            <div class="label">Dashboards Accessed</div>
            <div class="value">{{ details.totalDashboards | number }}</div>
          </div>
          <div class="summary-card">
            <div class="label">Last Accessed</div>
            <div class="value" style="font-size:16px; margin-top:10px;">{{ u.lastAccessed | date:'mediumDate' }}</div>
          </div>
        </div>

        <!-- Historical Views Chart -->
        <div class="card" style="border-color:#f59e0b;">
          <h3 style="color:#d97706;">Historical Views</h3>
          <div class="bar-chart-wrap" *ngIf="details.historicalViews.length; else noHistory">
            <div class="bar-chart">
              <div class="bar-col" *ngFor="let d of details.historicalViews">
                <div class="chart-tooltip">
                  <strong>{{ d.date | date:'mediumDate' }}</strong><br>
                  {{ d.views | number }} views
                </div>
                <div class="bar" [style.height.px]="barHeight(d.views, details.historicalViews)"></div>
                <div class="bar-label">{{ d.date | date:'M/d/yy' }}</div>
              </div>
            </div>
          </div>
          <ng-template #noHistory><p class="empty">No historical view data.</p></ng-template>
        </div>

        <!-- Top / Least Reports -->
        <div class="two-col">
          <div class="card" style="border-color:#10b981;">
            <h3 style="color:#059669;">Top Dashboards & Reports</h3>
            <div class="tbl-wrap" style="border-color:#10b981; scrollbar-color:#10b981 #ecfdf5;">
              <table>
                <thead><tr><th style="background:#10b981; border-bottom-color:#10b981;">Report Name</th><th style="background:#10b981; border-bottom-color:#10b981;">Views</th></tr></thead>
                <tbody>
                  <tr *ngFor="let r of details.topReports">
                    <td><span style="color:#047857; font-weight:600;">{{ r.reportName }}</span></td>
                    <td>{{ r.views | number }}</td>
                  </tr>
                  <tr *ngIf="!details.topReports.length"><td colspan="2" class="empty">No data.</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="card" style="border-color:#ef4444;">
            <h3 style="color:#b91c1c;">Least Accessed Reports</h3>
            <div class="tbl-wrap" style="border-color:#ef4444; scrollbar-color:#ef4444 #fee2e2;">
              <table>
                <thead><tr><th style="background:#ef4444; border-bottom-color:#ef4444;">Report Name</th><th style="background:#ef4444; border-bottom-color:#ef4444;">Views</th></tr></thead>
                <tbody>
                  <tr *ngFor="let r of details.leastReports">
                    <td><span style="color:#b91c1c; font-weight:600;">{{ r.reportName }}</span></td>
                    <td>{{ r.views | number }}</td>
                  </tr>
                  <tr *ngIf="!details.leastReports.length"><td colspan="2" class="empty">No data.</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Page Tabs -->
        <div class="card" style="border-color:#8b5cf6;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <h3 style="color:#6d28d9; margin:0;">Page Tabs Accessed</h3>
            <input type="text" class="table-search-input" style="width:200px; margin-bottom:0; padding:4px 8px; font-size:12px;" placeholder="Search tabs..."
                   [ngModel]="pageSearch()" (ngModelChange)="pageSearch.set($event)" />
          </div>
          <div class="tbl-wrap" style="border-color:#8b5cf6; scrollbar-color:#8b5cf6 #ede9fe; max-height: 250px;">
            <table>
              <thead><tr><th style="background:#8b5cf6; border-bottom-color:#8b5cf6;">Tab Name</th><th style="background:#8b5cf6; border-bottom-color:#8b5cf6;">Dashboard / Report</th><th style="background:#8b5cf6; border-bottom-color:#8b5cf6;">Views</th></tr></thead>
              <tbody>
                <tr *ngFor="let p of filteredPageAccess()">
                  <td><span style="color:#5b21b6; font-weight:600;">{{ p.pageName }}</span></td>
                  <td><span style="font-size:12px; color:#4b5563;">{{ p.reportName }}</span></td>
                  <td>{{ p.views | number }}</td>
                </tr>
                <tr *ngIf="!filteredPageAccess().length"><td colspan="3" class="empty">No page tab access.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </ng-container>
    </div>
  </ng-container>
  `
})
export class UserDetailsComponent implements OnInit {
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

  ngOnInit() {
    this.api.getAllUsersStats().subscribe({
      next: (users) => {
        this.allUsers.set(users);
        this.loadingAll.set(false);
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

  barHeight(views: number, data: { views: number }[]): number {
    const max = Math.max(...data.map(d => d.views), 1);
    const pct = views / max;
    return Math.max(pct * 120, 2);
  }
}
