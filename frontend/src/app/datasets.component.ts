import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SyncApiService, DynamicDataset } from './sync.service';
import { ToastService } from './toast.service';
import { PagerComponent } from './pager.component';
import { EmailPickerComponent } from './email-picker.component';

@Component({
  selector: 'app-datasets',
  standalone: true,
  imports: [CommonModule, FormsModule, PagerComponent, EmailPickerComponent],
  styles: [`
    :host {
      display: block;
    }

    .datasets-header-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 16px 20px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }

    .search-dataset-input {
      height: 36px;
      padding: 0 12px;
      border: 1px solid var(--border2);
      border-radius: var(--radius-xs);
      font-size: 13px;
      outline: none;
      min-width: 260px;
      color: var(--text);
    }

    .search-dataset-input:focus {
      border-color: var(--accent);
    }

    .dataset-table-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      overflow: hidden;
      box-shadow: var(--shadow-xs);
      margin-bottom: 20px;
    }

    .dataset-table {
      width: 100%;
      border-collapse: collapse;
      margin: 0;
      font-size: 13px;
    }

    .dataset-table th {
      background: #eff6ff;
      color: #1e40af;
      font-weight: 700;
      font-size: 12.5px;
      padding: 10px 16px;
      border-bottom: 1.5px solid #bfdbfe;
      text-align: left;
      white-space: nowrap;
    }

    .dataset-table td {
      padding: 12px 16px;
      border-bottom: 1px solid #f1f5f9;
      color: var(--text);
      vertical-align: middle;
    }

    .dataset-table tbody tr:hover td {
      background: #f8fafc;
    }

    .dataset-title {
      font-weight: 700;
      font-size: 13.5px;
      color: #0f172a;
      line-height: 1.3;
    }

    .dataset-sub {
      font-size: 11.5px;
      color: var(--muted);
      margin-top: 3px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .dataset-actions {
      display: flex;
      gap: 6px;
      justify-content: flex-end;
      align-items: center;
    }

    .btn-action-mini {
      background: var(--card);
      border: 1px solid var(--border2);
      border-radius: var(--radius-xs);
      padding: 5px 10px;
      font-size: 12px;
      font-weight: 600;
      color: var(--text);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      transition: all 0.12s;
      text-decoration: none;
      white-space: nowrap;
    }

    .btn-action-mini:hover:not(:disabled) {
      background: var(--bg);
      border-color: var(--accent);
      color: var(--accent);
    }

    .btn-action-mini.active-email {
      background: #eff6ff;
      border-color: #2563eb;
      color: #1d4ed8;
    }

    .email-drawer-box {
      background: #f8fafc;
      border: 1.5px solid #dbeafe;
      border-radius: var(--radius-sm);
      padding: 12px 16px;
      margin-top: 10px;
    }

    .preview-box {
      margin-top: 12px;
      border: 1.5px solid #93c5fd;
      border-radius: var(--radius-sm);
      overflow: auto;
      max-height: 320px;
      background: #ffffff;
    }
  `],
  template: `
    <!-- Top Filter & Action Bar -->
    <div class="datasets-header-card">
      <div style="display:flex; align-items:center; gap:12px; flex:1; min-width:280px;">
        <input
          class="search-dataset-input"
          placeholder="Search stored dataset or table name…"
          [ngModel]="searchQuery()"
          (ngModelChange)="searchQuery.set($event)"
        />
        <span class="tag" *ngIf="datasets().length > 0">
          {{ filteredDatasets().length }} of {{ datasets().length }} dataset(s)
        </span>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn-secondary" (click)="loadDatasets()" [disabled]="busy()">
          <span *ngIf="busy()" class="spinner"></span> Refresh
        </button>
      </div>
    </div>

    <!-- Clean Structured Datasets Table -->
    <div class="dataset-table-card">
      <table class="dataset-table">
        <thead>
          <tr>
            <th style="width: 44%;">Dataset / Report Name</th>
            <th style="width: 14%;">Type &amp; Status</th>
            <th style="width: 14%; text-align: center;">Rows Stored</th>
            <th style="width: 28%; text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          <ng-container *ngFor="let d of pagedDatasets()">
            <tr>
              <td>
                <div class="dataset-title">{{ d.label }}</div>
                <div class="dataset-sub">
                  <span class="tag" style="font-family: monospace; font-size: 11px;">{{ d.table_name }}</span>
                </div>
              </td>
              <td>
                <div style="display: flex; gap: 4px; align-items: center;">
                  <span class="badge badge-ok" style="font-size: 10px;">{{ d.kind }}</span>
                  <span class="badge badge-no" style="font-size: 10px;" *ngIf="d.locked">locked</span>
                </div>
              </td>
              <td style="text-align: center;">
                <strong style="font-size: 13.5px; font-variant-numeric: tabular-nums;">
                  {{ (d.last_rows || 0) | number }}
                </strong>
                <span class="muted" style="font-size: 11px; margin-left: 2px;">rows</span>
              </td>
              <td>
                <div class="dataset-actions">
                  <button
                    class="btn-action-mini"
                    (click)="preview(d.table_name)"
                    [class.active-email]="previewTable() === d.table_name"
                    [disabled]="busy()"
                  >
                    {{ previewTable() === d.table_name ? 'Close Preview' : 'Preview' }}
                  </button>
                  <a class="btn-action-mini" [href]="api.exportUrl(d.table_name)">
                    Export CSV
                  </a>
                  <button
                    class="btn-action-mini"
                    [class.active-email]="activeEmailTable() === d.table_name"
                    (click)="toggleEmailDrawer(d.table_name)"
                  >
                    Email Excel
                  </button>
                </div>
              </td>
            </tr>

            <!-- Inline Email Drawer Row (Expanded on Demand) -->
            <tr *ngIf="activeEmailTable() === d.table_name">
              <td colspan="4" style="background: #f8fafc; padding: 12px 16px; border-bottom: 1.5px solid #dbeafe;">
                <div class="email-drawer-box">
                  <div class="row-between" style="margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <strong style="font-size: 12.5px; color: #1e3a8a;">Email Excel Report - {{ d.label }}</strong>
                      <span class="badge badge-ok" style="font-size: 10px;">Direct Dispatch</span>
                    </div>
                    <button class="btn-secondary" style="font-size: 11px; padding: 2px 6px;" (click)="activeEmailTable.set('')">Close</button>
                  </div>
                  <div style="margin-bottom: 8px;">
                    <app-email-picker
                      [(recipients)]="datasetEmails[d.table_name]"
                      [placeholder]="'Select Azure AD recipients or enter custom email...'"
                    ></app-email-picker>
                  </div>
                  <div class="row-between" style="margin-top: 8px;">
                    <span class="muted" style="font-size: 11px;">Generates fresh spreadsheet from stored data</span>
                    <button
                      class="btn-primary"
                      style="font-size: 12px; padding: 5px 14px;"
                      (click)="sendEmail(d.table_name)"
                      [disabled]="busy() || !datasetEmails[d.table_name]"
                    >
                      <span *ngIf="busy()" class="spinner-white"></span> Send Excel Now
                    </button>
                  </div>
                </div>
              </td>
            </tr>

            <!-- Inline Preview Drawer Row (Expanded on Demand) -->
            <tr *ngIf="previewTable() === d.table_name">
              <td colspan="4" style="background: #ffffff; padding: 12px 16px; border-bottom: 1.5px solid #93c5fd;">
                <div class="row-between" style="margin-bottom: 6px;">
                  <strong style="font-size: 12px; color: #1e3a8a;">Previewing first 100 rows of {{ d.table_name }}</strong>
                  <button class="btn-secondary" style="font-size: 11px; padding: 2px 6px;" (click)="previewTable.set('')">Hide</button>
                </div>
                <div class="preview-box">
                  <table style="margin: 0;">
                    <thead>
                      <tr><th *ngFor="let c of previewCols()">{{ c }}</th></tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let row of previewRows()"><td *ngFor="let c of previewCols()">{{ row[c] }}</td></tr>
                    </tbody>
                  </table>
                </div>
              </td>
            </tr>
          </ng-container>

          <tr *ngIf="filteredDatasets().length === 0 && !busy()">
            <td colspan="4" class="placeholder" style="padding: 32px; text-align: center; color: var(--muted);">
              No stored datasets found matching "{{ searchQuery() }}".
            </td>
          </tr>
        </tbody>
      </table>

      <div style="padding: 14px 20px; border-top: 1px solid #eff6ff;" *ngIf="filteredDatasets().length > pageSize">
        <app-pager
          [page]="dsPage()"
          [total]="filteredDatasets().length"
          [pageSize]="pageSize"
          (go)="dsPage.set($event)"
        ></app-pager>
      </div>
    </div>
  `,
})
export class DatasetsComponent implements OnInit {
  busy = signal(false);
  datasets = signal<DynamicDataset[]>([]);
  datasetEmails: Record<string, string> = {};
  searchQuery = signal('');
  activeEmailTable = signal('');
  dsPage = signal(0);
  pageSize = 8;
  previewTable = signal('');
  previewCols = signal<string[]>([]);
  previewRows = signal<any[]>([]);

  filteredDatasets = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const all = this.datasets();
    if (!q) return all;
    return all.filter(
      (d) =>
        (d.label || '').toLowerCase().includes(q) ||
        (d.table_name || '').toLowerCase().includes(q) ||
        (d.kind || '').toLowerCase().includes(q),
    );
  });

  pagedDatasets = computed(() => {
    const list = this.filteredDatasets();
    return list.slice(this.dsPage() * this.pageSize, (this.dsPage() + 1) * this.pageSize);
  });

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
        this.datasets.set(d || []);
        this.dsPage.set(0);
        this.busy.set(false);
      },
      error: (e) => {
        this.busy.set(false);
        this.toast.error(e?.error?.message || e?.message || 'Failed to load datasets');
      },
    });
  }

  toggleEmailDrawer(table: string) {
    if (this.activeEmailTable() === table) {
      this.activeEmailTable.set('');
    } else {
      this.activeEmailTable.set(table);
    }
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
        this.toast.success(`Successfully emailed ${table} to ${recipients.join(', ')}`);
        this.datasetEmails[table] = '';
        this.activeEmailTable.set('');
      },
      error: (e) => {
        this.busy.set(false);
        this.toast.error(e?.error?.message || e?.message || 'Failed to send email');
      },
    });
  }
}
