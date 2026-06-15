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
    <div class="row-between">
      <h2>Saved jobs</h2>
      <button class="secondary" (click)="load()" [disabled]="busy()">Refresh</button>
    </div>
    <p class="muted">
      Saved from the Reports tab. Run one on demand, or let its cron schedule run it.
    </p>

    <div class="card" *ngFor="let j of pagedJobs()">
      <div class="row-between">
        <div>
          <strong>{{ j.name }}</strong>
          <span class="badge" [class.badge-ok]="j.mode === 'upsert'" [class.badge-no]="j.mode === 'append'">
            {{ j.mode }}
          </span>
          <span class="badge badge-ok" *ngIf="j.cron">⏱ {{ j.cron }}</span>
          <div class="tag">
            {{ j.report_name }} · {{ j.source_table }} → {{ j.target_table }} ·
            {{ j.columns.length }} cols
            <ng-container *ngIf="j.business_keys?.length">· key: {{ j.business_keys?.join(' + ') }}</ng-container>
          </div>
          <div class="tag" *ngIf="j.last_run_at">
            last run: {{ j.last_run_at | date: 'short' }} ·
            <span [class]="'status-' + j.last_status">{{ j.last_status }}</span>
            <ng-container *ngIf="j.last_rows != null"> · {{ j.last_rows }} rows</ng-container>
          </div>
        </div>
        <div style="display:flex;gap:6px;">
          <button (click)="run(j)" [disabled]="busy()">
            <span *ngIf="running() === j.id" class="spinner"></span> Run now
          </button>
          <button class="secondary danger" (click)="remove(j)" [disabled]="busy()">Delete</button>
        </div>
      </div>
    </div>
    <div class="card" *ngIf="jobs().length === 0">
      <span class="muted">No jobs yet — save one from the Reports &amp; upload tab.</span>
    </div>
    <app-pager [page]="jobPage()" [total]="jobs().length" [pageSize]="pageSize"
               (go)="jobPage.set($event)"></app-pager>

    <h2>Run history</h2>
    <div class="card">
      <table>
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
          <tr *ngIf="runs().length === 0"><td colspan="5" class="muted">No runs yet.</td></tr>
        </tbody>
      </table>
      <app-pager [page]="runPage()" [total]="runs().length" [pageSize]="pageSize"
                 (go)="runPage.set($event)"></app-pager>
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
