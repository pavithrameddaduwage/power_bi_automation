import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SyncApiService, Job, SyncRun } from './sync.service';
import { ToastService } from './toast.service';
import { PagerComponent } from './pager.component';

@Component({
  selector: 'app-jobs',
  standalone: true,
  imports: [CommonModule, PagerComponent],
  template: `
    <div class="card" style="padding: 16px 24px; margin-bottom: 24px; display: flex; align-items: center; justify-content: flex-end;">
      <button class="btn-secondary" (click)="load()" [disabled]="busy()">Refresh</button>
    </div>

    <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 32px;">
      <table style="margin: 0;">
        <thead>
          <tr>
            <th>Job Name</th>
            <th>Type & Schedule</th>
            <th>Target Table</th>
            <th>Last Run</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let j of pagedJobs()">
            <td style="font-weight: 600;">{{ j.name }}</td>
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
            <td colspan="5" class="placeholder" style="padding: 24px;">No jobs yet.</td>
          </tr>
        </tbody>
      </table>
      <div style="padding: 16px 24px;" *ngIf="jobs().length > 0">
        <app-pager [page]="jobPage()" [total]="jobs().length" [pageSize]="pageSize"
                   (go)="jobPage.set($event)"></app-pager>
      </div>
    </div>

    <div class="card row-between" style="padding: 16px 24px; margin-bottom: 24px; display: flex; align-items: center;">
      <h3 style="margin: 0;">Run history</h3>
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
      <div style="padding: 16px 24px;">
        <app-pager [page]="runPage()" [total]="runs().length" [pageSize]="pageSize"
                   (go)="runPage.set($event)"></app-pager>
      </div>
    </div>
  `,
})
export class JobsComponent implements OnInit {
  jobs = signal<Job[]>([]);
  runs = signal<SyncRun[]>([]);
  busy = signal(false);
  running = signal<number | null>(null);
  pageSize = 7;
  jobPage = signal(0);
  runPage = signal(0);

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

  load() {
    this.api.jobs().subscribe({
      next: (j) => this.jobs.set(j),
      error: (e) => this.toast.error(this.msg(e)),
    });
    this.api.runs().subscribe({
      next: (r) => this.runs.set(r),
      error: () => {},
    });
  }

  run(j: Job) {
    this.busy.set(true);
    this.running.set(j.id);
    this.api.runJob(j.id).subscribe({
      next: (res) => {
        this.done();
        this.toast.success(`"${j.name}" wrote ${res.rowsWritten} row(s).`);
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
