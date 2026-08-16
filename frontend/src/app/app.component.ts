import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UploadComponent } from './upload.component';
import { JobsComponent } from './jobs.component';
import { DatasetsComponent } from './datasets.component';
import { ToastService } from './toast.service';
import { AuthService } from './auth/auth.service';
import { LoginComponent } from './auth/login/login.component';
import { SyncApiService, EmailLog } from './sync.service';
import { UsageComponent } from './usage.component';
import { UserDetailsComponent } from './user-details.component';

type Tab = 'final' | 'datasets' | 'all' | 'jobs' | 'history' | 'email-history' | 'usage' | 'user-details';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, UploadComponent, JobsComponent, DatasetsComponent, LoginComponent, UsageComponent, UserDetailsComponent],
  template: `
    <app-login *ngIf="!(auth.isAuthenticated$() | async)"></app-login>

    <ng-container *ngIf="auth.isAuthenticated$() | async">
      <div class="app-shell">

        <!-- Sidebar -->
        <aside class="sidebar">
          <!-- Brand Header -->
          <div class="sidebar-brand">
            <span>Power BI Portal</span>
          </div>

          <nav class="sidebar-nav">
            <!-- Usage Reports Group -->
            <div class="nav-group">
              <div class="nav-subitem" [class.active]="tab() === 'usage'" (click)="tab.set('usage'); usageExpanded.set(!usageExpanded())" style="justify-content: space-between;">
                <div style="display:flex; align-items:center; gap:9px;">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                  Usage Reports
                </div>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                     [style.transform]="usageExpanded() ? 'rotate(180deg)' : 'rotate(0)'" style="transition: transform 0.2s; flex-shrink:0; opacity:0.6;">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
              <div *ngIf="usageExpanded()" class="nav-subitem" [class.active]="tab() === 'user-details'" (click)="tab.set('user-details')" style="margin-top:2px; margin-left: 18px; padding-left: 12px; border-left: 1.5px solid var(--border); border-radius: 0 8px 8px 0; font-size: 12.5px;">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0; opacity: 0.8;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                User Details
              </div>
            </div>

            <!-- Reports Group -->
            <div class="nav-group" style="margin-top:8px;">
              <div class="nav-subitem" [class.active]="tab() === 'final'" (click)="tab.set('final')">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                Reports
              </div>
              <div class="nav-subitem" [class.active]="tab() === 'datasets'" (click)="tab.set('datasets')" style="margin-top:4px;">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M21 19c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14"></path><path d="M21 5v14"></path></svg>
                Stored Datasets
              </div>
            </div>

            <!-- Jobs Group -->
            <div class="nav-group" style="margin-top:8px;">
              <div class="nav-subitem" [class.active]="tab() === 'jobs'" (click)="tab.set('jobs')">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                Jobs &amp; Schedules
              </div>
              <div class="nav-subitem" [class.active]="tab() === 'email-history'" (click)="setTab('email-history')">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                Email History
              </div>
            </div>
          </nav>

          <!-- Sidebar footer -->
          <div class="sidebar-footer">
            <div class="sidebar-user">
              <div class="avatar" style="width:30px;height:30px;font-size:11px;flex-shrink:0;">PM</div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Pavithra M.</div>
                <div style="font-size:11px;color:var(--muted);">Admin</div>
              </div>
              <button class="icon-btn-circle" (click)="auth.logout()" title="Logout">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
              </button>
            </div>
          </div>
        </aside>

        <!-- Main area -->
        <div class="main-area">
          <!-- Top bar -->
          <header class="top-bar">
            <div class="top-bar-title">
              <span *ngIf="tab() === 'final'">Report Automation</span>
              <span *ngIf="tab() === 'datasets'">Stored Datasets</span>
              <span *ngIf="tab() === 'jobs'">Jobs &amp; Schedules</span>
              <span *ngIf="tab() === 'email-history'">Email History</span>
              <span *ngIf="tab() === 'usage'">Usage Reports</span>
              <span *ngIf="tab() === 'user-details'">User Details</span>
            </div>
            <div class="top-bar-right">
              <div class="user-chip">
                <div class="avatar" style="width:28px;height:28px;font-size:10px;">PM</div>
                <span>Pavithra Meddaduwage</span>
              </div>
            </div>
          </header>

          <main class="content-wrapper">
            <app-upload *ngIf="tab() === 'final'" [finalOnly]="true"></app-upload>
            <app-datasets *ngIf="tab() === 'datasets'"></app-datasets>
            <app-jobs *ngIf="tab() === 'jobs'"></app-jobs>
            <app-usage *ngIf="tab() === 'usage'"></app-usage>
            <app-user-details *ngIf="tab() === 'user-details'"></app-user-details>
            <div *ngIf="tab() === 'email-history'">
              <!-- SMTP Settings Card -->
              <div class="card" style="margin-bottom: 24px;">
                <div class="row-between" style="cursor: pointer;" (click)="showSmtpForm.set(!showSmtpForm())">
                  <div>
                    <h3 style="margin: 0; display:flex; align-items:center; gap:8px;">
                      ⚙️ Real Email Server (SMTP Configuration)
                      <span class="badge" [class.badge-ok]="smtpIsConfigured()" [class.badge-no]="!smtpIsConfigured()">
                        {{ smtpIsConfigured() ? 'SMTP Active' : 'Test Mode (Ethereal)' }}
                      </span>
                    </h3>
                    <div class="muted" style="font-size:12px; margin-top:2px;">
                      Configure your Gmail / Outlook / SMTP credentials so reports land directly in users' email inboxes.
                    </div>
                  </div>
                  <button class="btn-secondary" style="font-size:12px;">
                    {{ showSmtpForm() ? 'Hide Config ▲' : 'Configure SMTP ▼' }}
                  </button>
                </div>

                <div *ngIf="showSmtpForm()" style="margin-top: 16px; border-top: 1px solid var(--border); padding-top: 16px;">
                  <div class="grid2">
                    <label>SMTP Host
                      <input [(ngModel)]="smtpHost" placeholder="e.g. smtp.gmail.com" />
                    </label>
                    <label>Port
                      <input type="number" [(ngModel)]="smtpPort" placeholder="587" />
                    </label>
                  </div>
                  <div class="grid2" style="margin-top:10px;">
                    <label>Email / Username
                      <input [(ngModel)]="smtpUsername" placeholder="e.g. your-email@gmail.com" />
                    </label>
                    <label>App Password / Password
                      <input type="password" [(ngModel)]="smtpPassword" placeholder="16-character app password" />
                    </label>
                  </div>
                  <div style="margin-top:10px;">
                    <label>Sender Name &amp; Address (Optional)
                      <input [(ngModel)]="smtpFromAddress" placeholder='"Power BI Portal" <your-email@gmail.com>' />
                    </label>
                  </div>
                  <div class="row-between" style="margin-top: 16px;">
                    <div style="font-size:12px; color:var(--muted);">
                      💡 For Gmail: Use <strong>smtp.gmail.com</strong>, Port <strong>587</strong>, and generate a 16-character <strong>App Password</strong> in Google Security settings.
                    </div>
                    <button class="btn-primary" (click)="saveSmtpConfig()" [disabled]="savingSmtp() || !smtpHost || !smtpUsername">
                      <span *ngIf="savingSmtp()" class="spinner-white"></span>
                      Save &amp; Test Connection
                    </button>
                  </div>
                </div>
              </div>

              <!-- Email Delivery Logs Card -->
              <div class="card row-between" style="padding: 16px 24px; margin-bottom: 24px; display: flex; align-items: center;">
                <h3 style="margin: 0;">Email Delivery Logs</h3>
                <button class="btn-secondary" (click)="loadEmailLogs()" [disabled]="loadingEmailLogs()">Refresh</button>
              </div>

              <div class="card" style="padding: 0; overflow: hidden;">
                <table style="margin: 0;">
                  <thead>
                    <tr>
                      <th>Recipients</th>
                      <th>Subject &amp; File</th>
                      <th>Size</th>
                      <th>Status</th>
                      <th>Sent At</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let log of emailLogs()">
                      <td style="font-weight: 600; font-size: 12px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        {{ log.recipients }}
                      </td>
                      <td>
                        <div style="font-weight:600; color:var(--text);">{{ log.subject }}</div>
                        <div class="muted" style="font-size:11px;" *ngIf="log.file_name">📎 {{ log.file_name }}</div>
                      </td>
                      <td class="muted" style="white-space:nowrap;">
                        {{ ((log.file_size_bytes || 0) / 1024).toFixed(1) }} KB
                      </td>
                      <td>
                        <span class="badge" [class.badge-ok]="log.status.includes('sent')" [class.badge-no]="log.status === 'failed'">
                          {{ log.status }}
                        </span>
                      </td>
                      <td class="muted" style="white-space:nowrap;">
                        {{ log.sent_at | date: 'short' }}
                      </td>
                      <td>
                        <a *ngIf="log.preview_url" [href]="log.preview_url" target="_blank" class="btn-secondary" style="text-decoration:none; padding:4px 8px; font-size:11px;">
                          View Email ↗
                        </a>
                      </td>
                    </tr>
                    <tr *ngIf="emailLogs().length === 0">
                      <td colspan="6" class="placeholder" style="padding: 24px;">No email history recorded yet.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </main>
        </div>
      </div>
    </ng-container>

    <!-- Toasts -->
    <div class="toast-wrap">
      <div
        *ngFor="let t of toast.toasts()"
        class="toast"
        [class.toast-success]="t.type === 'success'"
        [class.toast-error]="t.type === 'error'"
        (click)="toast.dismiss(t.id)"
      >{{ t.text }}</div>
    </div>
  `,
  styles: [`
    .app-shell {
      display: flex;
      height: 100vh;
      overflow: hidden;
    }

    /* ── Sidebar ── */
    .sidebar {
      width: 224px;
      background: var(--card);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      z-index: 10;
    }

    .sidebar-brand {
      height: 58px;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      padding: 0 20px;
      font-weight: 700;
      font-size: 15px;
      color: var(--text);
      border-bottom: 1px solid var(--border);
    }

    .sidebar-nav {
      flex: 1;
      overflow-y: auto;
      padding: 16px 10px;
    }

    .nav-group-label {
      font-size: 11px;
      font-weight: 700;
      color: var(--text);
      opacity: 0.45;
      padding: 0 12px;
      margin-bottom: 4px;
    }

    .nav-subitem {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 8px 12px;
      color: var(--text);
      font-size: 13px;
      font-weight: 500;
      border-radius: 8px;
      cursor: pointer;
      margin-bottom: 1px;
      transition: all 0.12s;
    }
    .nav-subitem:hover { background: var(--bg); }
    .nav-subitem.active {
      background: var(--accent-light);
      color: var(--accent);
      font-weight: 600;
    }

    .sidebar-footer {
      padding: 14px 12px;
      border-top: 1px solid var(--border);
    }
    .sidebar-user {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 8px;
      background: var(--bg);
      border: 1px solid var(--border);
    }

    .top-bar {
      height: 58px;
      background: var(--card);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 32px;
      flex-shrink: 0;
      box-shadow: var(--shadow-xs);
    }
    .top-bar-title {
      font-size: 15px;
      font-weight: 700;
      color: var(--text);
    }
    .top-bar-right { display: flex; align-items: center; gap: 12px; }
    .user-chip {
      display: flex; align-items: center; gap: 8px;
      font-size: 13px; font-weight: 500; color: var(--text);
    }

    .main-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: var(--bg);
    }

    .content-wrapper {
      flex: 1;
      padding: 28px 36px;
      overflow-y: auto;
    }
  `]
})
export class AppComponent {
  tab = signal<Tab>('usage');
  usageExpanded = signal(false);
  reportsExpanded = signal(true);
  jobsExpanded = signal(true);
  toast = inject(ToastService);
  auth = inject(AuthService);
  api = inject(SyncApiService);

  emailLogs = signal<EmailLog[]>([]);
  loadingEmailLogs = signal(false);

  // SMTP Settings
  showSmtpForm = signal(false);
  smtpHost = '';
  smtpPort = 587;
  smtpUsername = '';
  smtpPassword = '';
  smtpFromAddress = '';
  smtpIsConfigured = signal(false);
  savingSmtp = signal(false);

  setTab(t: Tab) {
    this.tab.set(t);
    if (t === 'email-history') {
      this.loadEmailLogs();
      this.loadSmtpConfig();
    }
  }

  loadSmtpConfig() {
    this.api.getSmtpConfig().subscribe({
      next: (cfg) => {
        if (cfg) {
          this.smtpHost = cfg.host || '';
          this.smtpPort = cfg.port || 587;
          this.smtpUsername = cfg.username || '';
          this.smtpFromAddress = cfg.fromAddress || '';
          this.smtpIsConfigured.set(cfg.isConfigured);
        }
      },
    });
  }

  saveSmtpConfig() {
    if (!this.smtpHost.trim() || !this.smtpUsername.trim()) {
      this.toast.error('Host and Username are required.');
      return;
    }
    this.savingSmtp.set(true);
    this.api
      .saveSmtpConfig({
        host: this.smtpHost.trim(),
        port: this.smtpPort || 587,
        username: this.smtpUsername.trim(),
        password: this.smtpPassword.trim() || undefined,
        fromAddress: this.smtpFromAddress.trim() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.savingSmtp.set(false);
          this.smtpIsConfigured.set(true);
          this.toast.success(res.message || 'SMTP server connected successfully!');
          this.smtpPassword = '';
          this.showSmtpForm.set(false);
        },
        error: (err: any) => {
          this.savingSmtp.set(false);
          this.toast.error(err?.error?.message || err?.message || 'Failed to connect to SMTP server.');
        },
      });
  }

  loadEmailLogs() {
    this.loadingEmailLogs.set(true);
    this.api.emailHistory().subscribe({
      next: (logs: EmailLog[]) => {
        this.emailLogs.set(logs || []);
        this.loadingEmailLogs.set(false);
      },
      error: () => this.loadingEmailLogs.set(false),
    });
  }
}
