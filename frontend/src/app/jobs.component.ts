import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SyncApiService, Job, SyncRun, DatasetRefreshInfo } from './sync.service';
import { ToastService } from './toast.service';
import { PagerComponent } from './pager.component';

@Component({
  selector: 'app-jobs',
  standalone: true,
  imports: [CommonModule, FormsModule, PagerComponent],
  template: `
    <!-- Top Action Bar -->
    <div class="card row-between" style="padding: 16px 24px; margin-bottom: 24px; display: flex; align-items: center;">
      <div>
        <h3 style="margin: 0;">Scheduled Jobs &amp; Automation</h3>
        <p class="muted" style="margin: 4px 0 0 0; font-size: 13px;">
          Manage recurring background sync jobs and export schedules.
        </p>
      </div>
      <button class="btn-secondary" (click)="load()" [disabled]="busy() || loadingRefreshes()">
        <span *ngIf="busy() || loadingRefreshes()" class="spinner"></span> Refresh
      </button>
    </div>

    <!-- Power BI Refresh Schedules Reference Card -->
    <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 32px;">
      <div style="padding: 16px 24px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; background: var(--card);">
        <div>
          <h4 style="margin: 0; font-size: 15px; font-weight: 700; color: var(--text);">Power BI Dataset Refresh Times &amp; Schedules</h4>
          <p class="muted" style="margin: 3px 0 0 0; font-size: 12px;">
            Reference when Power BI datasets refresh so you can schedule sync jobs after refresh completes to avoid job crashes.
          </p>
        </div>
        <div style="display: flex; gap: 10px; align-items: center;">
          <input
            [ngModel]="refreshSearch()"
            (ngModelChange)="onSearchChange($event)"
            placeholder="Search dataset or workspace..."
            style="font-size: 12px; padding: 6px 12px; min-width: 220px;"
          />
          <span class="tag" *ngIf="refreshSchedules().length > 0">{{ filteredRefreshes().length }} dataset(s)</span>
        </div>
      </div>

      <table style="margin: 0;">
        <thead>
          <tr>
            <th>Workspace</th>
            <th>Dataset / Dashboard</th>
            <th>Power BI Refresh Schedule</th>
            <th>Last Refresh &amp; Status</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let s of pagedRefreshes()">
            <td style="font-weight: 600; font-size: 12px; color: var(--text); white-space: nowrap;">
              {{ s.workspaceName }}
            </td>
            <td>
              <div style="font-weight: 600; font-size: 13px; color: var(--text);">{{ s.datasetName }}</div>
              <div class="muted" style="font-size: 11px;" *ngIf="s.configuredBy">Owner: {{ s.configuredBy }}</div>
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
          <tr *ngIf="pagedRefreshes().length === 0 && !loadingRefreshes()">
            <td colspan="4" class="placeholder" style="padding: 24px;">No matching dataset refresh schedules found.</td>
          </tr>
          <tr *ngIf="loadingRefreshes()">
            <td colspan="4" class="placeholder" style="padding: 24px;">
              <span class="spinner"></span> Loading Power BI dataset refresh times...
            </td>
          </tr>
        </tbody>
      </table>
      <div style="padding: 14px 24px;" *ngIf="filteredRefreshes().length > refreshPageSize">
        <app-pager
          [page]="refreshPage()"
          [total]="filteredRefreshes().length"
          [pageSize]="refreshPageSize"
          (go)="refreshPage.set($event)"
        ></app-pager>
      </div>
    </div>

    <!-- Active Scheduled Jobs Card -->
    <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 32px;">
      <div style="padding: 16px 24px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between;">
        <h4 style="margin: 0; font-size: 15px; font-weight: 700; color: var(--text);">Active Automation Jobs</h4>
        <span class="tag" *ngIf="jobs().length > 0">{{ jobs().length }} job(s) configured</span>
      </div>
      <table style="margin: 0;">
        <thead>
          <tr>
            <th>Job Name</th>
            <th>Type &amp; Schedule</th>
            <th>Target Table</th>
            <th>Last Run</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let j of pagedJobs()">
            <td>
              <div style="font-weight: 600;">{{ j.name }}</div>
              <div class="tag" *ngIf="j.recipients" style="margin-top:3px; color:var(--accent); font-size:11px;" [title]="'Recipients: ' + j.recipients">
                {{ j.recipients }}
              </div>
            </td>
            <td>
              <span class="badge" [class.badge-ok]="j.mode === 'upsert'" [class.badge-no]="j.mode === 'append'">{{ j.mode }}</span>
              <span class="badge badge-ok" *ngIf="j.cron">{{ j.cron }}</span>
              <span class="badge" *ngIf="!j.cron">manual</span>
            </td>
            <td>
              <div class="tag">{{ j.report_name }} &rarr; {{ j.target_table }}</div>
            </td>
            <td>
              <div class="tag" *ngIf="j.last_run_at">
                {{ j.last_run_at | date: 'short' }} · <span [class]="'status-' + j.last_status">{{ j.last_status }}</span>
              </div>
              <div class="muted" *ngIf="!j.last_run_at">Never</div>
            </td>
            <td>
              <div style="display:flex;gap:6px;">
                <button (click)="run(j)" [disabled]="busy()">
                  <span *ngIf="running() === j.id" class="spinner"></span> Run
                </button>
                <button class="btn-secondary danger" (click)="remove(j)" [disabled]="busy()">Delete</button>
              </div>
            </td>
          </tr>
          <tr *ngIf="jobs().length === 0">
            <td colspan="5" class="placeholder" style="padding: 24px;">No scheduled automation jobs configured yet.</td>
          </tr>
        </tbody>
      </table>
      <div style="padding: 16px 24px;" *ngIf="jobs().length > pageSize">
        <app-pager [page]="jobPage()" [total]="jobs().length" [pageSize]="pageSize"
                   (go)="jobPage.set($event)"></app-pager>
      </div>
    </div>

    <!-- Execution Run History Card -->
    <div class="card row-between" style="padding: 16px 24px; margin-bottom: 24px; display: flex; align-items: center;">
      <h4 style="margin: 0; font-size: 15px; font-weight: 700; color: var(--text);">Run History</h4>
    </div>
    <div class="card" style="padding: 0; overflow: hidden;">
      <table style="margin: 0;">
        <thead>
          <tr><th>Request</th><th>Table</th><th>Rows</th><th>Status</th><th>When</th></tr>
        </thead>
        <tbody>
          <tr *ngFor="let r of pagedRuns()">
            <td>{{ r.request }}</td>
            <td>{{ r.target_table }}</td>
            <td>{{ r.rows_written }}</td>
            <td [class]="'status-' + r.status">
              {{ r.status }}<span class="tag" *ngIf="r.error"> — {{ r.error }}</span>
            </td>
            <td class="muted">{{ r.started_at | date: 'short' }}</td>
          </tr>
          <tr *ngIf="runs().length === 0"><td colspan="5" class="placeholder" style="padding: 24px;">No runs yet.</td></tr>
        </tbody>
      </table>
      <div style="padding: 16px 24px;" *ngIf="runs().length > pageSize">
        <app-pager [page]="runPage()" [total]="runs().length" [pageSize]="pageSize"
                   (go)="runPage.set($event)"></app-pager>
      </div>
    </div>
  `,
})
export class JobsComponent implements OnInit {
  jobs = signal<Job[]>([]);
  runs = signal<SyncRun[]>([]);
  refreshSchedules = signal<DatasetRefreshInfo[]>([]);
  loadingRefreshes = signal(false);
  refreshSearch = signal('');

  busy = signal(false);
  running = signal<number | null>(null);

  pageSize = 7;
  jobPage = signal(0);
  runPage = signal(0);

  refreshPageSize = 8;
  refreshPage = signal(0);

  filteredRefreshes = computed(() => {
    const q = this.refreshSearch().toLowerCase().trim();
    const list = this.refreshSchedules();
    if (!q) return list;
    return list.filter(
      (s) =>
        s.datasetName.toLowerCase().includes(q) ||
        s.workspaceName.toLowerCase().includes(q) ||
        (s.configuredBy && s.configuredBy.toLowerCase().includes(q)),
    );
  });

  pagedRefreshes = computed(() => {
    const start = this.refreshPage() * this.refreshPageSize;
    return this.filteredRefreshes().slice(start, start + this.refreshPageSize);
  });

  pagedJobs = computed(() =>
    this.jobs().slice(this.jobPage() * this.pageSize, (this.jobPage() + 1) * this.pageSize),
  );
  pagedRuns = computed(() =>
    this.runs().slice(this.runPage() * this.pageSize, (this.runPage() + 1) * this.pageSize),
  );

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
