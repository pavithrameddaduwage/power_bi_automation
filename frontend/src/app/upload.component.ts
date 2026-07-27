import { Component, Input, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  SyncApiService,
  DynamicDataset,
  ReportWithAccess,
  DatasetColumn,
  DatasetMeasure,
} from './sync.service';
import { ToastService } from './toast.service';
import { PagerComponent } from './pager.component';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule, FormsModule, PagerComponent],
  template: `
    <div class="wizard-header">
      <div class="step" [class.active]="currentStep() === 1" (click)="setStep(1)">
        <div class="step-num">1</div>
        <div class="step-label">Pick Report</div>
      </div>
      <div class="step" [class.active]="currentStep() === 2" [class.disabled]="!selectedReport()" (click)="selectedReport() && setStep(2)">
        <div class="step-num">2</div>
        <div class="step-label">Columns</div>
      </div>
      <div class="step" [class.active]="currentStep() === 3" [class.disabled]="!loadedRows().length && !loadedCols().length" (click)="(loadedRows().length || loadedCols().length) && setStep(3)">
        <div class="step-num">3</div>
        <div class="step-label">Data</div>
      </div>
      <div class="step" [class.active]="currentStep() === 4" [class.disabled]="!loadedRows().length && !loadedCols().length" (click)="(loadedRows().length || loadedCols().length) && setStep(4)">
        <div class="step-num">4</div>
        <div class="step-label">Database</div>
      </div>
      <div class="step" [class.active]="currentStep() === 5" [class.disabled]="!loadedRows().length && !loadedCols().length" (click)="(loadedRows().length || loadedCols().length) && setStep(5)">
        <div class="step-num">5</div>
        <div class="step-label">Schedule</div>
      </div>
    </div>

    <div class="wizard-body">
      <!-- STEP 1 -->
      <ng-container *ngIf="currentStep() === 1">
        <h2>1 Pick a report</h2>
        <div class="card">
          <input class="search" placeholder="Search reports by name or workspace…" [ngModel]="filter" (ngModelChange)="onFilterChange($event)" />
          <div class="report-list">
            <div
              *ngFor="let r of pagedReports()"
              class="report-row"
              [class.active]="selectedReport()?.id === r.id"
              (click)="pickReport(r)"
            >
              <span>{{ r.name }}</span>
              <span class="tag">{{ r.workspaceName }}</span>
            </div>
            <div *ngIf="filteredReports().length === 0" class="muted" style="padding:12px;">
              <span *ngIf="!reports().length" class="spinner"></span>
              {{ reports().length ? 'No match.' : 'Loading reports…' }}
            </div>
          </div>
          <app-pager [page]="repPage()" [total]="filteredReports().length" [pageSize]="pageSize"
                     (go)="repPage.set($event)"></app-pager>
        </div>
        
        <ng-container *ngIf="!finalOnly">
          <h2>Principals</h2>
          <div class="card">
            <div class="row-between">
              <strong>Sync principals (access) from Power BI</strong>
              <button class="btn-secondary" (click)="syncPrincipals()" [disabled]="busy()">Sync from Power BI</button>
            </div>
          </div>
        </ng-container>

        <div class="row-between" style="margin-top: 30px;">
          <h2>Stored datasets</h2>
          <button class="btn-secondary" (click)="loadDatasets()" [disabled]="busy()">Refresh</button>
        </div>
        <div class="card" *ngFor="let d of pagedDatasets()">
          <div class="row-between">
            <div>
              <strong>{{ d.label }}</strong>
              <span class="badge badge-ok">{{ d.kind }}</span>
              <span class="badge badge-no" *ngIf="d.locked">locked</span>
              <div class="tag">table: {{ d.table_name }} · {{ d.last_rows }} rows</div>
            </div>
            <div style="display:flex;gap:6px;">
              <a class="btn-secondary" style="text-decoration: none; display: inline-flex; align-items: center;" [href]="api.exportUrl(d.table_name)">Export CSV</a>
              <button class="btn-secondary" (click)="preview(d.table_name)" [disabled]="busy()">Preview</button>
            </div>
          </div>
          <div style="margin-top:12px; display:flex; gap:6px; align-items:center;">
            <input style="flex:1" placeholder="Email recipients (comma separated)" [(ngModel)]="datasetEmails[d.table_name]" />
            <button class="btn-secondary" (click)="sendEmail(d.table_name)" [disabled]="busy() || !datasetEmails[d.table_name]">Send Excel via Email</button>
          </div>
          <div *ngIf="previewTable() === d.table_name" style="overflow:auto;margin-top:10px;">
            <table>
              <thead><tr><th *ngFor="let c of previewCols()">{{ c }}</th></tr></thead>
              <tbody>
                <tr *ngFor="let row of previewRows()"><td *ngFor="let c of previewCols()">{{ row[c] }}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <app-pager [page]="dsPage()" [total]="datasets().length" [pageSize]="pageSize"
                   (go)="dsPage.set($event)"></app-pager>
        <div class="card" *ngIf="datasets().length === 0"><span class="muted">Nothing stored yet.</span></div>
      </ng-container>

      <!-- STEP 2 -->
      <ng-container *ngIf="currentStep() === 2 && selectedReport() as rep">
        <h2>2 Choose table &amp; columns</h2>
        <div class="card">
          <div *ngIf="loadingCols()" class="muted"><span class="spinner"></span> Loading columns…</div>
          <div *ngIf="colError()" class="status-error">{{ colError() }}</div>

          <label *ngIf="tables().length">
            {{ finalOnly ? 'Final report table — the combined output users download' : 'Tables connected to this report' }}
            ({{ tables().length }})
          </label>
          <input *ngIf="tables().length" class="search" placeholder="Search tables…"
                 [ngModel]="tableFilter()" (ngModelChange)="tableFilter.set($event)" />
          <div class="scroll-list" *ngIf="tables().length">
            <div
              *ngFor="let t of filteredTables()"
              class="report-row"
              [class.active]="activeTable() === t"
              (click)="setTable(t)"
            >
              <span>{{ t }}</span>
              <span class="tag">{{ columnCount(t) }} cols</span>
            </div>
            <div *ngIf="filteredTables().length === 0" class="muted" style="padding:12px;">No match.</div>
          </div>

          <ng-container *ngIf="activeColumns().length">
            <div class="row-between" style="margin-top:16px;">
              <label class="pick" style="margin:0;">
                <input type="checkbox" [checked]="allChecked()" (change)="toggleAll($event)" />
                Select all columns
              </label>
              <span class="tag">{{ selectedNames().length }} of {{ activeColumns().length }} selected · {{ activeTable() }}</span>
            </div>
            <input class="search" placeholder="Search columns…" [ngModel]="columnFilter()" (ngModelChange)="columnFilter.set($event)" />
            <div class="scroll-list">
              <table>
                <thead>
                  <tr>
                    <th style="width:40px;">Use</th>
                    <th>Column</th>
                    <th>Data type</th>
                    <th style="width:80px; text-align:center;">Key</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let c of filteredColumns()">
                    <td><input type="checkbox" [checked]="selected()[c.name]" (change)="toggle(c.name)" /></td>
                    <td>{{ c.name }} <span class="badge badge-ok" *ngIf="c.isKey">model key</span></td>
                    <td class="tag">{{ c.dataType }}</td>
                    <td style="text-align:center;">
                      <input type="checkbox" [checked]="keySelected()[c.name]"
                             (change)="toggleKeyCol(c.name)" title="use as upsert/primary key" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="tag" style="margin-top:6px;">
              Tick <strong>Key</strong> on the column(s) that uniquely identify a row — those become the
              upsert keys so re-syncs update instead of duplicate.
            </p>

            <div *ngIf="measures().length" class="measures-block">
              <div class="row-between">
                <strong>Measures — viewed separately ({{ measures().length }})</strong>
                <span class="tag">{{ selectedMeasureNames().length }} selected</span>
              </div>
              <p class="muted" style="margin:4px 0;">
                DAX calculations (totals, ratios, %). When ticked, the data is grouped by the
                columns above and these are computed per group.
              </p>
              <input class="search" placeholder="Search measures…" [ngModel]="measureFilter()" (ngModelChange)="measureFilter.set($event)" />
              <div class="scroll-list">
                <table>
                  <thead><tr><th style="width:40px;">Use</th><th>Measure</th><th>Type</th></tr></thead>
                  <tbody>
                    <tr *ngFor="let m of filteredMeasures()">
                      <td><input type="checkbox" [checked]="measureSelected()[m.name]" (change)="toggleMeasure(m.name)" /></td>
                      <td>{{ m.name }}</td>
                      <td class="tag">{{ m.dataType }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div *ngIf="dateColumns().length" style="margin-top:16px;">
              <label>Filter by date range (optional)</label>
              <div class="daterow">
                <select [ngModel]="dateColumn()" (ngModelChange)="dateColumn.set($event)">
                  <option value="">— no date filter —</option>
                  <option *ngFor="let c of dateColumns()" [value]="c.name">{{ c.name }}</option>
                </select>
                <label style="margin:0;">From
                  <input type="date" [ngModel]="dateFrom()" (ngModelChange)="dateFrom.set($event)" [disabled]="!dateColumn()" />
                </label>
                <label style="margin:0;">To
                  <input type="date" [ngModel]="dateTo()" (ngModelChange)="dateTo.set($event)" [disabled]="!dateColumn()" />
                </label>
              </div>
            </div>

            <div class="row-between" style="margin-top:14px;">
              <div style="display:flex;gap:16px;align-items:center;">
                <label class="pick" style="margin:0;">
                  <input type="checkbox" [ngModel]="allRows()" (ngModelChange)="allRows.set($event)" /> All rows
                </label>
                <label style="margin:0;" *ngIf="!allRows()">max rows
                  <input type="number" min="1" [(ngModel)]="limit" style="width:90px;" />
                </label>
              </div>
              <button class="btn-primary" (click)="sync()" [disabled]="busy() || (selectedNames().length === 0 && selectedMeasureNames().length === 0)">
                <span *ngIf="busy()" class="spinner-white"></span>
                {{ busy() ? 'Syncing…' : 'Sync from Power BI' }}
              </button>
            </div>
          </ng-container>
        </div>
        <div class="wizard-footer row-between">
          <button class="btn-secondary" (click)="setStep(1)">‹ Back</button>
          <button class="btn-primary" (click)="setStep(3)" [disabled]="!loadedRows().length && !loadedCols().length">Next ›</button>
        </div>
      </ng-container>

      <!-- STEP 3 -->
      <ng-container *ngIf="currentStep() === 3 && (loadedRows().length || loadedCols().length)">
        <h2>3 Synced data ({{ loadedRows().length }} rows)</h2>
        <div class="card">
          <div style="overflow:auto;">
            <table>
              <thead><tr><th *ngFor="let c of loadedCols()">{{ c }}</th></tr></thead>
              <tbody>
                <tr *ngFor="let row of pagedRows()">
                  <td *ngFor="let c of loadedCols()">{{ row[c] }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="row-between" *ngIf="pageCount() > 1">
            <span class="tag">page {{ page() + 1 }} / {{ pageCount() }}</span>
            <div style="display:flex;gap:6px;">
              <button class="btn-secondary" (click)="prevPage()" [disabled]="page() === 0">‹ Prev</button>
              <button class="btn-secondary" (click)="nextPage()" [disabled]="page() + 1 >= pageCount()">Next ›</button>
            </div>
          </div>
        </div>
        <div class="wizard-footer row-between">
          <button class="btn-secondary" (click)="setStep(2)">‹ Back</button>
          <button class="btn-primary" (click)="setStep(4)">Next ›</button>
        </div>
      </ng-container>

      <!-- STEP 4 -->
      <ng-container *ngIf="currentStep() === 4 && (loadedRows().length || loadedCols().length)">
        <h2>4 Write to database</h2>
        <div class="card">
          <div class="grid2">
            <label>Table name in database
              <input [(ngModel)]="tableName" placeholder="e.g. inventory_bins" />
            </label>
            <label>Owner
              <input [(ngModel)]="owner" placeholder="your name" />
            </label>
          </div>

          <label>Write mode</label>
          <div class="modes">
            <label class="pick"><input type="radio" name="mode" value="append" [(ngModel)]="mode" /> Append (add rows)</label>
            <label class="pick"><input type="radio" name="mode" value="upsert" [(ngModel)]="mode" /> Upsert (update matching rows)</label>
          </div>

          <div class="warn" *ngIf="mode === 'append'">
            ⚠ Append inserts every row on each run — re-running or scheduling this
            <strong>duplicates</strong> the data. Pick Upsert + a business key to update in place.
          </div>

          <div *ngIf="mode === 'upsert'" style="margin-top:10px;">
            <label>Upsert keys{{ autoKeyNote() }}</label>
            <div class="keychips">
              <span class="chip" *ngFor="let n of selectedKeyNames()">{{ n }}</span>
              <span class="muted" *ngIf="selectedKeyNames().length === 0">
                No keys ticked — tick the “Key” box on the column(s) above.
              </span>
            </div>
          </div>

          <div class="warn" *ngIf="targetLocked()">
            The table has been created and cannot be edited.
          </div>

          <div class="grid2" style="margin-top:14px;">
            <label>Email recipients (comma-separated, optional)
              <input [(ngModel)]="recipients" placeholder="user@company.com, team@company.com" />
            </label>
            <label>Email subject (optional)
              <input [(ngModel)]="emailSubject" placeholder="Scheduled Report Export" />
            </label>
          </div>

          <div class="row-between" style="margin-top:14px;">
            <span class="tag">{{ loadedRows().length }} rows ready</span>
            <button class="btn-primary" (click)="upload()" [disabled]="busy() || loadedRows().length === 0 || targetLocked()">
              Upload to database
            </button>
          </div>
        </div>
        <div class="wizard-footer row-between">
          <button class="btn-secondary" (click)="setStep(3)">‹ Back</button>
          <button class="btn-primary" (click)="setStep(5)">Next ›</button>
        </div>
      </ng-container>

      <!-- STEP 5 -->
      <ng-container *ngIf="currentStep() === 5 && (loadedRows().length || loadedCols().length)">
        <h2>5 Save as a scheduled job (optional)</h2>
        <div class="card">
          <p class="muted">
            Saves this exact setup (report · table · columns · mode) so it can be
            re-run or scheduled. Leave cron blank to just save it for one-click runs.
          </p>
          <div class="grid2">
            <label>Job name
              <input [(ngModel)]="jobName" placeholder="e.g. Inventory bins nightly" />
            </label>
            <label>Cron schedule (optional, UTC)
              <input [(ngModel)]="cron" placeholder="0 6 * * 3  (Wed 06:00)" />
            </label>
          </div>
          <div class="warn" *ngIf="targetLocked()">
            The table has been created and cannot be edited.
          </div>
          <div class="row-between">
            <span class="tag">examples: <code>0 6 * * *</code> daily 06:00 · <code>0 */4 * * *</code> every 4h</span>
            <button class="btn-primary" (click)="saveJob()" [disabled]="busy() || targetLocked()">Save job</button>
          </div>
        </div>
        <div class="wizard-footer row-between">
          <button class="btn-secondary" (click)="setStep(4)">‹ Back</button>
          <button class="btn-primary" (click)="setStep(1)">Finish</button>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .wizard-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 32px;
      background: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
      border: 1px solid #e0e4eb;
    }
    .search {
      margin-bottom: 16px;
      margin-top: 8px;
      padding: 12px;
      font-size: 14px;
    }
    .daterow {
      display: flex;
      gap: 16px;
      align-items: center;
      margin-bottom: 16px;
      margin-top: 8px;
    }
    .daterow select {
      flex: 1;
    }
    .step {
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      opacity: 0.6;
      transition: all 0.3s ease;
    }
    .step.active {
      opacity: 1;
    }
    .step.disabled {
      cursor: not-allowed;
      opacity: 0.3;
    }
    .step-num {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #f0f0f0;
      color: #666;
      display: flex;
      justify-content: center;
      align-items: center;
      font-weight: bold;
    }
    .step.active .step-num {
      background: #3b82f6;
      color: white;
      border: 1px solid #1e40af;
      box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);
    }
    .step-label {
      font-weight: 600;
      color: #333;
      font-size: 14px;
    }
    .wizard-footer {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #eaeaea;
    }
    .btn-primary {
      background: #3b82f6;
      color: white;
      border: 1px solid #1e40af;
      padding: 10px 24px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-primary:hover:not(:disabled) {
      background: #2563eb;
    }
    .btn-primary:disabled {
      background: #ccc;
      box-shadow: none;
      cursor: not-allowed;
    }
    .btn-secondary {
      background: white;
      color: #4b5563;
      border: 1px solid #d1d5db;
      padding: 10px 24px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-secondary:hover:not(:disabled) {
      background: #f9fafb;
      border-color: #9ca3af;
    }
    .btn-secondary:disabled {
      background: #f3f4f6;
      color: #9ca3af;
      cursor: not-allowed;
    }
    .spinner-white {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255,255,255,0.3);
      border-radius: 50%;
      border-top-color: white;
      animation: spin 1s ease-in-out infinite;
      margin-right: 8px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `],
})
export class UploadComponent implements OnInit {
  /** When true, only the curated/combined "final report" tables are shown. */
  @Input() finalOnly = false;

  currentStep = signal(1);
  reports = signal<ReportWithAccess[]>([]);
  setStep(s: number) { this.currentStep.set(s); }
  filter = '';
  selectedReport = signal<ReportWithAccess | null>(null);

  columns = signal<DatasetColumn[]>([]);
  columnFilter = signal('');
  measures = signal<DatasetMeasure[]>([]);
  measureFilter = signal('');
  measureSelected = signal<Record<string, boolean>>({});
  loadingCols = signal(false);
  colError = signal('');
  tables = signal<string[]>([]);
  tableFilter = signal('');
  activeTable = signal('');
  selected = signal<Record<string, boolean>>({});
  limit = 500;
  allRows = signal(false);
  dateColumn = signal('');
  dateFrom = signal('');
  dateTo = signal('');

  loadedRows = signal<any[]>([]);
  loadedCols = signal<string[]>([]);
  page = signal(0);
  pageSize = 7;
  repPage = signal(0);
  dsPage = signal(0);

  owner = '';
  tableName = '';
  mode: 'append' | 'upsert' = 'append';
  keySelected = signal<Record<string, boolean>>({});

  jobName = '';
  cron = '';

  recipients = '';
  emailSubject = '';

  busy = signal(false);

  datasets = signal<DynamicDataset[]>([]);
  datasetEmails: Record<string, string> = {};
  previewTable = signal('');
  previewCols = signal<string[]>([]);
  previewRows = signal<any[]>([]);

  filterSig = signal('');
  filteredReports = computed(() => {
    const f = this.filterSig().trim().toLowerCase();
    const list = this.reports();
    if (!f) return list;
    return list.filter(
      (r) =>
        r.name.toLowerCase().includes(f) ||
        r.workspaceName.toLowerCase().includes(f),
    );
  });
  pagedReports = computed(() =>
    this.filteredReports().slice(this.repPage() * this.pageSize, (this.repPage() + 1) * this.pageSize),
  );
  filteredTables = computed(() => {
    const f = this.tableFilter().trim().toLowerCase();
    const list = this.tables();
    return f ? list.filter((t) => t.toLowerCase().includes(f)) : list;
  });
  activeColumns = computed(() =>
    this.columns().filter((c) => c.table === this.activeTable()),
  );
  filteredColumns = computed(() => {
    const f = this.columnFilter().trim().toLowerCase();
    const cols = this.activeColumns();
    return f ? cols.filter((c) => c.name.toLowerCase().includes(f)) : cols;
  });
  filteredMeasures = computed(() => {
    const f = this.measureFilter().trim().toLowerCase();
    const m = this.measures();
    return f ? m.filter((x) => x.name.toLowerCase().includes(f)) : m;
  });
  selectedMeasureNames = computed(() =>
    this.measures().map((m) => m.name).filter((n) => this.measureSelected()[n]),
  );
  dateColumns = computed(() =>
    this.activeColumns().filter((c) => /date|time/i.test(c.dataType)),
  );
  pagedDatasets = computed(() =>
    this.datasets().slice(this.dsPage() * this.pageSize, (this.dsPage() + 1) * this.pageSize),
  );
  selectedNames = computed(() =>
    this.activeColumns().map((c) => c.name).filter((n) => this.selected()[n]),
  );
  allChecked = computed(
    () =>
      this.activeColumns().length > 0 &&
      this.selectedNames().length === this.activeColumns().length,
  );
  selectedKeyNames = computed(() =>
    this.selectedNames().filter((n) => this.keySelected()[n]),
  );
  pageCount = computed(() =>
    Math.max(1, Math.ceil(this.loadedRows().length / this.pageSize)),
  );
  pagedRows = computed(() =>
    this.loadedRows().slice(this.page() * this.pageSize, (this.page() + 1) * this.pageSize),
  );

  constructor(
    public api: SyncApiService,
    private toast: ToastService,
  ) {}

  ngOnInit() {
    this.loadReports();
    this.loadDatasets();
  }

  loadReports() {
    this.api.catalogReports().subscribe({
      next: (r) => this.reports.set(r),
      error: (e) => this.toast.error(this.msg(e)),
    });
  }

  onFilterChange(v: string) {
    this.filter = v;
    this.filterSig.set(v);
    this.repPage.set(0);
  }

  pickReport(r: ReportWithAccess) {
    this.selectedReport.set(r);
    this.currentStep.set(2);
    this.columns.set([]);
    this.measures.set([]);
    this.measureSelected.set({});
    this.measureFilter.set('');
    this.columnFilter.set('');
    this.tables.set([]);
    this.tableFilter.set('');
    this.selected.set({});
    this.loadedRows.set([]);
    this.loadedCols.set([]);
    this.colError.set('');
    if (!r.datasetId) {
      this.colError.set('This report has no dataset to read columns from.');
      return;
    }
    // Measures are dataset-wide; load them alongside the columns.
    this.api.datasetMeasures(r.datasetId).subscribe({
      next: (m) => this.measures.set(m),
      error: () => this.measures.set([]),
    });
    this.loadingCols.set(true);
    this.api.datasetColumns(r.datasetId, this.finalOnly).subscribe({
      next: (cols) => {
        this.columns.set(cols);
        const counts = new Map<string, number>();
        for (const c of cols) counts.set(c.table, (counts.get(c.table) ?? 0) + 1);
        const tbls = Array.from(counts.keys());
        // In "final" mode, surface the most-complete (most-mapped) table first.
        if (this.finalOnly) {
          tbls.sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
        } else {
          tbls.sort();
        }
        this.tables.set(tbls);
        this.activeTable.set(tbls[0] ?? '');
        this.resetSelection();
        this.loadingCols.set(false);
      },
      error: (e) => {
        this.colError.set(this.msg(e));
        this.loadingCols.set(false);
      },
    });
  }

  /** Called as the user types/picks a table. Only re-init when it's a real table. */
  setTable(v: string) {
    this.activeTable.set(v);
    if (this.tables().includes(v)) this.onTableChange();
  }
  onTableChange() {
    this.loadedRows.set([]);
    this.loadedCols.set([]);
    this.resetSelection();
  }

  private resetSelection() {
    const sel: Record<string, boolean> = {};
    const keys: Record<string, boolean> = {};
    let hasKey = false;
    for (const c of this.activeColumns()) {
      sel[c.name] = true;
      if (c.isKey) {
        keys[c.name] = true;
        hasKey = true;
      }
    }
    this.selected.set(sel);
    // If the model marks key column(s), default to upsert on them so recurring
    // syncs update in place instead of duplicating. Otherwise append.
    this.keySelected.set(keys);
    this.mode = hasKey ? 'upsert' : 'append';
    this.tableName = this.suggestName();
    this.page.set(0);
    this.dateColumn.set('');
    this.dateFrom.set('');
    this.dateTo.set('');
  }

  private effectiveLimit(): number {
    return this.allRows() ? 0 : this.limit;
  }
  private filterPayload() {
    if (!this.dateColumn()) return undefined;
    return {
      dateColumn: this.dateColumn(),
      dateFrom: this.dateFrom() || undefined,
      dateTo: this.dateTo() || undefined,
    };
  }

  columnCount(table: string): number {
    return this.columns().filter((c) => c.table === table).length;
  }

  /** Mirror of the backend table-name sanitiser, to detect locked targets. */
  private slugTable(raw: string): string {
    let s = (raw ?? '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!s) return '';
    if (/^[0-9]/.test(s)) s = '_' + s;
    return s.slice(0, 60);
  }
  targetTableName(): string {
    return this.slugTable(this.tableName);
  }
  targetLocked(): boolean {
    const t = this.targetTableName();
    return !!t && this.datasets().some((d) => d.table_name === t && d.locked);
  }
  autoKeyNote(): string {
    return this.activeColumns().some((c) => c.isKey)
      ? ' · auto-detected from the model'
      : '';
  }
  private suggestName(): string {
    return `${this.selectedReport()?.name ?? ''} ${this.activeTable()}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60);
  }
  toggle(name: string) {
    const willInclude = !this.selected()[name];
    this.selected.update((s) => ({ ...s, [name]: willInclude }));
    // A column that's excluded can't be a key.
    if (!willInclude && this.keySelected()[name]) {
      this.keySelected.update((s) => ({ ...s, [name]: false }));
      this.syncModeToKeys();
    }
  }

  toggleMeasure(name: string) {
    this.measureSelected.update((s) => ({ ...s, [name]: !s[name] }));
  }

  /** Toggle a column as an upsert/primary key (also includes it). */
  toggleKeyCol(name: string) {
    const willBeKey = !this.keySelected()[name];
    this.keySelected.update((s) => ({ ...s, [name]: willBeKey }));
    if (willBeKey) {
      this.selected.update((s) => ({ ...s, [name]: true }));
    }
    this.syncModeToKeys();
  }

  /** Upsert when at least one key is ticked, otherwise append. */
  private syncModeToKeys() {
    this.mode = this.selectedKeyNames().length > 0 ? 'upsert' : 'append';
  }
  toggleAll(ev: Event) {
    const on = (ev.target as HTMLInputElement).checked;
    const sel: Record<string, boolean> = { ...this.selected() };
    for (const c of this.activeColumns()) sel[c.name] = on;
    this.selected.set(sel);
  }

  prevPage() { this.page.update((p) => Math.max(0, p - 1)); }
  nextPage() { this.page.update((p) => Math.min(this.pageCount() - 1, p + 1)); }

  sync() {
    const rep = this.selectedReport();
    if (!rep?.datasetId) return;
    this.busy.set(true);
    this.api
      .reportData(
        rep.datasetId,
        this.activeTable(),
        this.selectedNames(),
        this.effectiveLimit(),
        this.filterPayload(),
        this.selectedMeasureNames(),
      )
      .subscribe({
        next: (rows) => {
          this.loadedRows.set(rows);
          this.loadedCols.set(rows.length ? Object.keys(rows[0]) : this.selectedNames());
          this.page.set(0);
          this.busy.set(false);
          this.toast.success(`Synced ${rows.length} row(s) from Power BI.`);
          this.currentStep.set(3);
        },
        error: (e) => this.fail(e),
      });
  }

  upload() {
    const rep = this.selectedReport();
    if (!rep) return;
    if (this.mode === 'upsert' && this.selectedKeyNames().length === 0) {
      this.toast.error('Pick at least one business key for upsert.');
      return;
    }
    this.busy.set(true);
    this.api
      .uploadReport({
        reportName: `${rep.name} · ${this.activeTable()}`,
        owner: this.owner || 'anonymous',
        rows: this.loadedRows(),
        tableName: this.tableName,
        mode: this.mode,
        businessKeys: this.selectedKeyNames(),
        recipients: this.recipients ? this.recipients.split(',').map(e => e.trim()).filter(e => e) : undefined,
        subject: this.emailSubject.trim() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.busy.set(false);
          this.toast.success(`Uploaded ${res.rowsWritten} row(s) to ${res.table} (now ${res.totalRows}).`);
          this.loadDatasets();
        },
        error: (e) => this.fail(e),
      });
  }

  saveJob() {
    const rep = this.selectedReport();
    if (!rep?.datasetId) return;
    if (!this.jobName.trim()) {
      this.toast.error('Give the job a name.');
      return;
    }
    if (this.mode === 'upsert' && this.selectedKeyNames().length === 0) {
      this.toast.error('Pick at least one business key for upsert.');
      return;
    }
    this.busy.set(true);
    this.api
      .createJob({
        name: this.jobName.trim(),
        reportName: rep.name,
        datasetId: rep.datasetId,
        sourceTable: this.activeTable(),
        columns: this.selectedNames(),
        measures: this.selectedMeasureNames(),
        targetTable: this.tableName,
        mode: this.mode,
        businessKeys: this.selectedKeyNames(),
        limit: this.effectiveLimit(),
        owner: this.owner || 'anonymous',
        cron: this.cron.trim() || undefined,
        dateColumn: this.dateColumn() || undefined,
        dateFrom: (this.dateColumn() && this.dateFrom()) || undefined,
        dateTo: (this.dateColumn() && this.dateTo()) || undefined,
        recipients: this.recipients.trim() || undefined,
        emailSubject: this.emailSubject.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.toast.success(
            this.cron.trim()
              ? `Job "${this.jobName}" saved & scheduled.`
              : `Job "${this.jobName}" saved.`,
          );
          this.jobName = '';
          this.cron = '';
        },
        error: (e) => this.fail(e),
      });
  }

  syncPrincipals() {
    this.busy.set(true);
    this.api.syncPrincipals().subscribe({
      next: (r) => {
        this.busy.set(false);
        this.toast.success(`Synced ${r.rowsWritten} principal(s) (now ${r.totalRows}).`);
        this.loadDatasets();
      },
      error: (e) => this.fail(e),
    });
  }

  loadDatasets() {
    this.api.datasets().subscribe({
      next: (d) => {
        this.datasets.set(d);
        this.dsPage.set(0);
      },
      error: (e) => this.toast.error(this.msg(e)),
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
      error: (e) => this.fail(e),
    });
  }

  private fail(e: any) {
    this.busy.set(false);
    this.toast.error(this.msg(e));
  }
  
  sendEmail(table: string) {
    const recipientsStr = this.datasetEmails[table];
    if (!recipientsStr) return;
    const recipients = recipientsStr.split(',').map(e => e.trim()).filter(e => e);
    if (recipients.length === 0) return;
    
    this.busy.set(true);
    this.api.emailDataset(table, recipients, `Export of ${table}`).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.success(`Successfully sent ${table} to ${recipients.join(', ')}`);
        this.datasetEmails[table] = ''; // clear input
      },
      error: (e) => this.fail(e),
    });
  }

  private msg(e: any): string {
    return e?.error?.message || e?.message || 'Request failed';
  }
}
