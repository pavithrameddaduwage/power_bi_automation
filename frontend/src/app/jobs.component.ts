import { Component, HostListener, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SyncApiService, Job, SyncRun, DatasetRefreshInfo } from './sync.service';
import { ToastService } from './toast.service';
import { PagerComponent } from './pager.component';

@Component({
  selector: 'app-jobs',
  standalone: true,
  imports: [CommonModule, FormsModule, PagerComponent],
  styles: [`
    :host { display: block; }
    .th-header-cell {
      display: flex; align-items: center; justify-content: space-between; gap: 8px; user-select: none; cursor: pointer;
    }
    .th-title {
      font-size: 12.5px; font-weight: 700; color: #1e40af; white-space: nowrap;
    }
    .th-arrow-btn {
      font-size: 11px; color: #93c5fd; transition: transform 0.15s, color 0.15s; display: inline-block;
      opacity: 0.8;
    }
    .th-arrow-btn.open { transform: rotate(180deg); color: #1d6ef5; opacity: 1; }
    .th-arrow-btn.filtered { color: #1d6ef5; opacity: 1; font-weight: 900; }

    .filter-popover {
      position: fixed; margin-top: 0;
      min-width: 220px; max-width: 280px; background: #ffffff;
      border: 1.5px solid #93c5fd; border-radius: 12px;
      box-shadow: 0 8px 32px rgba(29,110,245,0.14); padding: 14px;
      z-index: 9999; cursor: default; text-transform: none; font-weight: normal;
    }
    .popover-header { font-size: 12px; font-weight: 700; color: #1d4ed8; margin-bottom: 8px; text-align: left; }
    .popover-search-input {
      font-size: 12px; padding: 6px 10px; border: 1.5px solid #93c5fd;
      border-radius: 7px; width: 100%; margin-bottom: 8px; outline: none;
    }
    .popover-search-input:focus { border-color: #1d6ef5; }
    .popover-options-list {
      max-height: 200px; overflow-y: auto; border: 1.5px solid #dbeafe;
      border-radius: 8px; text-align: left;
      scrollbar-width: thin; scrollbar-color: #93c5fd #f0f7ff;
    }
    .popover-option {
      display: flex; align-items: center; gap: 8px;
      padding: 7px 10px; font-size: 12px; color: #1e293b;
      cursor: pointer; border-bottom: 1px solid #f1f5f9; transition: background 0.1s;
    }
    .popover-option:last-child { border-bottom: none; }
    .popover-option:hover { background: #eff6ff; }
    .popover-option input[type="radio"] { accent-color: #1d6ef5; cursor: pointer; flex-shrink: 0; }
    .popover-option span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .popover-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; border-top: 1px solid #dbeafe; padding-top: 10px; }
    .btn-popover-main { background: #1d6ef5; color: #fff; border: none; padding: 5px 14px; border-radius: 7px; font-size: 12px; font-weight: 600; cursor: pointer; }
    .btn-popover-sub { background: #ffffff; color: #374151; border: 1.5px solid #93c5fd; padding: 5px 14px; border-radius: 7px; font-size: 12px; font-weight: 600; cursor: pointer; }
  `],
  template: `
    <!-- Tab Navigation Header -->
    <div style="display:flex; justify-space-between; align-items:center; margin-bottom: 20px; flex-wrap:wrap; gap:12px;">
      <div style="display: flex; gap: 8px; background:#e2e8f0; padding:4px; border-radius:10px;">
        <button
          class="btn-secondary"
          [style.background]="activeTab() === 'toolJobs' ? '#ffffff' : 'transparent'"
          [style.color]="activeTab() === 'toolJobs' ? '#1d4ed8' : '#64748b'"
          [style.box-shadow]="activeTab() === 'toolJobs' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'"
          [style.border]="'none'"
          (click)="activeTab.set('toolJobs')"
          style="font-size: 13px; font-weight: 700; padding: 7px 18px; border-radius:8px; cursor:pointer;"
        >
          Scheduled Auto-Sync Reports ({{ jobs().length }})
        </button>
        <button
          class="btn-secondary"
          [style.background]="activeTab() === 'pbiSchedules' ? '#ffffff' : 'transparent'"
          [style.color]="activeTab() === 'pbiSchedules' ? '#1d4ed8' : '#64748b'"
          [style.box-shadow]="activeTab() === 'pbiSchedules' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'"
          [style.border]="'none'"
          (click)="activeTab.set('pbiSchedules')"
          style="font-size: 13px; font-weight: 700; padding: 7px 18px; border-radius:8px; cursor:pointer;"
        >
          Power BI Dataset Refresh Times ({{ refreshSchedules().length }})
        </button>
      </div>
      <button class="btn-secondary" (click)="load()" [disabled]="busy() || loadingRefreshes()" style="font-size: 12px; padding: 6px 14px;">
        <span *ngIf="busy() || loadingRefreshes()" class="spinner"></span> Refresh
      </button>
    </div>

    <!-- TAB 1: Tool Scheduled Auto-Sync Reports -->
    <ng-container *ngIf="activeTab() === 'toolJobs'">
      <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 32px;">
        <div style="padding: 16px 24px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; background: var(--card);">
          <div>
            <h4 style="margin: 0; font-size: 15px; font-weight: 700; color: var(--text);">Auto-Sync Scheduled Reports</h4>
          </div>
          <input
            [ngModel]="jobSearch()"
            (ngModelChange)="onJobSearchChange($event)"
            placeholder="Search report name, table, schedule..."
            style="font-size: 12px; padding: 6px 12px; min-width: 220px; border-radius: 6px; border: 1px solid var(--border2); outline: none; background: var(--card); color: var(--text);"
          />
        </div>

        <div style="max-height: 520px; overflow-y: auto;">
          <table style="margin: 0;">
            <thead style="position: sticky; top: 0; z-index: 10; background: #eff6ff;">
              <tr>
                <th style="width: 24%;">Report Name</th>
                <th style="width: 20%;">Target DB Table</th>
                <th style="width: 18%;">Schedule (Cron)</th>
                <th style="width: 12%;">Mode</th>
                <th style="width: 14%;">Last Run</th>
                <th style="text-align: right; width: 12%;">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let j of pagedJobs()">
                <td>
                  <div style="font-weight: 700; font-size: 13px; color: var(--text);">{{ j.report_name || j.name }}</div>
                  <div class="muted" style="font-size: 11px;">Source: {{ j.source_table }}</div>
                </td>
                <td>
                  <span class="badge badge-ok" style="font-family: monospace;">{{ j.target_table }}</span>
                </td>
                <td>
                  <div *ngIf="j.cron" style="font-weight:600; color:#1d4ed8; font-size:12px;">
                    <code>{{ j.cron }}</code>
                  </div>
                  <span *ngIf="!j.cron" class="tag">Manual</span>
                </td>
                <td>
                  <span class="tag" style="text-transform: uppercase; font-weight: 600;">{{ j.mode || 'append' }}</span>
                </td>
                <td>
                  <div *ngIf="j.last_run_at">
                    <span class="badge" [class.badge-ok]="j.last_status === 'success'" [class.badge-no]="j.last_status === 'error'">
                      {{ j.last_status || 'ok' }}
                    </span>
                    <div class="muted" style="font-size: 11px; margin-top: 3px;">
                      {{ j.last_run_at | date: 'short' }} ({{ j.last_rows || 0 }} rows)
                    </div>
                  </div>
                  <span *ngIf="!j.last_run_at" class="muted" style="font-size: 11px;">Never run</span>
                </td>
                <td style="text-align: right;">
                  <div style="display: flex; gap: 6px; justify-content: flex-end;">
                    <button class="btn-action-mini" (click)="run(j)" [disabled]="busy() || running() === j.id">
                      <span *ngIf="running() === j.id" class="spinner"></span>
                      {{ running() === j.id ? 'Running…' : 'Run Now' }}
                    </button>
                    <button class="btn-action-mini" (click)="remove(j)" [disabled]="busy()" style="color:var(--red); border-color:#fca5a5;">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
              <tr *ngIf="filteredJobs().length === 0">
                <td colspan="6" class="placeholder" style="padding: 24px;">
                  No scheduled auto-sync reports found. Go to Reports view and enable Auto-Sync Schedule when configuring a report.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </ng-container>

    <!-- TAB 2: Power BI Refresh Schedules Reference Card -->
    <ng-container *ngIf="activeTab() === 'pbiSchedules'">
      <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 32px;">
        <div style="padding: 16px 24px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; background: var(--card);">
          <div>
            <h4 style="margin: 0; font-size: 15px; font-weight: 700; color: var(--text);">Power BI Dataset Refresh Times &amp; Schedules</h4>
          </div>
          <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
            <input
              [ngModel]="refreshSearch()"
              (ngModelChange)="onSearchChange($event)"
              placeholder="Search dataset, workspace, owner..."
              style="font-size: 12px; padding: 6px 12px; min-width: 220px; border-radius: 6px; border: 1px solid var(--border2); outline: none; background: var(--card); color: var(--text);"
            />
            <button class="btn-secondary" style="font-size: 11px; padding: 4px 10px;" *ngIf="hasActiveFilters()" (click)="clearAllFilters()">
              Clear Filters
            </button>
            <span class="tag" *ngIf="refreshSchedules().length > 0">
              {{ filteredRefreshes().length }} of {{ refreshSchedules().length }} dataset(s)
            </span>
          </div>
        </div>

        <div style="max-height: 520px; overflow-y: auto;">
          <table style="margin: 0;">
            <thead style="position: sticky; top: 0; z-index: 10; background: #eff6ff;">
              <tr>
                <th style="width: 24%; cursor: pointer;" (click)="toggleHeaderFilter('workspace', $event)">
                  <div class="th-header-cell">
                    <span class="th-title">Workspace</span>
                    <span class="th-arrow-btn" [class.open]="activeHeaderCol() === 'workspace'" [class.filtered]="!!workspaceFilter()">▾</span>
                  </div>
                </th>
                <th style="width: 30%; cursor: pointer;" (click)="toggleHeaderFilter('dataset', $event)">
                  <div class="th-header-cell">
                    <span class="th-title">Dataset / Dashboard</span>
                    <span class="th-arrow-btn" [class.open]="activeHeaderCol() === 'dataset'" [class.filtered]="!!refreshSearch()">▾</span>
                  </div>
                </th>
                <th style="width: 26%; cursor: pointer;" (click)="toggleHeaderFilter('schedule', $event)">
                  <div class="th-header-cell">
                    <span class="th-title">Power BI Refresh Schedule</span>
                    <span class="th-arrow-btn" [class.open]="activeHeaderCol() === 'schedule'" [class.filtered]="!!scheduleFilter()">▾</span>
                  </div>
                </th>
                <th style="width: 20%; cursor: pointer;" (click)="toggleHeaderFilter('status', $event)">
                  <div class="th-header-cell">
                    <span class="th-title">Last Refresh &amp; Status</span>
                    <span class="th-arrow-btn" [class.open]="activeHeaderCol() === 'status'" [class.filtered]="!!statusFilter()">▾</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let s of filteredRefreshes()">
                <td style="font-weight: 600; font-size: 12px; color: var(--text); white-space: nowrap;">
                  {{ s.workspaceName }}
                </td>
                <td>
                  <div style="font-weight: 600; font-size: 13px; color: var(--text);">{{ s.datasetName }}</div>
                  <div class="muted" style="font-size: 11px;" *ngIf="s.configuredBy">Owner - {{ s.configuredBy }}</div>
                </td>
                <td>
                  <div *ngIf="s.scheduleEnabled && s.scheduleTimes?.length">
                    <span class="badge badge-ok" style="font-weight: 600;">
                      {{ s.scheduleTimes.join(', ') }} ({{ s.timeZone || 'UTC' }})
                    </span>
                    <div class="muted" style="font-size: 11px; margin-top: 3px;">
                      {{ formatScheduleDays(s.scheduleDays) }}
                    </div>
                  </div>
                  <div *ngIf="!s.scheduleEnabled || !s.scheduleTimes?.length">
                    <span class="tag" style="color: var(--muted); font-size: 11px;">Manual / Not Scheduled</span>
                  </div>
                </td>
                <td>
                  <div *ngIf="s.lastRefreshStartTime">
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span
                        class="badge"
                        [class.badge-ok]="s.lastRefreshStatus === 'Completed'"
                        [class.badge-no]="s.lastRefreshStatus === 'Failed'"
                        [style.background]="s.lastRefreshStatus === 'InProgress' ? '#e0f2fe' : ''"
                        [style.color]="s.lastRefreshStatus === 'InProgress' ? '#0369a1' : ''"
                      >
                        {{ s.lastRefreshStatus || 'Completed' }}
                      </span>
                      <span class="muted" style="font-size: 11px;" *ngIf="s.lastRefreshType">({{ s.lastRefreshType }})</span>
                    </div>
                    <div class="muted" style="font-size: 11px; margin-top: 3px;">
                      {{ s.lastRefreshStartTime | date: 'medium' }}
                    </div>
                  </div>
                  <div class="muted" *ngIf="!s.lastRefreshStartTime" style="font-size: 12px;">
                    No refresh history recorded
                  </div>
                </td>
              </tr>
              <tr *ngIf="filteredRefreshes().length === 0 && !loadingRefreshes()">
                <td colspan="4" class="placeholder" style="padding: 24px;">No matching dataset refresh schedules found.</td>
              </tr>
              <tr *ngIf="loadingRefreshes()">
                <td colspan="4" class="placeholder" style="padding: 24px;">
                  <span class="spinner"></span> Loading Power BI dataset refresh times...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </ng-container>

      <!-- Floating Popover Filter Menu -->
      <div *ngIf="activeHeaderCol() as col"
           class="filter-popover"
           [style.top.px]="popoverPos().top"
           [style.left.px]="popoverPos().left"
           (click)="$event.stopPropagation()">

        <!-- Workspace Filter -->
        <ng-container *ngIf="col === 'workspace'">
          <div class="popover-header">Filter Workspace</div>
          <input class="popover-search-input" placeholder="Search workspace..."
                 [ngModel]="wsSearch" (ngModelChange)="wsSearch = $event" (click)="$event.stopPropagation()" />
          <div class="popover-options-list">
            <label class="popover-option">
              <input type="radio" name="wsFilter" [checked]="workspaceFilter() === ''" (change)="workspaceFilter.set('')" />
              <span>All Workspaces</span>
            </label>
            <label *ngFor="let ws of filteredAvailableWorkspaces()" class="popover-option">
              <input type="radio" name="wsFilter" [checked]="workspaceFilter() === ws" (change)="workspaceFilter.set(ws)" />
              <span>{{ ws }}</span>
            </label>
          </div>
          <div class="popover-actions">
            <button class="btn-popover-sub" (click)="workspaceFilter.set(''); activeHeaderCol.set(null)">Clear</button>
            <button class="btn-popover-main" (click)="activeHeaderCol.set(null)">Apply</button>
          </div>
        </ng-container>

        <!-- Dataset / Dashboard Search -->
        <ng-container *ngIf="col === 'dataset'">
          <div class="popover-header">Filter Dataset or Owner</div>
          <input class="popover-search-input" placeholder="Type dataset or owner name..."
                 [ngModel]="refreshSearch()" (ngModelChange)="refreshSearch.set($event)" (click)="$event.stopPropagation()" />
          <div class="popover-actions">
            <button class="btn-popover-sub" (click)="refreshSearch.set(''); activeHeaderCol.set(null)">Clear</button>
            <button class="btn-popover-main" (click)="activeHeaderCol.set(null)">Apply</button>
          </div>
        </ng-container>

        <!-- Schedule Filter -->
        <ng-container *ngIf="col === 'schedule'">
          <div class="popover-header">Filter Refresh Schedule</div>
          <div class="popover-options-list">
            <label class="popover-option">
              <input type="radio" name="schFilter" [checked]="scheduleFilter() === ''" (change)="scheduleFilter.set('')" />
              <span>All Schedules</span>
            </label>
            <label class="popover-option">
              <input type="radio" name="schFilter" [checked]="scheduleFilter() === 'Scheduled'" (change)="scheduleFilter.set('Scheduled')" />
              <span>Scheduled Only</span>
            </label>
            <label class="popover-option">
              <input type="radio" name="schFilter" [checked]="scheduleFilter() === 'Manual'" (change)="scheduleFilter.set('Manual')" />
              <span>Manual / Not Scheduled</span>
            </label>
          </div>
          <div class="popover-actions">
            <button class="btn-popover-sub" (click)="scheduleFilter.set(''); activeHeaderCol.set(null)">Clear</button>
            <button class="btn-popover-main" (click)="activeHeaderCol.set(null)">Apply</button>
          </div>
        </ng-container>

        <!-- Status Filter -->
        <ng-container *ngIf="col === 'status'">
          <div class="popover-header">Filter Last Status</div>
          <div class="popover-options-list">
            <label class="popover-option">
              <input type="radio" name="stFilter" [checked]="statusFilter() === ''" (change)="statusFilter.set('')" />
              <span>All Statuses</span>
            </label>
            <label class="popover-option">
              <input type="radio" name="stFilter" [checked]="statusFilter() === 'Completed'" (change)="statusFilter.set('Completed')" />
              <span>Completed</span>
            </label>
            <label class="popover-option">
              <input type="radio" name="stFilter" [checked]="statusFilter() === 'Failed'" (change)="statusFilter.set('Failed')" />
              <span>Failed</span>
            </label>
            <label class="popover-option">
              <input type="radio" name="stFilter" [checked]="statusFilter() === 'InProgress'" (change)="statusFilter.set('InProgress')" />
              <span>In Progress</span>
            </label>
            <label class="popover-option">
              <input type="radio" name="stFilter" [checked]="statusFilter() === 'No History'" (change)="statusFilter.set('No History')" />
              <span>No History</span>
            </label>
          </div>
          <div class="popover-actions">
            <button class="btn-popover-sub" (click)="statusFilter.set(''); activeHeaderCol.set(null)">Clear</button>
            <button class="btn-popover-main" (click)="activeHeaderCol.set(null)">Apply</button>
          </div>
        </ng-container>
      </div>
  `,
})
export class JobsComponent implements OnInit {
  activeTab = signal<'toolJobs' | 'pbiSchedules'>('toolJobs');
  jobs = signal<Job[]>([]);
  runs = signal<SyncRun[]>([]);
  refreshSchedules = signal<DatasetRefreshInfo[]>([]);
  loadingRefreshes = signal(false);
  refreshSearch = signal('');
  workspaceFilter = signal('');
  statusFilter = signal('');
  scheduleFilter = signal('');
  jobSearch = signal('');
  runSearch = signal('');

  activeHeaderCol = signal<'workspace' | 'dataset' | 'schedule' | 'status' | null>(null);
  popoverPos = signal<{ top: number; left: number }>({ top: 0, left: 0 });
  wsSearch = '';

  busy = signal(false);
  running = signal<number | null>(null);

  pageSize = 7;
  jobPage = signal(0);
  runPage = signal(0);

  refreshPageSize = 8;
  refreshPage = signal(0);

  availableWorkspaces = computed(() =>
    Array.from(new Set(this.refreshSchedules().map((s) => s.workspaceName).filter(Boolean))).sort(),
  );

  filteredAvailableWorkspaces = computed(() => {
    const list = this.availableWorkspaces();
    const q = (this.wsSearch || '').trim().toLowerCase();
    return q ? list.filter((w) => w.toLowerCase().includes(q)) : list;
  });

  hasActiveFilters = computed(() => {
    return !!this.workspaceFilter() || !!this.refreshSearch() || !!this.scheduleFilter() || !!this.statusFilter();
  });

  clearAllFilters() {
    this.workspaceFilter.set('');
    this.refreshSearch.set('');
    this.scheduleFilter.set('');
    this.statusFilter.set('');
    this.wsSearch = '';
    this.activeHeaderCol.set(null);
  }

  toggleHeaderFilter(col: 'workspace' | 'dataset' | 'schedule' | 'status', ev: MouseEvent) {
    ev.stopPropagation();
    if (this.activeHeaderCol() === col) {
      this.activeHeaderCol.set(null);
      return;
    }
    const target = ev.currentTarget as HTMLElement;
    const th = target.closest('th') || target;
    const rect = th.getBoundingClientRect();
    const popoverWidth = 240;
    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - 16) {
      left = Math.max(16, window.innerWidth - popoverWidth - 16);
    }
    const top = rect.bottom + 4;
    this.popoverPos.set({ top, left });
    this.activeHeaderCol.set(col);
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  @HostListener('document:click')
  closePopovers() {
    this.activeHeaderCol.set(null);
  }

  filteredRefreshes = computed(() => {
    const q = this.refreshSearch().toLowerCase().trim();
    const ws = this.workspaceFilter();
    const st = this.statusFilter();
    const sch = this.scheduleFilter();
    let list = this.refreshSchedules();

    if (ws) {
      list = list.filter((s) => s.workspaceName === ws);
    }

    if (st) {
      if (st === 'Completed') list = list.filter((s) => s.lastRefreshStatus === 'Completed');
      else if (st === 'Failed') list = list.filter((s) => s.lastRefreshStatus === 'Failed');
      else if (st === 'InProgress') list = list.filter((s) => s.lastRefreshStatus === 'InProgress');
      else if (st === 'No History') list = list.filter((s) => !s.lastRefreshStartTime);
    }

    if (sch) {
      if (sch === 'Scheduled') list = list.filter((s) => s.scheduleEnabled && s.scheduleTimes?.length);
      else if (sch === 'Manual') list = list.filter((s) => !s.scheduleEnabled || !s.scheduleTimes?.length);
    }

    if (q) {
      list = list.filter(
        (s) =>
          (s.datasetName || '').toLowerCase().includes(q) ||
          (s.workspaceName || '').toLowerCase().includes(q) ||
          (s.configuredBy || '').toLowerCase().includes(q),
      );
    }
    return list;
  });

  filteredJobs = computed(() => {
    const q = this.jobSearch().toLowerCase().trim();
    const list = this.jobs();
    if (!q) return list;
    return list.filter(
      (j) =>
        (j.name || '').toLowerCase().includes(q) ||
        (j.report_name || '').toLowerCase().includes(q) ||
        (j.target_table || '').toLowerCase().includes(q) ||
        (j.recipients || '').toLowerCase().includes(q) ||
        (j.mode || '').toLowerCase().includes(q),
    );
  });

  filteredRuns = computed(() => {
    const q = this.runSearch().toLowerCase().trim();
    const list = this.runs();
    if (!q) return list;
    return list.filter(
      (r) =>
        (r.request || '').toLowerCase().includes(q) ||
        (r.target_table || '').toLowerCase().includes(q) ||
        (r.status || '').toLowerCase().includes(q),
    );
  });

  pagedRefreshes = computed(() => {
    const start = this.refreshPage() * this.refreshPageSize;
    return this.filteredRefreshes().slice(start, start + this.refreshPageSize);
  });

  pagedJobs = computed(() => {
    const start = this.jobPage() * this.pageSize;
    return this.filteredJobs().slice(start, start + this.pageSize);
  });

  pagedRuns = computed(() => {
    const start = this.runPage() * this.pageSize;
    return this.filteredRuns().slice(start, start + this.pageSize);
  });

  constructor(
    private api: SyncApiService,
    private toast: ToastService,
  ) {}

  ngOnInit() {
    this.load();
  }

  onSearchChange(val: string) {
    this.refreshSearch.set(val);
    this.refreshPage.set(0);
  }

  onJobSearchChange(val: string) {
    this.jobSearch.set(val);
    this.jobPage.set(0);
  }

  onRunSearchChange(val: string) {
    this.runSearch.set(val);
    this.runPage.set(0);
  }

  formatScheduleDays(days: string[]): string {
    if (!days || days.length === 0) return 'Daily';
    if (days.length === 7) return 'Daily';
    if (days.length === 5 && !days.includes('Saturday') && !days.includes('Sunday')) return 'Weekdays (Mon-Fri)';
    return days.map((d) => d.slice(0, 3)).join(', ');
  }

  load() {
    this.api.jobs().subscribe({
      next: (j) => this.jobs.set(j),
      error: (e) => this.toast.error(this.msg(e)),
    });
    this.api.runs().subscribe({
      next: (r) => this.runs.set(r),
      error: () => {},
    });
    this.loadRefreshSchedules();
  }

  loadRefreshSchedules() {
    this.loadingRefreshes.set(true);
    this.api.refreshSchedules().subscribe({
      next: (data) => {
        this.refreshSchedules.set(data || []);
        this.loadingRefreshes.set(false);
      },
      error: (err) => {
        this.loadingRefreshes.set(false);
        this.toast.error(this.msg(err));
      },
    });
  }

  run(j: Job) {
    this.busy.set(true);
    this.running.set(j.id);
    this.api.runJob(j.id).subscribe({
      next: (res) => {
        this.done();
        const emailMsg = res?.emailedTo ? ` & emailed report to ${res.emailedTo}` : '';
        this.toast.success(`"${j.name}" wrote ${res.rowsWritten} row(s)${emailMsg}.`);
      },
      error: (e) => {
        this.done();
        this.toast.error(this.msg(e));
      },
    });
  }

  remove(j: Job) {
    this.busy.set(true);
    this.api.deleteJob(j.id).subscribe({
      next: () => {
        this.done();
        this.toast.success(`Deleted "${j.name}".`);
      },
      error: (e) => {
        this.done();
        this.toast.error(this.msg(e));
      },
    });
  }

  private done() {
    this.busy.set(false);
    this.running.set(null);
    this.load();
  }
  private msg(e: any): string {
    return e?.error?.message || e?.message || 'Request failed';
  }
}
