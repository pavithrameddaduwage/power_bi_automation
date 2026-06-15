import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  SyncApiService,
  ReportWithAccess,
  Dashboard,
} from './sync.service';
import { PagerComponent } from './pager.component';

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule, PagerComponent],
  template: `
    <div class="row-between">
      <h2>Dashboards</h2>
      <button class="secondary" (click)="load()" [disabled]="loading()">
        {{ loading() ? 'Loading…' : 'Refresh' }}
      </button>
    </div>
    <div class="card">
      <table>
        <thead>
          <tr><th>Dashboard</th><th>Workspace</th></tr>
        </thead>
        <tbody>
          <tr *ngFor="let d of dashboards()">
            <td>{{ d.displayName }}</td>
            <td class="muted">{{ d.groupName }}</td>
          </tr>
          <tr *ngIf="dashboards().length === 0">
            <td colspan="2" class="muted">
              No dashboards in this tenant — everything is a report (below).
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="row-between">
      <h2>Reports &amp; access</h2>
      <label class="muted" style="display:flex;gap:6px;align-items:center;">
        <input type="checkbox" [(ngModel)]="downloadableOnly" (change)="load()" />
        downloadable only
      </label>
    </div>

    <p class="muted" *ngIf="reports().length">
      {{ reports().length }} report(s){{ downloadableOnly ? ' in downloadable mode' : '' }}.
      Access is the workspace role; <strong>green = can download/export</strong>.
    </p>

    <app-pager [page]="page()" [total]="reports().length" [pageSize]="pageSize"
               (go)="page.set($event)"></app-pager>

    <div class="card" *ngFor="let r of pagedReports()">
      <div class="row-between">
        <div>
          <strong>{{ r.name }}</strong>
          <span class="badge" [class.badge-ok]="r.downloadable"
                [class.badge-no]="!r.downloadable">
            {{ r.downloadable ? 'downloadable' : 'not downloadable' }}
          </span>
          <div class="tag">
            {{ r.workspaceName }} · {{ r.reportType }}
            <a *ngIf="r.webUrl" [href]="r.webUrl" target="_blank">open ↗</a>
          </div>
        </div>
      </div>
      <table style="margin-top:10px;">
        <thead>
          <tr><th>Who has access</th><th>Role</th><th>Download?</th></tr>
        </thead>
        <tbody>
          <tr *ngFor="let a of r.access">
            <td>{{ a.name }} <span class="tag" *ngIf="a.email">&lt;{{ a.email }}&gt;</span></td>
            <td>{{ a.role }}</td>
            <td [class]="a.canDownload ? 'status-success' : 'muted'">
              {{ a.canDownload ? 'yes' : 'view only' }}
            </td>
          </tr>
          <tr *ngIf="r.access.length === 0">
            <td colspan="3" class="muted">No access info (admin API disabled).</td>
          </tr>
        </tbody>
      </table>
    </div>

    <app-pager [page]="page()" [total]="reports().length" [pageSize]="pageSize"
               (go)="page.set($event)"></app-pager>

    <div class="card" *ngIf="error()">
      <span class="status-error">{{ error() }}</span>
    </div>
  `,
})
export class CatalogComponent implements OnInit {
  dashboards = signal<Dashboard[]>([]);
  reports = signal<ReportWithAccess[]>([]);
  loading = signal(false);
  error = signal('');
  downloadableOnly = false;
  page = signal(0);
  pageSize = 7;

  pagedReports = computed(() =>
    this.reports().slice(this.page() * this.pageSize, (this.page() + 1) * this.pageSize),
  );

  constructor(private api: SyncApiService) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.page.set(0);
    this.api.dashboards().subscribe({
      next: (d) => this.dashboards.set(d),
      error: (e) => this.error.set(this.msg(e)),
    });
    this.api.catalogReports(this.downloadableOnly).subscribe({
      next: (r) => {
        this.reports.set(r);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(this.msg(e));
        this.loading.set(false);
      },
    });
  }

  private msg(e: any): string {
    return e?.error?.message || e?.message || 'Request failed';
  }
}
