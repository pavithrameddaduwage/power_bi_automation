import { Component, HostListener, Input, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  SyncApiService,
  DynamicDataset,
  ReportWithAccess,
  DatasetColumn,
  DatasetMeasure,
  DbConnection,
  NewDbDto,
  DatasetRefreshInfo,
} from './sync.service';
import { ToastService } from './toast.service';
import { PagerComponent } from './pager.component';
import { EmailPickerComponent } from './email-picker.component';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule, FormsModule, PagerComponent, EmailPickerComponent],
  template: `
    <div class="wizard-header">
      <div class="step" [class.active]="currentStep() === 1" (click)="setStep(1)">
        <div class="step-num">1</div>
        <div class="step-label">Pick Report</div>
      </div>
      <div class="step" [class.active]="currentStep() === 2" [class.disabled]="!selectedReport()" (click)="selectedReport() && setStep(2)">
        <div class="step-num">2</div>
        <div class="step-label">Tables & Columns</div>
      </div>
      <div class="step" [class.active]="currentStep() === 3" [class.disabled]="!loadedRows().length && !loadedCols().length" (click)="(loadedRows().length || loadedCols().length) && setStep(3)">
        <div class="step-num">3</div>
        <div class="step-label">Data</div>
      </div>
      <div class="step" [class.active]="currentStep() === 4" [class.disabled]="!loadedRows().length && !loadedCols().length" (click)="(loadedRows().length || loadedCols().length) && setStep(4)">
        <div class="step-num">4</div>
        <div class="step-label">Schedule & Database</div>
      </div>
    </div>

    <div class="wizard-body">
      <!-- STEP 1 -->
      <ng-container *ngIf="currentStep() === 1">
        <h2>Pick a report</h2>
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
      </ng-container>

      <!-- STEP 2 -->
      <ng-container *ngIf="currentStep() === 2 && selectedReport() as rep">
        <h2>Choose tables &amp; columns</h2>
        <div class="card">
          <div *ngIf="loadingCols()" class="muted"><span class="spinner"></span> Loading columns…</div>
          <div *ngIf="colError()" class="status-error">{{ colError() }}</div>

          <ng-container *ngIf="tables().length">
            <div class="row-between" style="margin-bottom:8px;">
              <label>
                {{ finalOnly ? 'Final report tables' : 'Tables connected to this report' }}
                ({{ tables().length }}) — <strong>tick multiple</strong>
              </label>
              <label class="pick" style="margin:0; font-size:13px;">
                <input type="checkbox" [(ngModel)]="showAllTables" (ngModelChange)="reloadColumnsForHiddenToggle()" />
                Show all tables (incl. hidden)
              </label>
            </div>
            <input *ngIf="tables().length" class="search" placeholder="Search tables…"
                   [ngModel]="tableFilter()" (ngModelChange)="tableFilter.set($event)" />
            <div class="scroll-list" *ngIf="tables().length">
              <div
                *ngFor="let t of filteredTables()"
                class="report-row multi-table-row"
                [class.active]="selectedTables().includes(t)"
                (click)="toggleTable(t)"
              >
                <input type="checkbox" [checked]="selectedTables().includes(t)" (click)="$event.stopPropagation()" (change)="toggleTable(t)" />
                <span style="flex:1">{{ t }}</span>
                <span class="tag">{{ columnCount(t) }} cols</span>
              </div>
              <div *ngIf="filteredTables().length === 0" class="muted" style="padding:12px;">No match.</div>
            </div>

            <div *ngIf="selectedTables().length > 0" class="selected-tables-summary">
              <span class="badge badge-ok" *ngFor="let t of selectedTables()">{{ t }}</span>
              <span class="tag">{{ activeColumns().length }} total columns</span>
            </div>
          </ng-container>

          <ng-container *ngIf="activeColumns().length">
            <div class="row-between" style="margin-top:16px;">
              <label class="pick" style="margin:0;">
                <input type="checkbox" [checked]="allChecked()" (change)="toggleAll($event)" />
                Select all columns
              </label>
              <span class="tag">{{ selectedNames().length }} of {{ activeColumns().length }} selected</span>
            </div>
            <input class="search" placeholder="Search columns…" [ngModel]="columnFilter()" (ngModelChange)="columnFilter.set($event)" />
            <div class="scroll-list">
              <table>
                <thead>
                  <tr>
                    <th style="width:40px;">Use</th>
                    <th>Column</th>
                    <th>Table</th>
                    <th>Data type</th>
                    <th style="width:80px; text-align:center;">Key</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let c of filteredColumns()">
                    <td><input type="checkbox" [checked]="selected()[c.name]" (change)="toggle(c.name)" /></td>
                    <td>{{ c.name }} <span class="badge badge-ok" *ngIf="c.isKey">model key</span></td>
                    <td>{{ c.table }}</td>
                    <td>{{ c.dataType }}</td>
                    <td style="text-align:center;">
                      <input type="checkbox" [checked]="keySelected()[c.name]"
                             (change)="toggleKeyCol(c.name)" title="use as upsert/primary key" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="tag" style="margin-top:6px;">
              Check <strong>Key</strong> on unique column(s) to update existing rows instead of creating duplicates.
            </p>

            <div *ngIf="measures().length" class="measures-block">
              <div class="row-between">
                <strong>Measures — viewed separately ({{ measures().length }})</strong>
                <span class="tag">{{ selectedMeasureNames().length }} selected</span>
              </div>
              <input class="search" placeholder="Search measures…" [ngModel]="measureFilter()" (ngModelChange)="measureFilter.set($event)" />
              <div class="scroll-list">
                <table>
                  <thead><tr><th style="width:40px;">Use</th><th>Measure</th><th>Type</th></tr></thead>
                  <tbody>
                    <tr *ngFor="let m of filteredMeasures()">
                      <td><input type="checkbox" [checked]="measureSelected()[m.name]" (change)="toggleMeasure(m.name)" /></td>
                      <td>{{ m.name }}</td>
                      <td>{{ m.dataType }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div class="row-between" style="margin-top:16px; flex-wrap:wrap; gap:10px;">
              <div style="display:flex;gap:16px;align-items:center;">
                <label class="pick" style="margin:0;">
                  <input type="checkbox" [ngModel]="allRows()" (ngModelChange)="allRows.set($event)" /> All rows
                </label>
                <label style="margin:0;" *ngIf="!allRows()">max rows
                  <input type="number" min="1" [(ngModel)]="limit" style="width:90px;" />
                </label>
              </div>
              <button class="btn-primary" (click)="sync()" [disabled]="busy() || selectedTables().length === 0 || (selectedNames().length === 0 && selectedMeasureNames().length === 0)">
                <span *ngIf="busy()" class="spinner-white"></span>
                {{ busy() ? 'Syncing…' : 'Sync & Preview Data' }}
              </button>
            </div>
          </ng-container>
        </div>
        <div class="wizard-footer row-between">
          <button class="btn-secondary" (click)="setStep(1)">‹ Back</button>
          <button class="btn-primary" (click)="nextFromStep2()" [disabled]="busy() || selectedTables().length === 0">Next ›</button>
        </div>
      </ng-container>

      <!-- STEP 3 — Data with column filters -->
      <ng-container *ngIf="currentStep() === 3 && (loadedRows().length || loadedCols().length)">
        <div class="row-between" style="margin-bottom:12px;">
          <h2>Synced data
            <span class="tag" style="font-size:13px; margin-left:8px;">
              {{ filteredLoadedRows().length }} of {{ loadedRows().length }} rows
              <ng-container *ngIf="hasActiveColFilters()"> (filtered)</ng-container>
            </span>
          </h2>
          <div style="display:flex;gap:8px;align-items:center;">
            <button class="btn-secondary" (click)="clearColFilters()" *ngIf="hasActiveColFilters()">Clear Filters</button>
          </div>
        </div>
        <div class="card">
          <div class="table-container" style="overflow:auto;">
            <table>
              <thead>
                <tr>
                  <th *ngFor="let c of loadedCols()" style="cursor: pointer;" (click)="toggleHeaderFilter(c, $event)">
                    <div class="th-header-cell">
                      <span class="th-title">{{ c }}</span>
                      <span class="th-arrow-btn"
                            [class.open]="activeFilterCol() === c"
                            [class.filtered]="isColFiltered(c)">▾</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of pagedRows()"><td *ngFor="let c of loadedCols()">{{ row[c] }}</td></tr>
              </tbody>
            </table>
          </div>

          <!-- Floating Popover Filter Menu -->
          <div *ngIf="activeFilterCol() as c"
               class="filter-popover"
               [style.top.px]="popoverPos().top"
               [style.left.px]="popoverPos().left"
               (click)="$event.stopPropagation()">
            <ng-container *ngIf="isDateCol(c); else valuePopover">
              <div class="popover-header">Filter Date Range</div>
              <div class="popover-field">
                <label>From</label>
                <input type="date" [ngModel]="colFilterFrom()[c] || ''" (ngModelChange)="setColFilterFrom(c, $event)" />
              </div>
              <div class="popover-field">
                <label>To</label>
                <input type="date" [ngModel]="colFilterTo()[c] || ''" (ngModelChange)="setColFilterTo(c, $event)" />
              </div>
              <div class="popover-actions">
                <button class="btn-popover-sub" (click)="clearSingleFilter(c, $event)">Clear</button>
                <button class="btn-popover-main" (click)="activeFilterCol.set(null)">Apply</button>
              </div>
            </ng-container>

            <ng-template #valuePopover>
              <div class="popover-header">Filter {{ c }}</div>
              <input class="popover-search-input" placeholder="Search values…"
                     [ngModel]="popoverSearch[c] || ''"
                     (ngModelChange)="popoverSearch[c] = $event"
                     (click)="$event.stopPropagation()" />
              <div class="popover-options-list">
                <label class="popover-option">
                  <input type="checkbox"
                         [checked]="(colFilters()[c] || []).length === 0"
                         (change)="clearSingleColValues(c)" />
                  <span>All</span>
                </label>
                <label *ngFor="let v of filteredUniqueValues(c)"
                       class="popover-option">
                  <input type="checkbox"
                         [checked]="isValueSelected(c, v)"
                         (change)="toggleColFilterValue(c, v)" />
                  <span>{{ v }}</span>
                </label>
              </div>
              <div class="popover-actions">
                <button class="btn-popover-sub" (click)="clearSingleFilter(c, $event)">Clear</button>
                <button class="btn-popover-main" (click)="activeFilterCol.set(null)">Apply</button>
              </div>
            </ng-template>
          </div>
          <div class="row-between" *ngIf="filteredPageCount() > 1">
            <span class="tag">page {{ page() + 1 }} / {{ filteredPageCount() }}</span>
            <div style="display:flex;gap:6px;">
              <button class="btn-secondary" (click)="prevPage()" [disabled]="page() === 0">‹ Prev</button>
              <button class="btn-secondary" (click)="nextPage()" [disabled]="page() + 1 >= filteredPageCount()">Next ›</button>
            </div>
          </div>
        </div>
        <div class="wizard-footer row-between">
          <button class="btn-secondary" (click)="setStep(2)">‹ Back</button>
          <div style="display:flex;gap:10px;align-items:center;">
            <button class="btn-secondary" (click)="downloadExcelSheet()" [disabled]="busy()" [title]="downloadTooltipText()">
              <span *ngIf="busy()" class="spinner"></span>
              Download Excel Sheet
            </button>
            <span *ngIf="selectedDatasetRefresh()?.lastRefreshStartTime"
                  class="tag"
                  [title]="downloadTooltipText()"
                  style="font-size:11px; cursor:help;">
              Data Refreshed - {{ selectedDatasetRefresh()?.lastRefreshStartTime | date: 'short' }}
            </span>
            <button class="btn-primary" (click)="setStep(4)">Next ›</button>
          </div>
        </div>
      </ng-container>

      <!-- STEP 4 — Schedule & Database (Optional) -->
      <ng-container *ngIf="currentStep() === 4 && (loadedRows().length || loadedCols().length)">
        <div class="row-between" style="margin-bottom:16px;">
          <h2>Database &amp; Schedule Options</h2>
          <span class="tag" style="font-size:13px;">{{ writeRows().length }} rows ready</span>
        </div>

        <!-- Step 4 Top Section: 2 Side-by-Side Instant Action Cards -->
        <div class="grid2" style="margin-bottom:20px;">
          <!-- Database Destination & One-Time Upload -->
          <div class="card">
            <div class="row-between" style="margin-bottom:8px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <strong>Database Table Destination</strong>
                <span class="badge badge-ok" style="font-size:11px;">DB Config</span>
              </div>
              <button class="btn-secondary" style="font-size:11px; padding:3px 8px;" (click)="showDbForm.set(!showDbForm())">
                {{ showDbForm() ? 'Hide DB Config' : 'Manage Connections' }}
              </button>
            </div>

            <!-- Collapsible Database Connections Panel -->
            <div *ngIf="showDbForm()" style="margin-bottom:12px; padding:10px; background:var(--bg); border:1px solid var(--border); border-radius:var(--radius-sm); font-size:12px;">
              <div class="row-between" style="margin-bottom:6px;">
                <span style="font-weight:600;">Target PostgreSQL Instance</span>
                <button class="btn-secondary" (click)="loadDatabases()" [disabled]="busy()" style="font-size:10px; padding:2px 6px;">Refresh</button>
              </div>
              <div *ngIf="databases().length > 0" style="margin-bottom:8px;">
                <div class="db-conn-row" *ngFor="let db of databases()" style="padding:4px 8px; margin-bottom:4px;">
                  <div style="display:flex;align-items:center;gap:8px;flex:1;">
                    <input type="radio" name="activeDb" [checked]="db.is_active" (change)="switchDatabase(db.id)" />
                    <div>
                      <strong>{{ db.label || db.dbname }}</strong>
                      <span class="muted" style="margin-left:4px; font-size:11px;">({{ db.host }}:{{ db.port }})</span>
                    </div>
                  </div>
                </div>
              </div>
              <div class="grid3" style="gap:6px;">
                <label style="font-size:11px;">Host <input [(ngModel)]="newDb.host" placeholder="192.168.1.100" style="padding:3px 6px; font-size:11px;" /></label>
                <label style="font-size:11px;">Port <input type="number" [(ngModel)]="newDb.port" placeholder="5432" style="padding:3px 6px; font-size:11px;" /></label>
                <label style="font-size:11px;">DB Name <input [(ngModel)]="newDb.dbname" placeholder="power_bi_db" style="padding:3px 6px; font-size:11px;" /></label>
              </div>
              <div class="grid3" style="gap:6px; margin-top:4px;">
                <label style="font-size:11px;">Username <input [(ngModel)]="newDb.username" placeholder="postgres" style="padding:3px 6px; font-size:11px;" /></label>
                <label style="font-size:11px;">Password <input type="password" [(ngModel)]="newDb.password" placeholder="••••" style="padding:3px 6px; font-size:11px;" /></label>
                <label style="font-size:11px;">Label <input [(ngModel)]="newDb.label" placeholder="Production" style="padding:3px 6px; font-size:11px;" /></label>
              </div>
              <div class="row-between" style="margin-top:6px;">
                <button class="btn-secondary" (click)="testDbConnection()" [disabled]="busy() || !newDb.host || !newDb.dbname" style="font-size:10px; padding:2px 6px;">Test</button>
                <button class="btn-primary" (click)="createDatabase()" [disabled]="busy() || !newDb.host || !newDb.dbname || !newDb.username || !newDb.password" style="font-size:10px; padding:2px 6px;">Save</button>
              </div>
            </div>

            <div class="grid2">
              <label>Table name
                <input [(ngModel)]="tableName" placeholder="e.g. daily_sales" />
              </label>
              <label>Owner
                <input [(ngModel)]="owner" placeholder="your name" />
              </label>
            </div>

            <!-- Write mode -->
            <label style="margin-top:10px;display:block;font-weight:600;font-size:12px;">Write mode</label>
            <div class="modes" style="margin-top:4px;">
              <label class="pick"><input type="radio" name="writeMode" value="total" [(ngModel)]="writeMode" /> Total</label>
              <label class="pick"><input type="radio" name="writeMode" value="delta" [(ngModel)]="writeMode" /> Delta</label>
              <label class="pick"><input type="radio" name="writeMode" value="append" [(ngModel)]="writeMode" /> Append</label>
              <label class="pick"><input type="radio" name="writeMode" value="upsert" [(ngModel)]="writeMode" /> Upsert</label>
            </div>

            <div *ngIf="writeMode === 'upsert'" style="margin-top:8px;">
              <label style="font-size:11px;font-weight:600;">Upsert keys{{ autoKeyNote() }}</label>
              <div class="keychips">
                <span class="chip" *ngFor="let n of selectedKeyNames()">{{ n }}</span>
                <span class="muted" *ngIf="selectedKeyNames().length === 0" style="font-size:11px;">
                  Tick "Key" on columns in Step 2.
                </span>
              </div>
            </div>

            <div class="row-between" style="margin-top:14px; padding-top:10px; border-top:1px solid var(--border);">
              <label class="pick" style="margin:0; font-size:11px;">
                <input type="checkbox" [(ngModel)]="customColumns" /> Pick columns
              </label>
              <button class="btn-primary" (click)="upload()" [disabled]="busy() || writeRows().length === 0 || targetLocked()">
                <span *ngIf="busy()" class="spinner-white"></span>
                Upload to Database Now
              </button>
            </div>
          </div>

          <!-- Email Distribution & One-Time Send -->
          <div class="card">
            <div class="row-between" style="margin-bottom:8px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <strong>Email Distribution</strong>
                <span class="badge" style="font-size:11px; background:#eff6ff; color:#1d4ed8;">Optional</span>
              </div>
            </div>
            <p class="muted" style="margin-top:0; font-size:12px;">
              Select Azure AD directory users or enter custom email addresses to receive the Excel report.
            </p>

            <label style="margin-top:6px;">Recipients (Azure AD & custom)</label>
            <app-email-picker
              [(recipients)]="recipients"
              [selectedReport]="selectedReport()"
              [placeholder]="'Select AD users or type custom email...'"
            ></app-email-picker>

            <label style="margin-top:8px;">Email subject (optional)
              <input [(ngModel)]="emailSubject" placeholder="Excel Report Export" />
            </label>

            <div class="row-between" style="margin-top:14px; padding-top:10px; border-top:1px solid var(--border);">
              <span class="muted" style="font-size:11px;">Direct email only (no DB write)</span>
              <button class="btn-secondary" (click)="sendReportEmail()" [disabled]="busy() || writeRows().length === 0 || !recipients.trim()">
                Send Email Now
              </button>
            </div>
          </div>
        </div>

        <!-- Automated Recurring Schedule (Applies Both Database & Email on Timer) -->
        <div class="card" style="margin-bottom:20px;">
          <div class="row-between" style="margin-bottom:6px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <strong style="font-size:14px;">Schedule Recurring Automation</strong>
              <span class="badge" style="font-size:11px; background:#f0fdf4; color:#166534;">Automates Pipeline</span>
            </div>
          </div>
          <p class="muted" style="margin-top:0; font-size:12px;">
            Setting a schedule automatically applies <strong>both the Database Table Upload</strong> and <strong>Email Distribution</strong> on your chosen recurring timer.
          </p>

          <div class="grid2" style="margin-top:10px;">
            <label>Job name
              <input [(ngModel)]="jobName" placeholder="e.g. Daily Sales Sync & Email" />
            </label>
            <label>Cron schedule (UTC)
              <input [(ngModel)]="cron" placeholder="0 6 * * 3  (Wed 06:00)" />
            </label>
          </div>

          <!-- Live Power BI Refresh Status & Safe Cron Calculation -->
          <div *ngIf="selectedDatasetRefresh()" style="margin-top:10px; padding:10px 12px; background:var(--bg); border:1px solid var(--border); border-radius:var(--radius-sm); font-size:12px;">
            <div class="row-between" style="margin-bottom:6px;">
              <span style="font-weight:700; color:var(--text);">Power BI Refresh Schedule Reference</span>
              <span class="badge"
                    [class.badge-ok]="selectedDatasetRefresh()?.lastRefreshStatus === 'Completed'"
                    [class.badge-no]="selectedDatasetRefresh()?.lastRefreshStatus === 'Failed'"
                    style="font-size:10px;">
                {{ selectedDatasetRefresh()?.lastRefreshStatus || 'Unknown' }}
              </span>
            </div>

            <div *ngIf="selectedDatasetRefresh()?.scheduleEnabled && selectedDatasetRefresh()?.scheduleTimes?.length" style="margin-bottom:6px;">
              <div>
                <strong>Scheduled Times:</strong> {{ selectedDatasetRefresh()?.scheduleTimes?.join(', ') }} ({{ selectedDatasetRefresh()?.timeZone || 'UTC' }}) ·
                <span class="muted">{{ selectedDatasetRefresh()?.scheduleDays?.join(', ') || 'Daily' }}</span>
              </div>
            </div>

            <div style="margin-top:4px; padding:6px 8px; border-radius:4px; font-size:11px;"
                 [style.background]="cronValidation().type === 'warning' ? '#fef3c7' : (cronValidation().type === 'success' ? '#f0fdf4' : 'var(--card)')"
                 [style.color]="cronValidation().type === 'warning' ? '#92400e' : (cronValidation().type === 'success' ? '#166534' : 'var(--muted)')"
                 [style.border]="cronValidation().type === 'warning' ? '1px solid #fde68a' : (cronValidation().type === 'success' ? '1px solid #bbf7d0' : '1px solid var(--border)')">
              {{ cronValidation().message }}
            </div>

            <button class="btn-secondary"
                    *ngIf="selectedDatasetRefresh()?.scheduleTimes?.length"
                    (click)="autoSetSafeCron()"
                    type="button"
                    style="margin-top:8px; font-size:11px; padding:4px 8px; width:100%;">
              Auto-Set Safe Cron (+30m after refresh)
            </button>
          </div>

          <!-- Schedule Pipeline Execution Summary Box -->
          <div style="margin-top:12px; padding:10px 12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:var(--radius-sm); font-size:12px;">
            <strong style="color:var(--text);">Scheduled Execution Pipeline -</strong>
            <div style="display:flex; flex-wrap:wrap; gap:16px; margin-top:6px; font-size:12px;">
              <div>
                <span class="muted">Database Sync -</span>
                <strong> {{ tableName || '(enter table name)' }}</strong> ({{ writeMode }})
              </div>
              <div>
                <span class="muted">Email Delivery -</span>
                <strong *ngIf="recipients.trim()"> {{ recipients.split(',').length }} recipient(s)</strong>
                <span *ngIf="!recipients.trim()" class="muted"> None (DB sync only)</span>
              </div>
            </div>
          </div>

          <div class="row-between" style="margin-top:14px;">
            <span class="muted" style="font-size:11px;">e.g. <code>0 6 * * *</code> daily</span>
            <button class="btn-primary" (click)="saveJob()" [disabled]="busy() || targetLocked() || !jobName.trim()">
              Save Recurring Schedule
            </button>
          </div>
        </div>

        <div class="wizard-footer row-between">
          <button class="btn-secondary" (click)="setStep(3)">‹ Back</button>
          <button class="btn-primary" (click)="setStep(1)">Finish</button>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    /* Only component-level overrides needed here — global styles.css handles the rest */
    :host { display: block; }

    /* Subtle step connector line between steps */
    .wizard-header { gap: 4px; }
    .step-connector {
      flex: 1; height: 1px;
      background: linear-gradient(90deg, var(--border2), var(--border));
      max-width: 40px;
    }

    /* Table header filter popover */
    .th-header-cell {
      display: flex; align-items: center; justify-content: space-between; gap: 8px; user-select: none;
    }
    .th-title {
      font-size: 13px; font-weight: 700; color: #1d4ed8; white-space: nowrap;
    }
    .th-arrow-btn {
      font-size: 12px; color: #93c5fd; transition: transform 0.15s, color 0.15s; display: inline-block;
      opacity: 0.7;
    }
    .th-arrow-btn.open { transform: rotate(180deg); color: #1d6ef5; opacity: 1; }
    .th-arrow-btn.filtered { color: #1d6ef5; opacity: 1; font-weight: 900; }

    .filter-popover {
      position: fixed; margin-top: 0;
      min-width: 230px; max-width: 290px; background: #ffffff;
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
    .popover-option input[type="checkbox"] { accent-color: #1d6ef5; cursor: pointer; flex-shrink: 0; }
    .popover-option span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .popover-field { margin-bottom: 8px; text-align: left; }
    .popover-field label { display: block; font-size: 11px; font-weight: 600; color: #374151; margin-bottom: 2px; }
    .popover-field input { font-size: 12px; padding: 5px 8px; border: 1.5px solid #93c5fd; border-radius: 6px; width: 100%; }
    .popover-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; border-top: 1px solid #dbeafe; padding-top: 10px; }
    .btn-popover-main { background: #1d6ef5; color: #fff; border: none; padding: 5px 14px; border-radius: 7px; font-size: 12px; font-weight: 600; cursor: pointer; }
    .btn-popover-sub { background: #ffffff; color: #374151; border: 1.5px solid #93c5fd; padding: 5px 14px; border-radius: 7px; font-size: 12px; font-weight: 600; cursor: pointer; }

    /* Table cell values */
    td { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    /* Compact scroll list row hover */
    .scroll-list .report-row:hover { background: #f0f4ff; }
    .scroll-list .report-row.active {
      background: var(--accent-light);
      color: var(--accent);
      border-left: 3px solid var(--accent);
      font-weight: 600;
    }
  `],
})
export class UploadComponent implements OnInit {
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

  // ── Multi-table ───────────────────────────────────────────────────
  tables = signal<string[]>([]);
  tableFilter = signal('');
  selectedTables = signal<string[]>([]);
  showAllTables = false;

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
  /** 'total' | 'delta' | 'append' | 'upsert' */
  writeMode: 'total' | 'delta' | 'append' | 'upsert' = 'append';
  keySelected = signal<Record<string, boolean>>({});

  // ── Delta / date filter ───────────────────────────────────────────
  deltaDateCol = '';
  deltaSince = '';
  lastSyncAt = signal<string | null>(null);
  writeDateCol = '';
  writeYearFrom: number | null = null;
  writeYearTo: number | null = null;
  writeDateFrom = '';
  writeDateTo = '';

  // ── Custom column write selection ─────────────────────────────────
  customColumns = false;
  writeColSelected = signal<Record<string, boolean>>({});

  jobName = '';
  cron = '';
  jobRecipients = '';
  jobEmailSubject = '';
  recipients = '';
  emailSubject = '';

  busy = signal(false);
  datasets = signal<DynamicDataset[]>([]);
  datasetEmails: Record<string, string> = {};
  previewTable = signal('');
  previewCols = signal<string[]>([]);
  previewRows = signal<any[]>([]);

  // ── Dataset Refresh Schedules ─────────────────────────────────────
  refreshSchedules = signal<DatasetRefreshInfo[]>([]);
  selectedDatasetRefresh = computed(() => {
    const dsId = this.selectedReport()?.datasetId;
    if (!dsId) return null;
    return this.refreshSchedules().find((s) => s.datasetId === dsId) || null;
  });

  downloadTooltipText = computed(() => {
    const rep = this.selectedReport();
    const refresh = this.selectedDatasetRefresh();
    if (!rep) return 'Download current data as an Excel (.xlsx) spreadsheet.';

    const lines: string[] = [];
    lines.push(`Dashboard / Report - ${rep.name}`);
    if (rep.workspaceName) {
      lines.push(`Workspace - ${rep.workspaceName}`);
    }

    if (refresh) {
      if (refresh.lastRefreshStartTime) {
        const timeStr = new Date(refresh.lastRefreshStartTime).toLocaleString();
        lines.push(`Last Data Refresh - ${refresh.lastRefreshStatus || 'Completed'} (${timeStr})`);
      } else {
        lines.push(`Last Data Refresh - No refresh history recorded`);
      }

      if (refresh.scheduleEnabled && refresh.scheduleTimes?.length) {
        lines.push(`Power BI Refresh Schedule - ${refresh.scheduleTimes.join(', ')} (${refresh.timeZone || 'UTC'}) - ${refresh.scheduleDays?.join(', ') || 'Daily'}`);
      } else {
        lines.push(`Power BI Refresh Schedule - Manual / Not Scheduled`);
      }
    } else {
      lines.push(`Data Refresh - Refresh details not configured`);
    }

    lines.push(`Ready to download ${this.filteredLoadedRows().length} row(s) as Excel (.xlsx) file`);
    return lines.join('\n');
  });

  cronValidation = computed(() => {
    const s = this.selectedDatasetRefresh();
    const c = (this.cron || '').trim();
    if (!s || !s.scheduleEnabled || !s.scheduleTimes?.length) {
      return { type: 'none', message: 'No automated Power BI refresh schedule detected for this dataset.' };
    }
    if (!c) {
      return {
        type: 'info',
        message: `Dataset refreshes at ${s.scheduleTimes.join(', ')} (${s.timeZone || 'UTC'}). Schedule this job at least 30m after refresh.`,
      };
    }

    const parts = c.split(/\s+/);
    if (parts.length >= 2) {
      const min = parseInt(parts[0], 10);
      const hr = parseInt(parts[1], 10);
      if (!isNaN(hr)) {
        for (const t of s.scheduleTimes) {
          const [refHrStr, refMinStr] = t.split(':');
          const refHr = parseInt(refHrStr, 10);
          const refMin = parseInt(refMinStr || '0', 10);
          if (!isNaN(refHr)) {
            // Check if cron matches exact refresh hour or within 15 minutes
            if (hr === refHr && (!isNaN(min) ? min <= refMin + 15 : true)) {
              return {
                type: 'warning',
                message: `Warning: Cron runs at ${t} (${s.timeZone || 'UTC'}) right as Power BI refresh begins. Power BI refreshes take 5-15 mins. Schedule at least +30m later to prevent extracting stale/partial data.`,
              };
            }
          }
        }
      }
    }
    return {
      type: 'success',
      message: `Validated: Job schedule is aligned after Power BI dataset refresh (${s.scheduleTimes.join(', ')} ${s.timeZone || 'UTC'}).`,
    };
  });

  autoSetSafeCron() {
    const s = this.selectedDatasetRefresh();
    if (!s || !s.scheduleTimes?.length) {
      this.cron = '0 6 * * *';
      this.toast.success('Set default safe schedule: daily at 06:00 UTC.');
      return;
    }
    const firstTime = s.scheduleTimes[0];
    const [hrStr, minStr] = firstTime.split(':');
    let hr = parseInt(hrStr, 10) || 0;
    let min = parseInt(minStr || '0', 10) || 0;

    min += 30;
    if (min >= 60) {
      min -= 60;
      hr = (hr + 1) % 24;
    }
    this.cron = `${min} ${hr} * * *`;
    this.toast.success(`Auto-configured safe cron: "${this.cron}" (+30m after Power BI ${firstTime} refresh).`);
  }

  // ── Column filters (Step 3) ───────────────────────────────────────
  colFilters = signal<Record<string, string[]>>({});
  colFilterFrom = signal<Record<string, string>>({});
  colFilterTo = signal<Record<string, string>>({});
  activeFilterCol = signal<string | null>(null);
  popoverPos = signal<{ top: number; left: number }>({ top: 0, left: 0 });
  popoverSearch: Record<string, string> = {};

  // ── Database management ───────────────────────────────────────────
  databases = signal<DbConnection[]>([]);
  showDbForm = signal(false);
  newDb: NewDbDto & { label?: string; port?: number } = { host: '', port: 5432, dbname: '', username: '', password: '' };
  dbTestState = signal<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  dbTestError = signal('');

  // ── Computed ──────────────────────────────────────────────────────
  filterSig = signal('');
  filteredReports = computed(() => {
    const f = this.filterSig().trim().toLowerCase();
    const isUsage = (name: string) => {
      const lower = (name || '').toLowerCase();
      return lower.includes('usage metric') || lower.includes('report usage') || lower.includes('usage metrics');
    };
    const list = this.reports().filter((r) => !isUsage(r.name));
    if (!f) return list;
    return list.filter(
      (r) =>
        (r.name || '').toLowerCase().includes(f) ||
        (r.workspaceName || '').toLowerCase().includes(f),
    );
  });
  pagedReports = computed(() =>
    this.filteredReports().slice(this.repPage() * this.pageSize, (this.repPage() + 1) * this.pageSize),
  );
  filteredTables = computed(() => {
    const f = this.tableFilter().trim().toLowerCase();
    const list = this.tables();
    return f ? list.filter((t) => (t || '').toLowerCase().includes(f)) : list;
  });

  /** All columns across ALL selected tables. */
  activeColumns = computed(() => {
    const sel = this.selectedTables();
    if (sel.length === 0) return [];
    return this.columns().filter((c) => sel.includes(c.table));
  });

  filteredColumns = computed(() => {
    const f = this.columnFilter().trim().toLowerCase();
    const cols = this.activeColumns();
    return f ? cols.filter((c) => (c.name || '').toLowerCase().includes(f) || (c.table || '').toLowerCase().includes(f)) : cols;
  });
  filteredMeasures = computed(() => {
    const f = this.measureFilter().trim().toLowerCase();
    const m = this.measures();
    return f ? m.filter((x) => (x.name || '').toLowerCase().includes(f)) : m;
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

  // ── Column filters computed ───────────────────────────────────────
  filteredLoadedRows = computed(() => {
    let rows = this.loadedRows();
    const cf = this.colFilters();
    const cfFrom = this.colFilterFrom();
    const cfTo = this.colFilterTo();
    for (const col of Object.keys(cf)) {
      const vals = cf[col];
      if (vals && vals.length > 0) {
        const set = new Set(vals);
        rows = rows.filter((r) => set.has(String(r[col] ?? '')));
      }
    }
    for (const col of Object.keys(cfFrom)) {
      const from = cfFrom[col];
      if (from) rows = rows.filter((r) => {
        const rv = r[col];
        return rv && new Date(rv) >= new Date(from);
      });
    }
    for (const col of Object.keys(cfTo)) {
      const to = cfTo[col];
      if (to) rows = rows.filter((r) => {
        const rv = r[col];
        return rv && new Date(rv) <= new Date(to + 'T23:59:59');
      });
    }
    return rows;
  });
  hasActiveColFilters = computed(() => {
    const cf = this.colFilters();
    const cfFrom = this.colFilterFrom();
    const cfTo = this.colFilterTo();
    return (
      Object.values(cf).some((vs) => vs && vs.length > 0) ||
      Object.values(cfFrom).some((v) => !!v) ||
      Object.values(cfTo).some((v) => !!v)
    );
  });
  filteredPageCount = computed(() =>
    Math.max(1, Math.ceil(this.filteredLoadedRows().length / this.pageSize)),
  );
  pagedRows = computed(() =>
    this.filteredLoadedRows().slice(this.page() * this.pageSize, (this.page() + 1) * this.pageSize),
  );

  // ── Date-col detection for loaded data ───────────────────────────
  loadedDateCols = computed(() =>
    this.loadedCols().filter((c) => {
      const sample = this.loadedRows().find((r) => r[c] != null)?.[c];
      if (sample == null) return false;

      // Exclude numbers or numeric strings (e.g. 100, 10.5, "100")
      if (typeof sample === 'number') return false;
      const str = String(sample).trim();
      if (/^-?\d+(\.\d+)?$/.test(str)) return false;

      // Check if name matches date keywords or string matches ISO/date format
      if (/(?:_at|_on|date|time|timestamp)$/i.test(c) || /\b(date|datetime|time|timestamp)\b/i.test(c)) return true;
      if (/^\d{4}-\d{2}-\d{2}/.test(str)) return true;
      if (sample instanceof Date) return true;

      return false;
    }),
  );

  // ── Rows to actually write (after delta/date/custom filtering) ────
  writeRows = computed(() => {
    let rows = this.loadedRows();

    // Delta filter: keep only rows whose date col >= deltaSince
    if (this.writeMode === 'delta' && this.deltaDateCol && this.deltaSince) {
      const since = new Date(this.deltaSince);
      rows = rows.filter((r) => {
        const v = r[this.deltaDateCol];
        return v && new Date(v) >= since;
      });
    }

    // Year / date filter
    if (this.writeDateCol) {
      if (this.writeYearFrom) {
        rows = rows.filter((r) => {
          const v = r[this.writeDateCol]; if (!v) return false;
          return new Date(v).getFullYear() >= (this.writeYearFrom ?? 0);
        });
      }
      if (this.writeYearTo) {
        rows = rows.filter((r) => {
          const v = r[this.writeDateCol]; if (!v) return false;
          return new Date(v).getFullYear() <= (this.writeYearTo ?? 9999);
        });
      }
      if (this.writeDateFrom) {
        const from = new Date(this.writeDateFrom);
        rows = rows.filter((r) => { const v = r[this.writeDateCol]; return v && new Date(v) >= from; });
      }
      if (this.writeDateTo) {
        const to = new Date(this.writeDateTo + 'T23:59:59');
        rows = rows.filter((r) => { const v = r[this.writeDateCol]; return v && new Date(v) <= to; });
      }
    }

    // Custom column projection
    if (this.customColumns) {
      const sel = this.writeColSelected();
      const cols = Object.keys(sel).filter((c) => sel[c]);
      if (cols.length > 0) {
        rows = rows.map((r) => {
          const out: Record<string, any> = {};
          for (const c of cols) out[c] = r[c];
          return out;
        });
      }
    }

    return rows;
  });

  constructor(
    public api: SyncApiService,
    private toast: ToastService,
  ) {}

  ngOnInit() {
    this.loadReports();
    this.loadDatasets();
    this.loadDatabases();
    this.loadRefreshSchedules();
  }

  loadRefreshSchedules() {
    this.api.refreshSchedules().subscribe({
      next: (s) => this.refreshSchedules.set(s || []),
      error: () => {},
    });
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
    this.selectedTables.set([]);
    this.selected.set({});
    this.loadedRows.set([]);
    this.loadedCols.set([]);
    this.colError.set('');
    if (!r.datasetId) {
      this.colError.set('This report has no dataset to read columns from.');
      return;
    }
    this.api.datasetMeasures(r.datasetId).subscribe({
      next: (m) => this.measures.set(m),
      error: () => this.measures.set([]),
    });
    this.loadingCols.set(true);
    this.api.datasetColumns(r.datasetId, this.finalOnly && !this.showAllTables, this.showAllTables).subscribe({
      next: (cols) => {
        this.columns.set(cols);
        const counts = new Map<string, number>();
        for (const c of cols) counts.set(c.table, (counts.get(c.table) ?? 0) + 1);
        const tbls = Array.from(counts.keys());
        if (this.finalOnly && !this.showAllTables) {
          tbls.sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
        } else {
          tbls.sort();
        }
        this.tables.set(tbls);
        // Auto-select first table.
        if (tbls.length > 0) {
          this.selectedTables.set([tbls[0]]);
          this.resetSelection();
        }
        this.loadingCols.set(false);
      },
      error: (e) => {
        this.colError.set(this.msg(e));
        this.loadingCols.set(false);
      },
    });
  }

  reloadColumnsForHiddenToggle() {
    const rep = this.selectedReport();
    if (rep) this.pickReport(rep);
  }

  toggleTable(t: string) {
    const cur = this.selectedTables();
    if (cur.includes(t)) {
      this.selectedTables.set(cur.filter((x) => x !== t));
    } else {
      this.selectedTables.set([...cur, t]);
    }
    this.loadedRows.set([]);
    this.loadedCols.set([]);
    this.resetSelection();
  }

  private resetSelection() {
    const sel: Record<string, boolean> = {};
    const keys: Record<string, boolean> = {};
    const wc: Record<string, boolean> = {};
    let hasKey = false;
    for (const c of this.activeColumns()) {
      sel[c.name] = true;
      wc[c.name] = true;
      if (c.isKey) { keys[c.name] = true; hasKey = true; }
    }
    this.selected.set(sel);
    this.keySelected.set(keys);
    this.writeColSelected.set(wc);
    this.writeMode = hasKey ? 'upsert' : 'append';
    this.tableName = this.suggestName();
    this.page.set(0);
    this.dateColumn.set('');
    this.dateFrom.set('');
    this.dateTo.set('');
    this.colFilters.set({});
    this.colFilterFrom.set({});
    this.colFilterTo.set({});
  }

  private effectiveLimit(): number { return this.allRows() ? 0 : this.limit; }
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

  uniqueValues(col: string): string[] {
    const seen = new Set<string>();
    for (const r of this.loadedRows()) {
      const v = r[col];
      if (v != null && String(v).trim() !== '') seen.add(String(v));
    }
    return Array.from(seen).sort().slice(0, 200);
  }

  isDateCol(col: string): boolean {
    return this.loadedDateCols().includes(col);
  }

  setColFilter(col: string, val: string) {
    this.colFilters.update((f) => ({ ...f, [col]: val ? [val] : [] }));
    this.page.set(0);
  }
  toggleColFilterValue(col: string, val: string) {
    this.colFilters.update((f) => {
      const cur = f[col] ?? [];
      const idx = cur.indexOf(val);
      const next = idx >= 0 ? cur.filter((v) => v !== val) : [...cur, val];
      return { ...f, [col]: next };
    });
    this.page.set(0);
  }
  clearSingleColValues(col: string) {
    this.colFilters.update((f) => ({ ...f, [col]: [] }));
    this.page.set(0);
  }
  isValueSelected(col: string, val: string): boolean {
    return (this.colFilters()[col] ?? []).includes(val);
  }
  isColFiltered(col: string): boolean {
    return (
      ((this.colFilters()[col] ?? []).length > 0) ||
      !!this.colFilterFrom()[col] ||
      !!this.colFilterTo()[col]
    );
  }
  setColFilterFrom(col: string, val: string) {
    this.colFilterFrom.update((f) => ({ ...f, [col]: val }));
    this.page.set(0);
  }
  setColFilterTo(col: string, val: string) {
    this.colFilterTo.update((f) => ({ ...f, [col]: val }));
    this.page.set(0);
  }
  clearColFilters() {
    this.colFilters.set({});
    this.colFilterFrom.set({});
    this.colFilterTo.set({});
    this.page.set(0);
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  @HostListener('document:click')
  closePopovers() {
    this.activeFilterCol.set(null);
  }

  toggleHeaderFilter(col: string, ev: MouseEvent) {
    ev.stopPropagation();
    if (this.activeFilterCol() === col) {
      this.activeFilterCol.set(null);
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
    this.activeFilterCol.set(col);
  }
  clearSingleFilter(col: string, ev?: MouseEvent) {
    if (ev) ev.stopPropagation();
    this.colFilters.update((f) => ({ ...f, [col]: [] }));
    this.colFilterFrom.update((f) => ({ ...f, [col]: '' }));
    this.colFilterTo.update((f) => ({ ...f, [col]: '' }));
    this.page.set(0);
  }

  filteredUniqueValues(col: string): string[] {
    const vals = this.uniqueValues(col);
    const q = (this.popoverSearch[col] || '').trim().toLowerCase();
    return q ? vals.filter((v) => v.toLowerCase().includes(q)) : vals;
  }

  private slugTable(raw: string): string {
    let s = (raw ?? '').toString().trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
    if (!s) return '';
    if (/^[0-9]/.test(s)) s = '_' + s;
    return s.slice(0, 60);
  }
  targetTableName(): string { return this.slugTable(this.tableName); }
  targetLocked(): boolean {
    const t = this.targetTableName();
    return !!t && this.datasets().some((d) => d.table_name === t && d.locked);
  }
  autoKeyNote(): string {
    return this.activeColumns().some((c) => c.isKey) ? ' · auto-detected from the model' : '';
  }
  private suggestName(): string {
    const tbls = this.selectedTables();
    return `${this.selectedReport()?.name ?? ''} ${tbls.join('_')}`
      .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
  }

  toggle(name: string) {
    const willInclude = !this.selected()[name];
    this.selected.update((s) => ({ ...s, [name]: willInclude }));
    if (!willInclude && this.keySelected()[name]) {
      this.keySelected.update((s) => ({ ...s, [name]: false }));
      this.syncModeToKeys();
    }
  }
  toggleMeasure(name: string) {
    this.measureSelected.update((s) => ({ ...s, [name]: !s[name] }));
  }
  toggleKeyCol(name: string) {
    const willBeKey = !this.keySelected()[name];
    this.keySelected.update((s) => ({ ...s, [name]: willBeKey }));
    if (willBeKey) this.selected.update((s) => ({ ...s, [name]: true }));
    this.syncModeToKeys();
  }
  private syncModeToKeys() {
    if (this.writeMode === 'upsert' || this.writeMode === 'append') {
      this.writeMode = this.selectedKeyNames().length > 0 ? 'upsert' : 'append';
    }
  }
  toggleAll(ev: Event) {
    const on = (ev.target as HTMLInputElement).checked;
    const sel: Record<string, boolean> = { ...this.selected() };
    for (const c of this.activeColumns()) sel[c.name] = on;
    this.selected.set(sel);
  }
  toggleWriteCol(name: string) {
    this.writeColSelected.update((s) => ({ ...s, [name]: !s[name] }));
  }

  prevPage() { this.page.update((p) => Math.max(0, p - 1)); }
  nextPage() { this.page.update((p) => Math.min(this.filteredPageCount() - 1, p + 1)); }

  useLast() {
    const s = this.lastSyncAt();
    if (s) this.deltaSince = s.slice(0, 10);
  }

  sync() {
    const rep = this.selectedReport();
    if (!rep?.datasetId) return;
    if (this.selectedTables().length === 0) {
      this.toast.error('Select at least one table.');
      return;
    }
    this.busy.set(true);
    this.api
      .reportData(
        rep.datasetId,
        this.selectedTables(),
        this.selectedNames(),
        this.effectiveLimit(),
        this.filterPayload(),
        this.selectedMeasureNames(),
      )
      .subscribe({
        next: (rows) => {
          this.loadedRows.set(rows);
          this.loadedCols.set(rows.length ? Object.keys(rows[0]) : this.selectedNames());
          // Reset write col selection to match new columns
          const wc: Record<string, boolean> = {};
          for (const c of (rows.length ? Object.keys(rows[0]) : this.selectedNames())) wc[c] = true;
          this.writeColSelected.set(wc);
          this.page.set(0);
          this.colFilters.set({});
          this.colFilterFrom.set({});
          this.colFilterTo.set({});
          this.busy.set(false);
          this.toast.success(`Synced ${rows.length} row(s) from Power BI.`);
          this.currentStep.set(3);
          // Load last-sync date for delta mode
          if (this.tableName) {
            this.api.getLastSync(this.targetTableName()).subscribe({
              next: (r) => this.lastSyncAt.set(r.lastSyncAt),
              error: () => {},
            });
          }
        },
        error: (e) => this.fail(e),
      });
  }

  nextFromStep2() {
    if (this.loadedRows().length || this.loadedCols().length) {
      this.setStep(3);
    } else {
      this.sync();
    }
  }

  syncAndEmailFromStep2() {
    const list = this.recipients
      ? this.recipients.split(',').map((e) => e.trim()).filter((e) => e)
      : [];
    if (list.length === 0) {
      this.toast.error('Please enter at least one recipient email address.');
      return;
    }
    const rep = this.selectedReport();
    if (!rep?.datasetId) return;

    this.busy.set(true);
    this.api
      .reportData(
        rep.datasetId,
        this.selectedTables(),
        this.selectedNames(),
        this.effectiveLimit(),
        this.filterPayload(),
        this.selectedMeasureNames(),
      )
      .subscribe({
        next: (rows) => {
          this.loadedRows.set(rows);
          this.loadedCols.set(rows.length ? Object.keys(rows[0]) : this.selectedNames());
          const reportName = rep.name || 'Power BI Report';
          const subject = this.emailSubject.trim() || `Excel Report Export: ${reportName}`;

          this.api
            .sendEmailReport({
              reportName,
              rows,
              recipients: list,
              subject,
            })
            .subscribe({
              next: (res) => {
                this.busy.set(false);
                this.toast.success(`Excel report with ${res.count} row(s) emailed to ${list.join(', ')}.`);
              },
              error: (e) => {
                this.busy.set(false);
                this.fail(e);
              },
            });
        },
        error: (e) => {
          this.busy.set(false);
          this.fail(e);
        },
      });
  }

  upload() {
    const rep = this.selectedReport();
    if (!rep) return;
    if ((this.writeMode === 'upsert') && this.selectedKeyNames().length === 0) {
      this.toast.error('Pick at least one business key for upsert.');
      return;
    }
    const rows = this.writeRows();
    if (rows.length === 0) {
      this.toast.error('No rows match the current filters — nothing to write.');
      return;
    }
    this.busy.set(true);
    const effectiveMode: 'append' | 'upsert' =
      this.writeMode === 'total' || this.writeMode === 'delta'
        ? (this.selectedKeyNames().length > 0 ? 'upsert' : 'append')
        : this.writeMode;

    this.api
      .uploadReport({
        reportName: `${rep.name} · ${this.selectedTables().join('+')}`,
        owner: this.owner || 'anonymous',
        rows,
        tableName: this.tableName,
        mode: effectiveMode,
        businessKeys: this.selectedKeyNames(),
      })
      .subscribe({
        next: (res) => {
          this.busy.set(false);
          this.toast.success(`Uploaded ${res.rowsWritten} row(s) to ${res.table} (now ${res.totalRows}).`);
          this.loadDatasets();
          this.lastSyncAt.set(new Date().toISOString());
        },
        error: (e) => this.fail(e),
      });
  }

  downloadExcelSheet() {
    const rows = this.writeRows().length ? this.writeRows() : this.filteredLoadedRows();
    if (rows.length === 0) {
      this.toast.error('No rows available to export.');
      return;
    }
    const rep = this.selectedReport();
    const reportName = rep ? rep.name : (this.tableName || 'Power_BI_Report');
    this.busy.set(true);
    this.api.exportExcel(reportName, rows).subscribe({
      next: (blob) => {
        this.busy.set(false);
        this.triggerBlobDownload(blob, `${this.safeSlug(reportName)}.xlsx`);
        this.toast.success(`Downloaded ${rows.length} row(s) as Excel sheet.`);
      },
      error: () => {
        // Fallback to client-side sheet download if backend endpoint is offline or 404
        this.busy.set(false);
        this.downloadCsvClientSide(reportName, rows);
      },
    });
  }

  private downloadCsvClientSide(reportName: string, rows: any[]) {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const csvLines: string[] = [headers.map((h) => JSON.stringify(h)).join(',')];
    for (const r of rows) {
      csvLines.push(headers.map((h) => JSON.stringify(r[h] ?? '')).join(','));
    }
    const csvContent = csvLines.join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    this.triggerBlobDownload(blob, `${this.safeSlug(reportName)}.csv`);
    this.toast.success(`Downloaded ${rows.length} row(s) as sheet.`);
  }

  private triggerBlobDownload(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  private safeSlug(name: string): string {
    return (name || 'report').replace(/[^a-zA-Z0-9_-]/g, '_') + '_' + new Date().toISOString().split('T')[0];
  }

  sendReportEmail() {
    const list = this.recipients
      ? this.recipients.split(',').map((e) => e.trim()).filter((e) => e)
      : [];
    if (list.length === 0) {
      this.toast.error('Please enter at least one recipient email address.');
      return;
    }
    const rows = this.writeRows();
    if (rows.length === 0) {
      this.toast.error('No rows available to send.');
      return;
    }

    const rep = this.selectedReport();
    const reportName = rep ? rep.name : (this.tableName || 'Power BI Report');
    const subject = this.emailSubject.trim() || `Excel Report Export: ${reportName}`;

    this.busy.set(true);
    this.api
      .sendEmailReport({
        reportName,
        rows,
        recipients: list,
        subject,
      })
      .subscribe({
        next: (res) => {
          this.busy.set(false);
          this.toast.success(`Excel report with ${res.count} row(s) emailed to ${list.join(', ')}.`);
        },
        error: (e) => {
          this.busy.set(false);
          this.fail(e);
        },
      });
  }

  saveJob() {
    const rep = this.selectedReport();
    if (!rep?.datasetId) return;
    if (!this.jobName.trim()) { this.toast.error('Give the job a name.'); return; }
    if (this.writeMode === 'upsert' && this.selectedKeyNames().length === 0) {
      this.toast.error('Pick at least one business key for upsert.'); return;
    }
    this.busy.set(true);
    this.api
      .createJob({
        name: this.jobName.trim(),
        reportName: rep.name,
        datasetId: rep.datasetId,
        sourceTable: this.selectedTables().join(','),
        columns: this.selectedNames(),
        measures: this.selectedMeasureNames(),
        targetTable: this.tableName,
        mode: this.writeMode === 'upsert' ? 'upsert' : 'append',
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
      next: (d) => { this.datasets.set(d); this.dsPage.set(0); },
      error: (e) => this.toast.error(this.msg(e)),
    });
  }

  preview(table: string) {
    if (this.previewTable() === table) { this.previewTable.set(''); return; }
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

  // ── Database management ───────────────────────────────────────────

  loadDatabases() {
    this.api.getDatabases().subscribe({
      next: (dbs) => this.databases.set(dbs),
      error: () => {},
    });
  }

  testDbConnection() {
    this.dbTestState.set('testing');
    this.dbTestError.set('');
    this.api.testDatabase({ ...this.newDb, port: this.newDb.port ?? 5432 }).subscribe({
      next: (r) => {
        if (r.ok) { this.dbTestState.set('ok'); }
        else { this.dbTestState.set('fail'); this.dbTestError.set(r.error ?? 'Connection failed'); }
      },
      error: (e) => { this.dbTestState.set('fail'); this.dbTestError.set(this.msg(e)); },
    });
  }

  createDatabase() {
    this.busy.set(true);
    this.api.addDatabase({ ...this.newDb, port: this.newDb.port ?? 5432 }).subscribe({
      next: (db) => {
        this.busy.set(false);
        this.toast.success(`Database "${db.dbname}" created & set as active!`);
        this.showDbForm.set(false);
        this.newDb = { host: '', port: 5432, dbname: '', username: '', password: '' };
        this.dbTestState.set('idle');
        this.loadDatabases();
      },
      error: (e) => this.fail(e),
    });
  }

  switchDatabase(id: number) {
    this.busy.set(true);
    this.api.activateDatabase(id).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.success('Active database switched.');
        this.loadDatabases();
      },
      error: (e) => this.fail(e),
    });
  }

  removeDatabase(id: number) {
    if (!confirm('Remove this database connection?')) return;
    this.busy.set(true);
    this.api.deleteDatabase(id).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.success('Connection removed.');
        this.loadDatabases();
      },
      error: (e) => this.fail(e),
    });
  }

  private fail(e: any) { this.busy.set(false); this.toast.error(this.msg(e)); }

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
      error: (e) => this.fail(e),
    });
  }

  private msg(e: any): string {
    return e?.error?.message || e?.message || 'Request failed';
  }
}
