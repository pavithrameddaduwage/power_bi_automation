import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SyncApiService, DynamicDataset } from './sync.service';
import { ToastService } from './toast.service';
import { PagerComponent } from './pager.component';

@Component({
  selector: 'app-datasets',
  standalone: true,
  imports: [CommonModule, FormsModule, PagerComponent],
  template: `
    <div style="display:flex; justify-content:flex-end; margin-bottom: 16px;">
      <button class="btn-secondary" (click)="loadDatasets()" [disabled]="busy()">Refresh</button>
    </div>

    <div class="card" *ngFor="let d of pagedDatasets()" style="margin-bottom: 16px;">
      <div class="row-between">
        <div>
          <strong>{{ d.label }}</strong>
          <span class="badge badge-ok" style="margin-left: 8px;">{{ d.kind }}</span>
          <span class="badge badge-no" style="margin-left: 4px;" *ngIf="d.locked">locked</span>
          <div class="tag" style="margin-top: 4px;">table: {{ d.table_name }} · {{ d.last_rows }} rows</div>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <a class="btn-secondary" style="text-decoration: none; display: inline-flex; align-items: center;" [href]="api.exportUrl(d.table_name)">Export CSV</a>
          <button class="btn-secondary" (click)="preview(d.table_name)" [disabled]="busy()">Preview</button>
        </div>
      </div>
      <div style="margin-top: 12px; display: flex; gap: 8px; align-items: center;">
        <input style="flex: 1" placeholder="Email recipients (comma separated)" [(ngModel)]="datasetEmails[d.table_name]" />
        <button class="btn-secondary" (click)="sendEmail(d.table_name)" [disabled]="busy() || !datasetEmails[d.table_name]">Send Excel via Email</button>
      </div>
      <div *ngIf="previewTable() === d.table_name" class="table-container" style="overflow: auto; margin-top: 12px;">
        <table>
          <thead>
            <tr><th *ngFor="let c of previewCols()">{{ c }}</th></tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of previewRows()"><td *ngFor="let c of previewCols()">{{ row[c] }}</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <app-pager [page]="dsPage()" [total]="datasets().length" [pageSize]="pageSize"
               (go)="dsPage.set($event)"></app-pager>

    <div class="card" *ngIf="datasets().length === 0"><span class="muted">No datasets stored yet.</span></div>
  `,
})
export class DatasetsComponent implements OnInit {
  busy = signal(false);
  datasets = signal<DynamicDataset[]>([]);
  datasetEmails: Record<string, string> = {};
  dsPage = signal(0);
  pageSize = 7;
  previewTable = signal('');
  previewCols = signal<string[]>([]);
  previewRows = signal<any[]>([]);

  pagedDatasets = computed(() =>
    this.datasets().slice(this.dsPage() * this.pageSize, (this.dsPage() + 1) * this.pageSize),
  );

  constructor(
    public api: SyncApiService,
    private toast: ToastService,
  ) {}

  ngOnInit() {
    this.loadDatasets();
  }

  loadDatasets() {
    this.busy.set(true);
    this.api.datasets().subscribe({
      next: (d) => {
        this.datasets.set(d);
        this.dsPage.set(0);
        this.busy.set(false);
      },
      error: (e) => {
        this.busy.set(false);
        this.toast.error(e?.error?.message || e?.message || 'Failed to load datasets');
      },
    });
  }

  preview(table: string) {
    if (this.previewTable() === table) {
      this.previewTable.set('');
      return;
    }
    this.busy.set(true);
    this.api.datasetRows(table, 100).subscribe({
      next: (rows) => {
        this.previewTable.set(table);
        this.previewRows.set(rows);
        this.previewCols.set(rows.length ? Object.keys(rows[0]) : []);
        this.busy.set(false);
      },
      error: (e) => {
        this.busy.set(false);
        this.toast.error(e?.error?.message || e?.message || 'Failed to preview table');
      },
    });
  }

  sendEmail(table: string) {
    const recipientsStr = this.datasetEmails[table];
    if (!recipientsStr) return;
    const recipients = recipientsStr.split(',').map((e) => e.trim()).filter((e) => e);
    if (recipients.length === 0) return;
    this.busy.set(true);
    this.api.emailDataset(table, recipients, `Export of ${table}`).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.success(`Successfully sent ${table} to ${recipients.join(', ')}`);
        this.datasetEmails[table] = '';
      },
      error: (e) => {
        this.busy.set(false);
        this.toast.error(e?.error?.message || e?.message || 'Failed to send email');
      },
    });
  }
}
