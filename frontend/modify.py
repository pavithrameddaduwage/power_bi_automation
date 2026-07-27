import sys

file_path = '/Users/pavithrameddaduwage/Downloads/powerbi-backup/frontend/src/app/upload.component.ts'

with open(file_path, 'r') as f:
    content = f.read()

# 1. Add currentStep to the class
content = content.replace(
    'reports = signal<ReportWithAccess[]>([]);',
    'currentStep = signal(1);\n  reports = signal<ReportWithAccess[]>([]);\n  setStep(s: number) { this.currentStep.set(s); }'
)

# 2. Add step navigation into pickReport
content = content.replace(
    'this.selectedReport.set(r);',
    'this.selectedReport.set(r);\n    this.currentStep.set(2);'
)

# 3. Add step navigation into sync
content = content.replace(
    'this.toast.success(`Synced ${rows.length} row(s) from Power BI.`);',
    'this.toast.success(`Synced ${rows.length} row(s) from Power BI.`);\n          this.currentStep.set(3);'
)

template_start = content.find('template: `')
if template_start == -1:
    print("Template start not found")
    sys.exit(1)

template_end = content.find('`,', template_start)
if template_end == -1:
    print("Template end not found")
    sys.exit(1)
    
template_end += 2

original_template = content[template_start:template_end]

new_template = """template: `
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
        <h2>1 · Pick a report</h2>
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
              <a class="btnlink" [href]="api.exportUrl(d.table_name)">Export CSV</a>
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
        <h2>2 · Choose table &amp; columns</h2>
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
        <h2>3 · Synced data ({{ loadedRows().length }} rows)</h2>
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
        <h2>4 · Write to database</h2>
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
        <h2>5 · Save as a scheduled job (optional)</h2>
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
      margin-bottom: 24px;
      background: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
      border: 1px solid #e0e4eb;
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
      background: linear-gradient(135deg, #6366f1, #a855f7);
      color: white;
      box-shadow: 0 4px 10px rgba(99, 102, 241, 0.3);
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
      background: linear-gradient(90deg, #6366f1, #a855f7);
      color: white;
      border: none;
      padding: 10px 24px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 4px 12px rgba(99,102,241,0.2);
    }
    .btn-primary:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(99,102,241,0.3);
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
  `],"""

content = content.replace(original_template, new_template)

with open(file_path, 'w') as f:
    f.write(content)

print("Successfully updated upload.component.ts")
